import bcrypt from "bcryptjs";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { pool, closeDb } from "./client.js";
import { uploadsDir } from "../utils/storage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEMO_USERS = [
  { name: "Admin Principal", email: "admin@example.com", password: "admin123", role: "admin" },
  { name: "Manager Production", email: "manager@example.com", password: "manager123", role: "manager" },
  { name: "Opérateur Ligne 1", email: "operator@example.com", password: "operator123", role: "operator" }
];

const DEMO_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR4nGP4z8DA8B8DGoY0AJmWAQEPt4ZSAAAAAElFTkSuQmCC",
  "base64"
);

async function main() {
  const { rows: existing } = await pool.query("SELECT email FROM users");
  const existingEmails = new Set(existing.map((r) => r.email));

  const ids = {};
  for (const u of DEMO_USERS) {
    if (existingEmails.has(u.email)) {
      const [row] = (await pool.query("SELECT id FROM users WHERE email = $1", [u.email])).rows;
      ids[u.email] = row.id;
      console.log(`= utilisateur existant : ${u.email}`);
      continue;
    }
    const hash = await bcrypt.hash(u.password, 10);
    const [row] = (await pool.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id",
      [u.name, u.email, hash, u.role]
    )).rows;
    ids[u.email] = row.id;
    console.log(`+ utilisateur créé : ${u.email} / ${u.password} (${u.role})`);
  }

  const { rows: checkpointCount } = await pool.query("SELECT count(*)::int AS n FROM quality_checkpoints");
  if (checkpointCount[0].n === 0) {
    const checkpoints = [
      ["Température de process", "Température relevée conforme au prérequis du process.", 1],
      ["Aspect visuel", "Absence de défauts visibles (couleur, texture, traces).", 2],
      ["Conformité emballage", "Emballage, étiquetage et marquage conformes.", 3],
      ["Masse / poids", "Poids dans la plage cible de l'OP.", 4],
      ["Traçabilité / lots matière", "Références matières et numéros de lot tracés.", 5]
    ];
    for (const [name, description, sortOrder] of checkpoints) {
      await pool.query(
        "INSERT INTO quality_checkpoints (name, description, sort_order) VALUES ($1,$2,$3)",
        [name, description, sortOrder]
      );
    }
    console.log(`+ ${checkpoints.length} points de contrôle qualité créés`);
  }

  const { rows: lotCount } = await pool.query("SELECT count(*)::int AS n FROM lots");
  if (lotCount[0].n > 0) {
    console.log("= Des lots existent déjà, données de démo ignorées.");
    await closeDb();
    return;
  }

  const [op1] = (await pool.query(
    "INSERT INTO ops (op_number, created_by) VALUES ($1,$2) RETURNING id",
    ["OP-2026-001", ids["manager@example.com"]]
  )).rows;
  const [op2] = (await pool.query(
    "INSERT INTO ops (op_number, created_by) VALUES ($1,$2) RETURNING id",
    ["OP-2026-002", ids["manager@example.com"]]
  )).rows;

  const [lot1] = (await pool.query(
    "INSERT INTO lots (op_id, lot_number, status, created_by, completed_at) VALUES ($1,$2,'completed',$3, now()) RETURNING id",
    [op1.id, "LOT-A-0001", ids["operator@example.com"]]
  )).rows;
  const [lot2] = (await pool.query(
    "INSERT INTO lots (op_id, lot_number, status, created_by) VALUES ($1,$2,'anomaly',$3) RETURNING id",
    [op1.id, "LOT-A-0002", ids["operator@example.com"]]
  )).rows;
  const [lot3] = (await pool.query(
    "INSERT INTO lots (op_id, lot_number, status, created_by) VALUES ($1,$2,'in_progress',$3) RETURNING id",
    [op2.id, "LOT-B-0001", ids["operator@example.com"]]
  )).rows;

  const weights = [
    [lot1.id, 12.4], [lot1.id, 12.6], [lot1.id, 12.2], [lot1.id, 12.5],
    [lot2.id, 11.9], [lot2.id, 10.8], [lot2.id, 10.2],
    [lot3.id, 12.3], [lot3.id, 12.4]
  ];
  for (const [lotId, weight] of weights) {
    await pool.query(
      "INSERT INTO weights (lot_id, weight, created_by) VALUES ($1,$2,$3)",
      [lotId, weight, ids["operator@example.com"]]
    );
  }
  console.log(`+ ${weights.length} relevés de poids créés`);

  fs.mkdirSync(uploadsDir, { recursive: true });
  const demoImage = "demo-anomalie.png";
  fs.writeFileSync(path.join(uploadsDir, demoImage), DEMO_PNG);

  const [anom] = (await pool.query(
    "INSERT INTO anomalies (lot_id, type, description, severity, status, created_by) VALUES ($1,$2,$3,$4,'open',$5) RETURNING id",
    [lot2.id, "Masse hors tolérance", "Poids mesuré 10.2 kg, hors de la plage cible (11.5 – 12.8 kg). Contrôle à refaire sur la ligne 1.",
      "high", ids["operator@example.com"]]
  )).rows;
  await pool.query("INSERT INTO photos (anomaly_id, url) VALUES ($1,$2)", [anom.id, `/uploads/${demoImage}`]);
  console.log("+ 1 anomalie ouverte avec photo de démo");

  await pool.query("DELETE FROM exports");

  console.log("✓ Seed terminé. Comptes : admin@example.com / manager@example.com / operator@example.com");
  await closeDb();
}

main().catch((err) => {
  console.error("Erreur seed :", err);
  process.exit(1);
});
