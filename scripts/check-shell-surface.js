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
  exportedRootOf,
  namedImports,
  resolveAlias,
} = require('./lib/shell-surface/scan');

const REPO = path.resolve(__dirname, '..');
const BASELINE = path.join(REPO, '.shell-surface-baseline.json');
const REGISTRY = path.join(REPO, '.shell-surface.json');

/**
 * Ο ΕΝΑΣ ΓΡΑΦΕΑΣ του δείκτη. Κάθε επιφάνεια που παίρνει διάδρομο περνά από εδώ —
 * και αυτό κάνει τη «δεύτερη αυθεντία» **αδύνατη**, όχι απλώς ανιχνεύσιμη.
 */
const PRIMITIVE = path.join(REPO, 'src', 'core', 'containers', 'ShellSurface.tsx');

/** Ο ιδιοκτήτης του κελύφους. Δεν γράφει πια τον δείκτη — τον **παραδίδει**. */
const OWNER = path.join(REPO, 'src', 'components', 'layout', 'MainContentBridge.tsx');

/** Η ρίζα των διαδρομών. Οι **γειτονιές** παράγονται από εδώ, ποτέ από λίστα. */
const APP_ROOT = path.join(REPO, 'src', 'app');

const BLOCKING = new Set(['page-padding', 'content-padding', 'negative-margin']);

const relative = (p) => path.relative(REPO, p).split(path.sep).join('/');

/**
 * Ταυτότητα παραβίασης: **διαδρομή + κατάσταση**, ποτέ γραμμή.
 * Η γραμμή μετακινείται με κάθε σχόλιο· η ταυτότητα δεν πρέπει.
 *
 * 🔑 Η ΔΙΑΔΡΟΜΗ ΜΕΝΕΙ ΓΥΜΝΗ ΑΚΟΜΑ ΚΑΙ ΤΩΡΑ ΠΟΥ ΟΙ ΓΕΙΤΟΝΙΕΣ ΕΙΝΑΙ ΠΕΝΤΕ, και
 * δεν είναι παράλειψη: το Next.js **απαγορεύει** σε δύο route groups να λύνονται
 * στην ίδια διεύθυνση (τεκμηρίωση, αυτολεξεί: *«Routes in different route groups
 * should not resolve to the same URL path … and cause an error»*). Η μοναδικότητα
 * είναι **δομική, από το framework** — άρα η επέκταση εμβέλειας από 139 σε 157
 * σελίδες **δεν μετακίνησε καμία υπάρχουσα ταυτότητα**, και δεν χρειάστηκε ούτε
 * πρόθεμα γειτονιάς ούτε ισομορφισμός baseline (πρότυπο CHECK 3.60).
 * Επαληθεύτηκε **μετρώντας**: 0 συγκρούσεις σε 156 διαδρομές.
 */
const violationId = (v) => `${v.route}|${v.state}`;

function readRegistry() {
  if (!fs.existsSync(REGISTRY)) {
    throw new Error(`λείπει το μητρώο ${relative(REGISTRY)}`);
  }
  const raw = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));

  // ⛔ Ο λόγος είναι ΥΠΟΧΡΕΩΤΙΚΟΣ (πρότυπο CHECK 3.35/3.58). Μια εξαίρεση χωρίς
  //    λόγο είναι εξαίρεση που κανείς δεν μπορεί να αποσύρει.
  const needsReason = (entry, label) => {
    if (!entry || typeof entry.reason !== 'string' || entry.reason.trim().length < 20) {
      throw new Error(`η δήλωση «${label}» δεν έχει ουσιαστικό reason`);
    }
  };

  const fullBleed = raw.fullBleed || {};
  for (const [route, entry] of Object.entries(fullBleed)) {
    if (route.startsWith('$')) continue;
    needsReason(entry, route);
  }

  const withoutCorridor = raw.groupsWithoutCorridor || {};
  for (const [group, entry] of Object.entries(withoutCorridor)) {
    if (group.startsWith('$')) continue;
    needsReason(entry, group);
  }

  return { fullBleed, withoutCorridor };
}

