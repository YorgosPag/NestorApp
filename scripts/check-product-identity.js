#!/usr/bin/env node
/**
 * CHECK 3.81 — Πύλη ταυτότητας προϊόντος (ADR-857 Φ8)
 *
 * «Λέει κάθε σημείο που ονομάζει το ΠΡΟΪΟΝ το ΙΔΙΟ όνομα — και είναι κάθε ΑΛΛΗ
 * χρήση δηλωμένη, με λόγο;»
 *
 * Η μηχανή ζει στο `lib/product-identity/scan.js` (και εξηγεί ΓΙΑΤΙ είναι AST).
 * Εδώ ζει η ΚΡΙΣΗ: τέσσερα κριτήρια, κλειστή λογιστική, fail-closed.
 *
 * ⚠️ ΜΗΝ λύσεις κόκκινο προσθέτοντας δήλωση στο `.product-identity.json` επειδή
 * «είναι σωστό». Η δήλωση σημαίνει «αυτό ΔΕΝ είναι το όνομα του προϊόντος» —
 * αν είναι, η θεραπεία είναι **εισαγωγή από τη ρίζα**, όχι εξαίρεση.
 *
 * Escape: SKIP_PRODUCT_IDENTITY=1
 */
'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const { STATES, BLOCKING, MIN_REASON, readRoot, scanCodeFile, scanLocaleFile } =
  require('./lib/product-identity/scan');
const { collectSourceFiles } = require('./lib/module-graph/scan-config');
const { toPosix } = require('./lib/module-graph/resolve-specifier');

const CONFIG_PATH = path.join(PROJECT_ROOT, '.product-identity.json');

/** Fail-closed φόρτωση: κάθε δήλωση οφείλει σχήμα ΚΑΙ λόγο (Κ3 κατά τη φόρτωση). */
function loadConfig(configPath = CONFIG_PATH) {
  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (!cfg.canonical || !cfg.canonical.root) {
    throw new Error('.product-identity.json: λείπει το `canonical.root` — η πύλη δεν έχει ρίζα');
  }
  if (!Array.isArray(cfg.declarations)) {
    throw new Error('.product-identity.json: το `declarations` πρέπει να είναι πίνακας');
  }
  for (const d of cfg.declarations) {
    if (!d.file || !Array.isArray(d.spellings) || d.spellings.length === 0 || !d.class) {
      throw new Error(`δήλωση «${d.file || '?'}»: απαιτούνται file, spellings[], class`);
    }
    if (!cfg.classes || !(d.class in cfg.classes)) {
      throw new Error(`δήλωση «${d.file}»: άγνωστη κλάση «${d.class}»`);
    }
  }
  return cfg;
}

/** Τα locale JSON — δικός του περίπατος: το `collectSourceFiles` βλέπει μόνο .ts/.tsx. */
function collectLocaleFiles(root, localeRoots) {
  const out = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) walk(abs);
      else if (e.isFile() && e.name.endsWith('.json')) out.push(toPosix(abs));
    }
  };
  for (const rel of localeRoots) walk(path.join(root, rel));
  return out.sort();
}

/** Ο δείκτης δηλώσεων: αρχείο → σύνολο επιτρεπόμενων γραφών. */
function declarationIndex(declarations) {
  const index = new Map();
  for (const d of declarations) index.set(d.file, new Set(d.spellings));
  return index;
}

function bumpOf(tally) {
  return (state) => {
    if (!(state in tally)) throw new Error(`CHECK 3.81 — ΑΓΝΩΣΤΗ ΚΑΤΑΣΤΑΣΗ: ${state}`);
    tally[state] += 1;
  };
}

