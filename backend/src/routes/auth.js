import { Router } from "express";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { signToken, publicUser, authenticate, authorize } from "../middleware/auth.js";

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES = ["operator", "manager", "admin"];

router.post("/register", authorize("admin"), async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Nom, email et mot de passe sont requis" });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: "Adresse email invalide" });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: "Mot de passe : 6 caractères minimum" });
    }
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: "Rôle invalide" });
    }
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
    if (existing.length) {
      return res.status(409).json({ error: "Cet email est déjà utilisé" });
    }
    const passwordHash = await bcrypt.hash(String(password), 10);
    const [created] = await db
      .insert(users)
      .values({ name: name.trim(), email: normalizedEmail, passwordHash, role })
      .returning();
    res.status(201).json(publicUser(created));
  } catch (err) {
    next(err);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email et mot de passe sont requis" });
    }
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);
    if (!user || !(await bcrypt.compare(String(password), user.passwordHash))) {
      return res.status(401).json({ error: "Identifiants incorrects" });
    }
    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.get("/me", authenticate, async (req, res, next) => {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.user.id)).limit(1);
    if (!user) {
      return res.status(401).json({ error: "Utilisateur introuvable" });
    }
    res.json(publicUser(user));
  } catch (err) {
    next(err);
  }
});

export default router;
