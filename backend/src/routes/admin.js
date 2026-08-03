import { Router } from "express";
import { sql, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { pool, db } from "../db/client.js";
import { users, lots, ops, anomalies } from "../db/schema.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { publicUser } from "../middleware/auth.js";

const router = Router();
router.use(authenticate, authorize("admin"));

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES = ["operator", "manager", "admin"];

router.get("/users", async (req, res, next) => {
  try {
    const rows = await db.select().from(users).orderBy(desc(users.id));
    res.json(rows.map(publicUser));
  } catch (err) {
    next(err);
  }
});

router.post("/users", async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Nom, email et mot de passe sont requis" });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: "Adresse email invalide" });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: "Mot de passe : 6 caractères minimum" });
    }
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: "Rôle invalide" });
    }
    const normalizedEmail = email.toLowerCase().trim();
    const [existing] = await db.select().from(users).where(sql`${users.email} = ${normalizedEmail}`).limit(1);
    if (existing) return res.status(409).json({ error: "Cet email est déjà utilisé" });
    const passwordHash = await bcrypt.hash(String(password), 10);
    const [created] = await db
      .insert(users)
      .values({ name: name.trim(), email: normalizedEmail, passwordHash, role })
      .returning();
    res.status(201).json(publicUser(created));
  } catch (err) {
    next(err);
  }
});

router.patch("/users/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [existing] = await db.select().from(users).where(sql`${users.id} = ${id}`).limit(1);
    if (!existing) return res.status(404).json({ error: "Utilisateur introuvable" });
    if (id === req.user.id && req.body?.role && req.body.role !== "admin") {
      return res.status(400).json({ error: "Vous ne pouvez pas retirer votre propre rôle admin" });
    }
    const { name, email, role, password } = req.body || {};
    const patch = {};
    if (name && name.trim()) patch.name = name.trim();
    if (email && EMAIL_RE.test(email)) patch.email = email.toLowerCase().trim();
    if (VALID_ROLES.includes(role)) patch.role = role;
    if (password) {
      if (String(password).length < 6) {
        return res.status(400).json({ error: "Mot de passe : 6 caractères minimum" });
      }
      patch.passwordHash = await bcrypt.hash(String(password), 10);
    }
    const [updated] = await db.update(users).set(patch).where(sql`${users.id} = ${id}`).returning();
    res.json(publicUser(updated));
  } catch (err) {
    next(err);
  }
});

router.delete("/users/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (id === req.user.id) {
      return res.status(400).json({ error: "Impossible de supprimer votre propre compte" });
    }
    const [existing] = await db.select().from(users).where(sql`${users.id} = ${id}`).limit(1);
    if (!existing) return res.status(404).json({ error: "Utilisateur introuvable" });
    await db.delete(users).where(sql`${users.id} = ${id}`);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.get("/stats", async (req, res, next) => {
  try {
    const lotStats = (await pool.query(`
      SELECT status, count(*)::int AS n
      FROM lots GROUP BY status
    `)).rows;
    const byStatus = {};
    for (const s of ["in_progress", "completed", "anomaly"]) {
      byStatus[s] = 0;
    }
    for (const row of lotStats) byStatus[row.status] = row.n;
    const totals = (await pool.query(`
      SELECT (SELECT count(*)::int FROM ops) AS ops,
             (SELECT count(*)::int FROM lots) AS lots,
             (SELECT count(*)::int FROM weights) AS weights,
             (SELECT count(*)::int FROM anomalies) AS anomalies,
             (SELECT count(*)::int FROM anomalies WHERE status = 'open') AS anomaliesOpen,
             (SELECT count(*)::int FROM users) AS users
    `)).rows[0];

    const recentLots = (await pool.query(`
      SELECT l.id, l.lot_number AS "lotNumber", o.op_number AS "opNumber", l.status,
             l.created_at AS "createdAt", u.name AS "createdByName"
      FROM lots l
      JOIN ops o ON o.id = l.op_id
      LEFT JOIN users u ON u.id = l.created_by
      ORDER BY l.id DESC LIMIT 8
    `)).rows;

    const recentAnomalies = (await pool.query(`
      SELECT a.id, a.type, a.severity, a.status, a.created_at AS "createdAt",
             o.op_number AS "opNumber", l.lot_number AS "lotNumber", u.name AS "createdByName"
      FROM anomalies a
      JOIN lots l ON l.id = a.lot_id
      JOIN ops o ON o.id = l.op_id
      LEFT JOIN users u ON u.id = a.created_by
      ORDER BY a.id DESC LIMIT 8
    `)).rows;

    res.json({ byStatus, totals, recentLots, recentAnomalies });
  } catch (err) {
    next(err);
  }
});

