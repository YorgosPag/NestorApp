/**
 * memory-store.js — ΕΝΑΣ ορισμός «τι είναι αρχείο memory» (I/O + frontmatter).
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ: το `memory-health.js` (όργανο μέτρησης) και το
 * `memory-normalize-ids.js` (codemod) διαβάζουν τα ΙΔΙΑ αρχεία με τους ΙΔΙΟΥΣ
 * κανόνες. Αν ο καθένας κρατούσε δικό του parser, θα απέκλιναν — και η απόκλιση
 * σε εργαλείο ταυτότητας σημαίνει σιωπηλά χαμένη γνώση. Ένας parser, δύο πελάτες.
 *
 * ΠΑΓΙΔΑ ΠΟΥ ΚΛΕΙΝΕΙ ΕΔΩ (Φάση 1, τεκμηριωμένη): 14 από τα 451 αρχεία είναι CRLF,
 * τα υπόλοιπα LF. Κάθε regex `^---\n` αποτυγχάνει ΣΙΩΠΗΛΑ στα CRLF — δεν πετάει
 * σφάλμα, απλώς «δεν βρίσκει frontmatter» και το αρχείο εξαφανίζεται από τη
 * μέτρηση. Όλα τα patterns εδώ είναι `\r?\n` και η εγγραφή ΔΙΑΤΗΡΕΙ το αρχικό EOL.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const MEMORY_DIR =
  process.env.CLAUDE_MEMORY_DIR ||
  path.join(os.homedir(), '.claude', 'projects', 'C--Nestor-Pagonis', 'memory');

/** Το ευρετήριο — ρίζα του γράφου, ΔΕΝ είναι το ίδιο memory. */
const INDEX = 'MEMORY.md';

/**
 * Όρια μεγέθους ευρετηρίου — ΔΕΝ είναι δικά μας, τα επιβάλλει ο harness.
 *
 * Το μήνυμα που εκπέμπει το `PostToolUse` hook είναι αυτολεξεί:
 *   «approaching the 24.4KB read limit. Compact it to under 17.1KB now»
 *
 * Άρα υπάρχουν ΔΥΟ κατώφλια, όχι ένα, και η διαφορά τους έχει σημασία:
 *   • SOFT (17.1 KB) — το σημείο που ζητά συμπύκνωση. Ανακτήσιμο, κανένα κόστος.
 *   • HARD (24.4 KB) — το ευρετήριο **ΑΠΟΚΟΠΤΕΤΑΙ ΣΙΩΠΗΛΑ**. Το κάτω μισό απλώς
 *     δεν φορτώνεται· καμία προειδοποίηση, πουθενά. Ό,τι κόπηκε δεν υπάρχει.
 *
 * ΓΙΑΤΙ σταθερές εδώ και όχι στην αναφορά: το όριο είναι ιδιότητα ΤΟΥ ΕΥΡΕΤΗΡΙΟΥ,
 * όπως το `INDEX` και το `indexBytes()`. Ένα δεύτερο εργαλείο που θα θελήσει να το
 * ελέγξει (gate, CI) πρέπει να βρει τον ΙΔΙΟ αριθμό — όχι αντίγραφο που θα αποκλίνει.
 *
 * ⚠️ ΣΕ BYTES, ΠΟΤΕ ΣΕ ΧΑΡΑΚΤΗΡΕΣ: το ευρετήριο είναι ελληνικά, 2 bytes/χαρακτήρα
 * σε UTF-8. Μέτρηση με `.length` δίνει ~μισό του πραγματικού και «περνά» ενώ κόβεται.
 */
const KB = 1024;
const INDEX_SOFT_LIMIT = Math.floor(17.1 * KB); // 17.510 — «compact it to under»
const INDEX_HARD_LIMIT = Math.floor(24.4 * KB); // 24.985 — σιωπηλή αποκοπή
/** Προειδοποίηση πριν την υπέρβαση: ένα gate που χτυπά μόνο αφού σπάσει αργεί. */
const INDEX_WARN_RATIO = 0.9;

/** Ο αρχειακός βαθμίδα δεν σαρώνεται (μη-recursive) — by design, βλ. contract. */
function listSlugs() {
  if (!fs.existsSync(MEMORY_DIR)) {
    throw new Error(
      `Δεν βρέθηκε ο φάκελος memory: ${MEMORY_DIR}\n  Όρισε CLAUDE_MEMORY_DIR αν είναι αλλού.`,
    );
  }
  return new Set(
    fs
      .readdirSync(MEMORY_DIR)
      .filter((f) => f.endsWith('.md') && f !== INDEX)
      .map((f) => f.slice(0, -3)),
  );
}

/**
 * Υπάρχει ο φάκελος; Το gate ΠΡΕΠΕΙ να το ρωτήσει πριν κάνει οτιδήποτε: ο φάκελος
 * είναι user-level και **δεν είναι git-tracked** → σε CI ή σε άλλο μηχάνημα απλώς
 * δεν υπάρχει. Εκεί το σωστό είναι **skip**, όχι fail (ένα gate που κοκκινίζει
 * επειδή λείπει κάτι που δεν όφειλε να υπάρχει, γίνεται θόρυβος και το αγνοούν).
 */
const memoryDirExists = () => fs.existsSync(MEMORY_DIR);

