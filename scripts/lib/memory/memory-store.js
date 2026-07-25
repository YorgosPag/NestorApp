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

module.exports = {
  MEMORY_DIR,
  INDEX,
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
};
