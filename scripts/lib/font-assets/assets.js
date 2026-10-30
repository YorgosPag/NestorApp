/**
 * CHECK 3.69 — ΤΟ ΜΗΤΡΩΟ ΤΩΝ ΓΡΑΜΜΑΤΟΣΕΙΡΩΝ ΠΟΥ ΔΙΑΝΕΜΟΥΜΕ (ADR-805).
 *
 * «Έχει κάθε δυαδικό γραμματοσειράς που **διανέμουμε** δηλωμένη, **επιτρεπόμενη** άδεια — και
 * το επιβεβαιώνει το **ίδιο το αρχείο**;»
 *
 * ## 🔴 Το τυφλό σημείο, μετρημένο
 *
 * Ο **license gate** (ADR-598 G13, CHECK 12) κρίνει την απογραφή **πακέτων** του pnpm
 * (`pnpm licenses list --prod`· ως 2026-09-16 `license-checker`). Ένα `.ttf` μέσα στο `public/`
 * **δεν είναι πακέτο** ⇒ είναι **δομικά αόρατο** εκεί. Μετρημένο 2026-08-25, το έργο διένειμε **τρία** σύνολα bytes γραμματοσειράς με
 * **μηδενική** δηλωμένη άδεια και **κανένα** αρχείο απόδοσης πουθενά στο δέντρο:
 *
 * | bytes | ταξιδεύει |
 * |---|---|
 * | `public/fonts/Roboto-Regular.ttf` (515 KB) | στον browser |
 * | `public/fonts/helvetiker_regular.typeface.json` (63 KB) | στον browser |
 * | `src/services/gantt-export/roboto-font-data.ts` (**687 KB base64**) | **ενσωματώνεται σε ΚΑΘΕ PDF πελάτη** |
 *
 * Και το τρίτο έδειξε ότι το ερώτημα **δεν** είναι ακαδημαϊκό: το `helvetiker` κουβαλά
 * `license_url = ellak.gr/fonts/MgOpen/license.html` — **προσαρμοσμένη άδεια, εκτός SPDX, που
 * δεν ενέκρινε ποτέ κανείς**.
 *
 * ## 🏆 Πού ξεπερνάμε τους μεγάλους
 *
 * AutoCAD / Revit / Figma **δεν επαληθεύουν ούτε την άδεια ούτε τις μετρικές** της
 * γραμματοσειράς που φορτώνουν — και τους είναι εύκολο, γιατί οι όψεις τους είναι **του
 * συστήματος** ή του χρήστη, όχι δικές τους να διανείμουν. Ένα web CAD **διανέμει** τα bytes,
 * άρα η ερώτηση **υπάρχει** εδώ και **δεν υπάρχει** εκεί. Η απάντηση παίρνεται από την πηγή που
 * δεν μπορεί να λέει ψέματα: το `name` table του **ίδιου του αρχείου**.
 *
 * ⚠️ **ΜΙΑ πολιτική αδειών** (2026-09-16): η απόφαση «επιτρέπεται;» είναι το
 * `decideAsset` του `lib/license-policy/policy.js` πάνω στο `.license-policy.json` — η **ίδια**
 * συνάρτηση και το **ίδιο** αρχείο που κρίνουν τα npm πακέτα. Η OFL-1.1 είναι
 * BY_EXCEPTION_ONLY (Google) ⇒ οι Liberation περνούν με **ρητή** `assetExceptions`, όχι επειδή
 * «είναι στη λίστα». Δεύτερη λίστα εδώ θα ήταν ADR-749 σε μικρογραφία.
 *
 * @module scripts/lib/font-assets/assets
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const E = require('./evidence');
const { closedTally, idsOf } = require('../gate-ledger');
const LP = require('../license-policy/policy');
const { stripComments } = require('../source-text');

const REGISTRY_FILE = '.font-assets.json';
const POLICY_FILE = LP.POLICY_FILE_NAME;

// 🔑 **«ΑΠΑΙΤΕΙ Η ΑΔΕΙΑ ΝΑ ΤΑΞΙΔΕΥΕΙ ΤΟ ΚΕΙΜΕΝΟ ΤΗΣ;» — ΤΟ ΡΩΤΑΜΕ, ΔΕΝ ΤΟ ΛΕΜΕ.**
//    Ως το ADR-863 ζούσε εδώ ως χειρόγραφο `new Set(['Apache-2.0','OFL-1.1'])` — δεύτερη λίστα
//    αδειών δίπλα στην πολιτική, δηλαδή ADR-749 σε μικρογραφία. Ήταν **και νομικά στενή**: η
//    MIT απαιτεί επίσης απόδοση («in all copies or substantial portions») και **έλειπε**.
//    Πλέον η απάντηση είναι το `LP.requiresAttribution` πάνω στο `.license-policy.json` — η
//    **ίδια** αυθεντία που λέει «επιτρέπεται;», και η ίδια που ρωτά το CHECK 3.84.

const STATES = {
  DECLARED_ALLOWED: 'declared-allowed',
  UNDECLARED_ASSET: 'undeclared-asset',
  ORPHAN_DECLARATION: 'orphan-declaration',
  UNREADABLE_ASSET: 'unreadable-asset',
  LICENSE_UNVERIFIABLE: 'license-unverifiable',
  LICENSE_DRIFT: 'license-drift',
  LICENSE_NOT_ALLOWED: 'license-not-allowed',
  UNATTRIBUTED: 'unattributed',
  DECLARED_NOT_TRACKED: 'declared-not-tracked',
  REMOTE_FONT_SOURCE: 'remote-font-source',
};

/**
 * ⛔ **ΔΕΝ μπαίνουν ΠΟΤΕ σε baseline** — ένα zero-tol που κλειδώνεται με ένα `--write-baseline`
 * δεν είναι zero-tol (πρότυπο CHECK 3.44).
 */