/** Το κείμενο ενός αρχείου χωρίς σχόλια, ή `null` αν δεν υπάρχει. */
function readClean(file) {
  if (!fs.existsSync(file)) return null;
  return stripComments(fs.readFileSync(file, 'utf8'));
}

/**
 * Κ1 — Ο ΕΝΑΣ ΓΡΑΦΕΑΣ, ΚΑΙ Η ΠΑΡΑΔΟΣΗ ΣΕ ΑΥΤΟΝ.
 *
 * Τέσσερις ερωτήσεις, όχι μία — και καμία δεν συνεπάγεται τις άλλες:
 *   α) γράφει **το primitive** τον δείκτη;   (αλλιώς ο διάδρομος σβήνει ΠΑΝΤΟΥ)
 *   β) **παραδίδει** ο ιδιοκτήτης σε αυτό;   (αλλιώς δεύτερος γραφέας)
 *   γ) τον ξαναγράφει **και** με το χέρι;    (τότε είναι ΚΑΙ οι δύο)
 *   δ) δηλώνει κάποιος από τους δύο padding; (τότε ο κριτής έγινε διάδικος)
 *
 * ⚠️ Η (β) είναι **αυστηρότερη** από τον έλεγχο της ΦΑΣΗΣ Α («το `<main>` φέρει
 * `data-shell-surface`»): εκείνος ήταν ικανοποιημένος από ένα **χειρόγραφο**
 * attribute — δηλαδή ακριβώς από τη δεύτερη αυθεντία που το ADR απαγορεύει.
 */
function judgeOwnership() {
  const prim = readClean(PRIMITIVE);
  if (prim === null) throw new Error(`το primitive δεν βρέθηκε: ${relative(PRIMITIVE)}`);
  const own = readClean(OWNER);
  if (own === null) throw new Error(`ο ιδιοκτήτης δεν βρέθηκε: ${relative(OWNER)}`);

  const primitiveRoot = exportedRootOf(prim) || { classAttr: '' };
  const ownerRoot = exportedRootOf(own) || { classAttr: '' };

  return {
    primitiveWrites: /data-shell-surface\s*=/.test(prim),
    primitivePads: OUTER_PADDING.test(prim),
    delegates: /<\s*ShellSurface\b[\s\S]{0,160}?as="main"/.test(own),
    ownerWritesRaw: /data-shell-surface/.test(own),
    ownerPads: OUTER_PADDING.test(ownerRoot.classAttr || ''),
    attrs: (ownerRoot.classAttr || '').slice(0, 120),
    primitiveTag: primitiveRoot.tag || '?',
  };
}

/** Οι γειτονιές, **παραγμένες** από τον δίσκο. Ποτέ χειρόγραφη λίστα. */
function routeGroups() {
  return fs
    .readdirSync(APP_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^\(.+\)$/.test(e.name))
    .map((e) => e.name)
    .sort();
}

/**
 * Κ4 — ΚΑΘΕ ΓΕΙΤΟΝΙΑ ΠΑΙΡΝΕΙ ΔΙΑΔΡΟΜΟ, εκτός αν το είπε κάποιος **με λόγο**.
 *
 * Η αναζήτηση είναι **ΕΝΑ άλμα** από το `layout.tsx` — ίδιο συμβόλαιο με τον
 * σαρωτή σελίδων, και **μετρημένα αρκετό και για τις πέντε**: το `(app)` εισάγει
 * το `MainContentBridge` **άμεσα**, το `(me)` το `PrivateSpaceShell`, τα
 * `(light)`/`(auth)` το γράφουν στο ίδιο τους το layout.
 *
 * ⚠️ **fail-closed**: γειτονιά **χωρίς** `layout.tsx` είναι ⛔, όχι «καθαρή».
 * Χωρίς αυτό, μια γειτονιά που χάνει το layout της θα έβγαινε **σιωπηλά** από
 * την κρίση — δηλαδή θα ήταν πράσινη ακριβώς **επειδή** έσπασε.
 *
 * ⚠️ Και η **αντίφαση** είναι δική της κατάσταση: μητρώο που λέει «χωρίς
 * διάδρομο» ενώ το layout δίνει διάδρομο δεν είναι «εντάξει επειδή το ένα από τα
 * δύο περνά» — είναι δύο αλήθειες που διαφωνούν (ADR-749).
 */
