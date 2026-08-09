#!/usr/bin/env node
/**
 * =============================================================================
 * CHECK 3.51 (ADR-781) — Ο ΧΡΗΣΜΟΣ (Χ) · Η ΑΥΘΕΝΤΙΑ
 * =============================================================================
 *
 * Χτυπάει **κάθε** διαδρομή του `src/app/**` σε **ζωντανό server** και ρωτά το
 * μόνο ερώτημα που δεν επιδέχεται μοντέλο: **περιέχει ωμά κλειδιά το HTML που
 * στέλνει ο server;**
 *
 * ΓΙΑΤΙ ΕΙΝΑΙ Η ΑΥΘΕΝΤΙΑ
 * -----------------------
 * Δεν μπορεί να είναι πράσινος πάνω σε σπασμένη οθόνη, **γιατί είναι η οθόνη**.
 * Και είναι ο **μόνος** που απαντά για τις **29 δυναμικές** διαδρομές και για
 * ό,τι η στατική ανάλυση αρνείται.
 *
 * ΜΕΤΡΗΜΕΝΗ ΒΑΘΜΟΝΟΜΗΣΗ (dev server, 2026-08-09)
 * -----------------------------------------------
 *   `/`               → clean    (ανεξάρτητη μέτρηση: 0)  ✅
 *   `/settings`       → clean    (ανεξάρτητη μέτρηση: 0)  ✅
 *   `/spaces/parking` → raw-key  **11**: τα 4 σε κείμενο **+ 7 σε `aria-label`**
 *   UA `curl/8.5.0`   → 403 ΚΕΝΟ σώμα ⇒ `route-unreachable`, **ποτέ «clean»**
 *
 * 🔑 Τα **7 σε `aria-label`** είναι ο λόγος που ο χρησμός σαρώνει **δύο**
 * επιφάνειες. Ένας text-only χρησμός θα ανέφερε 4 και θα φαινόταν σωστός.
 *
 * ΓΙΑΤΙ RATCHET ΚΑΙ ΟΧΙ ZERO-TOL ΣΤΑ ΚΛΕΙΔΙΑ — ΜΕΤΡΗΜΕΝΟ, ΟΧΙ ΓΟΥΣΤΟ
 * -------------------------------------------------------------------
 * Το σχέδιο έλεγε ⛔ zero-tol. Η **μέτρηση** το ανέτρεψε: υπάρχουν **ζωντανά**
 * ωμά κλειδιά **σήμερα** (11 μόνο στο `/spaces/parking`, «Κλάση Β» — namespace
 * που πραγματικά λείπει από τον server). Zero-tol θα ήταν **μονίμως κόκκινο**
 * ⇒ θα παρακαμπτόταν με `SKIP_` ⇒ διακοσμητικό. Δοκιμάστηκε και απορρίφθηκε με
 * τον ίδιο τρόπο στο CHECK 3.39. Ratchet **κατά ταυτότητα** `διαδρομή|επιφάνεια|κλειδί`:
 * μια **ανταλλαγή** μπλοκάρει, μια **προσθήκη** μπλοκάρει, μια **διόρθωση**
 * καταγράφεται (ADR-749).
 *
 * ⛔ ΑΛΛΑ ΔΥΟ ΚΑΤΑΣΤΑΣΕΙΣ ΔΕΝ ΜΠΑΙΝΟΥΝ ΠΟΤΕ ΣΕ BASELINE
 * -----------------------------------------------------
 *   `route-unreachable`  — 403/500/timeout/κενό σώμα
 *   `probe-unproven`     — καμία μεταφρασμένη τιμή στη σελίδα
 * Και οι δύο σημαίνουν **«δεν κοίταξα»**, και «δεν κοίταξα» δεν έχει πρόοδο.
 * Το `buildPayload` **αρνείται** να τις γράψει (πρότυπο CHECK 3.44/3.50).
 *
 * ⚠️ ΔΕΝ ΤΡΕΧΕΙ ΣΕ PRE-COMMIT. Χρειάζεται server· στο CI σηκώνεται από
 * `next build` + `next start`. Τοπικά: σήκωσε server και τρέξε το script.
 *
 * Περιβάλλον:
 *   I18N_SSR_ORACLE_BASE_URL   προεπιλογή `http://127.0.0.1:3000`
 *                              ⚠️ **127.0.0.1**, όχι `localhost`: το `fetch` του
 *                              Node λύνει πρώτα σε `::1` και ένας server που
 *                              ακούει IPv4 δίνει `ECONNREFUSED` — δηλαδή
 *                              «unreachable» για λόγο που δεν είναι η εφαρμογή.
 *   I18N_SSR_ORACLE_CONCURRENCY προεπιλογή 2
 *   I18N_SSR_ORACLE_TIMEOUT_MS  προεπιλογή 300000 (dev cold compile: μετρήθηκε
 *                               **167s** για το `/` — σε `next start` είναι ms)
 *   SKIP_I18N_SSR_ORACLE=1      παράκαμψη
 * =============================================================================
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const O = require('./lib/i18n-ssr/oracle');
const { runSetRatchetCli } = require('./lib/ratchet-baseline');

const CHECK = 'CHECK 3.51 Χ (ADR-781)';
const BS = String.fromCharCode(92);
const PROJECT_ROOT = path.join(__dirname, '..');
const BASELINE = path.join(PROJECT_ROOT, '.i18n-ssr-oracle-baseline.json');
const LOCALE_DIR = path.join(PROJECT_ROOT, 'src', 'i18n', 'locales', 'el');
const SLICE = path.join(PROJECT_ROOT, 'src', 'i18n', 'generated', 'shell-slice.el.json');

/**
 * ⚠️ ΤΟ ΠΛΑΣΤΟ UA ΕΙΝΑΙ ΜΕΡΟΣ ΤΗΣ ΟΡΘΟΤΗΤΑΣ, ΟΧΙ ΕΥΚΟΛΙΑ.
 * Το `src/middleware.ts → BLOCKED_BOT_PATTERNS` μπλοκάρει `node-fetch`, `curl/`,
 * `axios/`, `headlesschrome` με **403 και ΚΕΝΟ σώμα**, **χωρίς εξαίρεση για dev**.
 * Χωρίς αυτή τη γραμμή η πύλη αναφέρει «0 ωμά κλειδιά σε 141 διαδρομές».
 * 🚫 ΜΗΝ τη «διορθώσεις» αφαιρώντας pattern από το middleware — είναι κώδικας
 *    ασφαλείας (ίδιο μάθημα με το CHECK 3.46).
 */
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36';