const BLOCKING = [
  STATES.UNDECLARED_ASSET,
  STATES.ORPHAN_DECLARATION,
  STATES.DECLARED_NOT_TRACKED,
  STATES.UNREADABLE_ASSET,
  STATES.LICENSE_UNVERIFIABLE,
  STATES.LICENSE_DRIFT,
  STATES.REMOTE_FONT_SOURCE,
];

/** 🔴 Ratchet κατά ταυτότητα — εκστρατείες που τελειώνουν στο μηδέν. */
const RATCHETED = [STATES.LICENSE_NOT_ALLOWED, STATES.UNATTRIBUTED];

// ─── Απογραφή ─────────────────────────────────────────────────────────────────

/** Το ευρετήριο — τα αρχεία που θα φύγουν στο commit (η είσοδος: \`git ls-files\` και στις δύο όψεις). */
function tracked(input) {
  return input.tracked();
}

/** Δυαδικά γραμματοσειράς που είναι **στο ευρετήριο του git** — δηλαδή θα φύγουν στο commit. */
function binaryAssets(files) {
  return files.filter((f) => E.FONT_EXTENSIONS.test(f) || E.TYPEFACE_JSON.test(f));
}

/**
 * Modules που **ΕΙΝΑΙ** γραμματοσειρά σε base64.
 *
 * 🔑 **Το κριτήριο ακολουθεί τον ΚΑΤΑΝΑΛΩΤΗ, και μετρήθηκε πριν γραφτεί.** Δύο ευρετικά
 * απορρίφθηκαν: «αρχείο που εξάγει `*_BASE64`» ⇒ **50% ψευδώς θετικά** (το `logo-data.ts` είναι
 * **εικόνα**)· «όνομα αρχείου που περιέχει font» ⇒ εύθραυστο. Κρατήθηκε το ακριβές: **ο
 * ταυτοποιητής που περνιέται ως τα BYTES σε `addFileToVFS('<κάτι>.ttf', X)`** — μετρημένα
 * **3 σημεία κλήσης, 1 ταυτοποιητής, 0 ψευδώς θετικά**.
 *
 * ⚠️ Η προέλευση βρίσκεται με `export const <X>` πάνω σε **tracked** αρχεία, **όχι** με επίλυση
 * ψευδωνύμων μονοπατιού: οι κλήσεις χρησιμοποιούν **και** στατικό `import` **και** δυναμικό
 * `await import()`, και ένας δεύτερος resolver θα ήταν δεύτερη μηχανή για κάτι που το
 * **όνομα** ήδη απαντά μονοσήμαντα.
 */
const SOURCE_PATHSPECS = ['*.ts', '*.tsx', '*.js', '*.mjs'];

