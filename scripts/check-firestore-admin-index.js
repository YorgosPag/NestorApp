#!/usr/bin/env node
/**
 * CHECK 3.91 — Admin SDK Index Coverage (ADR-870)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * **«Τα ερωτήματα που ΔΕΝ περνούν από το `firestoreQueryService` — έχουν δείκτη;»**
 *
 * Το CHECK 3.15 έμαθε να βλέπει το εύρος (ADR-869 §7), αλλά σαρώνει **μόνο** κλήσεις του
 * SSoT. Κάθε `adminDb.collection(X).where('t','>=',v)` ήταν **αόρατο** — και ζει σε **cron
 * jobs και API routes**, όπου κανένα UI δεν θα δείξει το `FAILED_PRECONDITION`: το σφάλμα
 * καταλήγει σε log που δεν διαβάζει κανείς, και η δουλειά απλώς δεν γίνεται.
 *
 * ═══ ΤΙ ΒΡΕΘΗΚΕ ΟΤΑΝ ΚΟΙΤΑΞΕ ΚΑΠΟΙΟΣ (2026-09-21, όλα ΖΩΝΤΑΝΑ επιβεβαιωμένα) ════════════
 *
 * | # | σημείο | ερώτημα | ζωντανά |
 * |---|---|---|---|
 * | 1 | `api/admin/iso19650/costs` | `companyId==` `createdAt` εύρος `orderBy(createdAt desc)` | `FAILED_PRECONDITION` — **0 δείκτες** στη συλλογή |
 * | 2 | `ai-pipeline/feedback-service.cleanupStale` | `rating==null` `createdAt<` | `FAILED_PRECONDITION` — cron καθαρισμού |
 * | 3 | `accounting-repo-audit.listAuditEntries` | `companyId==` + 4 προαιρετικά + `timestamp` | `FAILED_PRECONDITION` σε **32** συνδυασμούς |
 * | 4 | `api/calendar/reminders` | `reminderDate<=` **και** `reminderSent!=` | `FAILED_PRECONDITION` — cron υπενθυμίσεων |
 * | 5 | `procurement/sourcing-event-service.listSourcingEvents` | `companyId==` `status!=` `orderBy(createdAt desc)` | `FAILED_PRECONDITION` σε 3 από 4 κλάδους |
 * | 6 | `cron/purge-deleted-entities` (τύπος `STORAGE`) | `status=='deleted'` `deletedAt<=` | `FAILED_PRECONDITION` — `storage_units`: **0 δείκτες** |
 *
 * Το #3 είναι το πιο διδακτικό: ο κώδικας **έλεγε** ποιους δείκτες θέλει («entityType +
 * entityId + timestamp» κ.λπ.), το μανιφέστο **συμφωνούσε** με το σχόλιο — και κανένας από
 * τους δύο δεν είχε `companyId`, που ο κώδικας προσθέτει **πάντα**. Δύο πηγές συμφωνούσαν
 * μεταξύ τους και **και οι δύο** διαφωνούσαν με ό,τι τρέχει.
 *
 * ═══ ΔΥΟ ΚΡΙΤΗΡΙΑ, ΔΥΟ ΚΑΘΕΣΤΩΤΑ — ΚΑΙ ΤΟ ΓΙΑΤΙ ═══════════════════════════════════════════
 *
 *   **Κ1 — ερωτήματα ΜΕ ΕΥΡΟΣ ⇒ ⛔ ZERO-TOLERANCE.** Μετρημένα **5** ακάλυπτα σημεία, όλα
 *   επιβεβαιωμένα ζωντανά, όλα διορθωμένα στο ίδιο commit ⇒ η πύλη γεννιέται στο **0**.
 *
 *   **Κ2 — ερωτήματα ΧΩΡΙΣ εύρος ⇒ 🔴 RATCHET κατά ταυτότητα.** **18** ταυτότητες
 *   (`αρχείο::συλλογή`) στη baseline — **άνοιξε το JSON, μην αντιγράψεις τον αριθμό**.
 *   Zero-tolerance εδώ θα σήμαινε **πύλη που γεννιέται κόκκινη** — ρητά απαγορευμένο
 *   (ADR-742, `b4ec47e2`). Και θα ήταν και **πρόωρο**: κανένα από τα 20 δεν έχει
 *   επιβεβαιωθεί ζωντανά, και το μάθημα του `audit_logs` λέει ακριβώς γιατί αυτό μετράει —
 *   η συγχώνευση δεικτών **αθώωσε 12 κλάδους** που η στατική ανάλυση κατήγγειλε.
 *
 * 🔑 Γιατί ΟΧΙ δύο πύλες: η ερώτηση είναι μία («έχει δείκτη;»). Χωριστή πύλη ανά καθεστώς θα
 * σήμαινε δύο εξαγωγείς για το ίδιο AST — δηλαδή το ακριβώς αντίθετο του ADR-870.
 *
 * ═══ ΡΗΤΗ ΕΞΑΙΡΕΣΗ ═══════════════════════════════════════════════════════════════════════
 *
 *     // firestore-index-exempt: <γιατί δεν χρειάζεται δείκτης ΕΔΩ>
 *
 * Ο λόγος είναι **υποχρεωτικός** — ίδιο δόγμα και **ίδιος αναγνώστης** με το
 * `tenant-scope-exempt` του CHECK 3.35 (`hasReasonedExemption`).
 *
 * CLI:
 *   node scripts/check-firestore-admin-index.js                # staged (Layer 1)
 *   node scripts/check-firestore-admin-index.js --all          # πλήρες src/ (Layer 2)
 *   node scripts/check-firestore-admin-index.js --report       # ανθρώπινη αναφορά
 *   node scripts/check-firestore-admin-index.js --generate-baseline
 *
 * Escape hatch: `SKIP_FIRESTORE_ADMIN_INDEX=1` (δικαιολόγησέ το στον Γιώργο)
 * Exit: 0 καθαρό · 1 ακάλυπτο εύρος (Κ1) ή οπισθοδρόμηση ratchet (Κ2)
 *
 * @see ADR-870 · ADR-869 §7 · docs/gates/3.91.md
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const { PROJECT_ROOT, hasReasonedExemption } = require('./_shared/firestore-ast-loaders');
const {
  createChainContext, scanFileChains, enumerateBranches, toQueryShape,
} = require('./_shared/firestore-query-chain');
const {
  loadIndexCatalog, requiredIndexFor, findCoveringIndexes,
  noIndexCarriesRangeFields, suggestIndexJson,
} = require('./_shared/firestore-index-matcher');

const INDEXES_FILE = path.join(PROJECT_ROOT, 'firestore.indexes.json');
const BASELINE_FILE = path.join(PROJECT_ROOT, '.firestore-admin-index-baseline.json');
const EXEMPT_TOKEN = 'firestore-index-exempt';

const useColour = process.stdout.isTTY;
const c = {
  red: (s) => (useColour ? `\x1b[31m${s}\x1b[0m` : s),
  green: (s) => (useColour ? `\x1b[32m${s}\x1b[0m` : s),
  yellow: (s) => (useColour ? `\x1b[33m${s}\x1b[0m` : s),
  cyan: (s) => (useColour ? `\x1b[36m${s}\x1b[0m` : s),
  dim: (s) => (useColour ? `\x1b[2m${s}\x1b[0m` : s),
  bold: (s) => (useColour ? `\x1b[1m${s}\x1b[0m` : s),
};
const rel = (f) => path.relative(PROJECT_ROOT, f).replace(/\\/g, '/');

// ---------------------------------------------------------------------------
// Ανακάλυψη αρχείων
// ---------------------------------------------------------------------------

function isScannable(p) {
  const r = rel(p);
  if (!r.startsWith('src/') || !/\.(ts|tsx)$/.test(r)) return false;
  if (/\.(test|spec|d)\.tsx?$/.test(r)) return false;
  return !r.includes('__tests__/') && !r.includes('__mocks__/');
}

function listStagedFiles() {
  try {
    return execSync('git diff --cached --name-only --diff-filter=ACMR', { cwd: PROJECT_ROOT, encoding: 'utf8' })
      .split('\n').map((s) => s.trim()).filter(Boolean)
      .map((p) => path.resolve(PROJECT_ROOT, p));
  } catch {
    return [];
  }
}

function listAllSrcFiles() {
  const out = [];
  (function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== 'node_modules' && !e.name.startsWith('.')) walk(full);
      } else if (isScannable(full)) out.push(full);
    }
  })(path.join(PROJECT_ROOT, 'src'));
  return out;
}

function resolveTargets(argv) {
  if (argv.includes('--all') || argv.includes('--report') || argv.includes('--generate-baseline')) {
    return listAllSrcFiles();
  }
  const explicit = argv.filter((a) => !a.startsWith('--'));
  const chosen = explicit.length > 0
    ? explicit.map((p) => path.resolve(PROJECT_ROOT, p))
    : listStagedFiles();
  return chosen.filter((p) => fs.existsSync(p) && isScannable(p));
}

// ---------------------------------------------------------------------------
// Κρίση
// ---------------------------------------------------------------------------

/** Σταθερό αποτύπωμα σχήματος — ώστε ισοδύναμοι κλάδοι να μην αναφέρονται δύο φορές. */
function fingerprint(shape) {
  return JSON.stringify([
    [...shape.equalityFields].sort(),
    [...shape.rangeFields].sort(),
    shape.orderBy.map((o) => `${o.field}:${o.direction}`),
    shape.arrayContainsField || '',
  ]);
}

