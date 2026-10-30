#!/usr/bin/env node
/**
 * CHECK 3.35 — Firestore Tenant-Scope Ratchet (ADR-747)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η πύλη που **έλειπε ανάμεσα σε δύο πύλες**. Το CHECK 3.15 παραπέμπει γραπτά στο
 * CHECK 3.10 για το direct `query()`· το CHECK 3.10 είναι **δομικά τυφλό** σε
 * ακριβώς αυτό. Ο σαρωτής ({@link module:scripts/_shared/firestore-tenant-scope-scan})
 * απαντά και τα δύο σκέλη με AST αντί για grep γραμμών.
 *
 * ─── ΓΙΑΤΙ RATCHET ΚΑΙ ΟΧΙ ZERO-TOLERANCE — Η ΑΠΟΦΑΣΗ ΕΙΝΑΙ ΜΕΤΡΗΜΕΝΗ ─────────
 *
 * Απογραφή πριν γραφτεί η πύλη (2026-08-01, 11.062 αρχεία):
 *
 *     ωμά ευρήματα Admin SDK ............ 199
 *     −54  αφού αναγνωρίστηκε το `FIELDS.COMPANY_ID` (73 χρήσεις· 61% θόρυβος)
 *     − 6  αφού αναγνωρίστηκε η επανανάθεση `q = q.where(COMPANY_ID, …)`
 *     = 139  σε 86 αρχεία
 *
 * Από τα 139, χειροκίνητη κατηγοριοποίηση: **~48 είναι νόμιμα εκ σχεδιασμού**
 * (public capability tokens, `__name__` batch από ήδη-scoped γονέα, migrations
 * super-admin, inbound webhooks χωρίς μισθωτή ακόμη) και ~42 «έμμεση εμβέλεια από
 * γονέα» — γκρίζα, όχι σφάλματα. Ποσοστό ψευδώς θετικών **πολύ πάνω** από τον
 * πήχη ≤10% που θέτει η Google για blocking analyzers (Tricorder).
 *
 * ⇒ Zero-tolerance θα σήμαινε **139 κόκκινα σε καθαρό repo**. Υπάρχει ρητό
 *   προηγούμενο ότι **«ένα gate δεν επιτρέπεται να γεννηθεί κόκκινο»**
 *   (ADR-742, commit `b4ec47e2`). Άρα: **ratchet ανά αρχείο** — τα 139 μπαίνουν
 *   στη baseline, μπλοκάρονται μόνο **νέα** και **οπισθοδρομήσεις**.
 *
 * 🔴 ΚΑΙ Η BASELINE ΛΕΕΙ «139», ΟΧΙ «0». Αυτή είναι η ουσία: το
 *   `.firestore-companyid-baseline.json` έλεγε «0 violations — fully cleaned» ενώ
 *   η διαρροή ήταν ενεργή. Ένα ειλικρινές **139** είναι ασύγκριτα πιο χρήσιμο από
 *   ένα ψεύτικο **0** (τέταρτη εμφάνιση του «0 = κανείς δεν κοίταξε» — πρβλ. N.11
 *   i18n, N.12 ssot-discover, CHECK 3.15).
 *
 * ─── ΔΥΟ ΣΤΡΩΜΑΤΑ (καθιερωμένο σχήμα του repo) ───────────────────────────────
 *   Layer 1 — pre-commit: **μόνο τα staged** αρχεία (~0,3s). Δεν χτίζει γράφο.
 *   Layer 2 — CI: `--all`, πλήρης σάρωση, συγκρίνει ΟΛΗ τη baseline (πιάνει και
 *             μειώσεις που πρέπει να κλειδώσουν, και αρχεία που μετακινήθηκαν).
 *
 * ─── ΡΗΤΗ ΕΞΑΙΡΕΣΗ ΣΤΟ ΣΗΜΕΙΟ ΧΡΗΣΗΣ ────────────────────────────────────────
 *     // tenant-scope-exempt: το token ΕΙΝΑΙ η εξουσιοδότηση (public showcase)
 *     const snap = await adminDb.collection(COLLECTIONS.SHARES).where('token','==',t)…
 *
 *   Ο λόγος είναι **υποχρεωτικός**. Μια εξαίρεση χωρίς λόγο δεν αναγνωρίζεται —
 *   αλλιώς σε έξι μήνες κανείς δεν ξέρει αν ήταν απόφαση ή βιασύνη.
 *
 * CLI:
 *   node scripts/check-firestore-tenant-scope.js                 # staged (Layer 1)
 *   node scripts/check-firestore-tenant-scope.js --all           # πλήρης (Layer 2)
 *   node scripts/check-firestore-tenant-scope.js --report        # ανθρώπινη αναφορά
 *   node scripts/check-firestore-tenant-scope.js --write-baseline
 *   node scripts/check-firestore-tenant-scope.js path/to/file.ts
 *
 * Escape hatch: `SKIP_FIRESTORE_TENANT_SCOPE=1` (δικαιολόγησέ το στον Γιώργο)
 *
 * Exit: 0 καθαρό · 1 νέες/αυξημένες παραβιάσεις
 *
 * @see ADR-747
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { PROJECT_ROOT, projectInput } = require('./_shared/firestore-ast-loaders');
const { createScanContext, scanFile } = require('./_shared/firestore-tenant-scope-scan');
const { isScannable, resolveScanTargets, runScanCli, rel } = require('./_shared/firestore-scan-targets');

const BASELINE_FILE = path.join(PROJECT_ROOT, '.firestore-tenant-scope-baseline.json');

const c = require('./lib/tty-colours').ttyColours();   // SSoT (ADR-924 §8.10)

// ---------------------------------------------------------------------------
// Ανακάλυψη αρχείων — ο κοινός λιστωτής των σαρωτών Firestore (ADR-924 Φ3, `firestore-scan-targets`)
// ---------------------------------------------------------------------------

/** `--all`/`--report`/`--write-baseline` ⇒ κάθε σαρώσιμο του `src/` · αλλιώς ορίσματα · αλλιώς σταδιοποιημένα. */
function resolveTargets(argv, input = projectInput()) {
  return resolveScanTargets(argv, input, ['--all', '--report', '--write-baseline']);
}

