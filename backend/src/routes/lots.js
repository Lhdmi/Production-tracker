import { Router } from "express";
import { sql } from "drizzle-orm";
import { pool, db } from "../db/client.js";
import { lots, weights } from "../db/schema.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();
router.use(authenticate);

const VALID_STATUSES = ["in_progress", "completed", "anomaly"];

function canManageLot(user, lot) {
  return user.role === "admin" || user.role === "manager" || lot.createdBy === user.id;
}

async function getLotRow(id) {
  const { rows } = await db.execute(
    sql`
      SELECT l.id, l.lot_number AS "lotNumber", l.status, l.created_at AS "createdAt",
             l.updated_at AS "updatedAt", l.completed_at AS "completedAt",
             l.op_id AS "opId", o.op_number AS "opNumber",
             u.name AS "createdByName", u.id AS "createdById"
      FROM lots l
      JOIN ops o ON o.id = l.op_id
      LEFT JOIN users u ON u.id = l.created_by
      WHERE l.id = ${id}
      LIMIT 1
    `
  );
  return rows[0];
}

async function getWeights(lotId) {
  const { rows } = await db.execute(
    sql`
      SELECT w.id, w.weight::float8 AS "weight", w.created_at AS "createdAt",
             u.name AS "createdByName"
      FROM weights w
      LEFT JOIN users u ON u.id = w.created_by
      WHERE w.lot_id = ${lotId}
      ORDER BY w.created_at DESC, w.id DESC
    `
  );
  return rows;
}

async function getAnomalies(lotId) {
  const { rows } = await db.execute(
    sql`
      SELECT a.id, a.type, a.description, a.severity, a.status, a.comment,
             a.created_at AS "createdAt", a.validated_at AS "validatedAt",
             u.name AS "createdByName", v.name AS "validatedByName",
             (SELECT array_agg(json_build_object('id', p.id, 'url', p.url)) FROM photos p WHERE p.anomaly_id = a.id) AS photos
      FROM anomalies a
      LEFT JOIN users u ON u.id = a.created_by
      LEFT JOIN users v ON v.id = a.validated_by
      WHERE a.lot_id = ${lotId}
      ORDER BY a.created_at DESC, a.id DESC
    `
  );
  return rows.map((r) => ({ ...r, photos: r.photos || [] }));
}