/**
 * Κρίνε **ένα** σημείο: όλοι οι συνδυασμοί κλάδων, ένας-ένας.
 *
 * @returns {{missing: object[], unjudged: object[], unanalyzable: string|null, merged: number}}
 */
function judgeSite(site, catalog) {
  const out = { missing: [], unjudged: [], unanalyzable: null, merged: 0 };
  if (!site.collectionName) {
    out.unanalyzable = site.clauses.length > 0 ? 'η συλλογή δεν προκύπτει στατικά' : null;
    return out;
  }
  const dynamic = site.clauses.find((cl) => cl.kind === 'unresolved');
  if (dynamic) { out.unanalyzable = dynamic.why; return out; }

  const { combos, overflow, groups } = enumerateBranches(site.clauses);
  // ⚠️ Το πλαφόν ζει στο `enumerateBranches`, ΟΧΙ εδώ. Αντίγραφο του αριθμού θα ήταν δεύτερη
  // αυθεντία που αποκλίνει σιωπηλά — το ακριβές σχήμα που έχει αποτύχει τέσσερις φορές σε
  // αυτό το δέντρο (CHECK 3.34 · 3.37 · 3.49 · 3.57).
  if (overflow) { out.unanalyzable = `πάρα πολλοί συνδυασμοί κλάδων (${groups} συνθήκες)`; return out; }

  const seen = new Set();
  for (const combo of combos) {
    const shape = toQueryShape(site.collectionName, combo);
    const fp = fingerprint(shape);
    if (seen.has(fp)) continue;
    seen.add(fp);
    judgeShape(shape, catalog, out);
  }
  return out;
}

