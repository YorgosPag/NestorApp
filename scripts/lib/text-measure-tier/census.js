/**
 * CHECK 3.64 — Ο ΣΥΓΚΕΝΤΡΩΤΗΣ ΤΗΣ ΑΠΟΓΡΑΦΗΣ (ADR-799 Φάση 2)
 *
 * Διαβάζει τα NDJSON ανά worker, τα ενώνει σε **μία** εγγραφή ανά αρχείο test, και
 * υπογράφει το αποτέλεσμα με **αποτύπωμα περιεχομένου** των εισόδων.
 *
 * ⚠️ **ΤΟ `mtime` ΔΕΝ ΕΙΝΑΙ ΣΗΜΑ** (μάθημα CHECK 3.33): ένα `git checkout` το αλλάζει χωρίς
 * να αλλάξει τίποτα, και ένα `touch` το αλλάζει χωρίς να αλλάξει τίποτα προς την άλλη
 * κατεύθυνση. Η φρεσκάδα κρίνεται με **sha256 του περιεχομένου**.
 */

'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const CENSUS_DIR = '.text-measure-census';
const CENSUS_FILE = '.text-measure-census.json';

const toPosix = (p) => p.split(path.sep).join('/');

/** sha256 ενός αρχείου· `null` αν λείπει (το «λείπει» είναι πληροφορία, όχι σφάλμα εδώ). */
function hashFile(repoRoot, rel) {
  const abs = path.join(repoRoot, rel);
  if (!fs.existsSync(abs)) return null;
  return crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex').slice(0, 16);
}

/** Τα αρχεία που καθορίζουν **τι θα παρατηρηθεί**: η μηχανή μέτρησης + οι ίδιες οι σουίτες. */
function fingerprintInputs(repoRoot, files) {
  const engine = [
    'src/subapps/dxf-viewer/text-engine/fonts/text-advance.ts',
    'src/subapps/dxf-viewer/text-engine/fonts/__tests__/_stub-font.ts',
  ];
  const parts = {};
  for (const rel of [...engine, ...files].sort()) parts[rel] = hashFile(repoRoot, rel);
  return parts;
}

/** Ενώνει τα NDJSON των workers. Δύο γραμμές για το ίδιο αρχείο ⇒ αθροίζονται. */
function collectRuns(repoRoot) {
  const dir = path.join(repoRoot, CENSUS_DIR);
  if (!fs.existsSync(dir)) return null;
  const merged = new Map();
  for (const name of fs.readdirSync(dir).filter((f) => f.endsWith('.ndjson'))) {
    for (const line of fs.readFileSync(path.join(dir, name), 'utf8').split(/\r?\n/)) {
      if (!line.trim()) continue;
      const row = JSON.parse(line);
      const prev = merged.get(row.file);
      if (!prev) { merged.set(row.file, { ...row, dropped: [...row.dropped] }); continue; }
      prev.glyph += row.glyph;
      prev.css += row.css;
      prev.nominal += row.nominal;
      prev.dropped = [...new Set([...prev.dropped, ...row.dropped])].sort();
    }
  }
  return merged.size === 0 ? null : merged;
}

/** Γράφει την υπογεγραμμένη απογραφή. Επιστρέφει το payload. */
function writeCensus(repoRoot) {
  const merged = collectRuns(repoRoot);
  if (!merged) throw new Error(`Καμία παρατήρηση στο ${CENSUS_DIR}/ — η απογραφή δεν έτρεξε.`);
  const observations = [...merged.values()].sort((a, b) => a.file.localeCompare(b.file));
  const payload = {
    $doc: 'ADR-799 Φάση 2 / CHECK 3.64 — ΠΑΡΑΤΗΡΗΣΗ, όχι ευρετικό. Παράγεται από `npm run text-measure:census`.',
    generatedFrom: fingerprintInputs(repoRoot, observations.map((o) => o.file)),
    observations,
  };
  fs.writeFileSync(path.join(repoRoot, CENSUS_FILE), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return payload;
}

/** Διαβάζει την αποθηκευμένη απογραφή. **Fail-closed**: απούσα ⇒ `null`, ποτέ σιωπηλό `{}`. */
function readCensus(repoRoot) {
  const file = path.join(repoRoot, CENSUS_FILE);
  if (!fs.existsSync(file)) return null;
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(raw.observations) || typeof raw.generatedFrom !== 'object' || !raw.generatedFrom) {
    throw new Error(`${CENSUS_FILE}: περίμενα { generatedFrom, observations[] }.`);
  }
  return raw;
}

/** Ποιες είσοδοι άλλαξαν από τότε που γράφτηκε η απογραφή. Κενό = φρέσκια. */
function staleInputs(repoRoot, census) {
  const now = fingerprintInputs(repoRoot, census.observations.map((o) => o.file));
  const drifted = [];
  for (const rel of new Set([...Object.keys(census.generatedFrom), ...Object.keys(now)])) {
    if (census.generatedFrom[rel] !== now[rel]) drifted.push(rel);
  }
  return drifted.sort();
}

/** Η μία ερώτηση: μέτρησε αυτή η σουίτα σε βαθμίδα που **δεν βλέπει** ό,τι ζήτησε; */
const isBlind = (obs) => obs.nominal > 0 && obs.dropped.length > 0;

module.exports = { CENSUS_DIR, CENSUS_FILE, collectRuns, writeCensus, readCensus, staleInputs, isBlind, toPosix };
