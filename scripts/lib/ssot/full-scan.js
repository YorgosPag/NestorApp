#!/usr/bin/env node
/**
 * =============================================================================
 * ADR-749 — SSoT ΠΑΡΑΒΙΑΣΕΙΣ: ΠΛΗΡΗΣ ΣΑΡΩΣΗ ΤΟΥ src/
 * =============================================================================
 *
 * Χρησιμοποιείται από **δύο** εντολές — `ssot:baseline` και `ssot:audit` — και
 * από καμία άλλη. Η **πύλη** (CHECK 3.7) ΔΕΝ περνά από εδώ: τρέχει μόνο στα
 * staged αρχεία, μέσω `scan.js` απευθείας.
 *
 * ── ΓΙΑΤΙ ΕΝΑ ΠΕΡΑΣΜΑ ΚΑΙ ΟΧΙ 420 ──────────────────────────────────────────
 *
 * Το `ssot-audit.sh` έκανε **μία πλήρη σάρωση ανά module**: 420 modules ×
 * 14.115 αρχεία. Μετρημένο σε 4-πύρηνο Windows: **~60′** με GNU grep, **10′31″**
 * με ripgrep. Εδώ τα αρχεία διαβάζονται **μία φορά** και ελέγχονται όλα τα
 * modules πάνω στο περιεχόμενο: **22,8s** μετρημένα.
 *
 * ⚠️ ΜΗΝ το «βελτιστοποιήσεις» ξανά σε ένα regex με όλα τα patterns ενωμένα:
 * δοκιμάστηκε (`rg -f`, 667 patterns) και ήταν **χειρότερο** (5′36″) — με
 * σύνθετα regex κυριαρχεί το κόστος του automaton, όχι τα αρχεία.
 *
 * ── ΓΙΑΤΙ ΔΕΝ ΥΠΑΡΧΕΙ ΠΙΑ CACHE ────────────────────────────────────────────
 *
 * Η προηγούμενη μηχανή κρατούσε cache με hash περιεχομένου (`.ssot-baseline-
 * cache.json`). Αφαιρέθηκε **επίτηδες**: ολόκληρο το ADR-749 αφορά επιφάνειες
 * όπου κάτι παλιώνει σιωπηλά, και μια cache είναι ακριβώς τέτοια επιφάνεια.
 * Κερδίζει δευτερόλεπτα σε εντολή που τρέχει σπάνια — ο πράκτορας δεν την
 * τρέχει ΠΟΤΕ (`.claude-rules/test-execution-budget.md` ΜΕΡΟΣ Β).
 *
 * ── ΠΡΟΫΠΟΛΟΓΙΣΜΟΣ ΠΥΡΗΝΩΝ ─────────────────────────────────────────────────
 *
 * Τοπικά αφήνονται **2 πυρήνες ελεύθεροι** για το UI, ίδια πολιτική με το
 * `jest.config.js` (`maxWorkers: 2` τοπικά). Το PC έχει 4 πυρήνες και έχει ήδη
 * κολλήσει δύο φορές από βαριά scripts.
 *
 * @see ADR-749
 * @module scripts/lib/ssot/full-scan
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');

const { loadRegistry, normalizePath, TS_EXT_RE } = require('./registry');
const { analyzeFile } = require('./scan');

const SRC_DIR = 'src';

// ---------------------------------------------------------------------------
// Λειτουργία worker
// ---------------------------------------------------------------------------

if (!isMainThread && workerData && workerData.__ssotFullScan) {
  runWorker(workerData);
}

/** @internal Τρέχει σε νήμα worker: σαρώνει το μερίδιό του από τα αρχεία. */
function runWorker({ root, registryFile, files, trackLiveness }) {
  const { modules } = loadRegistry(path.join(root, registryFile));
  const perFile = {};

  // ⚠️ Χωρίς παρακολούθηση ζωντάνιας ο σαρωτής σταματά στο **πρώτο** pattern
  // που πιάνει τη γραμμή· με παρακολούθηση δοκιμάζει **όλα**. Το δεύτερο
  // κοστίζει (μετρημένο: 68s έναντι 26s σε 2 νήματα) και το χρειάζεται μόνο η
  // αναφορά — η παραγωγή baseline δεν το χρειάζεται καθόλου.
  const patternHits = trackLiveness ? new Map() : null;

  for (const rel of files) {
    let content;
    try {
      content = fs.readFileSync(path.join(root, rel), 'utf8');
    } catch {
      continue;                       // διαγράφηκε ανάμεσα στην απαρίθμηση και εδώ
    }
    const { counts } = analyzeFile(content, rel, modules, patternHits ? { patternHits } : {});
    if (counts.size > 0) perFile[rel] = Object.fromEntries([...counts.entries()].sort());
  }

  parentPort.postMessage({ perFile, patternHits: patternHits ? [...patternHits.entries()] : [] });
}