/** Ένα σχήμα → κάδος. Κρατά χωριστά «λείπει», «δεν αποφασίζεται», «στηρίζεται σε συγχώνευση». */
function judgeShape(shape, catalog, out) {
  const required = requiredIndexFor(shape);
  if (required.status === 'free') return;
  if (required.status !== 'required') {
    // «Δεν ξέρω ΠΟΙΟΝ θέλεις» δεν εμποδίζει το «πάντως ΚΑΝΕΝΑΝ δεν έχεις».
    if (noIndexCarriesRangeFields(catalog, shape)) out.missing.push({ shape, required });
    else out.unjudged.push({ shape, required });
    return;
  }
  const cover = findCoveringIndexes(catalog, shape);
  if (!cover) { out.missing.push({ shape, required }); return; }
  if (cover.mode === 'merge' && cover.beyondMeasuredEnvelope) out.merged += 1;
}

/** Έχει το σημείο ρητή εξαίρεση με λόγο; */
function isExemptSite(site, lineCache) {
  let lines = lineCache.get(site.file);
  if (!lines) {
    lines = fs.readFileSync(site.file, 'utf8').split(/\r?\n/);
    lineCache.set(site.file, lines);
  }
  return hasReasonedExemption(lines, site.line - 1, EXEMPT_TOKEN);
}