const ADMIN_TABLES = ["ops", "lots", "weights", "anomalies", "photos", "quality_checkpoints", "quality_checks", "lot_documents", "lot_scan_verifications", "users", "exports"];
const ADMIN_TABLE_COLUMNS = {
  ops: ['id', 'op_number', 'created_at', 'created_by'],
  lots: ['id', 'op_id', 'lot_number', 'status', 'created_at', 'updated_at', 'completed_at', 'created_by'],
  weights: ['id', 'lot_id', 'weight', 'created_at', 'created_by'],
  anomalies: ['id', 'lot_id', 'type', 'description', 'severity', 'status', 'comment', 'created_at', 'created_by', 'validated_by', 'validated_at'],
  photos: ['id', 'anomaly_id', 'url', 'created_at'],
  quality_checkpoints: ['id', 'name', 'description', 'active', 'sort_order', 'created_at'],
  quality_checks: ['id', 'lot_id', 'checkpoint_id', 'status', 'comment', 'created_at', 'created_by'],
  lot_documents: ['id', 'lot_id', 'title', 'image_url', 'ocr_text', 'created_at', 'created_by'],
  lot_scan_verifications: ['id', 'lot_id', 'scanned_code', 'expected_code', 'matched', 'created_at', 'created_by'],
  users: ['id', 'name', 'email', 'role', 'created_at'],
  exports: ['id', 'user_id', 'entity', 'row_count', 'created_at']
};

router.get("/records", async (req, res, next) => {
  try {
    const table = (req.query.table || "lots").toString();
    if (!ADMIN_TABLES.includes(table)) {
      return res.status(400).json({ error: "Table inconnue" });
    }
    const q = (req.query.q || "").toString().trim();
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || "25", 10)));
    const columns = ADMIN_TABLE_COLUMNS[table];

    let where = "";
    const params = [];
    if (q && columns.length) {
      params.push(`%${q}%`);
      where = `WHERE ${columns.map((c) => `CAST(${c} AS text) ILIKE $1`).join(" OR ")}`;
    }
    const { rows } = await pool.query(
      `SELECT * FROM ${table} ${where} ORDER BY id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, (page - 1) * pageSize]
    );
    const total = parseInt(
      (await pool.query(`SELECT count(*)::int AS total FROM ${table} ${where}`, params)).rows[0].total,
      10
    );
    res.json({ rows, columns, total, page, pageSize });
  } catch (err) {
    next(err);
  }
});

router.delete("/records/:table/:id", async (req, res, next) => {
  try {
    const table = (req.params.table || "").toString();
    const id = parseInt(req.params.id, 10);
    if (!ADMIN_TABLES.includes(table)) {
      return res.status(400).json({ error: "Table inconnue" });
    }
    if (table === "ops") {
      const lotsOfOp = (await pool.query("SELECT id FROM lots WHERE op_id = $1", [id])).rows;
      for (const l of lotsOfOp) {
        await deleteLotCascade(l.id);
      }
      await pool.query("DELETE FROM ops WHERE id = $1", [id]);
    } else if (table === "lots") {
      await deleteLotCascade(id);
    } else if (table === "anomalies") {
      await pool.query("DELETE FROM photos WHERE anomaly_id = $1", [id]);
      await pool.query("DELETE FROM anomalies WHERE id = $1", [id]);
    } else if (table === "users") {
      await pool.query("UPDATE ops SET created_by = NULL WHERE created_by = $1", [id]);
      await pool.query("UPDATE lots SET created_by = NULL WHERE created_by = $1", [id]);
      await pool.query("UPDATE weights SET created_by = NULL WHERE created_by = $1", [id]);
      await pool.query("UPDATE anomalies SET created_by = NULL, validated_by = NULL WHERE created_by = $1 OR validated_by = $1", [id]);
      await pool.query("UPDATE quality_checks SET created_by = NULL WHERE created_by = $1", [id]);
      await pool.query("UPDATE lot_documents SET created_by = NULL WHERE created_by = $1", [id]);
      await pool.query("UPDATE lot_scan_verifications SET created_by = NULL WHERE created_by = $1", [id]);
      await pool.query("DELETE FROM exports WHERE user_id = $1", [id]);
      await pool.query("DELETE FROM users WHERE id = $1", [id]);
    } else {
      await pool.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

async function deleteLotCascade(lotId) {
  const anomaliesOf = (await pool.query("SELECT id FROM anomalies WHERE lot_id = $1", [lotId])).rows;
  for (const a of anomaliesOf) {
    await pool.query("DELETE FROM photos WHERE anomaly_id = $1", [a.id]);
  }
  await pool.query("DELETE FROM anomalies WHERE lot_id = $1", [lotId]);
  await pool.query("DELETE FROM weights WHERE lot_id = $1", [lotId]);
  await pool.query("DELETE FROM quality_checks WHERE lot_id = $1", [lotId]);
  await pool.query("DELETE FROM lot_documents WHERE lot_id = $1", [lotId]);
  await pool.query("DELETE FROM lot_scan_verifications WHERE lot_id = $1", [lotId]);
  await pool.query("DELETE FROM lots WHERE id = $1", [lotId]);
}

export default router;
