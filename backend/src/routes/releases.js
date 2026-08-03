import { Router } from "express";
import { sql } from "drizzle-orm";
import { pool, db } from "../db/client.js";
import { lots, lotReleases } from "../db/schema.js";
import { authenticate, authorize } from "../middleware/auth.js";

// Router monté sur /api/lots/:lotId/release
const router = Router({ mergeParams: true });
router.use(authenticate);

const VALID_STATUSES = ["compliant", "non_compliant", "na"];

function canManageLot(user, lot) {
  return user.role === "admin" || user.role === "manager" || lot.createdBy === user.id;
}

async function getRelease(lotId) {
  const { rows } = await pool.query(`
    SELECT r.id, r.record_status AS "recordStatus", r.results_status AS "resultsStatus",
           r.net_weight_status AS "netWeightStatus", r.released, r.comment,
           r.released_at AS "releasedAt", u.name AS "releasedByName", u.id AS "releasedById"
    FROM lot_releases r
    LEFT JOIN users u ON u.id = r.released_by
    WHERE r.lot_id = $1
    LIMIT 1
  `, [lotId]);
  return rows[0] || null;
}

router.get("/", async (req, res, next) => {
  try {
    const lotId = parseInt(req.params.lotId, 10);
    const [lot] = await db.select().from(lots).where(sql`${lots.id} = ${lotId}`).limit(1);
    if (!lot) return res.status(404).json({ error: "Lot introuvable" });
    res.json(await getRelease(lotId));
  } catch (err) {
    next(err);
  }
});

// Création / mise à jour de la libération (un seul enregistrement par lot).
router.post("/", authorize("operator", "manager", "admin"), async (req, res, next) => {
  try {
    const lotId = parseInt(req.params.lotId, 10);
    const [lot] = await db.select().from(lots).where(sql`${lots.id} = ${lotId}`).limit(1);
    if (!lot) return res.status(404).json({ error: "Lot introuvable" });
    if (!canManageLot(req.user, lot)) {
      return res.status(403).json({ error: "Vous ne pouvez modifier que vos propres lots" });
    }

    const body = req.body || {};
    const recordStatus = String(body.recordStatus || "").trim();
    const resultsStatus = String(body.resultsStatus || "").trim();
    const netWeightStatus = String(body.netWeightStatus || "").trim();
    if (!VALID_STATUSES.includes(recordStatus) || !VALID_STATUSES.includes(resultsStatus) || !VALID_STATUSES.includes(netWeightStatus)) {
      return res.status(400).json({ error: "Statuts de libération invalides" });
    }
    const released = body.released === true || body.released === "true";
    const comment = String(body.comment || "").trim() || null;

    const [existing] = await db.select().from(lotReleases).where(sql`${lotReleases.lotId} = ${lotId}`).limit(1);

    let row;
    if (existing) {
      [row] = await db
        .update(lotReleases)
        .set({ recordStatus, resultsStatus, netWeightStatus, released, comment, releasedAt: new Date(), releasedBy: req.user.id })
        .where(sql`${lotReleases.id} = ${existing.id}`)
        .returning();
    } else {
      [row] = await db
        .insert(lotReleases)
        .values({ lotId, recordStatus, resultsStatus, netWeightStatus, released, comment, releasedBy: req.user.id })
        .returning();
    }

    // Une production libérée clôture le lot ; une non-libération le laisse ouvert.
    if (released) {
      await db
        .update(lots)
        .set({ status: "completed", updatedAt: new Date(), completedAt: new Date() })
        .where(sql`${lots.id} = ${lotId}`);
    } else if (lot.status === "completed") {
      await db
        .update(lots)
        .set({ status: "in_progress", updatedAt: new Date(), completedAt: null })
        .where(sql`${lots.id} = ${lotId}`);
    }

    res.status(201).json({ ...(await getRelease(lotId)), id: row.id });
  } catch (err) {
    next(err);
  }
});

export default router;