/** Σάρωσε και κρίνε τα αρχεία-στόχους. */
function analyse(targets) {
  const ctx = createChainContext();
  const catalog = loadIndexCatalog(INDEXES_FILE);
  const lineCache = new Map();
  const result = { withRange: [], withoutRange: [], unjudged: [], unanalyzable: [], exempt: 0, merged: 0, sites: 0 };

  for (const file of targets) {
    let sites;
    try { sites = scanFileChains(file, ctx); } catch (err) {
      console.error(c.yellow(`⚠ αδύνατη η ανάλυση ${rel(file)}: ${err.message}`));
      continue;
    }
    for (const site of sites) {
      result.sites += 1;
      if (isExemptSite(site, lineCache)) { result.exempt += 1; continue; }
      const judged = judgeSite(site, catalog);
      result.merged += judged.merged;
      if (judged.unanalyzable) result.unanalyzable.push({ site, why: judged.unanalyzable });
      for (const u of judged.unjudged) result.unjudged.push({ site, ...u });
      if (judged.missing.length === 0) continue;
      const hasRange = site.clauses.some((cl) => cl.kind === 'range');
      (hasRange ? result.withRange : result.withoutRange).push({ site, missing: judged.missing });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Baseline (Κ2)
// ---------------------------------------------------------------------------

/** Ταυτότητα, όχι πλήθος: «ποιο αρχείο, ποια συλλογή». Έτσι η **ανταλλαγή** μπλοκάρει. */
function baselineKeyOf(entry) {
  return `${rel(entry.site.file)}::${entry.site.collectionName}`;
}

/**
 * Σύνολο ακάλυπτων ανά ταυτότητα. ⚠️ **ΑΘΡΟΙΣΜΑ, όχι «το τελευταίο κερδίζει»**: ένα αρχείο
 * έχει συχνά **δύο** ερωτήματα στην ίδια συλλογή. Με αντικατάσταση, το ένα μπορούσε να
 * μεγαλώσει όσο το άλλο ήταν μεγαλύτερο — σιωπηλή οπισθοδρόμηση μέσα στο ratchet.
 *
 * @param {{site: object, missing: object[]}[]} entries
 * @returns {Map<string, number>}
 */
function totalsByKey(entries) {
  const totals = new Map();
  for (const entry of entries) {
    const key = baselineKeyOf(entry);
    totals.set(key, (totals.get(key) || 0) + entry.missing.length);
  }
  return totals;
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE_FILE)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
    return parsed && typeof parsed.sites === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function writeBaseline(withoutRange) {
  const sites = Object.fromEntries(totalsByKey(withoutRange));
  const payload = {
    _meta: {
      description: 'CHECK 3.91 — Admin SDK index coverage (ADR-870). Κ2: ερωτήματα ΧΩΡΙΣ εύρος, ανά (αρχείο, συλλογή). Μόνο μειώνεται.',
      check: 'CHECK 3.91',
      adr: 'ADR-870',
      generatedBy: 'node scripts/check-firestore-admin-index.js --generate-baseline',
      totalSites: Object.keys(sites).length,
      note: 'Το Κ1 (ερωτήματα ΜΕ ΕΥΡΟΣ) ΔΕΝ έχει baseline — είναι zero-tolerance, γεννήθηκε στο 0.',
      unverified: 'Κανένα από αυτά ΔΕΝ έχει επιβεβαιωθεί ζωντανά. Η συγχώνευση δεικτών αθώωσε 12 κλάδους στο audit_logs — μην τα επικαλεστείς ως «σφάλματα» πριν τα μετρήσεις.',
    },
    sites: Object.fromEntries(Object.keys(sites).sort().map((k) => [k, sites[k]])),
  };
  fs.writeFileSync(BASELINE_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return payload;
}

// ---------------------------------------------------------------------------
// Αναφορά
// ---------------------------------------------------------------------------

function formatShape(shape) {
  const parts = [
    shape.equalityFields.map((f) => `where('${f}','==')`).join(' + '),
    shape.rangeFields.map((f) => `where('${f}',<εύρος>)`).join(' + '),
    shape.orderBy.map((o) => `orderBy('${o.field}','${o.direction === 'DESCENDING' ? 'desc' : 'asc'}')`).join(' + '),
  ];
  if (shape.arrayContainsField) parts.push(`array-contains('${shape.arrayContainsField}')`);
  return parts.filter(Boolean).join(' + ') || '(κενό)';
}

function printEntry(entry, label) {
  const { site, missing } = entry;
  console.error(c.bold(`  ${rel(site.file)}:${site.line}`) + c.dim(`   [${site.collectionName}]${site.group ? ' (collectionGroup)' : ''}`));
  console.error(`    ${c.cyan(label)} ${missing.length} συνδυασμός(οί) κλάδων χωρίς δείκτη`);
  for (const m of missing.slice(0, 3)) {
    console.error(`    ${c.cyan('σχήμα:')}  ${formatShape(m.shape)}`);
    const suggestion = suggestIndexJson(m.shape);
    console.error(c.yellow(`    → firestore.indexes.json: ${JSON.stringify(suggestion.fields.map((f) => `${f.fieldPath} ${f.order}`))}`));
  }
  if (missing.length > 3) console.error(c.dim(`    … και ${missing.length - 3} ακόμη συνδυασμοί`));
  console.error('');
}

function printInfo(result) {
  if (result.unjudged.length > 0) {
    console.log(c.dim(`  ? ${result.unjudged.length} σχήμα(τα) «δεν αποφασίζεται» (πολλαπλά πεδία εύρους, με δείκτη παρόντα) — δεν μπλοκάρουν`));
  }
  if (result.unanalyzable.length > 0) {
    console.log(c.dim(`  ? ${result.unanalyzable.length} σημείο(α) μη αναλύσιμα — τυπώνονται με --report`));
  }
  if (result.merged > 0) {
    console.log(c.yellow(`  ⏳ ${result.merged} σχήμα(τα) καλύπτονται από συγχώνευση >3 δεικτών — ΠΕΡΑ από το μετρημένο· επαλήθευσέ τα ζωντανά`));
  }
}

function runReport(targets) {
  const r = analyse(targets);
  console.log('');
  console.log(c.bold('CHECK 3.91 — Admin SDK index coverage'));
  console.log(`  αρχεία σαρωμένα     : ${targets.length}`);
  console.log(`  σημεία ερωτημάτων   : ${r.sites}`);
  console.log(c.dim(`  · ρητή εξαίρεση     : ${r.exempt}`));
  console.log(c.red(`  ✖ Κ1 ΜΕ ΕΥΡΟΣ       : ${r.withRange.length} σημεία`));
  console.log(c.yellow(`  ✖ Κ2 χωρίς εύρος    : ${r.withoutRange.length} σημεία`));
  printInfo(r);
  console.log('');
  for (const entry of [...r.withRange, ...r.withoutRange]) printEntry(entry, 'ΑΚΑΛΥΠΤΟ:');
  for (const u of r.unanalyzable) {
    console.log(c.dim(`  ? ${rel(u.site.file)}:${u.site.line} — ${u.why}`));
  }
  console.log('');
  return r;
}

// ---------------------------------------------------------------------------
// Έλεγχος
// ---------------------------------------------------------------------------

/** Κ2: ποια σημεία ξεπέρασαν τη baseline τους (ή δεν υπήρχαν καθόλου σε αυτήν); */
function ratchetOffenders(withoutRange, baseline) {
  const totals = totalsByKey(withoutRange);
  const offenders = [];
  for (const [key, now] of totals) {
    const before = baseline.sites[key] || 0;
    if (now <= before) continue;
    const entry = withoutRange.find((e) => baselineKeyOf(e) === key);
    offenders.push({ entry, before, now });
  }
  return offenders;
}

function runCheck(targets, { full }) {
  const r = analyse(targets);
  const baseline = loadBaseline();
  if (!baseline) {
    console.error(c.red('🚫 CHECK 3.91: λείπει το baseline αρχείο.'));
    console.error(c.yellow('   Τρέξε: npm run firestore:admin-index:baseline'));
    process.exit(1);
  }

  const offenders = ratchetOffenders(r.withoutRange, baseline);
  if (r.withRange.length === 0 && offenders.length === 0) {
    if (full) reportImprovements(r, baseline);
    printInfo(r);
    process.exit(0);
  }

  console.error('');
  if (r.withRange.length > 0) {
    console.error(c.red(c.bold(`🚫 CHECK 3.91 / Κ1 — ${r.withRange.length} ερώτημα(τα) ΜΕ ΕΥΡΟΣ χωρίς δείκτη (ZERO-TOLERANCE)`)));
    console.error(c.dim('   Αυτά πετούν FAILED_PRECONDITION σε cron/route, όπου κανένα UI δεν θα το δείξει.'));
    console.error('');
    for (const entry of r.withRange) printEntry(entry, 'ΑΚΑΛΥΠΤΟ:');
  }
  if (offenders.length > 0) {
    console.error(c.red(c.bold(`🚫 CHECK 3.91 / Κ2 — ${offenders.length} σημείο(α) χωρίς εύρος πάνω από τη baseline`)));
    console.error('');
    for (const o of offenders) {
      console.error(c.dim(`  (baseline ${o.before} → τώρα ${o.now})`));
      printEntry(o.entry, 'ΑΚΑΛΥΠΤΟ:');
    }
  }
  console.error(c.yellow('  Διόρθωση — μία από τις τρεις:'));
  console.error('    1. πρόσθεσε τον δείκτη στο firestore.indexes.json (η πρόταση είναι από πάνω)');
  console.error('    2. άλλαξε το ερώτημα ώστε να καλύπτεται από υπάρχοντα δείκτη');
  console.error('    3. αν ΠΡΑΓΜΑΤΙΚΑ δεν χρειάζεται δείκτη, δήλωσέ το με λόγο:');
  console.error(c.dim(`       // ${EXEMPT_TOKEN}: <γιατί δεν χρειάζεται δείκτη εδώ>`));
  console.error('');
  process.exit(1);
}

function reportImprovements(r, baseline) {
  const current = totalsByKey(r.withoutRange);
  const improved = Object.keys(baseline.sites).filter((k) => (current.get(k) || 0) < baseline.sites[k]);
  if (improved.length === 0) return;
  console.log(c.green(`✔ CHECK 3.91 καθαρό — και ${improved.length} σημείο(α) βελτιώθηκαν.`));
  console.log(c.yellow('  Κλείδωσε την πρόοδο: npm run firestore:admin-index:baseline'));
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function main() {
  if (process.env.SKIP_FIRESTORE_ADMIN_INDEX === '1') process.exit(0);
  const argv = process.argv.slice(2);
  const targets = resolveTargets(argv);
  if (targets.length === 0) process.exit(0);

  if (argv.includes('--generate-baseline')) {
    const r = analyse(targets);
    const payload = writeBaseline(r.withoutRange);
    console.log(c.green(`✔ baseline γράφτηκε: ${payload._meta.totalSites} σημεία (Κ2)`));
    if (r.withRange.length > 0) {
      console.log(c.red(`⚠ ΠΡΟΣΟΧΗ: ${r.withRange.length} σημεία ΜΕ ΕΥΡΟΣ είναι ακάλυπτα και ΔΕΝ μπαίνουν σε baseline (Κ1 = zero-tolerance).`));
    }
    process.exit(0);
  }

  if (argv.includes('--report')) { runReport(targets); process.exit(0); }
  runCheck(targets, { full: argv.includes('--all') });
}

if (require.main === module) main();

// Μόνο ό,τι καλεί η άγκυρα — βλ. σχόλιο στο firestore-query-chain.js.
module.exports = { judgeSite };