function judgeGroupCorridor(group, withoutCorridor) {
  const layoutFile = path.join(APP_ROOT, group, 'layout.tsx');
  const src = readClean(layoutFile);
  if (src === null) {
    return { state: 'group-without-layout', detail: `η γειτονιά ${group} δεν έχει layout.tsx` };
  }

  let found = /<\s*ShellSurface\b/.test(src);
  if (!found) {
    for (const imp of namedImports(src)) {
      const target = resolveAlias(imp.spec, REPO);
      if (!target) continue;
      if (!imp.names.some((n) => src.includes(`<${n}`))) continue;
      const child = readClean(target);
      if (child && /<\s*ShellSurface\b/.test(child)) {
        found = true;
        break;
      }
    }
  }

  const declared = Object.prototype.hasOwnProperty.call(withoutCorridor, group);
  if (found && declared) {
    return {
      state: 'corridor-contradicts-declaration',
      detail: `${group}: το μητρώο λέει «χωρίς διάδρομο», το layout όμως δίνει διάδρομο`,
    };
  }
  if (found) return { state: 'corridor-owned', detail: group };
  if (declared) return { state: 'corridor-declared-absent', detail: group };
  return {
    state: 'group-without-corridor',
    detail: `${group}: ούτε το layout ούτε ένα άλμα από αυτό δηλώνει διάδρομο`,
  };
}

