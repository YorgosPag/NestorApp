#!/usr/bin/env node
/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  CHECK 3.63 — Η ΠΥΛΗ ΤΟΥ ΔΙΑΔΡΟΜΟΥ                          (ADR-797)     ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 *
 * «Δηλώνει κάποιος κενό που **δεν του ανήκει**, και ξέρει κάποιος ποιες σελίδες
 *  βγήκαν από τον διάδρομο;»
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ
 * ─────────────────────────────────────────────────────────────────────────────
 * Το ADR-797 έδωσε στο κέλυφος **έναν** ιδιοκτήτη για το κενό γύρω από το
 * περιεχόμενο. Χωρίς φρουρό, η επόμενη σελίδα ξαναγράφει το δικό της `p-6` και
 * η εφαρμογή αποκτά **δύο αυθεντίες** — που δεν φαίνεται ως σφάλμα, φαίνεται ως
 * «λίγο πιο μέσα». Μετρήθηκε **ζωντανά μέσα στην ίδια δουλειά**: το
 * `/listings/mandates` έβγαζε **32px + 24px = 56px**, και το είδε η **οθόνη**,
 * όχι ο κώδικας.
 *
 * Είναι το ίδιο σχήμα που σε αυτό το repo έχει αποτύχει **μετρημένα**: CHECK
 * 3.34 (δύο λίστες namespace, απόκλιση **63**) · 3.37 (**18 έναντι 26**) ·
 * 3.49 (**60** συγκρούσεις) · 3.57 (**19 από 20** μεταβλητές). Το ADR-749 το
 * ονομάζει με μια φράση: **μία μηχανή**.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΡΕΙΣ ΑΝΕΞΑΡΤΗΤΟΙ ΚΑΝΟΝΕΣ — ΠΟΤΕ ΕΝΑΣ ΜΕ «Ή» (μάθημα CHECK 3.41)
 * ─────────────────────────────────────────────────────────────────────────────
 *  **Κ1** ⛔ `owner-declares-padding` — ο **ίδιος ο ιδιοκτήτης**
 *      (`MainContentBridge`) απέκτησε κλάση padding. Δεν είναι «διπλό κενό»:
 *      είναι ο κριτής να γίνεται διάδικος, και **νικά κατά σειρά πηγής**
 *      (το `shell-surface.css` εισάγεται πριν τα `@tailwind`).
 *
 *  **Κ2** 🔴 `page-padding` / `content-padding` / `negative-margin` — μια
 *      **σελίδα** δηλώνει εξωτερικό κενό. RATCHET **κατά ταυτότητα**, όχι
 *      πλήθος: με αριθμό, η **ανταλλαγή** (καθαρίζω το Α, γεννώ το Β) περνά
 *      αθόρυβα (ADR-749).
 *
 *  **Κ3** ⛔ **κλειστό σύνολο δηλώσεων** — κάθε `bleed` δηλώνεται με **λόγο**.
 *      🏆 Φυλά **και τη σωστή πράξη**: μια νέα, απολύτως δικαιολογημένη
 *      επιφάνεια-καμβάς **ΜΠΛΟΚΑΡΕΙ** ώσπου να τη δει άνθρωπος. Ένα κλειστό
 *      σύνολο που εγκρίνει σιωπηλά τις σωστές πράξεις δεν θα έβλεπε ποτέ τη
 *      **δεύτερη** σωστή πράξη να γίνεται **τρίτη**, και μετά κανόνας.
 *
 * Ένας κανόνας με «ή» θα έμενε **πράσινος πάνω στο ελάττωμα**: ο ιδιοκτήτης
 * μπορεί να είναι καθαρός ενώ 40 σελίδες διπλασιάζουν, και το αντίστροφο.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΓΙΑΤΙ ΤΟ Κ2 ΕΙΝΑΙ RATCHET ΚΑΙ ΟΧΙ ZERO-TOL
 * ─────────────────────────────────────────────────────────────────────────────
 * Μετρημένο πριν γραφτεί η πύλη: **15 ζωντανές** σελίδες. Zero-tol θα γεννιόταν
 * μονίμως κόκκινο ⇒ `SKIP_` ⇒ **διακοσμητική πύλη** — δοκιμάστηκε και
 * απορρίφθηκε ρητά στο CHECK 3.39.
 *
 * ⚠️ **Ο ΑΡΙΘΜΟΣ ΔΕΝ ΕΙΝΑΙ ΔΕΙΚΤΗΣ ΥΓΕΙΑΣ.** Είναι το μέτρο μιας εκστρατείας
 * που **τελειώνει στο μηδέν**: κάθε σελίδα που σβήνει το `p-*` της κλειδώνεται.
 * Μερικές είναι **ακίνδυνες σήμερα** (`mx-auto max-w-3xl px-4` — κεντραρισμένη
 * στήλη, όπου το διπλό κενό δεν φαίνεται σε φαρδιά οθόνη) και **παραμένουν
 * παραβιάσεις**: το ερώτημα δεν είναι «φαίνεται;» αλλά «**ποιος αποφασίζει;**».
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔶 ΔΗΛΩΜΕΝΟ ΤΥΦΛΟ ΣΗΜΕΙΟ, ΜΕ ΑΡΙΘΜΟ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο σαρωτής κάνει **ΕΝΑ άλμα** (σελίδα → πρώτο component περιεχομένου). Σελίδα
 * που περνά από **τρίτο** ενδιάμεσο δεν κρίνεται: κατάσταση `unresolved-root`,
 * **μετριέται και τυπώνεται**, ποτέ σιωπηλά «καθαρή».
 *
 * ⚠️ Η πρώτη γραφή του σαρωτή έδινε **93 από 139** `unresolved-root` επειδή
 * έψαχνε μόνο `return (`. Θα γεννιόταν **σχεδόν ανενεργή**, με το «δεν βρήκα»
 * να διαβάζεται «καθαρό» — το σχήμα «0 = κανείς δεν κοίταξε». Σήμερα **12**.
 *
 * Layer 1 = pre-commit (~0,3s, πάντα πλήρες: το πλήρες κοστίζει όσο το μερικό).
 * Layer 2 = job στο υπάρχον `ssot-discover.yml`, άνευ όρων.
 *
 * Αναφορά:  npm run shell-surface:report
 * Baseline: npm run shell-surface:baseline
 * Escape:   SKIP_SHELL_SURFACE=1
 */