const DIM = '\x1b[2m';
const NC = '\x1b[0m';

function baseUrl() {
  return (process.env.I18N_SSR_ORACLE_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
}

async function measure(args) {
  const posixRoot = PROJECT_ROOT.split(BS).join('/');
  const routes = O.enumerateRoutes(posixRoot);
  if (routes.length === 0) throw new Error('δεν βρέθηκε καμία διαδρομή κάτω από src/app');

  const { universe, unreadable } = O.buildUniverse(LOCALE_DIR);
  if (unreadable.length > 0) {
    // fail-closed: ένα namespace που δεν διαβάστηκε είναι **άγνωστο**, όχι άδειο.
    throw new Error(`μη αναγνώσιμα locale namespaces: ${unreadable.map((item) => `${item.namespace} (${item.reason})`).join(', ')}`);
  }
  if (!fs.existsSync(SLICE)) throw new Error('λείπει το shell-slice.el.json — τρέξε: npm run generate:i18n-shell-slice');
  const controls = O.buildPositiveControls(JSON.parse(fs.readFileSync(SLICE, 'utf8')));
  if (controls.size === 0) throw new Error('μηδέν θετικά controls — ο χρησμός δεν μπορεί να αποδείξει ότι κοίταξε');

  const only = args.find((arg) => arg.startsWith('--only='));
  const selected = only ? routes.filter((route) => route.url.includes(only.slice('--only='.length))) : routes;
  const skipped = routes.filter((route) => !selected.includes(route));

  const verbose = !args.includes('--quiet');
  const records = await O.sweep(selected, {
    baseUrl: baseUrl(),
    userAgent: USER_AGENT,
    oracle: { universe, controls },
    timeoutMs: Number(process.env.I18N_SSR_ORACLE_TIMEOUT_MS || 300000),
    concurrency: Number(process.env.I18N_SSR_ORACLE_CONCURRENCY || 2),
    onProgress: verbose
      ? (record, done, total) => {
          const badge = record.state === O.X_STATES.CLEAN ? '✅' : record.state === O.X_STATES.RAW_KEY ? '🔴' : '⛔';
          process.stderr.write(`${DIM}  [${String(done).padStart(3)}/${total}] ${badge} ${record.route} ${record.state}${record.keys.length ? ` (${record.keys.length})` : ''}${NC}\n`);
        }
      : undefined,
  });

  // ⚠️ Καμία σιωπηλή δειγματοληψία: ό,τι δεν χτυπήθηκε μπαίνει ΡΗΤΑ και
  // ratchet-άρεται — μια κάλυψη που συρρικνώνεται πρέπει να φαίνεται.
  for (const route of skipped) {
    records.push({ ...route, route: route.url, state: O.X_STATES.SKIPPED, status: null, keys: [] });
  }

  const census = O.assertClosedX(records);

  const violationIds = [];
  for (const record of records) {
    if (record.state === O.X_STATES.RAW_KEY) {
      for (const hit of record.keys) violationIds.push(O.violationId(record, hit));
    } else if (record.state === O.X_STATES.SKIPPED) {
      violationIds.push(`${record.route}|skipped|—`);
    }
  }

  return {
    records,
    census,
    routes,
    violationIds: violationIds.sort(),
    declarations: routes.map((route) => `${route.url}${route.dynamic ? ' (dynamic)' : ''}`).sort(),
    violations: records
      .filter((record) => record.state === O.X_STATES.RAW_KEY)
      .flatMap((record) => record.keys.map((hit) => ({
        file: record.file,
        line: record.route,
        state: `raw-key/${hit.surface}`,
        detail: hit.key,
      }))),
  };
}

/** ⛔ Οι zero-tolerance καταστάσεις ΔΕΝ γράφονται ΠΟΤΕ σε baseline. */
function assertNoZeroTolerance(measured) {
  const offenders = measured.records.filter((record) => O.X_ZERO_TOLERANCE.includes(record.state));
  if (offenders.length === 0) return;
  const lines = offenders.map((record) => `      ${record.state.padEnd(18)} ${record.route}  ${record.detail || ''}`);
  throw new Error(
    `${offenders.length} διαδρομή/ές που ο χρησμός ΔΕΝ απέδειξε ότι κοίταξε — αυτό δεν είναι «καθαρό», είναι «δεν ξέρω»:\n${lines.join('\n')}\n` +
    '      Αυτές οι καταστάσεις ΔΕΝ μπαίνουν ΠΟΤΕ σε baseline.'
  );
}

function buildPayload(measured) {
  assertNoZeroTolerance(measured);
  return {
    description:
      'CHECK 3.51 Χ (ADR-781) — ο ΧΡΗΣΜΟΣ: ωμά i18n κλειδιά στο HTML που στέλνει ο server. ' +
      '`violations` = ΜΙΑ ταυτότητα ανά (διαδρομή, επιφάνεια, κλειδί) — η ταυτότητα ΔΕΝ περιέχει γραμμή, ' +
      'ώστε μια μετακίνηση να μη φαίνεται ως add+remove. `declarations` = οι διαδρομές· νέα διαδρομή ' +
      'μπλοκάρει ΑΚΟΜΑ ΚΙ ΑΝ είναι καθαρή, γιατί αλλάζει την επιφάνεια που ο χρησμός οφείλει να καλύψει. ' +
      '⛔ Οι καταστάσεις route-unreachable / probe-unproven ΔΕΝ μπαίνουν ΠΟΤΕ εδώ. ' +
      '⚠️ Ο αριθμός ΔΕΝ είναι δείκτης υγείας: η θεραπεία είναι per-route slices (ADR-744 Φ4), όχι μικρότερος αριθμός.',
    adr: 'ADR-781',
    check: 'CHECK 3.51 Χ',
    baseUrl: baseUrl(),
    by_state: measured.census,
    violation_count: measured.violationIds.length,
    declaration_count: measured.declarations.length,
    violations: measured.violationIds,
    declarations: measured.declarations,
  };
}

function printReport(measured) {
  console.log(`\n${CHECK} — ο ΧΡΗΣΜΟΣ · ${measured.routes.length} διαδρομές έναντι ${baseUrl()}\n`);
  const mark = (state) => (O.X_ZERO_TOLERANCE.includes(state) ? '⛔' : O.X_RATCHETED.includes(state) ? '🔴' : '✅');
  // Οι κάδοι τυπώνονται ΑΚΟΜΑ ΚΑΙ ΣΤΟ ΜΗΔΕΝ (μάθημα CHECK 3.48 Κ6).
  for (const [state, count] of Object.entries(measured.census)) {
    console.log(`    ${mark(state)} ${state.padEnd(20)}${String(count).padStart(6)}`);
  }
  console.log(`\n  ωμά κλειδιά ανά διαδρομή:`);
  const dirty = measured.records.filter((record) => record.keys.length > 0).sort((a, b) => b.keys.length - a.keys.length);
  if (dirty.length === 0) console.log('    (κανένα)');
  for (const record of dirty) {
    console.log(`    ${record.route}  ${DIM}(${record.keys.length})${NC}`);
    for (const hit of record.keys) console.log(`        ${hit.surface.padEnd(12)} ${hit.key}`);
  }
  const bySurface = {};
  for (const record of measured.records) for (const hit of record.keys) bySurface[hit.surface] = (bySurface[hit.surface] || 0) + 1;
  console.log(`\n  ανά επιφάνεια: ${JSON.stringify(bySurface)}`);
  console.log(`  ${DIM}(μια επιφάνεια που λείπει από αυτόν τον πίνακα είναι τυφλό σημείο, όχι απουσία βλάβης)${NC}\n`);
}

const DESCRIPTOR = {
  adr: CHECK,
  skipEnv: 'SKIP_I18N_SSR_ORACLE',
  baselineFile: BASELINE,
  measure,
  buildPayload,
  printReport,
  violationId: (violation) => `${violation.line}|${violation.state.replace('raw-key/', '')}|${violation.detail}`,
  labels: { violations: 'ωμά κλειδιά στο SSR HTML', declarations: 'διαδρομές' },
  messages: {
    worse: 'ο server στέλνει ωμό i18n κλειδί εκεί που δεν το έστελνε',
    newDeclLabel: 'ΝΕΑ ΔΙΑΔΡΟΜΗ:',
    newDeclAdvice: [
      'Μια νέα διαδρομή μπλοκάρει ΑΚΟΜΑ ΚΙ ΑΝ είναι καθαρή σήμερα: αλλάζει την επιφάνεια',
      'που ο χρησμός οφείλει να καλύπτει, και αυτό είναι απόφαση, όχι παρενέργεια.',
      'Αν είναι όντως καθαρή: npm run i18n-ssr-oracle:baseline',
    ],
  },
  commands: {
    seed: 'node scripts/check-i18n-ssr-oracle.js --write-baseline',
    report: 'npm run i18n-ssr-oracle:report',
    baseline: 'npm run i18n-ssr-oracle:baseline',
  },
};

if (require.main === module) {
  // ⚠️ Το `assertNoZeroTolerance` πετά μέσα από το `buildPayload`, το οποίο ο
  // κοινός `runSetRatchetCli` καλεί ΕΞΩ από το δικό του try. Χωρίς αυτό εδώ, μια
  // **σωστή άρνηση** («δεν απέδειξα ότι κοίταξα») θα τυπωνόταν ως **stack trace**
  // — και ένα stack trace σε CI διαβάζεται ως «η πύλη κράσαρε», όχι ως «η πύλη
  // αρνήθηκε». Η διαφορά είναι ολόκληρη: το πρώτο προσκαλεί `SKIP_`, το δεύτερο
  // προσκαλεί διόρθωση.
  runSetRatchetCli(DESCRIPTOR, process.argv).catch((error) => {
    console.error(`\n❌ ${CHECK} — Η ΠΥΛΗ ΑΡΝΕΙΤΑΙ ΝΑ ΑΠΟΦΑΝΘΕΙ\n`);
    console.error(`   ${error.message}\n`);
    console.error('   Σήκωσε τον server που ΟΝΤΩΣ στέλνεται και ξανατρέξε:');
    console.error('     pnpm run build:ci');
    console.error('     cp -r public .next/standalone/public');
    console.error('     mkdir -p .next/standalone/.next && cp -r .next/static .next/standalone/.next/static');
    console.error('     node .next/standalone/server.js &');
    console.error(`   Βάση: ${baseUrl()}  (⚠️ 127.0.0.1, ΟΧΙ localhost — το fetch του Node λύνει πρώτα ::1)\n`);
    process.exit(1);
  });
}

module.exports = { DESCRIPTOR, measure, buildPayload, printReport, assertNoZeroTolerance, USER_AGENT, CHECK };
