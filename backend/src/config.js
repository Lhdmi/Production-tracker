import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  databaseUrl:
    process.env.DATABASE_URL ||
    "postgres://postgres:postgres@localhost:5432/production_tracker",
  jwtSecret: process.env.JWT_SECRET || "dev-only-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "12h",
  publicUrl: process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3001}`,
  storageDriver: process.env.STORAGE_DRIVER || "local",
  // Origines autorisées pour CORS (séparées par des virgules). Si vide,
  // seule la PUBLIC_URL (et localhost en dev) sont autorisées.
  allowedOrigins: (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  // Derrière le Ingress nginx : 1 proxy → on utilise X-Forwarded-For
  trustProxy: process.env.TRUST_PROXY ? parseInt(process.env.TRUST_PROXY, 10) : 1,
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
    apiKey: process.env.CLOUDINARY_API_KEY || "",
    apiSecret: process.env.CLOUDINARY_API_SECRET || "",
    folder: process.env.CLOUDINARY_FOLDER || "production_tracker"
  }
};
