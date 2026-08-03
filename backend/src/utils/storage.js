import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const uploadsDir = path.join(__dirname, "../../uploads");
export const UPLOAD_LIMIT = 10 * 1024 * 1024;

function ensureUploadsDir() {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureUploadsDir();
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || ".jpg").toLowerCase();
    const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
    cb(null, name);
  }
});

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif"
];

const fileFilter = (req, file, cb) => {
  if (file.mimetype && ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(null, true);
  }
  const err = Object.assign(new Error("Format d'image non autorisé"), { status: 415 });
  return cb(err);
};

export const uploadImage = multer({
  storage: diskStorage,
  fileFilter,
  limits: {
    fileSize: UPLOAD_LIMIT,
    files: 1
  }
});

export function toPublicUrl(file) {
  return `/uploads/${file.filename}`;
}

export function toAbsoluteUrl(relative) {
  if (/^https?:\/\//.test(relative)) return relative;
  return `${config.publicUrl}${relative}`;
}

export async function persistRemote(remoteUrl) {
  const res = await fetch(remoteUrl);
  if (!res.ok) throw new Error("Impossible de télécharger l'image distante");
  ensureUploadsDir();
  const ext = path.extname(new URL(remoteUrl).pathname) || ".jpg";
  const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
  const dest = path.join(uploadsDir, name);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  return `/uploads/${name}`;
}
