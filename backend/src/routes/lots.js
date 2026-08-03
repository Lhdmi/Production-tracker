import { Router } from "express";
import { sql } from "drizzle-orm";
import { pool, db } from "../db/client.js";
import { lots, weights, anomalies, photos, qualityChecks as checksTable, qualityCheckpoints, lotDocuments, lotScanVerifications, rawMaterials, lotRawMaterials, qualityCheckSessions, qualityCheckSessionItems, lotReleases } from "../db/schema.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { uploadImage, toPublicUrl } from "../utils/storage.js";
import { runOcr } from "../utils/ocr.js";
import { config } from "../config.js";
import { buildLotNumber, parseLotNumber, parseDateOnly, julianDay } from "../utils/lotNumber.js";

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
             l.production_date AS "productionDate", l.production_year AS "productionYear",
             l.julian_day AS "julianDay", l.best_before AS "bestBefore",
             l.product_reference AS "productReference", l.variety,
             l.plant_code AS "plantCode", l.line, l.batch_flag AS "batchFlag",
             l.batch_run AS "batchRun",
             l.shift, l.ot_number AS "otNumber", l.produced_quantity AS "producedQuantity",
             l.pallets_quantity AS "palletsQuantity", l.net_weight_status AS "netWeightStatus",
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

async function getQualityChecks(lotId) {
  const { rows } = await pool.query(`
    SELECT qc.id, qc.status, qc.comment, qc.created_at AS "createdAt",
           qc.checkpoint_id AS "checkpointId",
           qcp.name AS "checkpointName",
           qcp.requires_second_visa AS "requiresSecondVisa",
           u.name AS "createdByName", u.id AS "createdById",
           su.name AS "secondValidatedByName", qc.second_validated_at AS "secondValidatedAt"
    FROM quality_checks qc
    JOIN quality_checkpoints qcp ON qcp.id = qc.checkpoint_id
    LEFT JOIN users u ON u.id = qc.created_by
    LEFT JOIN users su ON su.id = qc.second_validated_by
    WHERE qc.lot_id = $1
    ORDER BY qc.created_at DESC, qc.id DESC
  `, [lotId]);
  return rows;
}

async function getDocuments(lotId) {
  const { rows } = await pool.query(`
    SELECT d.id, d.title, d.image_url AS "imageUrl", d.ocr_text AS "ocrText",
           d.created_at AS "createdAt", u.name AS "createdByName"
    FROM lot_documents d
    LEFT JOIN users u ON u.id = d.created_by
    WHERE d.lot_id = $1
    ORDER BY d.id DESC
  `, [lotId]);
  return rows;
}

