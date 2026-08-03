// Génération et validation des numéros de lot PF.
//
// Format :  y ddd ccc L [F] R
//   y   = année (1 chiffre, dernier chiffre de l'année)     ex : 2026 → « 6 »
//   ddd = jour julien (3 chiffres, jour dans l'année)        ex : 1 mai → 121
//   ccc = code usine (3 caractères)                          ex : 886
//   L   = ligne (1 caractère)                                ex : 1
//   F   = indicatif changement de date dans la même prod     ex : A (optionnel)
//   R   = numéro de course / run                              ex : 1
//
// Exemple : 61218861A1  →  6 | 121 | 886 | 1 | A | 1

export function parseDateOnly(value) {
  if (!value) return null;
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(date.getTime()) ? null : date;
}

// Jour julien (1..366) pour une date, en utilisant l'année calendaire.
export function julianDay(dateStr) {
  const d = parseDateOnly(dateStr);
  if (!d) return null;
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  const day = Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - start) / 86400000);
  return day + 1;
}

export function yearDigit(dateStr) {
  const d = parseDateOnly(dateStr);
  if (!d) return null;
  return String(d.getUTCFullYear()).slice(-1);
}

export function buildLotNumber({ productionDate, plantCode = "886", line = "1", flag = "", run = "1" }) {
  const jd = julianDay(productionDate);
  const yd = yearDigit(productionDate);
  if (jd == null || yd == null) return null;
  return `${yd}${String(jd).padStart(3, "0")}${String(plantCode).toUpperCase()}${String(line).toUpperCase()}${String(flag).toUpperCase()}${String(run)}`;
}

// Analyse un numéro de lot PF. Retourne null si le format est invalide.
// Longueur : 9 (sans indicatif) ou 10 (avec indicatif).
export function parseLotNumber(code) {
  const s = String(code || "").trim().toUpperCase();
  const m = s.match(/^(\d)(\d{3})([A-Z0-9]{3})([A-Z0-9])([A-Z])?([0-9])$/);
  if (!m) return null;
  const [, y, ddd, plantCode, line, flag, run] = m;
  const digit = Number(y);
  // Le chiffre d'année n'encode que le dernier chiffre : on prend l'année la
  // plus proche de l'année courante qui se termine par ce chiffre.
  const now = new Date().getFullYear();
  let year = now - ((now % 10) - digit);
  if (year > now) year -= 10;
  return {
    yearDigit: y,
    year,
    julianDay: Number(ddd),
    plantCode,
    line,
    flag: flag || "",
    run,
    full: s
  };
}

// Date approximative correspondant à un jour julien (pour l'aperçu / validation).
export function dateFromYearJulian(year, julian) {
  const jd = Number(julian);
  if (!jd || jd < 1 || jd > 366) return null;
  const date = new Date(Date.UTC(year, 0, jd));
  if (Number.isNaN(date.getTime())) return null;
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}-${mm}-${dd}`;
}