// ---------------------------------------------------------------------------
// Απαρίθμηση αρχείων
// ---------------------------------------------------------------------------

/**
 * Απαριθμεί κάθε `.ts`/`.tsx` κάτω από το `src/`, αφαιρώντας τα exempt.
 *
 * @param {RegExp} exemptRe
 * @param {string} root
 * @returns {string[]} διαδρομές σχετικές με το root, με `/`
 */
function listSrcFiles(exemptRe, root) {
  const out = [];
  walkInto(path.join(root, SRC_DIR), root, exemptRe, out);
  return out;
}

/** @internal */
function walkInto(dir, root, exemptRe, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkInto(full, root, exemptRe, out);
      continue;
    }
    if (!TS_EXT_RE.test(entry.name)) continue;
    const rel = normalizePath(path.relative(root, full));
    if (!exemptRe.test(rel)) out.push(rel);
  }
}

// ---------------------------------------------------------------------------
// Ενορχήστρωση
// ---------------------------------------------------------------------------

/** Πόσα νήματα — τοπικά αφήνει 2 πυρήνες στο UI, στο CI τα παίρνει όλα. */
function workerCount() {
  const cores = os.cpus().length;
  return process.env.CI ? Math.min(cores, 8) : Math.max(1, cores - 2);
}

/**
 * Σαρώνει ολόκληρο το `src/`.
 *
 * @param {object} [options]
 * @param {string} [options.root]
 * @param {string} [options.registryFile]
 * @param {boolean} [options.trackLiveness=false] να μετρηθεί ποια patterns
 *        πιάνουν κάτι (χρειάζεται μόνο η αναφορά· κοστίζει ~2,5×)
 * @returns {Promise<{files: Record<string, Record<string, number>>,
 *                    patternHits: Map<string, number>,
 *                    scanned: number, workers: number}>}
 */
async function scanAll(options = {}) {
  const root = options.root || process.cwd();
  const registryFile = options.registryFile || '.ssot-registry.json';
  const trackLiveness = options.trackLiveness === true;

  const { exemptRe } = loadRegistry(path.join(root, registryFile));
  const all = listSrcFiles(exemptRe, root);

  const workers = Math.min(workerCount(), Math.max(1, all.length));
  const batches = splitIntoBatches(all, workers);

  const results = await Promise.all(
    batches.map(files => runBatch({ root, registryFile, files, trackLiveness }))
  );

  const merged = { files: {}, patternHits: new Map() };
  for (const { perFile, patternHits } of results) {
    Object.assign(merged.files, perFile);
    for (const [key, n] of patternHits) merged.patternHits.set(key, (merged.patternHits.get(key) || 0) + n);
  }

  return { ...merged, scanned: all.length, workers };
}

/** @internal */
function splitIntoBatches(items, count) {
  const size = Math.ceil(items.length / count);
  const batches = [];
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size));
  return batches;
}

/** @internal */
function runBatch(data) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(__filename, { workerData: { ...data, __ssotFullScan: true } });
    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', code => {
      if (code !== 0) reject(new Error(`worker σταμάτησε με κωδικό ${code}`));
    });
  });
}

module.exports = { listSrcFiles, scanAll, workerCount, SRC_DIR };
