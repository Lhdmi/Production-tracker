import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
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
import checkpointsRoutes from "./routes/checkpoints.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.set("trust proxy", config.trustProxy);
app.disable("x-powered-by");

app.use(
  helmet({
    // L'app est 100% même-origine : l'isolation COEP n'est pas nécessaire
    crossOriginEmbedderPolicy: false
  })
);

const allowedOrigins = [
  config.publicUrl,
  ...config.allowedOrigins
];
app.use(
  cors({
    origin(origin, cb) {
      // Requêtes sans origine (curl, server-to-server, même origine) : OK
      if (!origin) return cb(null, true);
      const ok =
        allowedOrigins.includes(origin) ||
        /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      return ok
        ? cb(null, true)
        : cb(Object.assign(new Error("Origine non autorisée"), { status: 403, expose: true }));
    }
  })
);

// Limite globale : 500 requêtes / 15 min / IP
app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Trop de requêtes, réessayez dans quelques minutes." }
  })
);

// Limite stricte sur la connexion : 10 essais / 15 min / IP
app.use(
  "/api/auth/login",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Trop de tentatives de connexion. Réessayez dans 15 minutes." }
  })
);

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
app.use("/api/quality/checkpoints", checkpointsRoutes);

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
