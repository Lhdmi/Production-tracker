import { Router } from "express";
import { sql } from "drizzle-orm";
import { pool, db } from "../db/client.js";
import { anomalies, photos, lots } from "../db/schema.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { uploadImage, toPublicUrl } from "../utils/storage.js";

const router = Router();
export const lotAnomalyRouter = Router();
lotAnomalyRouter.use(authenticate);
router.use(authenticate);

const SEVERITIES = ["low", "medium", "high", "critical"];

function canManageAnomaly(user, row) {
  return user.role === "admin" || user.role === "manager" || row.createdBy === user.id;
}

function rowToAnomaly(r) {
  return {
    ...r,
    photos: r.photos || []
  };
}

async function queryAnomalies({ status, q, page, pageSize, lotId }) {
  const where = [];
  const params = [];
  if (lotId) {
    params.push(lotId);
    where.push(`a.lot_id = $${params.length}`);
  }
  if (["open", "validated", "rejected"].includes(status)) {
    params.push(status);
    where.push(`a.status = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    where.push(`(a.type ILIKE $${params.length} OR a.description ILIKE $${params.length} OR o.op_number ILIKE $${params.length} OR l.lot_number ILIKE $${params.length})`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const { rows } = await pool.query(`
    SELECT a.id, a.lot_id AS "lotId", a.type, a.description, a.severity, a.status, a.comment,
           a.created_at AS "createdAt", a.validated_at AS "validatedAt",
           o.op_number AS "opNumber", l.lot_number AS "lotNumber", l.status AS "lotStatus",
           u.name AS "createdByName", v.name AS "validatedByName",
            (SELECT array_agg(json_build_object('id', p.id, 'url', p.url) ORDER BY p.id)
             FROM photos p WHERE p.anomaly_id = a.id) AS photos
    FROM anomalies a
    JOIN lots l ON l.id = a.lot_id
    JOIN ops o ON o.id = l.op_id
    LEFT JOIN users u ON u.id = a.created_by
    LEFT JOIN users v ON v.id = a.validated_by
    ${whereSql}
    ORDER BY
      CASE a.status WHEN 'open' THEN 0 ELSE 1 END,
      a.created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `, [...params, pageSize, (page - 1) * pageSize]);

  const total = parseInt(
    (await pool.query(`
      SELECT count(*)::int AS total
      FROM anomalies a
      JOIN lots l ON l.id = a.lot_id
      JOIN ops o ON o.id = l.op_id
      LEFT JOIN users u ON u.id = a.created_by
      ${whereSql}
    `, params)).rows[0].total,
    10
  );

  return { rows: rows.map(rowToAnomaly), total, page, pageSize };
}

router.get("/", async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || "25", 10)));
    const result = await queryAnomalies({
      status: req.query.status?.toString(),
      q: req.query.q?.toString().trim(),
      page,
      pageSize
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { rows: list } = await pool.query(
      `SELECT a.* FROM anomalies a WHERE a.id = $1`,
      [id]
    );
    if (!list.length) return res.status(404).json({ error: "Anomalie introuvable" });
    const { rows } = await pool.query(`
      SELECT a.id, a.lot_id AS "lotId", a.type, a.description, a.severity, a.status, a.comment,
             a.created_by AS "createdById", a.created_at AS "createdAt", a.validated_at AS "validatedAt",
             o.op_number AS "opNumber", l.lot_number AS "lotNumber",
             u.name AS "createdByName", v.name AS "validatedByName",
              (SELECT array_agg(json_build_object('id', p.id, 'url', p.url) ORDER BY p.id)
               FROM photos p WHERE p.anomaly_id = a.id) AS photos
      FROM anomalies a
      JOIN lots l ON l.id = a.lot_id
      JOIN ops o ON o.id = l.op_id
      LEFT JOIN users u ON u.id = a.created_by
      LEFT JOIN users v ON v.id = a.validated_by
      WHERE a.id = $1
    `, [id]);
    res.json(rowToAnomaly(rows[0]));
  } catch (err) {
    next(err);
  }
});

lotAnomalyRouter.post(
  "/:lotId/anomalies",
  uploadImage.array("photos", 10),
  async (req, res, next) => {
    try {
      const lotId = parseInt(req.params.lotId, 10);
      const [lot] = await db.select().from(lots).where(sql`${lots.id} = ${lotId}`).limit(1);
      if (!lot) return res.status(404).json({ error: "Lot introuvable" });

      const type = (req.body?.type || "").toString().trim();
      const description = (req.body?.description || "").toString().trim();
      const severity = SEVERITIES.includes(req.body?.severity) ? req.body.severity : "medium";
      if (!type || !description) {
        return res.status(400).json({ error: "Type et description requis" });
      }

      const [created] = await db
        .insert(anomalies)
        .values({ lotId, type, description, severity, createdBy: req.user.id })
        .returning();

      const urls = (req.files || []).map((f) => toPublicUrl(f));
      if (urls.length) {
        await db.insert(photos).values(urls.map((url) => ({ anomalyId: created.id, url })));
      }

      if (lot.status !== "anomaly") {
        await db
          .update(lots)
          .set({ status: "anomaly", updatedAt: new Date() })
          .where(sql`${lots.id} = ${lotId}`);
      }

      const { rows } = await pool.query(`
        SELECT a.id, a.lot_id AS "lotId", a.type, a.description, a.severity, a.status, a.comment,
               a.created_at AS "createdAt", a.validated_at AS "validatedAt",
               o.op_number AS "opNumber", l.lot_number AS "lotNumber",
               u.name AS "createdByName", v.name AS "validatedByName",
                (SELECT array_agg(json_build_object('id', p.id, 'url', p.url) ORDER BY p.id)
                 FROM photos p WHERE p.anomaly_id = a.id) AS photos
        FROM anomalies a
        JOIN lots l ON l.id = a.lot_id
        JOIN ops o ON o.id = l.op_id
        LEFT JOIN users u ON u.id = a.created_by
        LEFT JOIN users v ON v.id = a.validated_by
        WHERE a.id = $1
      `, [created.id]);
      res.status(201).json(rowToAnomaly(rows[0]));
    } catch (err) {
      next(err);
    }
  }
);

router.patch("/:id", authorize("manager", "admin"), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [a] = await db.select().from(anomalies).where(sql`${anomalies.id} = ${id}`).limit(1);
    if (!a) return res.status(404).json({ error: "Anomalie introuvable" });
    const { status, comment } = req.body || {};
    if (!["validated", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Statut de validation invalide" });
    }
    await db
      .update(anomalies)
      .set({
        status,
        comment: (comment || "").toString().trim() || null,
        validatedBy: req.user.id,
        validatedAt: new Date()
      })
      .where(sql`${anomalies.id} = ${id}`);

    if (status === "rejected") {
      const [lot] = await db.select().from(lots).where(sql`${lots.id} = ${a.lotId}`).limit(1);
      if (lot && lot.status === "anomaly") {
        const open = (await db.execute(
          sql`SELECT count(*)::int AS n FROM anomalies WHERE lot_id = ${a.lotId} AND status = 'open'`
        )).rows[0].n;
        if (open === 0) {
          await db
            .update(lots)
            .set({ status: "in_progress", updatedAt: new Date() })
            .where(sql`${lots.id} = ${a.lotId}`);
        }
      }
    }

    const { rows } = await pool.query(`
      SELECT a.id, a.lot_id AS "lotId", a.type, a.description, a.severity, a.status, a.comment,
             a.created_by AS "createdById", a.created_at AS "createdAt", a.validated_at AS "validatedAt",
             o.op_number AS "opNumber", l.lot_number AS "lotNumber",
             u.name AS "createdByName", v.name AS "validatedByName",
              (SELECT array_agg(json_build_object('id', p.id, 'url', p.url) ORDER BY p.id)
               FROM photos p WHERE p.anomaly_id = a.id) AS photos
      FROM anomalies a
      JOIN lots l ON l.id = a.lot_id
      JOIN ops o ON o.id = l.op_id
      LEFT JOIN users u ON u.id = a.created_by
      LEFT JOIN users v ON v.id = a.validated_by
      WHERE a.id = $1
    `, [id]);
    res.json(rowToAnomaly(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [a] = await db.select().from(anomalies).where(sql`${anomalies.id} = ${id}`).limit(1);
    if (!a) return res.status(404).json({ error: "Anomalie introuvable" });
    if (!canManageAnomaly(req.user, a)) {
      return res.status(403).json({ error: "Vous ne pouvez supprimer que vos propres anomalies" });
    }
    await db.delete(anomalies).where(sql`${anomalies.id} = ${id}`);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
