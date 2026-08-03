import { Router } from "express";
import { sql } from "drizzle-orm";
import { pool, db } from "../db/client.js";
import { lots, qualityCheckSessions, qualityCheckSessionItems, anomalies } from "../db/schema.js";
import { authenticate, authorize } from "../middleware/auth.js";

// Router monté sur /api/lots/:lotId/sessions
const router = Router({ mergeParams: true });
router.use(authenticate);

const VALID_TYPES = ["sortie_machine", "carton_palette"];
const VALID_STATUSES = ["compliant", "non_compliant", "na"];
const SESSION_ANOMALY_TYPES = {
  sortie_machine: "Sortie machine",
  carton_palette: "Carton & palette"
};

function canManageLot(user, lot) {
  return user.role === "admin" || user.role === "manager" || lot.createdBy === user.id;
}

async function getSessions(lotId) {
  const { rows } = await pool.query(`
    SELECT s.id, s.type, s.recorded_at AS "recordedAt",
           s.carton_number AS "cartonNumber", s.comment,
           s.created_at AS "createdAt", u.name AS "createdByName",
           COALESCE((
             SELECT json_agg(
               json_build_object(
                 'id', i.id, 'name', i.name, 'status', i.status, 'comment', i.comment,
                 'createdById', i.created_by
               )
               ORDER BY i.id
             )
             FROM quality_check_session_items i
             WHERE i.session_id = s.id
           ), '[]')::json AS items
    FROM quality_check_sessions s
    LEFT JOIN users u ON u.id = s.created_by
    WHERE s.lot_id = $1
    ORDER BY s.recorded_at DESC, s.id DESC
  `, [lotId]);
  return rows;
}

router.get("/", async (req, res, next) => {
  try {
    const lotId = parseInt(req.params.lotId, 10);
    const [lot] = await db.select().from(lots).where(sql`${lots.id} = ${lotId}`).limit(1);
    if (!lot) return res.status(404).json({ error: "Lot introuvable" });
    res.json(await getSessions(lotId));
  } catch (err) {
    next(err);
  }
});

router.post("/", authorize("operator", "manager", "admin"), async (req, res, next) => {
  try {
    const lotId = parseInt(req.params.lotId, 10);
    const [lot] = await db.select().from(lots).where(sql`${lots.id} = ${lotId}`).limit(1);
    if (!lot) return res.status(404).json({ error: "Lot introuvable" });
    if (!canManageLot(req.user, lot)) {
      return res.status(403).json({ error: "Vous ne pouvez modifier que vos propres lots" });
    }

    const type = String(req.body?.type || "").trim();
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: "Type de session invalide (sortie_machine / carton_palette)" });
    }

    const recordedAtRaw = req.body?.recordedAt;
    let recordedAt = recordedAtRaw ? new Date(recordedAtRaw) : null;
    if (!recordedAt || Number.isNaN(recordedAt.getTime())) {
      return res.status(400).json({ error: "Date/heure du contrôle requise" });
    }

    const cartonNumber = type === "carton_palette"
      ? String(req.body?.cartonNumber || "").trim() || null
      : null;
    if (type === "carton_palette" && !cartonNumber) {
      return res.status(400).json({ error: "N° de carton requis pour le contrôle carton & palette" });
    }

    const comment = String(req.body?.comment || "").trim() || null;

    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) {
      return res.status(400).json({ error: "Au moins un point de contrôle requis" });
    }
    const cleanItems = items.map((i) => {
      const name = String(i.name || "").trim();
      const status = String(i.status || "").trim();
      const itemComment = String(i.comment || "").trim() || null;
      if (!name || !VALID_STATUSES.includes(status)) {
        throw { code: 400, message: "Point de contrôle invalide (name / status requis)" };
      }
      return { name, status, comment: itemComment };
    });

    const [session] = await db
      .insert(qualityCheckSessions)
      .values({
        lotId,
        type,
        recordedAt,
        cartonNumber,
        comment,
        createdBy: req.user.id
      })
      .returning();

    await db.insert(qualityCheckSessionItems).values(
      cleanItems.map((i) => ({ sessionId: session.id, ...i, createdBy: req.user.id }))
    );

    // Anomalies automatiques pour les points non conformes (une par point, lot en cours)
    const createdAnomalies = [];
    for (const item of cleanItems) {
      if (item.status !== "non_compliant") continue;
      const [dup] = await db
        .select()
        .from(anomalies)
        .where(sql`
          ${anomalies.lotId} = ${lotId}
          AND ${anomalies.type} = ${`${SESSION_ANOMALY_TYPES[type]} : ${item.name}`}
          AND ${anomalies.status} = 'open'
        `)
        .limit(1);
      if (dup) continue;
      const [a] = await db
        .insert(anomalies)
        .values({
          lotId,
          type: `${SESSION_ANOMALY_TYPES[type]} : ${item.name}`,
          description: item.comment || `Point non conforme en sortie : ${item.name}`,
          severity: type === "carton_palette" ? "high" : "medium",
          status: "open",
          createdBy: req.user.id
        })
        .returning();
      createdAnomalies.push(a);
    }

    if (lot.status === "completed") {
      await db
        .update(lots)
        .set({ status: "in_progress", updatedAt: new Date(), completedAt: null })
        .where(sql`${lots.id} = ${lotId}`);
    }

    res.status(201).json({
      session: (await getSessions(lotId)).find((s) => s.id === session.id),
      anomalies: createdAnomalies,
      anomalyCreated: createdAnomalies.length > 0
    });
  } catch (err) {
    if (err?.code === 400) return res.status(400).json({ error: err.message });
    next(err);
  }
});