'use strict';

const fs = require('fs');
const path = require('path');

const { runSetRatchetCli } = require('./lib/ratchet-baseline');
const {
  OUTER_PADDING,
  stripComments,
  classifyPage,
  collectPages,
} = require('./lib/shell-surface/scan');

const REPO = path.resolve(__dirname, '..');
const BASELINE = path.join(REPO, '.shell-surface-baseline.json');
const REGISTRY = path.join(REPO, '.shell-surface.json');

/** Ο ΕΝΑΣ ιδιοκτήτης. Αν μετακινηθεί, η πύλη πρέπει να το μάθει — δεν μαντεύει. */
const OWNER = path.join(REPO, 'src', 'components', 'layout', 'MainContentBridge.tsx');

/** Οι σελίδες που φοράνε το κέλυφος. Το `(app)` **είναι** ο ορισμός (CHECK 3.52). */
const SHELL_ROOT = path.join(REPO, 'src', 'app', '(app)');

const BLOCKING = new Set(['page-padding', 'content-padding', 'negative-margin']);

const relative = (p) => path.relative(REPO, p).split(path.sep).join('/');

/** Ταυτότητα παραβίασης: **διαδρομή + κατάσταση**, ποτέ γραμμή.
 *  Η γραμμή μετακινείται με κάθε σχόλιο· η ταυτότητα δεν πρέπει. */
const violationId = (v) => `${v.route}|${v.state}`;

function readRegistry() {
  if (!fs.existsSync(REGISTRY)) {
    throw new Error(`λείπει το μητρώο ${relative(REGISTRY)}`);
  }
  const raw = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));
  const entries = raw.fullBleed || {};
  for (const [route, entry] of Object.entries(entries)) {
    if (route.startsWith('$')) continue;
    // ⛔ Ο λόγος είναι ΥΠΟΧΡΕΩΤΙΚΟΣ (πρότυπο CHECK 3.35/3.58). Μια εξαίρεση
    //    χωρίς λόγο είναι εξαίρεση που κανείς δεν μπορεί να αποσύρει.
    if (!entry || typeof entry.reason !== 'string' || entry.reason.trim().length < 20) {
      throw new Error(`η δήλωση bleed «${route}» δεν έχει ουσιαστικό reason`);
    }
  }
  return entries;
}

