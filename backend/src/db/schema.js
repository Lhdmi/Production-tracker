import { pgTable, pgEnum, serial, varchar, text, integer, numeric, timestamp, date, boolean } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["operator", "manager", "admin"]);
export const lotStatusEnum = pgEnum("lot_status", ["in_progress", "completed", "anomaly"]);
export const anomalyStatusEnum = pgEnum("anomaly_status", ["open", "validated", "rejected"]);
export const severityEnum = pgEnum("severity", ["low", "medium", "high", "critical"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("operator"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const ops = pgTable("ops", {
  id: serial("id").primaryKey(),
  opNumber: varchar("op_number", { length: 50 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: integer("created_by").references(() => users.id)
});

export const lots = pgTable("lots", {
  id: serial("id").primaryKey(),
  opId: integer("op_id").notNull().references(() => ops.id),
  lotNumber: varchar("lot_number", { length: 50 }).notNull(),
  status: lotStatusEnum("status").notNull().default("in_progress"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdBy: integer("created_by").references(() => users.id)
});

export const weights = pgTable("weights", {
  id: serial("id").primaryKey(),
  lotId: integer("lot_id").notNull().references(() => lots.id),
  weight: numeric("weight", { precision: 10, scale: 3 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: integer("created_by").references(() => users.id)
});

export const anomalies = pgTable("anomalies", {
  id: serial("id").primaryKey(),
  lotId: integer("lot_id").notNull().references(() => lots.id),
  type: varchar("type", { length: 80 }).notNull(),
  description: text("description").notNull(),
  severity: severityEnum("severity").notNull().default("medium"),
  status: anomalyStatusEnum("status").notNull().default("open"),
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
  validatedBy: integer("validated_by").references(() => users.id),
  validatedAt: timestamp("validated_at", { withTimezone: true })
});

export const photos = pgTable("photos", {
  id: serial("id").primaryKey(),
  anomalyId: integer("anomaly_id").notNull().references(() => anomalies.id),
  url: text("url").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const checkStatusEnum = pgEnum("check_status", ["compliant", "non_compliant", "na"]);

export const qualityCheckpoints = pgTable("quality_checkpoints", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const qualityChecks = pgTable("quality_checks", {
  id: serial("id").primaryKey(),
  lotId: integer("lot_id").notNull().references(() => lots.id),
  checkpointId: integer("checkpoint_id").notNull().references(() => qualityCheckpoints.id),
  status: checkStatusEnum("status").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: integer("created_by").references(() => users.id)
});

export const lotDocuments = pgTable("lot_documents", {
  id: serial("id").primaryKey(),
  lotId: integer("lot_id").notNull().references(() => lots.id),
  title: varchar("title", { length: 120 }),
  imageUrl: text("image_url"),
  ocrText: text("ocr_text"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: integer("created_by").references(() => users.id)
});

export const lotScanVerifications = pgTable("lot_scan_verifications", {
  id: serial("id").primaryKey(),
  lotId: integer("lot_id").notNull().references(() => lots.id),
  scannedCode: varchar("scanned_code", { length: 255 }).notNull(),
  expectedCode: varchar("expected_code", { length: 255 }).notNull(),
  matched: boolean("matched").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: integer("created_by").references(() => users.id)
});

export const exportsLog = pgTable("exports", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  entity: varchar("entity", { length: 50 }).notNull(),
  rowCount: integer("row_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