function measure() {
  const registry = readRegistry();
  const ownership = judgeOwnership();

  const tally = Object.create(null);
  const groupTally = Object.create(null);
  const violations = [];
  const declarations = [];
  const unresolved = [];
  const measures = [];

  const flag = (route, state, file, detail) =>
    violations.push({ route, state, file, line: 0, detail });

  // ⛔ Κ1 — ZERO-TOL. Μπαίνει στις violations αλλά ΔΕΝ επιτρέπεται σε baseline
  //    (δες buildPayload): ένα zero-tol που κλειδώνεται με ένα `--write-baseline`
  //    δεν είναι zero-tol (πρότυπο CHECK 3.44/3.58).
  if (!ownership.primitiveWrites) {
    flag(relative(PRIMITIVE), 'primitive-lost-marker', relative(PRIMITIVE),
      'ο ΕΝΑΣ γραφέας έπαψε να γράφει το data-shell-surface — ο διάδρομος γίνεται ΣΙΩΠΗΛΑ μηδέν σε ΟΛΕΣ τις γειτονιές ταυτόχρονα');
  }
  if (ownership.primitivePads) {
    flag(relative(PRIMITIVE), 'primitive-declares-padding', relative(PRIMITIVE),
      'το primitive δηλώνει δικό του padding — δεύτερη αυθεντία στην πηγή της πρώτης');
  }
  if (!ownership.delegates) {
    flag(relative(OWNER), 'owner-lost-marker', relative(OWNER),
      `ο ιδιοκτήτης του κελύφους δεν παραδίδει στο ShellSurface (as="main") · ${ownership.attrs}`);
  }
  if (ownership.ownerWritesRaw && ownership.delegates) {
    flag(relative(OWNER), 'owner-writes-marker-by-hand', relative(OWNER),
      'ο ιδιοκτήτης ξαναγράφει το data-shell-surface με το χέρι δίπλα στην παράδοση — δύο γραφείς');
  }
  if (ownership.ownerPads) {
    flag(relative(OWNER), 'owner-declares-padding', relative(OWNER),
      `ο ιδιοκτήτης δηλώνει δικό του padding — δεύτερη αυθεντία που νικά κατά σειρά πηγής · ${ownership.attrs}`);
  }

  // ⛔ Κ4 — η κάθε γειτονιά, παραγμένη από τον δίσκο.
  const groups = routeGroups();
  for (const group of groups) {
    const verdict = judgeGroupCorridor(group, registry.withoutCorridor);
    groupTally[verdict.state] = (groupTally[verdict.state] || 0) + 1;
    if (verdict.state !== 'corridor-owned' && verdict.state !== 'corridor-declared-absent') {
      flag(group, verdict.state, `src/app/${group}/layout.tsx`, verdict.detail);
    }
  }
  for (const group of Object.keys(registry.withoutCorridor)) {
    if (group.startsWith('$')) continue;
    if (!groups.includes(group)) {
      flag(group, 'orphan-group-declaration', relative(REGISTRY),
        'το μητρώο δηλώνει γειτονιά χωρίς διάδρομο που δεν υπάρχει (πια) στον δίσκο');
    }
  }

  // ── ΟΙ ΣΕΛΙΔΕΣ, ΣΕ ΟΛΕΣ ΤΙΣ ΓΕΙΤΟΝΙΕΣ ────────────────────────────────────
  let pages = 0;
  for (const group of groups) {
    for (const page of collectPages(path.join(APP_ROOT, group))) {
      pages += 1;
      const verdict = classifyPage(page, REPO);
      const route =
        relative(page).replace(`src/app/${group}`, '').replace(/\/page\.tsx$/, '') || '/';

      tally[verdict.state] = (tally[verdict.state] || 0) + 1;

      // 🔑 Κ5 — ΔΕΥΤΕΡΟΣ ΑΞΟΝΑΣ: κρίνεται ΠΑΝΤΑ, ακόμη κι όταν η σελίδα είναι
      //    «καθαρή» ως προς το κενό. Μία κατάσταση για δύο ερωτήσεις θα έκρυβε
      //    τη μία πίσω από την άλλη (μάθημα CHECK 3.41).
      if (verdict.measure) {
        measures.push(route);
        flag(route, 'page-measure', relative(page),
          `${verdict.measure.where}: <${verdict.measure.tag} className="… ${verdict.measure.klass} …"> — χειρόγραφο ταβάνι πλάτους· η κλίμακα ζει στο spacing.layout.measure`);
      }

      if (verdict.state === 'declared-bleed') {
        declarations.push(route);
        if (!registry.fullBleed[route]) {
          flag(route, 'undeclared-bleed', relative(page),
            `η σελίδα βγαίνει από τον διάδρομο χωρίς γραμμή στο ${relative(REGISTRY)}`);
        }
        continue;
      }
      if (verdict.state === 'unresolved-root') {
        unresolved.push(route);
        continue;
      }
      if (BLOCKING.has(verdict.state)) {
        flag(route, verdict.state, relative(page), verdict.detail);
      }
    }
  }

  // Κ3, η άλλη κατεύθυνση: δήλωση χωρίς σελίδα. Χωρίς αυτό το μητρώο σαπίζει
  // σιωπηλά και ο επόμενος διαβάζει «εγκεκριμένο» εκεί που δεν υπάρχει τίποτα.
  for (const route of Object.keys(registry.fullBleed)) {
    if (route.startsWith('$')) continue;
    if (!declarations.includes(route)) {
      flag(route, 'orphan-declaration', relative(REGISTRY),
        'το μητρώο δηλώνει bleed για διαδρομή που δεν το ζητά (πια)');
    }
  }

  // fail-closed: κλειστή λογιστική, ΔΥΟ κατάστιχα. Άγνωστη κατάσταση δεν χάνεται
  // σιωπηλά — και τα δύο μεγέθη μετρώνται ανεξάρτητα από τα ευρήματα.
  const counted = Object.values(tally).reduce((a, b) => a + b, 0);
  if (counted !== pages) {
    throw new Error(`η λογιστική σελίδων δεν κλείνει: ${counted} ≠ ${pages}`);
  }
  const countedGroups = Object.values(groupTally).reduce((a, b) => a + b, 0);
  if (countedGroups !== groups.length) {
    throw new Error(`η λογιστική γειτονιών δεν κλείνει: ${countedGroups} ≠ ${groups.length}`);
  }

  return {
    violations,
    violationIds: violations.map(violationId),
    declarations: declarations.sort(),
    tally,
    groupTally,
    groups,
    unresolved,
    measures,
    pages,
    ownership,
  };
}