/** Κ1 — ο ιδιοκτήτης δεν γίνεται διάδικος. */
function judgeOwner() {
  if (!fs.existsSync(OWNER)) {
    throw new Error(`ο ιδιοκτήτης δεν βρέθηκε: ${relative(OWNER)}`);
  }
  const src = stripComments(fs.readFileSync(OWNER, 'utf8'));
  const open = src.match(/<main\b([^>]*)>/);
  if (!open) throw new Error(`ο ιδιοκτήτης δεν αποδίδει <main>: ${relative(OWNER)}`);

  const hasSurface = /data-shell-surface/.test(open[1]);
  const hasPadding = OUTER_PADDING.test(open[1]);
  return { hasSurface, hasPadding, attrs: open[1].trim().slice(0, 120) };
}

function measure() {
  const registry = readRegistry();
  const owner = judgeOwner();

  const tally = Object.create(null);
  const violations = [];
  const declarations = [];
  const unresolved = [];

  // ⛔ Κ1 — ZERO-TOL. Μπαίνει στις violations αλλά ΔΕΝ επιτρέπεται σε baseline
  //    (δες buildPayload): ένα zero-tol που κλειδώνεται με ένα `--write-baseline`
  //    δεν είναι zero-tol (πρότυπο CHECK 3.44/3.58).
  if (!owner.hasSurface) {
    violations.push({
      route: relative(OWNER), state: 'owner-lost-marker', file: relative(OWNER), line: 0,
      detail: `το <main> του κελύφους έχασε το data-shell-surface — ο διάδρομος γίνεται ΣΙΩΠΗΛΑ μηδέν · ${owner.attrs}`,
    });
  }
  if (owner.hasPadding) {
    violations.push({
      route: relative(OWNER), state: 'owner-declares-padding', file: relative(OWNER), line: 0,
      detail: `ο ιδιοκτήτης δηλώνει δικό του padding — δεύτερη αυθεντία που νικά κατά σειρά πηγής · ${owner.attrs}`,
    });
  }

  for (const page of collectPages(SHELL_ROOT)) {
    const verdict = classifyPage(page, REPO);
    const route =
      relative(page).replace('src/app/(app)', '').replace(/\/page\.tsx$/, '') || '/';

    tally[verdict.state] = (tally[verdict.state] || 0) + 1;

    if (verdict.state === 'declared-bleed') {
      declarations.push(route);
      if (!registry[route]) {
        violations.push({
          route, state: 'undeclared-bleed', file: relative(page), line: 0,
          detail: `η σελίδα βγαίνει από τον διάδρομο χωρίς γραμμή στο ${relative(REGISTRY)}`,
        });
      }
      continue;
    }
    if (verdict.state === 'unresolved-root') { unresolved.push(route); continue; }
    if (BLOCKING.has(verdict.state)) {
      violations.push({ route, state: verdict.state, file: relative(page), line: 0, detail: verdict.detail });
    }
  }

  // Κ3, η άλλη κατεύθυνση: δήλωση χωρίς σελίδα. Χωρίς αυτό το μητρώο σαπίζει
  // σιωπηλά και ο επόμενος διαβάζει «εγκεκριμένο» εκεί που δεν υπάρχει τίποτα.
  for (const route of Object.keys(registry)) {
    if (route.startsWith('$')) continue;
    if (!declarations.includes(route)) {
      violations.push({
        route, state: 'orphan-declaration', file: relative(REGISTRY), line: 0,
        detail: 'το μητρώο δηλώνει bleed για διαδρομή που δεν το ζητά (πια)',
      });
    }
  }

  const pages = collectPages(SHELL_ROOT).length;
  const counted = Object.values(tally).reduce((a, b) => a + b, 0);
  if (counted !== pages) {
    // fail-closed: κλειστή λογιστική. Άγνωστη κατάσταση δεν χάνεται σιωπηλά.
    throw new Error(`η λογιστική δεν κλείνει: ${counted} ≠ ${pages}`);
  }

  return {
    violations,
    violationIds: violations.map(violationId),
    declarations: declarations.sort(),
    tally,
    unresolved,
    pages,
    owner,
  };
}