router.get("/", async (req, res, next) => {
  try {
    const q = (req.query.q || "").toString().trim();
    const status = (req.query.status || "").toString().trim();
    const date = (req.query.date || "").toString().trim();
    const mine = req.query.mine === "true";
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || "25", 10)));

    const where = [];
    const params = [];
    if (mine) {
      params.push(req.user.id);
      where.push(`l.created_by = $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      where.push(`(o.op_number ILIKE $${params.length} OR l.lot_number ILIKE $${params.length} OR u.name ILIKE $${params.length})`);
    }
    if (VALID_STATUSES.includes(status)) {
      params.push(status);
      where.push(`l.status = $${params.length}`);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      params.push(date);
      where.push(`l.created_at::date = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const { rows } = await pool.query(`
      SELECT l.id, l.lot_number AS "lotNumber", l.status, l.created_at AS "createdAt",
             l.updated_at AS "updatedAt", l.completed_at AS "completedAt",
             o.op_number AS "opNumber", u.name AS "createdByName",
             (SELECT count(*)::int FROM weights w WHERE w.lot_id = l.id) AS "weightCount",
             (SELECT COALESCE(sum(w.weight),0)::float8 FROM weights w WHERE w.lot_id = l.id) AS "weightSum",
             (SELECT count(*)::int FROM anomalies a WHERE a.lot_id = l.id AND a.status = 'open') AS "openAnomalyCount"
      FROM lots l
      JOIN ops o ON o.id = l.op_id
      LEFT JOIN users u ON u.id = l.created_by
      ${whereSql}
      ORDER BY l.id DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, pageSize, (page - 1) * pageSize]);

    const total = parseInt(
      (await pool.query(`
        SELECT count(*)::int AS total
        FROM lots l
        JOIN ops o ON o.id = l.op_id
        LEFT JOIN users u ON u.id = l.created_by
        ${whereSql}
      `, params)).rows[0].total,
      10
    );

    res.json({ rows, total, page, pageSize });
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const opNumber = (req.body?.opNumber || "").toString().trim().toUpperCase();
    const lotNumber = (req.body?.lotNumber || "").toString().trim();
    if (!opNumber || !lotNumber) {
      return res.status(400).json({ error: "Numéro d'OP et numéro de lot requis" });
    }

    let op = (await db.execute(sql`SELECT * FROM ops WHERE op_number = ${opNumber} LIMIT 1`)).rows[0];
    if (!op) {
      op = (await db.execute(sql`INSERT INTO ops (op_number, created_by) VALUES (${opNumber}, ${req.user.id}) RETURNING *`)).rows[0];
    }

    const dup = (await db.execute(
      sql`SELECT l.id FROM lots l WHERE l.op_id = ${op.id} AND l.lot_number = ${lotNumber} LIMIT 1`
    )).rows[0];
    if (dup) {
      return res.status(409).json({ error: "Ce lot existe déjà pour cette OP", id: dup.id });
    }

    const [created] = await db
      .insert(lots)
      .values({ opId: op.id, lotNumber, createdBy: req.user.id })
      .returning();

    const row = await getLotRow(created.id);
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const row = await getLotRow(id);
    if (!row) return res.status(404).json({ error: "Lot introuvable" });
    const [lotWeights, lotAnomalies] = await Promise.all([getWeights(id), getAnomalies(id)]);
    res.json({ ...row, weights: lotWeights, anomalies: lotAnomalies });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", authorize("operator", "manager", "admin"), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [lot] = await db.select().from(lots).where(sql`${lots.id} = ${id}`).limit(1);
    if (!lot) return res.status(404).json({ error: "Lot introuvable" });
    if (!canManageLot(req.user, lot)) {
      return res.status(403).json({ error: "Vous ne pouvez modifier que vos propres lots" });
    }
    const { status } = req.body || {};
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: "Statut invalide" });
    }
    const updates = {
      status,
      updatedAt: new Date(),
      completedAt: status === "completed" ? new Date() : null
    };
    await db.update(lots).set(updates).where(sql`${lots.id} = ${id}`);
    res.json(await getLotRow(id));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", authorize("manager", "admin"), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [lot] = await db.select().from(lots).where(sql`${lots.id} = ${id}`).limit(1);
    if (!lot) return res.status(404).json({ error: "Lot introuvable" });
    await db.delete(lots).where(sql`${lots.id} = ${id}`);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.post("/:id/weights", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [lot] = await db.select().from(lots).where(sql`${lots.id} = ${id}`).limit(1);
    if (!lot) return res.status(404).json({ error: "Lot introuvable" });
    if (!canManageLot(req.user, lot)) {
      return res.status(403).json({ error: "Vous ne pouvez modifier que vos propres lots" });
    }
    const weight = Number(req.body?.weight);
    if (!Number.isFinite(weight) || weight <= 0) {
      return res.status(400).json({ error: "Poids invalide" });
    }
    await db.insert(weights).values({ lotId: id, weight: weight.toFixed(3), createdBy: req.user.id });
    if (lot.status === "completed") {
      await db
        .update(lots)
        .set({ status: "in_progress", updatedAt: new Date(), completedAt: null })
        .where(sql`${lots.id} = ${id}`);
    }
    const [newRow] = await getWeights(id);
    res.status(201).json(newRow);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id/weights/:weightId", async (req, res, next) => {
  try {
    const lotId = parseInt(req.params.id, 10);
    const weightId = parseInt(req.params.weightId, 10);
    const [lot] = await db.select().from(lots).where(sql`${lots.id} = ${lotId}`).limit(1);
    if (!lot) return res.status(404).json({ error: "Lot introuvable" });
    const [w] = await db.select().from(weights).where(sql`${weights.id} = ${weightId}`).limit(1);
    if (!w) return res.status(404).json({ error: "Relevé introuvable" });
    if (req.user.role === "operator" && w.createdBy !== req.user.id) {
      return res.status(403).json({ error: "Vous ne pouvez supprimer que vos propres relevés" });
    }
    await db.delete(weights).where(sql`${weights.id} = ${weightId}`);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
