import { Router } from "express";
import { sql } from "drizzle-orm";
import { pool, db } from "../db/client.js";
import { exportsLog } from "../db/schema.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();
router.use(authenticate, authorize("manager", "admin"));

const SEVERITY_FR = { low: "Faible", medium: "Moyenne", high: "Élevée", critical: "Critique" };
const LOT_STATUS_FR = { in_progress: "En cours", completed: "Terminé", anomaly: "En anomalie" };
const ANOMALY_STATUS_FR = { open: "Ouverte", validated: "Validée", rejected: "Rejetée" };

function esc(value) {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(rows, headers) {
  const head = headers.map((h) => h.label).join(";");
  const body = rows.map((r) => headers.map((h) => esc(r[h.key])).join(";"));
  return `\uFEFF${[head, ...body].join("\r\n")}`;
}

async function respondCsv(req, res, next, filename, headers, rows) {
  try {
    const csv = toCsv(rows, headers);
    await db.insert(exportsLog).values({ userId: req.user.id, entity: filename, rowCount: rows.length });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
}

router.get("/lots.csv", async (req, res, next) => {
  try {
    const q = (req.query.q || "").toString().trim();
    const { rows } = await pool.query(`
      SELECT o.op_number AS "OP", l.lot_number AS "Lot",
             l.status AS "Statut",
             (SELECT count(*)::int FROM weights w WHERE w.lot_id = l.id) AS "NbReleves",
             (SELECT COALESCE(sum(w.weight),0)::float8 FROM weights w WHERE w.lot_id = l.id) AS "PoidsTotal",
             COALESCE(u.name,'') AS "CreePar",
             to_char(l.created_at, 'DD/MM/YYYY HH24:MI') AS "CreeLe",
             COALESCE(to_char(l.completed_at, 'DD/MM/YYYY HH24:MI'),'') AS "TermineLe"
      FROM lots l
      JOIN ops o ON o.id = l.op_id
      LEFT JOIN users u ON u.id = l.created_by
      ${q ? "WHERE o.op_number ILIKE $1 OR l.lot_number ILIKE $1" : ""}
      ORDER BY l.id DESC
    `, q ? [`%${q}%`] : []);
    const mapped = rows.map((r) => ({ ...r, Statut: LOT_STATUS_FR[r.Statut] || r.Statut }));
    const headers = [
      { key: "OP", label: "Ordre de production" },
      { key: "Lot", label: "Numéro de lot" },
      { key: "Statut", label: "Statut" },
      { key: "NbReleves", label: "Nb relevés" },
      { key: "PoidsTotal", label: "Poids total (kg)" },
      { key: "CreePar", label: "Créé par" },
      { key: "CreeLe", label: "Créé le" },
      { key: "TermineLe", label: "Terminé le" }
    ];
    await respondCsv(req, res, next, "lots.csv", headers, mapped);
  } catch (err) {
    next(err);
  }
});

router.get("/anomalies.csv", async (req, res, next) => {
  try {
    const status = (req.query.status || "").toString();
    const { rows } = await pool.query(`
      SELECT o.op_number AS "OP", l.lot_number AS "Lot",
             a.type AS "Type", a.description AS "Description",
             a.severity AS "Gravite", a.status AS "Statut",
             COALESCE(a.comment,'') AS "Commentaire",
             (SELECT string_agg(p.url, ', ' ORDER BY p.id) FROM photos p WHERE p.anomaly_id = a.id) AS "Photos",
             COALESCE(u.name,'') AS "CreePar",
             to_char(a.created_at, 'DD/MM/YYYY HH24:MI') AS "CreeLe",
             COALESCE(v.name,'') AS "ValidePar",
             COALESCE(to_char(a.validated_at, 'DD/MM/YYYY HH24:MI'),'') AS "ValideLe"
      FROM anomalies a
      JOIN lots l ON l.id = a.lot_id
      JOIN ops o ON o.id = l.op_id
      LEFT JOIN users u ON u.id = a.created_by
      LEFT JOIN users v ON v.id = a.validated_by
      ${["open", "validated", "rejected"].includes(status) ? "WHERE a.status = $1" : ""}
      ORDER BY a.id DESC
    `, ["open", "validated", "rejected"].includes(status) ? [status] : []);
    const mapped = rows.map((r) => ({
      ...r,
      Gravite: SEVERITY_FR[r.Gravite] || r.Gravite,
      Statut: ANOMALY_STATUS_FR[r.Statut] || r.Statut
    }));
    const headers = [
      { key: "OP", label: "Ordre de production" },
      { key: "Lot", label: "Numéro de lot" },
      { key: "Type", label: "Type d'anomalie" },
      { key: "Description", label: "Description" },
      { key: "Gravite", label: "Gravité" },
      { key: "Statut", label: "Statut" },
      { key: "Commentaire", label: "Commentaire" },
      { key: "Photos", label: "Photos" },
      { key: "CreePar", label: "Créé par" },
      { key: "CreeLe", label: "Créé le" },
      { key: "ValidePar", label: "Validé par" },
      { key: "ValideLe", label: "Validé le" }
    ];
    await respondCsv(req, res, next, "anomalies.csv", headers, mapped);
  } catch (err) {
    next(err);
  }
});

router.get("/ops.csv", async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT o.op_number AS "OP",
             (SELECT count(*)::int FROM lots l WHERE l.op_id = o.id) AS "NbLots",
             to_char(o.created_at, 'DD/MM/YYYY HH24:MI') AS "CreeLe"
      FROM ops o
      ORDER BY o.id DESC
    `);
    const headers = [
      { key: "OP", label: "Ordre de production" },
      { key: "NbLots", label: "Nb lots" },
      { key: "CreeLe", label: "Créé le" }
    ];
    await respondCsv(req, res, next, "ops.csv", headers, rows);
  } catch (err) {
    next(err);
  }
});

router.get("/weights.csv", async (req, res, next) => {
  try {
    const lotId = parseInt(req.query.lotId || "0", 10);
    const { rows } = await pool.query(`
      SELECT o.op_number AS "OP", l.lot_number AS "Lot",
             w.weight::float8 AS "Poids",
             COALESCE(u.name,'') AS "SaisiPar",
             to_char(w.created_at, 'DD/MM/YYYY HH24:MI:SS') AS "Date"
      FROM weights w
      JOIN lots l ON l.id = w.lot_id
      JOIN ops o ON o.id = l.op_id
      LEFT JOIN users u ON u.id = w.created_by
      ${lotId ? "WHERE w.lot_id = $1" : ""}
      ORDER BY w.id DESC
    `, lotId ? [lotId] : []);
    const headers = [
      { key: "OP", label: "Ordre de production" },
      { key: "Lot", label: "Numéro de lot" },
      { key: "Poids", label: "Poids (kg)" },
      { key: "SaisiPar", label: "Saisi par" },
      { key: "Date", label: "Date" }
    ];
    await respondCsv(req, res, next, "poids.csv", headers, rows);
  } catch (err) {
    next(err);
  }
});

export default router;
