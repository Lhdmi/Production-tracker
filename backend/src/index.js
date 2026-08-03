import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { pingDb, closeDb } from "./db/client.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";
import { uploadsDir } from "./utils/storage.js";
import authRoutes from "./routes/auth.js";
import opsRoutes from "./routes/ops.js";
import lotsRoutes from "./routes/lots.js";
import anomaliesRoutes, { lotAnomalyRouter } from "./routes/anomalies.js";
import adminRoutes from "./routes/admin.js";
import exportRoutes from "./routes/export.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.disable("x-powered-by");
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

fs.mkdirSync(uploadsDir, { recursive: true });
app.use("/uploads", express.static(uploadsDir, { maxAge: "7d" }));

app.get("/api/health", async (req, res) => {
  try {
    await pingDb();
    res.json({ status: "ok", db: "connected" });
  } catch {
    res.status(503).json({ status: "degraded", db: "unavailable" });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/ops", opsRoutes);
app.use("/api/lots", lotsRoutes);
app.use("/api/lots", lotAnomalyRouter);
app.use("/api/anomalies", anomaliesRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/export", exportRoutes);

const frontendDist = path.join(__dirname, "../../frontend/dist");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get(/^\/(?!api|uploads).*/, (req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

app.use("/api", notFound);
app.use(errorHandler);

async function start() {
  try {
    await pingDb();
    console.log("✓ PostgreSQL connecté");
  } catch {
    console.warn("⚠  PostgreSQL indisponible — l'API répondra mais les requêtes DB échoueront.");
    console.warn("   Démarrez la base :  docker compose up -d   puis :  npm run db:push && npm run db:seed");
  }

  const server = app.listen(config.port, () => {
    console.log(`✓ API en écoute sur http://localhost:${config.port}`);
    if (!fs.existsSync(frontendDist)) {
      console.log(`  Frontend (dev) : http://localhost:5173`);
    }
  });

  const shutdown = async () => {
    console.log("\nArrêt en cours…");
    server.close(async () => {
      try {
        await closeDb();
      } finally {
        process.exit(0);
      }
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start();
