import { Router } from "express";
import { sql } from "drizzle-orm";
import { pool, db } from "../db/client.js";
import { qualityCheckpoints } from "../db/schema.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();
router.use(authenticate);

router.get("/", async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      req.user.role === "admin"
        ? `SELECT * FROM quality_checkpoints ORDER BY sort_order, id`
        : `SELECT * FROM quality_checkpoints WHERE active = true ORDER BY sort_order, id`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post("/", authorize("admin"), async (req, res, next) => {
  try {
    const { name, description, active, sortOrder } = req.body || {};
    const trimmed = (name || "").toString().trim();
    if (!trimmed) {
      return res.status(400).json({ error: "Le nom du point de contrôle est requis" });
    }
    const [created] = await db
      .insert(qualityCheckpoints)
      .values({
        name: trimmed,
        description: (description || "").toString().trim() || null,
        active: active !== false,
        sortOrder: parseInt(sortOrder, 10) || 0
      })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", authorize("admin"), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [existing] = await db
      .select()
      .from(qualityCheckpoints)
      .where(sql`${qualityCheckpoints.id} = ${id}`)
      .limit(1);
    if (!existing) return res.status(404).json({ error: "Point de contrôle introuvable" });
    const { name, description, active, sortOrder } = req.body || {};
    const patch = {};
    if (name && name.trim()) patch.name = name.trim();
    if (typeof description === "string") patch.description = description.trim() || null;
    if (typeof active === "boolean") patch.active = active;
    if (sortOrder !== undefined) patch.sortOrder = parseInt(sortOrder, 10) || 0;
    const [updated] = await db
      .update(qualityCheckpoints)
      .set(patch)
      .where(sql`${qualityCheckpoints.id} = ${id}`)
      .returning();
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", authorize("admin"), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [existing] = await db
      .select()
      .from(qualityCheckpoints)
      .where(sql`${qualityCheckpoints.id} = ${id}`)
      .limit(1);
    if (!existing) return res.status(404).json({ error: "Point de contrôle introuvable" });
    const { rows } = await pool.query("SELECT count(*)::int AS n FROM quality_checks WHERE checkpoint_id = $1", [id]);
    if (rows[0].n > 0) {
      return res.status(409).json({
        error: "Ce point de contrôle est utilisé par des contrôles existants (traçabilité). Désactivez-le plutôt."
      });
    }
    await db.delete(qualityCheckpoints).where(sql`${qualityCheckpoints.id} = ${id}`);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