/** Κ2 + Κ3: κάθε δήλωση οφείλει να προστατεύει κάτι ΥΠΑΡΚΤΟ, και να λέει γιατί. */
function judgeDeclarations(cfg, root, seenByFile, bump, findings, spellings) {
  for (const d of cfg.declarations) {
    // ⚠️ ΓΡΑΦΗ ΕΚΤΟΣ ΤΟΥ ΚΛΕΙΣΤΟΥ ΣΥΝΟΛΟΥ ΕΙΝΑΙ ΟΡΦΑΝΗ ΕΞ ΟΡΙΣΜΟΥ, ΚΑΙ ΤΟ ΛΕΜΕ ΡΗΤΑ.
    //    Η πρώτη γραφή αυτού του μητρώου δήλωνε `NestorPagonisApp` / `NestorAec` — ονόματα
    //    που ο σαρωτής ΔΕΝ αναζητά ποτέ, γιατί το σύνολο έρχεται από τη ΡΙΖΑ. Αποτέλεσμα:
    //    11 «ορφανές» με μήνυμα που δεν εξηγούσε ΓΙΑΤΙ. Η αιτία δεν είναι «δεν υπάρχει πια».
    const outside = d.spellings.filter((s) => !spellings.includes(s));
    if (outside.length > 0) {
      bump(STATES.ORPHAN_DECLARATION);
      findings.push({ state: STATES.ORPHAN_DECLARATION, file: d.file,
        detail: `γραφές ΕΚΤΟΣ του κλειστού συνόλου της ρίζας: ${outside.join(' · ')} — `
          + `δήλωσε μία από: ${spellings.join(' · ')} (το σύνολο ορίζεται ΑΠΟ ΤΗ ΡΙΖΑ)` });
      continue;
    }
    if (!d.reason || String(d.reason).trim().length < MIN_REASON) {
      bump(STATES.REASONLESS_DECLARATION);
      findings.push({ state: STATES.REASONLESS_DECLARATION, file: d.file,
        detail: `ο λόγος είναι ΥΠΟΧΡΕΩΤΙΚΟΣ (≥${MIN_REASON} χαρακτήρες)` });
      continue;
    }
    if (!fs.existsSync(path.join(root, d.file))) {
      bump(STATES.ORPHAN_DECLARATION);
      findings.push({ state: STATES.ORPHAN_DECLARATION, file: d.file,
        detail: 'δηλωμένο αρχείο που ΔΕΝ ΥΠΑΡΧΕΙ — η δήλωση προστατεύει το τίποτα' });
      continue;
    }
    const seen = seenByFile.get(d.file) || new Set();
    const dead = d.spellings.filter((s) => !seen.has(s));
    if (dead.length > 0) {
      bump(STATES.ORPHAN_DECLARATION);
      findings.push({ state: STATES.ORPHAN_DECLARATION, file: d.file,
        detail: `δηλωμένες γραφές που ΔΕΝ ΥΠΑΡΧΟΥΝ πια: ${dead.join(' · ')} — σβήσε τη δήλωση` });
    }
  }
}

/**
 * Η μέτρηση.
 *
 * 🔑 Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΕΙΝΑΙ ΟΙ ΔΗΛΩΣΕΙΣ, ΚΑΙ ΕΙΝΑΙ ΙΣΧΥΡΟΤΕΡΟΣ ΑΠΟ ΑΓΚΥΡΑ ΕΝΟΣ
 * ΑΡΧΕΙΟΥ: κάθε μία από τις δηλώσεις **οφείλει** να βρεθεί ζωντανή στο δέντρο.
 * Αν ο σαρωτής σπάσει, δεν σιωπά — **όλες** γίνονται `orphan-declaration` και η
 * πύλη ουρλιάζει. Ένα «0 ευρήματα» με 0 δηλώσεις βρεθείσες είναι ΑΠΟΤΥΧΙΑ.
 */
function measure(opts = {}) {
  const root = opts.root || PROJECT_ROOT;
  const cfg = opts.config || loadConfig(opts.configPath);

  const rootAbs = path.join(root, cfg.canonical.root);
  const tally = Object.fromEntries(Object.values(STATES).map((s) => [s, 0]));
  const bump = bumpOf(tally);
  const findings = [];

  if (!fs.existsSync(rootAbs)) {
    bump(STATES.ROOT_DRIFT);
    findings.push({ state: STATES.ROOT_DRIFT, file: cfg.canonical.root, detail: 'η ρίζα δεν υπάρχει' });
    return { findings, tally, spellings: [], examined: 0 };
  }
  const verdict = readRoot(fs.readFileSync(rootAbs, 'utf8'), rootAbs, cfg.canonical);
  if (!verdict.ok) {
    bump(STATES.ROOT_DRIFT);
    findings.push({ state: STATES.ROOT_DRIFT, file: cfg.canonical.root, detail: verdict.reason });
    return { findings, tally, spellings: [], examined: 0 };
  }
  bump(STATES.ROOT);

  const codeFiles = opts.codeFiles || collectSourceFiles(root, cfg.scan.codeRoots);
  if (!opts.codeFiles && codeFiles.length < 1000) {
    throw new Error(`ΦΡΟΥΡΟΣ: μόνο ${codeFiles.length} αρχεία κώδικα σαρώθηκαν — η σάρωση δεν κοίταξε`);
  }
  const localeFiles = opts.localeFiles || collectLocaleFiles(root, cfg.scan.localeRoots);
  const declared = declarationIndex(cfg.declarations);
  const seenByFile = new Map();

  const record = (hit, isCode) => {
    const rel = hit.file;
    if (!seenByFile.has(rel)) seenByFile.set(rel, new Set());
    seenByFile.get(rel).add(hit.spelling);
    if (rel === cfg.canonical.root) return;            // η ρίζα ΟΡΙΖΕΙ τις γραφές
    if ((declared.get(rel) || new Set()).has(hit.spelling)) { bump(STATES.DECLARED); return; }
    if (!isCode && hit.spelling === verdict.product) { bump(STATES.CANONICAL); return; }
    bump(STATES.UNDECLARED_WRITING);
    findings.push({ ...hit, state: STATES.UNDECLARED_WRITING });
  };

  for (const abs of codeFiles) {
    const rel = toPosix(path.relative(root, abs));
    if (rel.includes('__tests__/')) continue;
    let text;
    try { text = fs.readFileSync(abs, 'utf8'); } catch { continue; }
    if (!verdict.spellings.some((s) => text.includes(s))) continue;   // προφίλτρο: ασφαλές δομικά
    let hits;
    try { hits = scanCodeFile(abs, text, verdict.spellings, rel); } catch { continue; }
    for (const hit of hits) record(hit, true);
  }

  for (const abs of localeFiles) {
    const rel = toPosix(path.relative(root, abs));
    let text;
    try { text = fs.readFileSync(abs, 'utf8'); } catch { continue; }
    if (!verdict.spellings.some((s) => text.includes(s))) continue;
    for (const hit of scanLocaleFile(text, verdict.spellings, verdict.product, rel)) record(hit, false);
  }

  judgeDeclarations(cfg, root, seenByFile, bump, findings, verdict.spellings);
  return { findings, tally, spellings: verdict.spellings, examined: codeFiles.length + localeFiles.length };
}