/**
 * ⛔ ΟΙ ΚΑΤΑΣΤΑΣΕΙΣ ΠΟΥ ΔΕΝ ΜΠΑΙΝΟΥΝ **ΠΟΤΕ** ΣΕ BASELINE.
 *
 * Δεν είναι «σοβαρότερες» — είναι **άλλου είδους**. Καμία από αυτές δεν έχει
 * νόημα ως «λιγότερες από χθες»: ένας ιδιοκτήτης που έπαψε να παραδίδει, μια
 * γειτονιά χωρίς διάδρομο, ή ένα μητρώο που αντιφάσκει με τον δίσκο είναι
 * **σπασμένα**, όχι χρέος. Ένα zero-tolerance που κλειδώνεται με ένα
 * `--write-baseline` δεν είναι zero-tolerance (πρότυπο CHECK 3.44/3.50/3.58).
 */
const ZERO_TOL = new Set([
  'primitive-lost-marker',
  'primitive-declares-padding',
  'owner-lost-marker',
  'owner-writes-marker-by-hand',
  'owner-declares-padding',
  'undeclared-bleed',
  'orphan-declaration',
  'group-without-corridor',
  'group-without-layout',
  'corridor-contradicts-declaration',
  'orphan-group-declaration',
]);

/** Οι ratcheted — **εκστρατείες που τελειώνουν στο μηδέν**, όχι δείκτες υγείας. */
const RATCHETED = new Set(['page-padding', 'content-padding', 'negative-margin', 'page-measure']);

function buildPayload(m) {
  const forbidden = m.violations.filter((v) => ZERO_TOL.has(v.state));
  if (forbidden.length) {
    throw new Error(
      'ΑΡΝΟΥΜΑΙ να γράψω baseline που περιέχει zero-tolerance καταστάσεις:\n'
      + forbidden.map((v) => `   ⛔ ${v.state}  ${v.route}`).join('\n'),
    );
  }
  const unknown = m.violations.filter((v) => !RATCHETED.has(v.state));
  if (unknown.length) {
    // fail-closed: κατάσταση που δεν είναι ούτε zero-tol ούτε ratcheted δεν
    // επιτρέπεται να προσγειωθεί σιωπηλά σε αρχείο που λέγεται «αποδεκτά».
    throw new Error(
      'άγνωστη κατάσταση στις παραβιάσεις:\n'
      + unknown.map((v) => `   ? ${v.state}  ${v.route}`).join('\n'),
    );
  }
  return {
    $doc: 'ADR-797 / CHECK 3.63 — σελίδες που δηλώνουν γεωμετρία που ανήκει στο κέλυφος: '
      + 'κενό (page/content-padding, negative-margin) ή ΠΛΑΤΟΣ (page-measure). '
      + 'Ο αριθμός ΔΕΝ είναι δείκτης υγείας: είναι εκστρατεία που τελειώνει στο μηδέν. '
      + 'Τα zero-tolerance ΔΕΝ μπαίνουν ΠΟΤΕ εδώ.',
    generated: new Date().toISOString().slice(0, 10),
    violations: m.violationIds.slice().sort(),
    declarations: m.declarations,
  };
}