/** ADR-924 Φ2 — το κείμενο ΤΗΣ ΟΨΗΣ: με `--index` ψάχνει το ευρετήριο (`git grep --cached`), όχι τον δίσκο. */
/** Ρίζα (σουίτες, παλιό API) ή είσοδος — ό,τι κι αν δοθεί, οι αναγνώσεις περνούν από την ΕΙΣΟΔΟ. */
const inputOf = (rootOrInput) => (typeof rootOrInput === 'string'
  ? require('../gate-input').openGateInput({ root: rootOrInput }) : rootOrInput);

function gitGrepFiles(input, needle, pathspecs = SOURCE_PATHSPECS) {
  return input.grep(needle, pathspecs);
}

function base64FontModules(rootOrInput) {
  const input = inputOf(rootOrInput);
  const idents = new Set();
  for (const rel of gitGrepFiles(input, 'addFileToVFS')) {
    // 🔴 ΤΑ ΣΧΟΛΙΑ ΚΟΒΟΝΤΑΙ, ΚΑΙ ΤΟ ΠΛΗΡΩΣΕ ΑΥΤΟ ΤΟ ΙΔΙΟ ΑΡΧΕΙΟ: το docblock από πάνω γράφει
    //    το κριτήριο ως παράδειγμα, οπότε η πύλη διάβαζε τη ΔΙΚΗ ΤΗΣ τεκμηρίωση, εξήγαγε
    //    «ταυτοποιητή» και ανέφερε 11 αδήλωτες γραμματοσειρές αντί για 1 (σχήμα `Κ7β`, 3.50).
    const text = stripComments(input.read(rel) ?? '');
    const re = /addFileToVFS\(\s*['"][^'"]+\.(?:ttf|otf|woff2?)['"]\s*,\s*([A-Za-z_$][\w$]*)/g;
    for (const m of text.matchAll(re)) idents.add(m[1]);
  }
  const owners = new Set();
  for (const ident of idents) {
    for (const rel of gitGrepFiles(input, `export const ${ident}`)) owners.add(rel);
  }
  return [...owners].sort();
}

/**
 * 🔴 **Η ΔΙΑΝΟΜΗ ΠΟΥ ΤΟ ΜΗΤΡΩΟ ΔΕΝ ΜΠΟΡΟΥΣΕ ΝΑ ΔΕΙ** (ADR-805 §10, ως τότε «δηλωμένο όριο» §9.2).
 *
 * Το `next/font/google` κατεβάζει γραμματοσειρά **στο build** και τη σερβίρει από το
 * `.next/static/media`: bytes που διανέμουμε, χωρίς να είναι ποτέ checked-in ⇒ **αόρατα** στην
 * απογραφή δυαδικών. Μετρημένο 2026-10-10: το ADR έγραφε γι' αυτά «είναι Apache-2.0», ενώ το
 * `name` table τους έλεγε **OFL-1.1** (η Roboto 3 άλλαξε άδεια) — και η εκκίνηση του dev server
 * εξαρτιόταν από το τι θα απαντήσει η Google εκείνη τη στιγμή.
 *
 * Μια φόρτωση από τρίτον δεν «δηλώνεται»: **αντικαθίσταται** από αρχείο στο μητρώο. Γι' αυτό
 * είναι ⛔ zero-tolerance και όχι γραμμή του `.font-assets.json`.
 */
const REMOTE_FONT_NEEDLES = ['next/font/google', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const SHIPPED_CODE_PATHSPECS = [...SOURCE_PATHSPECS, '*.cjs', '*.css', '*.scss', '*.html'];

/**
 * ⚠️ Τα εργαλεία του `scripts/` **ονομάζουν** τις βελόνες (αυτό το αρχείο, η σουίτα του) χωρίς
 * να φορτώνουν τίποτα, και δεν φτάνουν ποτέ σε χρήστη. Εξαιρούνται κατά φάκελο, όχι κατά όνομα.
 */
const TOOLING_PREFIX = 'scripts/';

/** Ποιες βελόνες εμφανίζονται στον **κώδικα** ενός κειμένου — τα σχόλια δεν φορτώνουν τίποτα. */
function remoteNeedlesIn(sourceText) {
  const code = stripComments(sourceText);
  return REMOTE_FONT_NEEDLES.filter((needle) => code.includes(needle));
}

function remoteFontSources(rootOrInput) {
  const input = inputOf(rootOrInput);
  const candidates = new Set();
  for (const needle of REMOTE_FONT_NEEDLES) {
    for (const rel of gitGrepFiles(input, needle, SHIPPED_CODE_PATHSPECS)) candidates.add(rel);
  }
  const found = [];
  for (const rel of [...candidates].sort()) {
    if (rel.startsWith(TOOLING_PREFIX)) continue;
    const [needle] = remoteNeedlesIn(input.read(rel) ?? '');
    if (needle) found.push({ file: rel, needle });
  }
  return found;
}

function readJson(input, rel, what) {
  const text = input.read(rel);
  if (text === null) {
    throw new Error(`${rel} λείπει — ${what} χωρίς αυθεντία, και «καμία παραβίαση» θα ήταν ψέμα.`);
  }
  return JSON.parse(text);
}

/** Η πολιτική που λείπει ή είναι άκυρη ⇒ σφάλμα ΜΕ ΟΝΟΜΑ, ποτέ «καμία παραβίαση». */
function loadPolicyOrThrow(input) {
  const loaded = LP.loadPolicy(POLICY_FILE, input);
  if (!loaded.ok) throw new Error(`${POLICY_FILE} — η πολιτική αδειών δεν διαβάζεται: ${loaded.error}`);
  return loaded.policy;
}

/**
 * Η απογραφή. Το `override` υπάρχει **μόνο** για τη σουίτα. `input` = η είσοδος της πύλης (ADR-924): προεπιλογή
 * ο δίσκος, ο εκτελεστής δίνει την όψη του commit.
 */
function takeInventory(repoRoot, override = {}, input = require('../gate-input').openGateInput({ root: repoRoot })) {
  // ⚠️ **Η ΑΥΘΕΝΤΙΑ ΔΙΑΒΑΖΕΤΑΙ ΠΡΩΤΗ.** Αν το μητρώο λείπει, το σφάλμα πρέπει να **ονομάζει το
  //    μητρώο** — όχι να σκάει πρώτα το `git` με «spawnSync ENOENT», μήνυμα που στέλνει τον
  //    επόμενο να ψάχνει λάθος πράγμα (άγκυρα `Κ12`).
  const registry = override.registry ?? readJson(input, REGISTRY_FILE, 'το μητρώο').assets;
  const policy = override.policy ?? loadPolicyOrThrow(input);
  const files = override.files ?? tracked(input);
  const shipped = override.shipped
    ?? [...binaryAssets(files), ...base64FontModules(input)].sort();

  return {
    repoRoot,
    files,
    shipped,
    registry: registry || {},
    policy,
    now: override.now ?? Date.now(),
    evidenceOf: override.evidenceOf ?? ((rel) => E.readEvidence(repoRoot, rel, input)),
    attributionExists: override.attributionExists
      ?? ((rel) => !!rel && input.exists(rel)),
    existsOnDisk: override.existsOnDisk ?? ((rel) => input.exists(rel)),
    // Συνθετικός κόσμος (`shipped` δοσμένο) ⇒ δεν σαρώνεται το πραγματικό δέντρο πίσω από την πλάτη του.
    remote: override.remote ?? (override.shipped ? [] : remoteFontSources(input)),
  };
}

// ─── Κρίση ────────────────────────────────────────────────────────────────────

/** Κρίνει **ένα** δηλωμένο στοιχείο. Επιστρέφει τη ΜΙΑ κατάστασή του. */
function judgeDeclared(inv, rel, entry) {
  const ev = inv.evidenceOf(rel);
  if (ev.missing) return [STATES.ORPHAN_DECLARATION, 'δηλώθηκε αλλά το ΑΡΧΕΙΟ δεν υπάρχει'];
  if (ev.unreadable) return [STATES.UNREADABLE_ASSET, `δεν διαβάζεται: ${ev.unreadable}`];
  if (!ev.spdx) {
    return [STATES.LICENSE_UNVERIFIABLE,
      'το αρχείο ΔΕΝ κουβαλά αναγνωρίσιμη άδεια — η δήλωση δεν επαληθεύεται από τίποτα'];
  }
  if (ev.spdx !== entry.spdx) {
    return [STATES.LICENSE_DRIFT,
      `το μητρώο λέει «${entry.spdx}», το ΑΡΧΕΙΟ λέει «${ev.spdx}»`];
  }
  const decision = LP.decideAsset(inv.policy, rel, ev.spdx, inv.now);
  if (!LP.isPermitted(decision)) {
    return [STATES.LICENSE_NOT_ALLOWED,
      `${decision.detail} — ${POLICY_FILE}, απόφαση N.5`];
  }
  if (LP.requiresAttribution(inv.policy, ev.spdx) && !inv.attributionExists(entry.attribution)) {
    return [STATES.UNATTRIBUTED,
      `η «${ev.spdx}» απαιτεί το κείμενό της να ταξιδεύει· δεν βρέθηκε αρχείο απόδοσης`];
  }
  return [STATES.DECLARED_ALLOWED, `${ev.spdx} · ${ev.family ?? '—'} · ${decision.state === 'allowed' ? decision.category : decision.detail}`];
}

/**
 * Κρίνει τα πάντα. Κάθε διανεμόμενο στοιχείο και κάθε δήλωση παίρνει **ακριβώς μία** κατάσταση·
 * άγνωστη ⇒ `throw` **με όνομα**.
 */
function judge(inv) {
  const rows = [];
  const declared = new Set(Object.keys(inv.registry));

  for (const rel of inv.shipped) {
    if (!declared.has(rel)) {
      rows.push({ state: STATES.UNDECLARED_ASSET, id: rel,
        detail: 'διανέμεται γραμματοσειρά που ΚΑΝΕΙΣ δεν δήλωσε — ο license gate δεν τη βλέπει ποτέ' });
      continue;
    }
    const [state, detail] = judgeDeclared(inv, rel, inv.registry[rel]);
    rows.push({ state, id: rel, detail });
  }

  // ⚠️ **Η ΑΥΘΕΝΤΙΑ ΕΙΝΑΙ ΤΟ ΕΥΡΕΤΗΡΙΟ ΤΟΥ GIT, ΟΧΙ Ο ΔΙΣΚΟΣ** (πρότυπο CHECK 3.49): ο δίσκος
  //    βλέπει untracked προσχέδια ⇒ **άλλο αποτέλεσμα ανά πράκτορα**· το ευρετήριο είναι ό,τι
  //    θα περιέχει το commit. Γι' αυτό όμως η απουσία έχει **ΔΥΟ αιτίες** με **αντίθετη**
  //    θεραπεία, και ένα μήνυμα για τις δύο θα έλεγε ψέματα στη μία:
  //      · το αρχείο **υπάρχει** στον δίσκο ⇒ ξεχάστηκε το `git add` (η δήλωση είναι ΣΩΣΤΗ)
  //      · το αρχείο **δεν υπάρχει**      ⇒ σάπια δήλωση (η δήλωση πρέπει να ΣΒΗΣΤΕΙ)
  for (const rel of [...declared].sort()) {
    if (inv.shipped.includes(rel)) continue;
    const onDisk = inv.existsOnDisk(rel);
    rows.push(onDisk
      ? { state: STATES.DECLARED_NOT_TRACKED, id: rel,
        detail: 'δηλώθηκε και ΥΠΑΡΧΕΙ στον δίσκο, αλλά ΔΕΝ είναι στο ευρετήριο του git — κάνε `git add`, αλλιώς δεν θα φύγει στο commit' }
      : { state: STATES.ORPHAN_DECLARATION, id: rel,
        detail: 'δήλωση για αρχείο που ΔΕΝ υπάρχει — σβήσε τη δήλωση' });
  }

  for (const { file, needle } of inv.remote) {
    rows.push({ state: STATES.REMOTE_FONT_SOURCE, id: file,
      detail: `φορτώνει γραμματοσειρά από τρίτον («${needle}») — bytes που διανέμουμε χωρίς να είναι στο μητρώο· φιλοξένησέ τη τοπικά (ADR-805 §10)` });
  }

  return { rows, tally: tallyOf(rows) };
}

/** Κλειστή λογιστική (SSoT `gate-ledger`). */
const tallyOf = (rows) => closedTally(rows, STATES, '3.69');

module.exports = {
  REGISTRY_FILE, POLICY_FILE,
  STATES, BLOCKING, RATCHETED,
  tracked, binaryAssets, base64FontModules, gitGrepFiles,
  REMOTE_FONT_NEEDLES, remoteNeedlesIn, remoteFontSources,
  takeInventory, judge, tallyOf, idsOf,
};