async function getLotMaterials(lotId) {
  const { rows } = await pool.query(`
    SELECT rm.id, rm.lot_number AS "lotNumber", rm.ot_number AS "otNumber",
           rm.designation, rm.reference, rm.best_before AS "bestBefore",
           rm.production_date AS "productionDate", rm.supplier,
           rm.quantity::float8 AS quantity, rm.quality_status AS "qualityStatus",
           lrm.created_at AS "linkedAt", u.name AS "linkedByName"
    FROM lot_raw_materials lrm
    JOIN raw_materials rm ON rm.id = lrm.raw_material_id
    LEFT JOIN users u ON u.id = lrm.created_by
    WHERE lrm.lot_id = $1
    ORDER BY lrm.id DESC
  `, [lotId]);
  return rows;
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
             l.production_date AS "productionDate", l.julian_day AS "julianDay",
             l.best_before AS "bestBefore", l.product_reference AS "productReference",
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

router.get("/scan", async (req, res, next) => {
  try {
    const code = (req.query.code || "").toString().trim();
    if (!code) return res.status(400).json({ error: "Code manquant" });

    const { rows: lotRows } = await pool.query(`
      SELECT l.id, l.lot_number AS "lotNumber", l.status,
             o.op_number AS "opNumber", u.name AS "createdByName"
      FROM lots l
      JOIN ops o ON o.id = l.op_id
      LEFT JOIN users u ON u.id = l.created_by
      WHERE l.lot_number = $1
      LIMIT 1
    `, [code]);

    if (lotRows.length) {
      return res.json({ kind: "lot", lot: lotRows[0] });
    }

    const { rows: opRows } = await pool.query(`
      SELECT o.id, o.op_number AS "opNumber",
             (SELECT count(*)::int FROM lots l WHERE l.op_id = o.id) AS "lotCount"
      FROM ops o
      WHERE o.op_number = $1
      LIMIT 1
    `, [code]);

    if (opRows.length) {
      const { rows: lotsList } = await pool.query(`
        SELECT l.id, l.lot_number AS "lotNumber", l.status,
               o.op_number AS "opNumber", u.name AS "createdByName"
        FROM lots l
        JOIN ops o ON o.id = l.op_id
        LEFT JOIN users u ON u.id = l.created_by
        WHERE l.op_id = $1
        ORDER BY l.id
      `, [opRows[0].id]);
      return res.json({ kind: "op", op: opRows[0], lots: lotsList });
    }

    const parsed = parseLotNumber(code);
    if (parsed) {
      return res.status(404).json({
        error: `Format de lot PF valide (année ${parsed.year}, jour julien ${parsed.julianDay}, usine ${parsed.plantCode}, ligne ${parsed.line}) mais aucun lot enregistré pour ce code.`
      });
    }

    res.status(404).json({ error: `Aucun lot ni OP trouvé pour le code « ${code} »` });
  } catch (err) {
    next(err);
  }
});

// Aperçu de génération du numéro de lot PF à partir de la date de production.
// GET /api/lots/generate?date=YYYY-MM-DD&plant=&line=&flag=&run=
router.get("/generate", async (req, res, next) => {
  try {
    const productionDate = (req.query.date || "").toString().trim();
    const plantCode = (req.query.plant || "").toString().trim() || config.plantCode;
    const line = (req.query.line || "").toString().trim() || config.prodLine;
    const flag = (req.query.flag || "").toString().trim();
    const run = (req.query.run || "").toString().trim() || "1";
    const d = parseDateOnly(productionDate);
    if (!d) return res.status(400).json({ error: "Date de production invalide (AAAA-MM-JJ)" });
    const lotNumber = buildLotNumber({ productionDate, plantCode, line, flag, run });
    res.json({
      lotNumber,
      productionYear: d.getUTCFullYear(),
      julianDay: julianDay(productionDate),
      date: productionDate
    });
  } catch (err) {
    next(err);
  }
});

// Validation / décodage d'un code batch PF.
// GET /api/lots/parse?code=61218861A1
router.get("/parse", async (req, res, next) => {
  try {
    const code = (req.query.code || "").toString().trim();
    const parsed = parseLotNumber(code);
    if (!parsed) return res.json({ valid: false });
    res.json({ valid: true, ...parsed });
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const opNumber = (req.body?.opNumber || "").toString().trim().toUpperCase();
    let lotNumber = (req.body?.lotNumber || "").toString().trim();
    const productionDate = (req.body?.productionDate || "").toString().trim();
    const plantCode = (req.body?.plantCode || "").toString().trim() || config.plantCode;
    const line = (req.body?.line || "").toString().trim() || config.prodLine;
    const flag = (req.body?.batchFlag || "").toString().trim();
    const run = (req.body?.batchRun || "").toString().trim() || "1";

    if (!opNumber) {
      return res.status(400).json({ error: "Numéro d'OP requis" });
    }

    if (!lotNumber && productionDate) {
      lotNumber = buildLotNumber({ productionDate, plantCode, line, flag, run }) || "";
    }
    if (!lotNumber) {
      return res.status(400).json({ error: "Numéro de lot requis (ou date de production pour le générer)" });
    }

    const prod = parseDateOnly(productionDate);
    const productionYear = prod ? prod.getUTCFullYear() : null;
    const julian = prod ? julianDay(productionDate) : null;

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
      .values({
        opId: op.id,
        lotNumber,
        productionDate: prod ? productionDate : null,
        productionYear,
        julianDay: julian,
        bestBefore: req.body?.bestBefore || null,
        productReference: (req.body?.productReference || "").toString().trim() || null,
        variety: (req.body?.variety || "").toString().trim() || null,
        plantCode: plantCode || null,
        line: line || null,
        batchFlag: flag || null,
        batchRun: run || null,
        shift: req.body?.shift || null,
        otNumber: (req.body?.otNumber || "").toString().trim() || null,
        producedQuantity: req.body?.producedQuantity === "" || req.body?.producedQuantity == null ? null : parseInt(req.body.producedQuantity, 10),
        palletsQuantity: req.body?.palletsQuantity === "" || req.body?.palletsQuantity == null ? null : parseInt(req.body.palletsQuantity, 10),
        netWeightStatus: req.body?.netWeightStatus || null,
        createdBy: req.user.id
      })
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
    const [lotWeights, lotAnomalies, lotChecks, lotDocs, lotMats] = await Promise.all([
      getWeights(id),
      getAnomalies(id),
      getQualityChecks(id),
      getDocuments(id),
      getLotMaterials(id)
    ]);
    res.json({ ...row, weights: lotWeights, anomalies: lotAnomalies, qualityChecks: lotChecks, documents: lotDocs, rawMaterials: lotMats });
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
    const body = req.body || {};
    const updates = {
      updatedAt: new Date()
    };

    if (body.status !== undefined) {
      const status = body.status;
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ error: "Statut invalide" });
      }
      updates.status = status;
      updates.completedAt = status === "completed" ? new Date() : null;
    }

    // Mise à jour des données PF (productionDate recalcule année + jour julien)
    if (body.productionDate !== undefined) {
      const prod = parseDateOnly(String(body.productionDate || "").trim());
      updates.productionDate = prod ? String(body.productionDate).trim() : null;
      updates.productionYear = prod ? prod.getUTCFullYear() : null;
      updates.julianDay = prod ? julianDay(String(body.productionDate).trim()) : null;
    }
    if (body.bestBefore !== undefined) updates.bestBefore = body.bestBefore || null;
    if (body.productReference !== undefined) updates.productReference = String(body.productReference).trim() || null;
    if (body.variety !== undefined) updates.variety = String(body.variety).trim() || null;
    if (body.plantCode !== undefined) updates.plantCode = String(body.plantCode).trim() || null;
    if (body.line !== undefined) updates.line = String(body.line).trim() || null;
    if (body.batchFlag !== undefined) updates.batchFlag = String(body.batchFlag).trim() || null;
    if (body.batchRun !== undefined) updates.batchRun = String(body.batchRun).trim() || null;
    if (body.shift !== undefined) {
      const shift = String(body.shift || "").trim();
      if (shift && !["morning", "afternoon", "night"].includes(shift)) {
        return res.status(400).json({ error: "Équipe invalide" });
      }
      updates.shift = shift || null;
    }
    if (body.otNumber !== undefined) updates.otNumber = String(body.otNumber).trim() || null;
    if (body.producedQuantity !== undefined) {
      if (body.producedQuantity === "" || body.producedQuantity == null) {
        updates.producedQuantity = null;
      } else {
        const qty = parseInt(body.producedQuantity, 10);
        if (!Number.isInteger(qty) || qty < 0) return res.status(400).json({ error: "Quantité produite invalide" });
        updates.producedQuantity = qty;
      }
    }
    if (body.palletsQuantity !== undefined) {
      if (body.palletsQuantity === "" || body.palletsQuantity == null) {
        updates.palletsQuantity = null;
      } else {
        const qty = parseInt(body.palletsQuantity, 10);
        if (!Number.isInteger(qty) || qty < 0) return res.status(400).json({ error: "Nombre de palettes invalide" });
        updates.palletsQuantity = qty;
      }
    }
    if (body.netWeightStatus !== undefined) {
      const nw = String(body.netWeightStatus || "").trim();
      if (nw && !["complete", "compliant", "non_compliant"].includes(nw)) {
        return res.status(400).json({ error: "Statut poids net invalide" });
      }
      updates.netWeightStatus = nw || null;
    }

    if (Object.keys(updates).length > 1) {
      await db.update(lots).set(updates).where(sql`${lots.id} = ${id}`);
    }
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

    const sessions = await db.select().from(qualityCheckSessions).where(sql`${qualityCheckSessions.lotId} = ${id}`);
    for (const s of sessions) {
      await db.delete(qualityCheckSessionItems).where(sql`${qualityCheckSessionItems.sessionId} = ${s.id}`);
    }
    await db.delete(qualityCheckSessions).where(sql`${qualityCheckSessions.lotId} = ${id}`);
    await db.delete(checksTable).where(sql`${checksTable.lotId} = ${id}`);
    await db.delete(lotReleases).where(sql`${lotReleases.lotId} = ${id}`);
    await db.delete(lotRawMaterials).where(sql`${lotRawMaterials.lotId} = ${id}`);
    await db.delete(lotScanVerifications).where(sql`${lotScanVerifications.lotId} = ${id}`);
    await db.delete(lotDocuments).where(sql`${lotDocuments.lotId} = ${id}`);
    const anoms = await db.select().from(anomalies).where(sql`${anomalies.lotId} = ${id}`);
    for (const a of anoms) {
      await db.delete(photos).where(sql`${photos.anomalyId} = ${a.id}`);
    }
    await db.delete(anomalies).where(sql`${anomalies.lotId} = ${id}`);
    await db.delete(weights).where(sql`${weights.lotId} = ${id}`);
    await db.delete(lots).where(sql`${lots.id} = ${id}`);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.post("/:id/raw-materials", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const rawMaterialId = parseInt(req.body?.rawMaterialId, 10);
    const [lot] = await db.select().from(lots).where(sql`${lots.id} = ${id}`).limit(1);
    if (!lot) return res.status(404).json({ error: "Lot introuvable" });
    if (!canManageLot(req.user, lot)) {
      return res.status(403).json({ error: "Vous ne pouvez modifier que vos propres lots" });
    }
    const [mat] = await db.select().from(rawMaterials).where(sql`${rawMaterials.id} = ${rawMaterialId}`).limit(1);
    if (!mat) return res.status(404).json({ error: "Lot matière première introuvable" });
    const [existing] = await db
      .select()
      .from(lotRawMaterials)
      .where(sql`${lotRawMaterials.lotId} = ${id} AND ${lotRawMaterials.rawMaterialId} = ${rawMaterialId}`)
      .limit(1);
    if (existing) return res.status(409).json({ error: "Ce lot MP est déjà lié à ce lot PF" });
    await db.insert(lotRawMaterials).values({ lotId: id, rawMaterialId, createdBy: req.user.id });
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id/raw-materials/:matId", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const matId = parseInt(req.params.matId, 10);
    const [lot] = await db.select().from(lots).where(sql`${lots.id} = ${id}`).limit(1);
    if (!lot) return res.status(404).json({ error: "Lot introuvable" });
    if (!canManageLot(req.user, lot)) {
      return res.status(403).json({ error: "Vous ne pouvez modifier que vos propres lots" });
    }
    const [rel] = await db
      .select()
      .from(lotRawMaterials)
      .where(sql`${lotRawMaterials.lotId} = ${id} AND ${lotRawMaterials.rawMaterialId} = ${matId}`)
      .limit(1);
    if (!rel) return res.status(404).json({ error: "Liaison introuvable" });
    await db.delete(lotRawMaterials).where(sql`${lotRawMaterials.id} = ${rel.id}`);
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

router.post("/:id/scan-verifications", authorize("operator", "manager", "admin"), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [lot] = await db.select().from(lots).where(sql`${lots.id} = ${id}`).limit(1);
    if (!lot) return res.status(404).json({ error: "Lot introuvable" });
    const code = String(req.body?.code || "").trim();
    if (!code) return res.status(400).json({ error: "Code batch requis" });

    const expected = lot.lotNumber;
    const matched = code.toUpperCase() === String(expected).trim().toUpperCase();

    const [row] = await db
      .insert(lotScanVerifications)
      .values({ lotId: id, scannedCode: code, expectedCode: expected, matched, createdBy: req.user.id })
      .returning();

    res.status(201).json({
      id: row.id,
      matched,
      scanned: code,
      expected: String(expected),
      createdAt: row.createdAt
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:id/quality-checks", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [lot] = await db.select().from(lots).where(sql`${lots.id} = ${id}`).limit(1);
    if (!lot) return res.status(404).json({ error: "Lot introuvable" });
    res.json(await getQualityChecks(id));
  } catch (err) {
    next(err);
  }
});

router.post("/:id/quality-checks", authorize("operator", "manager", "admin"), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [lot] = await db.select().from(lots).where(sql`${lots.id} = ${id}`).limit(1);
    if (!lot) return res.status(404).json({ error: "Lot introuvable" });
    if (!canManageLot(req.user, lot)) {
      return res.status(403).json({ error: "Vous ne pouvez modifier que vos propres lots" });
    }

    const submitted = Array.isArray(req.body?.checks) ? req.body.checks : [];
    if (!submitted.length) {
      return res.status(400).json({ error: "Aucun contrôle à enregistrer" });
    }

    const results = [];
    for (const c of submitted) {
      const checkpointId = parseInt(c.checkpointId, 10);
      const status = String(c.status || "");
      if (!checkpointId || !["compliant", "non_compliant", "na"].includes(status)) {
        return res.status(400).json({ error: "Contrôle invalide (checkpointId / status requis)" });
      }
      const comment = String(c.comment || "").trim() || null;

      const [existing] = await db
        .select()
        .from(checksTable)
        .where(sql`${checksTable.lotId} = ${id} AND ${checksTable.checkpointId} = ${checkpointId}`)
        .limit(1);

      let row;
      if (existing) {
        [row] = await db
          .update(checksTable)
          .set({ status, comment, createdAt: new Date(), createdBy: req.user.id })
          .where(sql`${checksTable.id} = ${existing.id}`)
          .returning();
      } else {
        [row] = await db
          .insert(checksTable)
          .values({ lotId: id, checkpointId, status, comment, createdBy: req.user.id })
          .returning();
      }
      results.push(row);
    }

    let createdAnomalies = [];
    for (const c of submitted) {
      if (String(c.status) !== "non_compliant") continue;
      const cpId = parseInt(c.checkpointId, 10);
      const cpName = (await pool.query("SELECT name FROM quality_checkpoints WHERE id = $1", [cpId])).rows[0]?.name || `#${cpId}`;
      const comment = String(c.comment || "").trim() || null;
      const [dup] = await db
        .select()
        .from(anomalies)
        .where(sql`${anomalies.lotId} = ${id} AND ${anomalies.type} = ${`Contrôle qualité : ${cpName}`} AND ${anomalies.status} = 'open'`)
        .limit(1);
      if (dup) continue;
      const [a] = await db
        .insert(anomalies)
        .values({
          lotId: id,
          type: `Contrôle qualité : ${cpName}`,
          description: comment || `Point de contrôle non conforme : ${cpName}`,
          severity: "high",
          status: "open",
          createdBy: req.user.id
        })
        .returning();
      createdAnomalies.push(a);
    }

    res.status(201).json({
      checks: results,
      anomalies: createdAnomalies,
      anomalyCreated: createdAnomalies.length > 0
    });
  } catch (err) {
    next(err);
  }
});