function report(result, log = console.log) {
  const { tally, findings, spellings } = result;
  log('');
  log('🏷️  CHECK 3.81 — Πύλη ταυτότητας προϊόντος (ADR-857 Φ8)');
  log('');
  log(`   αρχεία που εξετάστηκαν: ${result.examined}`);
  log(`   γραφές του κλειστού συνόλου: ${spellings.length}${spellings.length ? ` — ${spellings.join(' · ')}` : ''}`);
  log('');
  for (const s of BLOCKING) log(`   ⛔ ${s.padEnd(24)} ${tally[s]}`);
  log('');
  for (const s of [STATES.ROOT, STATES.DECLARED, STATES.CANONICAL]) {
    log(`   ✅ ${s.padEnd(24)} ${tally[s]}`);
  }
  const blocking = findings.filter((f) => BLOCKING.includes(f.state));
  if (blocking.length) {
    log('');
    log('   ── ΕΥΡΗΜΑΤΑ ──');
    for (const f of blocking) {
      log(`   ⛔ ${f.state}  ${f.file}${f.line ? ':' + f.line : ''}`);
      if (f.spelling) log(`        γραφή: «${f.spelling}»  σε: «${f.excerpt}»`);
      if (f.detail) log(`        ${f.detail}`);
    }
    log('');
    log('   ΘΕΡΑΠΕΙΑ — ΜΙΑ από τις δύο, και η πρώτη είναι σχεδόν πάντα η σωστή:');
    log('     (1) ΕΙΝΑΙ το όνομα του προϊόντος ⇒ εισήγαγέ το από τη ρίζα:');
    log("         import { PRODUCT_NAME, productQualified } from '@/constants/product-identity'");
    log('     (2) ΔΕΝ είναι (νομικό πρόσωπο · δεδομένα ενοίκου · αναγνωριστικό μηχανής ·');
    log('         παγωμένο) ⇒ δήλωσέ το στο .product-identity.json με κλάση ΚΑΙ λόγο.');
    log('     ⚠️ Σε locale JSON η (1) ΔΕΝ υπάρχει — γράψε την κανονική γραφή στην πρόταση.');
  }
  return blocking.length;
}

function main() {
  if (process.env.SKIP_PRODUCT_IDENTITY === '1') {
    console.log('⏭️  CHECK 3.81 παραλείφθηκε (SKIP_PRODUCT_IDENTITY=1)');
    return 0;
  }
  const result = measure();
  const blocking = report(result);
  if (blocking > 0) {
    console.log('');
    console.log(`❌ CHECK 3.81 ΑΠΕΤΥΧΕ — ${blocking} μπλοκάρουσα(ες) παραβίαση(εις)`);
    console.log('');
    return 1;
  }
  console.log('');
  console.log('✅ CHECK 3.81 — κάθε γραφή του ονόματος είναι η ρίζα ή δηλωμένη, με λόγο');
  console.log('');
  return 0;
}

if (require.main === module) process.exit(main());
module.exports = { measure, report, main, loadConfig, collectLocaleFiles, STATES, BLOCKING };