const pathOf = (slug) => path.join(MEMORY_DIR, `${slug}.md`);

const readRaw = (slug) => fs.readFileSync(pathOf(slug), 'utf8');
const writeRaw = (slug, text) => fs.writeFileSync(pathOf(slug), text, 'utf8');
const sizeOf = (slug) => fs.statSync(pathOf(slug)).size;
const readIndex = () => fs.readFileSync(path.join(MEMORY_DIR, INDEX), 'utf8');
const indexBytes = () => fs.statSync(path.join(MEMORY_DIR, INDEX)).size;

/**
 * Χωρίζει YAML frontmatter από σώμα. Επιστρέφει null αν δεν υπάρχει frontmatter —
 * ο καλών ΠΡΕΠΕΙ να το χειριστεί ρητά (σιωπηλό `''` ήταν η αιτία της Φ1 παγίδας).
 */
function splitFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const start = m[0].indexOf(m[1]); // ακριβές offset — όχι indexOf πάνω σε όλο το κείμενο
  return {
    frontmatter: m[1],
    start,
    end: start + m[1].length,
    eol: /\r\n/.test(raw) ? '\r\n' : '\n',
  };
}

/** Τιμή πεδίου frontmatter (πρώτη εμφάνιση), ή null. Μόνο εντός frontmatter. */
function readField(raw, key) {
  const fm = splitFrontmatter(raw);
  if (!fm) return null;
  const m = fm.frontmatter.match(new RegExp(`^${key}:[ \\t]*(.*)$`, 'm'));
  return m ? m[1].trim() : null;
}

/**
 * Αντικαθιστά ΜΙΑ γραμμή πεδίου μέσα στο frontmatter, διατηρώντας θέση και EOL.
 * Δεν αγγίζει το σώμα — ένα `name:` σε παράδειγμα τεκμηρίωσης μένει ανέπαφο.
 * Επιστρέφει το νέο κείμενο, ή null αν το πεδίο δεν υπάρχει (δεν εφευρίσκουμε πεδία).
 */
function setField(raw, key, value) {
  const fm = splitFrontmatter(raw);
  if (!fm) return null;
  const re = new RegExp(`^${key}:[ \\t]*(.*)$`, 'm');
  if (!re.test(fm.frontmatter)) return null;
  const updated = fm.frontmatter.replace(re, `${key}: ${value}`);
  return raw.slice(0, fm.start) + updated + raw.slice(fm.end);
}

/**
 * Σαν το `setField`, αλλά ΠΡΟΣΘΕΤΕΙ το πεδίο αν λείπει (αμέσως μετά το `afterKey`).
 * ΓΙΑΤΙ ξεχωριστή συνάρτηση: το `setField` αρνείται επίτηδες να εφευρίσκει πεδία — μια
 * μαζική εγγραφή που «διορθώνει» με το να προσθέτει άγνωστα κλειδιά είναι επικίνδυνη.
 * Η εισαγωγή είναι ρητή πρόθεση του καλούντος, όχι σιωπηλή παρενέργεια.
 */
function upsertField(raw, key, value, afterKey = 'description') {
  const existing = setField(raw, key, value);
  if (existing !== null) return existing;
  const fm = splitFrontmatter(raw);
  if (!fm) return null;
  const anchor = new RegExp(`^${afterKey}:.*$`, 'm');
  if (!anchor.test(fm.frontmatter)) return null;
  const updated = fm.frontmatter.replace(anchor, (line) => `${line}${fm.eol}${key}: ${value}`);
  return raw.slice(0, fm.start) + updated + raw.slice(fm.end);
}

/**
 * Ταξινομεί το μέγεθος του ευρετηρίου σε ΕΝΑ από 4 επίπεδα. Ζει εδώ (όχι στην
 * αναφορά) ώστε report, gate και CI να δίνουν την ΙΔΙΑ απάντηση για τα ίδια bytes.
 *
 *   ok       — άνετα κάτω από το soft limit
 *   warn     — ≥90% του soft· δεν μπλοκάρει, αλλά το περιθώριο τελειώνει
 *   over     — πάνω από το soft· ο harness ζητά ήδη συμπύκνωση    → ΜΠΛΟΚ
 *   critical — πάνω από το hard· **ήδη αποκόπτεται σιωπηλά**      → ΜΠΛΟΚ
 */
function classifyIndexSize(bytes) {
  const margin = INDEX_SOFT_LIMIT - bytes;
  const level =
    bytes > INDEX_HARD_LIMIT
      ? 'critical'
      : bytes > INDEX_SOFT_LIMIT
        ? 'over'
        : bytes >= INDEX_SOFT_LIMIT * INDEX_WARN_RATIO
          ? 'warn'
          : 'ok';
  return { bytes, margin, level, blocking: level === 'over' || level === 'critical' };
}

module.exports = {
  MEMORY_DIR,
  INDEX,
  INDEX_SOFT_LIMIT,
  INDEX_HARD_LIMIT,
  INDEX_WARN_RATIO,
  classifyIndexSize,
  memoryDirExists,
  listSlugs,
  pathOf,
  readRaw,
  writeRaw,
  sizeOf,
  readIndex,
  indexBytes,
  splitFrontmatter,
  readField,
  setField,
  upsertField,
};