// Double visa : signature par un 2e utilisateur différent du signataire initial.
router.post("/:id/quality-checks/:checkId/second-visa", authorize("operator", "manager", "admin"), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const checkId = parseInt(req.params.checkId, 10);
    const [lot] = await db.select().from(lots).where(sql`${lots.id} = ${id}`).limit(1);
    if (!lot) return res.status(404).json({ error: "Lot introuvable" });

    const [check] = await db.select().from(checksTable).where(sql`${checksTable.id} = ${checkId}`).limit(1);
    if (!check || check.lotId !== id) return res.status(404).json({ error: "Contrôle introuvable" });

    const [checkpoint] = await db
      .select()
      .from(qualityCheckpoints)
      .where(sql`${qualityCheckpoints.id} = ${check.checkpointId}`)
      .limit(1);
    if (!checkpoint?.requiresSecondVisa) {
      return res.status(400).json({ error: "Ce contrôle ne requiert pas de double visa" });
    }
    if (check.secondValidatedBy) {
      return res.status(409).json({ error: "Le second visa est déjà apposé" });
    }
    if (check.createdBy === req.user.id) {
      return res.status(403).json({ error: "Le second visa doit être apposé par un autre utilisateur" });
    }

    const [row] = await db
      .update(checksTable)
      .set({ secondValidatedBy: req.user.id, secondValidatedAt: new Date() })
      .where(sql`${checksTable.id} = ${checkId}`)
      .returning();

    res.json({ id: row.id, secondValidatedById: row.secondValidatedBy, secondValidatedAt: row.secondValidatedAt });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/documents", authorize("operator", "manager", "admin"), uploadImage.array("image", 1), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [lot] = await db.select().from(lots).where(sql`${lots.id} = ${id}`).limit(1);
    if (!lot) return res.status(404).json({ error: "Lot introuvable" });
    if (!canManageLot(req.user, lot)) {
      return res.status(403).json({ error: "Vous ne pouvez modifier que vos propres lots" });
    }
    const file = req.files?.[0];
    if (!file) {
      return res.status(400).json({ error: "Photo du document requise" });
    }

    const title = String(req.body?.title || "").trim() || null;
    const imageUrl = toPublicUrl(file);
    const ocrText = await runOcr(file.path);

    const [doc] = await db
      .insert(lotDocuments)
      .values({ lotId: id, title, imageUrl, ocrText, createdBy: req.user.id })
      .returning();
    const full = await getDocuments(id);
    res.status(201).json(full.find((d) => d.id === doc.id));
  } catch (err) {
    next(err);
  }
});

