import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { ops } from "../db/schema.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();
router.use(authenticate);

router.get("/", async (req, res, next) => {
  try {
    const q = (req.query.q || "").toString().trim();
    const rows = await db.execute(
      sql`
        SELECT o.id, o.op_number AS "opNumber", o.created_at AS "createdAt",
               (SELECT count(*)::int FROM lots l WHERE l.op_id = o.id) AS "lotCount"
        FROM ops o
        ${q ? sql`WHERE o.op_number ILIKE ${`%${q}%`}` : sql``}
        ORDER BY o.id DESC
        LIMIT 50
      `
    );
    res.json(rows.rows);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const opNumber = (req.body?.opNumber || "").toString().trim().toUpperCase();
    if (!opNumber) {
      return res.status(400).json({ error: "Numéro d'OP requis" });
    }
    const [existing] = await db.select().from(ops).where(sql`${ops.opNumber} = ${opNumber}`).limit(1);
    if (existing) {
      return res.status(200).json(existing);
    }
    const [created] = await db
      .insert(ops)
      .values({ opNumber, createdBy: req.user.id })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [op] = await db.select().from(ops).where(sql`${ops.id} = ${id}`).limit(1);
    if (!op) return res.status(404).json({ error: "OP introuvable" });
    const { rows: lots } = await db.execute(
      sql`
        SELECT l.id, l.lot_number AS "lotNumber", l.status, l.created_at AS "createdAt",
               l.updated_at AS "updatedAt", l.completed_at AS "completedAt",
               (SELECT count(*)::int FROM weights w WHERE w.lot_id = l.id) AS "weightCount"
        FROM lots l
        WHERE l.op_id = ${id}
        ORDER BY l.id DESC
      `
    );
    res.json({ ...op, lots });
  } catch (err) {
    next(err);
  }
});

export default router;