function printReport(m) {
  const o = m.ownership;
  console.log('🏛️  ADR-797 / CHECK 3.63 — ο διάδρομος του κελύφους\n');
  console.log(`   Ο ΕΝΑΣ γραφέας: ${relative(PRIMITIVE)}  (<${o.primitiveTag}>)`);
  console.log(`     γράφει data-shell-surface  : ${o.primitiveWrites ? '✅' : '⛔ ΟΧΙ'}`);
  console.log(`     δικό του padding           : ${o.primitivePads ? '⛔ ΝΑΙ' : '✅ όχι'}\n`);
  console.log(`   Ιδιοκτήτης κελύφους: ${relative(OWNER)}`);
  console.log(`     παραδίδει στο primitive    : ${o.delegates ? '✅' : '⛔ ΟΧΙ'}`);
  console.log(`     ξαναγράφει τον δείκτη      : ${o.ownerWritesRaw && o.delegates ? '⛔ ΝΑΙ' : '✅ όχι'}`);
  console.log(`     δικό του padding           : ${o.ownerPads ? '⛔ ΝΑΙ' : '✅ όχι'}\n`);

  // ⚠️ Οι κάδοι τυπώνονται **ΑΚΟΜΑ ΚΑΙ ΣΤΟ ΜΗΔΕΝ**: ένα «0» που δεν τυπώνεται
  //    διαβάζεται ως «δεν υπάρχει τέτοιος έλεγχος» (μάθημα CHECK 3.48 / Κ6).
  console.log(`   Γειτονιές (παραγμένες από τον δίσκο): ${m.groups.length} — ${m.groups.join(' ')}`);
  for (const state of ['corridor-owned', 'corridor-declared-absent', 'group-without-corridor',
                       'group-without-layout', 'corridor-contradicts-declaration']) {
    const n = m.groupTally[state] || 0;
    const mark = state.startsWith('corridor-owned') || state.endsWith('declared-absent') ? '✅' : n ? '⛔' : '✅';
    console.log(`     ${mark} ${state.padEnd(34)} ${n}`);
  }

  console.log(`\n   Σελίδες: ${m.pages}`);
  for (const [state, n] of Object.entries(m.tally).sort((a, b) => b[1] - a[1])) {
    const mark = BLOCKING.has(state) ? '🔴' : state === 'unresolved-root' ? '🔶' : '✅';
    console.log(`     ${mark} ${state.padEnd(18)} ${n}`);
  }
  console.log(`     🔴 ${'page-measure'.padEnd(18)} ${m.measures.length}   (2ος άξονας — κρίνεται ανεξάρτητα)`);

  if (m.unresolved.length) {
    console.log(`\n   🔶 Δηλωμένο τυφλό σημείο (${m.unresolved.length}) — τα άλματα δεν έφτασαν:`);
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
  labels: { violations: 'σελίδες με δική τους γεωμετρία', declarations: 'δηλώσεις bleed' },
  commands: {
    report: 'npm run shell-surface:report',
    baseline: 'npm run shell-surface:baseline',
    seed: 'npm run shell-surface:baseline',
  },
  messages: {
    worse: 'κάποιος ξαναδήλωσε γεωμετρία (κενό ή πλάτος) που ανήκει στο κέλυφος',
    newDeclLabel: 'ΝΕΑ δήλωση bleed:',
    newDeclAdvice: [
      'Μια νέα επιφάνεια χωρίς διάδρομο μπλοκάρει ΑΚΟΜΑ ΚΙ ΑΝ είναι σωστή.',
      'Αυτό είναι το σημείο: το opt-out πρέπει να το δει άνθρωπος, αλλιώς η',
      'δεύτερη σωστή πράξη γίνεται τρίτη, και μετά κανόνας.',
      `Δήλωσέ την με λόγο στο ${relative(REGISTRY)} και ξανατρέξε.`,
    ],
  },
});