router.get("/:id/history", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [lot] = await db.select().from(lots).where(sql`${lots.id} = ${id}`).limit(1);
    if (!lot) return res.status(404).json({ error: "Lot introuvable" });

    const [weights, checks, docs, anoms, scans] = await Promise.all([
      pool.query(`
        SELECT 'weight' AS kind, w.created_at AS "at", w.weight::float8 AS weight,
               null AS "text", u.name AS "by"
        FROM weights w LEFT JOIN users u ON u.id = w.created_by WHERE w.lot_id = $1
      `, [id]),
      pool.query(`
        SELECT 'check' AS kind, qc.created_at AS "at", null AS weight,
               qcp.name AS "text", u.name AS "by"
        FROM quality_checks qc
        JOIN quality_checkpoints qcp ON qcp.id = qc.checkpoint_id
        LEFT JOIN users u ON u.id = qc.created_by
        WHERE qc.lot_id = $1
      `, [id]),
      pool.query(`
        SELECT 'document' AS kind, d.created_at AS "at", null AS weight,
               COALESCE(d.title, 'Document') AS "text", u.name AS "by"
        FROM lot_documents d LEFT JOIN users u ON u.id = d.created_by WHERE d.lot_id = $1
      `, [id]),
      pool.query(`
        SELECT 'anomaly' AS kind, a.created_at AS "at", null AS weight,
               a.type AS "text", u.name AS "by"
        FROM anomalies a LEFT JOIN users u ON u.id = a.created_by WHERE a.lot_id = $1
      `, [id]),
      pool.query(`
        SELECT 'scan' AS kind, s.created_at AS "at", null AS weight,
               (CASE WHEN s.matched
                     THEN 'Batch validé : ' || s.scanned_code
                     ELSE 'Batch incorrect : ' || s.scanned_code || ' ≠ ' || s.expected_code END) AS "text",
               u.name AS "by"
        FROM lot_scan_verifications s LEFT JOIN users u ON u.id = s.created_by
        WHERE s.lot_id = $1
      `, [id])
    ]);

    const timeline = [
      ...weights.rows.map((r) => ({ ...r, text: `Poids : ${r.weight} kg` })),
      ...checks.rows,
      ...docs.rows,
      ...anoms.rows,
      ...scans.rows
    ].sort((a, b) => new Date(a.at) - new Date(b.at));

    res.json(timeline);
  } catch (err) {
    next(err);
  }
});

export default router;
