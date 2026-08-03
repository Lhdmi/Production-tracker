import { Router } from "express";
import { sql } from "drizzle-orm";
import { pool, db } from "../db/client.js";
import { rawMaterials } from "../db/schema.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();
router.use(authenticate);

const VALID_STATUSES = ["compliant", "non_compliant", "pending"];

async function getMaterialRow(id) {
  const { rows } = await pool.query(
    `SELECT rm.id, rm.lot_number AS "lotNumber", rm.ot_number AS "otNumber",
            rm.designation, rm.reference, rm.best_before AS "bestBefore",
            rm.production_date AS "productionDate", rm.supplier,
            rm.quantity::float8 AS quantity, rm.quality_status AS "qualityStatus",
            rm.created_at AS "createdAt", u.name AS "createdByName",
            (SELECT count(*)::int FROM lot_raw_materials lrm WHERE lrm.raw_material_id = rm.id) AS "linkedLots"
     FROM raw_materials rm
     LEFT JOIN users u ON u.id = rm.created_by
     WHERE rm.id = $1`,
    [id]
  );
  return rows[0];
}

router.get("/", async (req, res, next) => {
  try {
    const q = (req.query.q || "").toString().trim();
    const status = (req.query.status || "").toString().trim();
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || "25", 10)));

    const where = [];
    const params = [];
    if (q) {
      params.push(`%${q}%`);
      where.push(
        `(rm.lot_number ILIKE $${params.length} OR rm.designation ILIKE $${params.length} OR rm.reference ILIKE $${params.length} OR rm.supplier ILIKE $${params.length})`
      );
    }
    if (VALID_STATUSES.includes(status)) {
      params.push(status);
      where.push(`rm.quality_status = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `SELECT rm.id, rm.lot_number AS "lotNumber", rm.ot_number AS "otNumber",
              rm.designation, rm.reference, rm.best_before AS "bestBefore",
              rm.production_date AS "productionDate", rm.supplier,
              rm.quantity::float8 AS quantity, rm.quality_status AS "qualityStatus",
              rm.created_at AS "createdAt", u.name AS "createdByName",
              (SELECT count(*)::int FROM lot_raw_materials lrm WHERE lrm.raw_material_id = rm.id) AS "linkedLots"
       FROM raw_materials rm
       LEFT JOIN users u ON u.id = rm.created_by
       ${whereSql}
       ORDER BY rm.id DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, (page - 1) * pageSize]
    );

    const total = parseInt(
      (
        await pool.query(
          `SELECT count(*)::int AS total FROM raw_materials rm ${whereSql}`,
          params
        )
      ).rows[0].total,
      10
    );

    res.json({ rows, total, page, pageSize });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const row = await getMaterialRow(id);
    if (!row) return res.status(404).json({ error: "Lot matière première introuvable" });
    res.json(row);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const lotNumber = (req.body?.lotNumber || "").toString().trim();
    if (!lotNumber) {
      return res.status(400).json({ error: "Numéro de lot MP requis" });
    }
    const dup = (await db.select().from(rawMaterials).where(sql`${rawMaterials.lotNumber} = ${lotNumber}`).limit(1))[0];
    if (dup) {
      return res.status(409).json({ error: "Ce lot MP existe déjà", id: dup.id });
    }

    const quantity = Number(req.body?.quantity);
    const [created] = await db
      .insert(rawMaterials)
      .values({
        lotNumber,
        otNumber: (req.body?.otNumber || "").toString().trim() || null,
        designation: (req.body?.designation || "").toString().trim() || null,
        reference: (req.body?.reference || "").toString().trim() || null,
        bestBefore: req.body?.bestBefore || null,
        productionDate: req.body?.productionDate || null,
        supplier: (req.body?.supplier || "").toString().trim() || null,
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity.toFixed(3) : null,
        qualityStatus: VALID_STATUSES.includes(req.body?.qualityStatus) ? req.body.qualityStatus : "pending",
        createdBy: req.user.id
      })
      .returning();

    res.status(201).json(await getMaterialRow(created.id));
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [existing] = await db.select().from(rawMaterials).where(sql`${rawMaterials.id} = ${id}`).limit(1);
    if (!existing) return res.status(404).json({ error: "Lot matière première introuvable" });

    const patch = {};
    const text = (v) => (typeof v === "string" ? v.trim() || null : undefined);
    if (req.body?.lotNumber !== undefined) {
      const ln = text(req.body.lotNumber);
      if (!ln) return res.status(400).json({ error: "Numéro de lot MP requis" });
      patch.lotNumber = ln;
    }
    if (req.body?.otNumber !== undefined) patch.otNumber = text(req.body.otNumber);
    if (req.body?.designation !== undefined) patch.designation = text(req.body.designation);
    if (req.body?.reference !== undefined) patch.reference = text(req.body.reference);
    if (req.body?.supplier !== undefined) patch.supplier = text(req.body.supplier);
    if (req.body?.bestBefore !== undefined) patch.bestBefore = req.body.bestBefore || null;
    if (req.body?.productionDate !== undefined) patch.productionDate = req.body.productionDate || null;
    if (req.body?.quantity !== undefined) {
      const q = Number(req.body.quantity);
      patch.quantity = Number.isFinite(q) && q > 0 ? q.toFixed(3) : null;
    }
    if (req.body?.qualityStatus !== undefined) {
      if (!VALID_STATUSES.includes(req.body.qualityStatus)) {
        return res.status(400).json({ error: "Statut qualité invalide" });
      }
      patch.qualityStatus = req.body.qualityStatus;
    }

    if (!Object.keys(patch).length) return res.json(existing);
    await db.update(rawMaterials).set(patch).where(sql`${rawMaterials.id} = ${id}`);
    res.json(await getMaterialRow(id));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", authorize("manager", "admin"), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [existing] = await db.select().from(rawMaterials).where(sql`${rawMaterials.id} = ${id}`).limit(1);
    if (!existing) return res.status(404).json({ error: "Lot matière première introuvable" });
    const { rows } = await pool.query("SELECT count(*)::int AS n FROM lot_raw_materials WHERE raw_material_id = $1", [id]);
    if (rows[0].n > 0) {
      return res.status(409).json({
        error: "Ce lot MP est lié à des lots PF (traçabilité). Désactivez-le ou déliez-le d'abord."
      });
    }
    await db.delete(rawMaterials).where(sql`${rawMaterials.id} = ${id}`);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