// ---------------------------------------------------------------------------
// Baseline
// ---------------------------------------------------------------------------

function loadBaseline(input = projectInput()) {
  const text = input.read(BASELINE_FILE);
  if (text === null) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed.files === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function writeBaseline(perFile, totals) {
  const files = {};
  for (const key of Object.keys(perFile).sort()) files[key] = perFile[key];
  const payload = {
    _meta: {
      description:
        'CHECK 3.35 — Firestore tenant-scope ratchet (ADR-747). Ανά αρχείο πλήθος query χωρίς φίλτρο μισθωτή. Μόνο μειώνεται.',
      check: 'CHECK 3.35',
      adr: 'ADR-747',
      generatedBy: 'scripts/check-firestore-tenant-scope.js --write-baseline',
      totalViolations: totals.violations,
      totalFiles: Object.keys(files).length,
      unanalyzable: totals.unanalyzable,
      exempt: totals.exempt,
      note: 'Το πλήθος ΔΕΝ είναι δείκτης υγείας — περιλαμβάνει νόμιμα cross-tenant μονοπάτια. Δες §«γιατί ratchet» στο script.',
    },
    files,
  };
  fs.writeFileSync(BASELINE_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return payload;
}

// ---------------------------------------------------------------------------
// Σάρωση
// ---------------------------------------------------------------------------

function scanTargets(targets, input = projectInput()) {
  const ctx = createScanContext(input);
  const all = [];
  for (const f of targets) {
    try {
      all.push(...scanFile(f, ctx));
    } catch (err) {
      console.error(c.yellow(`⚠ αδύνατη η ανάλυση ${rel(f)}: ${err.message}`));
    }
  }
  const violations = all.filter((s) => s.status === 'violation');
  const perFile = {};
  for (const v of violations) {
    const k = rel(v.file);
    perFile[k] = (perFile[k] || 0) + 1;
  }
  return {
    sites: all,
    violations,
    perFile,
    totals: {
      violations: violations.length,
      unanalyzable: all.filter((s) => s.status === 'unanalyzable').length,
      exempt: all.filter((s) => s.status === 'exempt').length,
      ok: all.filter((s) => s.status === 'ok').length,
      notScoped: all.filter((s) => s.status === 'not-tenant-scoped').length,
    },
  };
}

// ---------------------------------------------------------------------------
// Λειτουργίες
// ---------------------------------------------------------------------------

function runReport(targets, input) {
  const { sites, violations, perFile, totals } = scanTargets(targets, input);
  console.log('');
  console.log(c.bold('CHECK 3.35 — Firestore tenant scope'));
  console.log(`  αρχεία σαρωμένα      : ${targets.length}`);
  console.log(`  σημεία query         : ${sites.length}`);
  console.log(c.green(`  ✔ με φίλτρο          : ${totals.ok}`));
  console.log(c.dim(`  · εκτός εμβέλειας    : ${totals.notScoped}`));
  console.log(c.dim(`  · ρητή εξαίρεση      : ${totals.exempt}`));
  console.log(c.yellow(`  ? μη αναλύσιμα       : ${totals.unanalyzable}`));
  console.log(c.red(`  ✖ ΧΩΡΙΣ ΦΙΛΤΡΟ       : ${totals.violations}  σε ${Object.keys(perFile).length} αρχεία`));
  console.log('');
  // ισοπαλία ⇒ όνομα: ντετερμινιστικό σε κάθε ΛΣ (ήταν η σειρά του `readdir`)
  const byFile = Object.entries(perFile).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  for (const [f, n] of byFile) console.log(`  ${String(n).padStart(3)}  ${f}`);
  console.log('');
  return { violations, perFile, totals };
}

function runCheck(targets, { full, input }) {
  const { sites, violations, perFile, totals } = scanTargets(targets, input);
  const baseline = loadBaseline(input);

  if (!baseline) {
    console.error(c.red('🚫 CHECK 3.35: λείπει το baseline αρχείο.'));
    console.error(c.yellow('   Τρέξε: npm run firestore:tenant-scope:baseline'));
    process.exit(1);
  }

  const offenders = [];
  for (const [file, count] of Object.entries(perFile)) {
    const before = baseline.files[file] || 0;
    if (count > before) offenders.push({ file, before, now: count });
  }

  // Layer 2 (--all): κλείδωσε και τις **μειώσεις** — αλλιώς η πρόοδος ξεγλιστρά πίσω.
  const improvements = [];
  if (full) {
    for (const [file, before] of Object.entries(baseline.files)) {
      const now = perFile[file] || 0;
      if (now < before) improvements.push({ file, before, now });
    }
  }

  // ═══ ΑΔΡΑΝΗΣ ΕΞΑΙΡΕΣΗ — ZERO TOL **ΜΟΝΟ ΣΤΟ ΑΓΓΙΓΜΑ** ═══════════════════════════════
  //
  // 🔴 Η μελέτη FSE 2025 μέτρησε ότι **50,8%** των suppressions δεν καταστέλλουν τίποτα, ότι
  // το πλήθος τους **αυξάνεται μονότονα**, και — το κρίσιμο — ότι κρύβουν ακούσια
  // **μελλοντικές** προειδοποιήσεις. Μια εξαίρεση που σήμερα δεν καλύπτει σημείο είναι
  // προ-εγκεκριμένο veto σε ό,τι γραφτεί εκεί αύριο.
  //
  // ⚠️ ΓΙΑΤΙ «ΣΤΟ ΑΓΓΙΓΜΑ» ΚΑΙ ΟΧΙ ΚΑΘΟΛΙΚΑ: μετρήθηκαν **8** αδρανείς εξαιρέσεις στο
  // σημερινό δέντρο (όλες νόμιμες κατά τον λόγο τους, όλες αδρανείς κατά τον σαρωτή — π.χ.
  // αιτιολογία πάνω από `onSnapshot(doc(...))`, που δεν είναι ερώτημα). Καθολικό μπλοκ θα
  // γεννούσε την πύλη **κόκκινη**, και μια πύλη που γεννιέται κόκκινη αγνοείται (ADR-742).
  // Στο άγγιγμα: αν πειράξεις το αρχείο, καθαρίζεις — ίδιο σχήμα με το CHECK 3.15.
  //
  // ⚠️ ΚΑΙ ΔΕΝ ΜΠΑΙΝΕΙ ΣΤΟΝ ΑΡΙΘΜΟ ΤΟΥ RATCHET: αδρανής εξαίρεση **δεν διαρρέει δεδομένα**.
  // Ανακατεύοντάς τη με τις παραβιάσεις θα χαλούσε το μόνο νούμερο που μετράει απομόνωση.
  const stale = full ? [] : sites.filter((s) => s.status === 'stale-exempt');
  if (stale.length > 0) {
    console.error('');
    console.error(c.red(c.bold('🚫 CHECK 3.35 — αδρανής εξαίρεση σε αρχείο που άγγιξες')));
    console.error('');
    for (const s of stale) {
      console.error(`  ${c.bold(rel(s.file))}${c.cyan(`:${s.line}`)}  ${s.detail}`);
    }
    console.error('');
    console.error(c.yellow('  Διόρθωση — μία από τις δύο:'));
    console.error('    1. σβήσε την: δεν καλύπτει τίποτα, και αύριο θα καλύψει κάτι εν αγνοία σου');
    console.error('    2. αν το σημείο ΟΝΤΩΣ χρειάζεται εξαίρεση, μετακίνησέ την στη γραμμή του query');
    console.error('');
    process.exit(1);
  }

  if (offenders.length === 0) {
    if (full && improvements.length > 0) {
      console.log(c.green(`✔ CHECK 3.35 καθαρό — και ${improvements.length} αρχείο(α) βελτιώθηκαν.`));
      console.log(c.yellow('  Κλείδωσε την πρόοδο: npm run firestore:tenant-scope:baseline'));
    }
    process.exit(0);
  }

  console.error('');
  console.error(c.red(c.bold('🚫 CHECK 3.35 — Firestore tenant scope: νέα query χωρίς φίλτρο μισθωτή')));
  console.error('');
  for (const o of offenders) {
    console.error(c.bold(`  ${o.file}`) + c.dim(`   (baseline ${o.before} → τώρα ${o.now})`));
    for (const v of violations.filter((x) => rel(x.file) === o.file)) {
      console.error(`    ${c.cyan(`γρ. ${v.line}`)}  [${v.rule}]  ${v.detail}`);
      console.error(c.dim(`             φιλτράρει σε: ${v.fields.length ? v.fields.join(', ') : '(τίποτα)'}`));
    }
    console.error('');
  }
  console.error(c.yellow('  Διόρθωση — μία από τις τρεις:'));
  console.error("    1. πρόσθεσε where('companyId','==',companyId) στο query");
  console.error('    2. πέρασε το από SSoT: firestoreQueryService / scopeQueryToCompany (ADR-702/742)');
  console.error('    3. αν είναι ΝΟΜΙΜΑ cross-tenant, δήλωσέ το με λόγο:');
  console.error(c.dim('       // tenant-scope-exempt: <γιατί δεν έχει μισθωτή αυτό το μονοπάτι>'));
  console.error('');
  console.error(c.dim(`  Σύνολο σάρωσης: ${totals.violations} παραβιάσεις · ${totals.unanalyzable} μη αναλύσιμα`));
  console.error('');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

/** ADR-924: με `--index` (εκτελεστής) κρίνονται τα αρχεία, οι κατάλογοι και η baseline ΤΟΥ COMMIT (`runScanCli`). */
function main() {
  runScanCli({
    skipEnv: 'SKIP_FIRESTORE_TENANT_SCOPE',
    baselineFlag: '--write-baseline',
    generate(targets, input) {
      const { perFile, totals } = scanTargets(targets, input);
      const payload = writeBaseline(perFile, totals);
      console.log(c.green(`✔ baseline γράφτηκε: ${payload._meta.totalViolations} παραβιάσεις σε ${payload._meta.totalFiles} αρχεία`));
    },
    report: runReport,
    check: runCheck,
  });
}

if (require.main === module) main();

module.exports = { scanTargets, loadBaseline, writeBaseline, isScannable, resolveTargets, BASELINE_FILE };