router.patch("/:sessionId", authorize("operator", "manager", "admin"), async (req, res, next) => {
  try {
    const lotId = parseInt(req.params.lotId, 10);
    const sessionId = parseInt(req.params.sessionId, 10);
    const [session] = await db
      .select()
      .from(qualityCheckSessions)
      .where(sql`${qualityCheckSessions.id} = ${sessionId} AND ${qualityCheckSessions.lotId} = ${lotId}`)
      .limit(1);
    if (!session) return res.status(404).json({ error: "Session introuvable" });
    if (req.user.role === "operator" && session.createdBy !== req.user.id) {
      return res.status(403).json({ error: "Vous ne pouvez modifier que vos propres sessions" });
    }

    const comment = String(req.body?.comment || "").trim() || null;
    await db
      .update(qualityCheckSessions)
      .set({ comment })
      .where(sql`${qualityCheckSessions.id} = ${sessionId}`);

    const items = Array.isArray(req.body?.items) ? req.body.items : null;
    if (items) {
      for (const i of items) {
        const itemId = parseInt(i.id, 10);
        const status = String(i.status || "").trim();
        const itemComment = String(i.comment || "").trim() || null;
        if (!itemId || !VALID_STATUSES.includes(status)) continue;
        await db
          .update(qualityCheckSessionItems)
          .set({ status, comment: itemComment })
          .where(sql`${qualityCheckSessionItems.id} = ${itemId} AND ${qualityCheckSessionItems.sessionId} = ${sessionId}`);
      }
    }

    res.json((await getSessions(lotId)).find((s) => s.id === sessionId));
  } catch (err) {
    next(err);
  }
});

router.delete("/:sessionId", authorize("manager", "admin"), async (req, res, next) => {
  try {
    const lotId = parseInt(req.params.lotId, 10);
    const sessionId = parseInt(req.params.sessionId, 10);
    const [session] = await db
      .select()
      .from(qualityCheckSessions)
      .where(sql`${qualityCheckSessions.id} = ${sessionId} AND ${qualityCheckSessions.lotId} = ${lotId}`)
      .limit(1);
    if (!session) return res.status(404).json({ error: "Session introuvable" });
    await db.delete(qualityCheckSessionItems).where(sql`${qualityCheckSessionItems.sessionId} = ${sessionId}`);
    await db.delete(qualityCheckSessions).where(sql`${qualityCheckSessions.id} = ${sessionId}`);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