const ZERO_TOL = new Set(['owner-declares-padding', 'owner-lost-marker', 'undeclared-bleed', 'orphan-declaration']);

function buildPayload(m) {
  const forbidden = m.violations.filter((v) => ZERO_TOL.has(v.state));
  if (forbidden.length) {
    // ⛔ Ένα zero-tolerance που κλειδώνεται με ένα `--write-baseline` δεν είναι
    //    zero-tolerance. Πρότυπο CHECK 3.44 / 3.50 / 3.58.
    throw new Error(
      'ΑΡΝΟΥΜΑΙ να γράψω baseline που περιέχει zero-tolerance καταστάσεις:\n'
      + forbidden.map((v) => `   ⛔ ${v.state}  ${v.route}`).join('\n'),
    );
  }
  return {
    $doc: 'ADR-797 / CHECK 3.63 — σελίδες που δηλώνουν κενό που ανήκει στο κέλυφος. '
      + 'Ο αριθμός ΔΕΝ είναι δείκτης υγείας: είναι εκστρατεία που τελειώνει στο μηδέν. '
      + 'Τα zero-tolerance ΔΕΝ μπαίνουν ΠΟΤΕ εδώ.',
    generated: new Date().toISOString().slice(0, 10),
    violations: m.violationIds.slice().sort(),
    declarations: m.declarations,
  };
}

function printReport(m) {
  console.log('🏛️  ADR-797 / CHECK 3.63 — ο διάδρομος του κελύφους\n');
  console.log(`   Ιδιοκτήτης: ${relative(OWNER)}`);
  console.log(`     δείκτης data-shell-surface : ${m.owner.hasSurface ? '✅' : '⛔ ΛΕΙΠΕΙ'}`);
  console.log(`     δικό του padding           : ${m.owner.hasPadding ? '⛔ ΝΑΙ' : '✅ όχι'}\n`);
  console.log(`   Σελίδες κελύφους: ${m.pages}`);
  for (const [state, n] of Object.entries(m.tally).sort((a, b) => b[1] - a[1])) {
    const mark = BLOCKING.has(state) ? '🔴' : state === 'unresolved-root' ? '🔶' : '✅';
    console.log(`     ${mark} ${state.padEnd(18)} ${n}`);
  }
  if (m.unresolved.length) {
    console.log(`\n   🔶 Δηλωμένο τυφλό σημείο (${m.unresolved.length}) — ένα άλμα δεν έφτασε:`);
    for (const r of m.unresolved) console.log(`      ${r}`);
  }
  if (m.violations.length) {
    console.log(`\n   Ευρήματα (${m.violations.length}):`);
    for (const v of m.violations) {
      console.log(`      [${v.state}] ${v.route}`);
      console.log(`         ${v.detail}`);
    }
  }
}

runSetRatchetCli({
  adr: 'ADR-797 (CHECK 3.63)',
  skipEnv: 'SKIP_SHELL_SURFACE',
  baselineFile: BASELINE,
  measure,
  buildPayload,
  printReport,
  violationId: (v) => violationId(v),
  labels: { violations: 'σελίδες με δικό τους κενό', declarations: 'δηλώσεις bleed' },
  commands: {
    report: 'npm run shell-surface:report',
    baseline: 'npm run shell-surface:baseline',
    seed: 'npm run shell-surface:baseline',
  },
  messages: {
    worse: 'κάποιος ξαναδήλωσε κενό που ανήκει στο κέλυφος',
    newDeclLabel: 'ΝΕΑ δήλωση bleed:',
    newDeclAdvice: [
      'Μια νέα επιφάνεια χωρίς διάδρομο μπλοκάρει ΑΚΟΜΑ ΚΙ ΑΝ είναι σωστή.',
      'Αυτό είναι το σημείο: το opt-out πρέπει να το δει άνθρωπος, αλλιώς η',
      'δεύτερη σωστή πράξη γίνεται τρίτη, και μετά κανόνας.',
      `Δήλωσέ την με λόγο στο ${relative(REGISTRY)} και ξανατρέξε.`,
    ],
  },
});
