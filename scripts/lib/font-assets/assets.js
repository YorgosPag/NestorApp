/**
 * CHECK 3.69 — ΤΟ ΜΗΤΡΩΟ ΤΩΝ ΓΡΑΜΜΑΤΟΣΕΙΡΩΝ ΠΟΥ ΔΙΑΝΕΜΟΥΜΕ (ADR-805).
 *
 * «Έχει κάθε δυαδικό γραμματοσειράς που **διανέμουμε** δηλωμένη, **επιτρεπόμενη** άδεια — και
 * το επιβεβαιώνει το **ίδιο το αρχείο**;»
 *
 * ## 🔴 Το τυφλό σημείο, μετρημένο
 *
 * Ο **license gate** (ADR-598 G13, CHECK 12) τρέχει `license-checker`, που διαβάζει
 * **`node_modules`**. Ένα `.ttf` μέσα στο `public/` **δεν είναι πακέτο** ⇒ είναι **δομικά
 * αόρατο**. Μετρημένο 2026-08-25, το έργο διένειμε **τρία** σύνολα bytes γραμματοσειράς με
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
 * ⚠️ **ΜΙΑ λίστα επιτρεπόμενων αδειών**: το `allowedLicenses` του `.license-allowlist.json` —
 * το **ίδιο** που κρίνει τα npm πακέτα. Δεύτερη λίστα εδώ θα ήταν ADR-749 σε μικρογραφία.
 *
 * @module scripts/lib/font-assets/assets
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const E = require('./evidence');
const { stripComments } = require('../source-text');

const REGISTRY_FILE = '.font-assets.json';
const ALLOWLIST_FILE = '.license-allowlist.json';

/** Άδειες που απαιτούν το κείμενό τους να **ταξιδεύει** με το έργο. */
const ATTRIBUTION_REQUIRED = new Set(['Apache-2.0', 'OFL-1.1']);

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
];

/** 🔴 Ratchet κατά ταυτότητα — εκστρατείες που τελειώνουν στο μηδέν. */
const RATCHETED = [STATES.LICENSE_NOT_ALLOWED, STATES.UNATTRIBUTED];

// ─── Απογραφή ─────────────────────────────────────────────────────────────────

function tracked(repoRoot) {
  const out = execFileSync('git', ['ls-files', '-z'], {
    cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  return out.split('\0').filter(Boolean);
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
function gitGrepFiles(repoRoot, needle) {
  try {
    const out = execFileSync(
      'git',
      ['grep', '-l', '--fixed-strings', '-z', needle, '--', '*.ts', '*.tsx', '*.js', '*.mjs'],
      { cwd: repoRoot, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
    );
    return out.split('\0').filter(Boolean);
  } catch (error) {
    // `git grep` βγαίνει με 1 όταν δεν βρει τίποτα — αυτό ΔΕΝ είναι σφάλμα.
    if (error && error.status === 1) return [];
    throw error;
  }
}

function base64FontModules(repoRoot) {
  const idents = new Set();
  for (const rel of gitGrepFiles(repoRoot, 'addFileToVFS')) {
    // 🔴 ΤΑ ΣΧΟΛΙΑ ΚΟΒΟΝΤΑΙ, ΚΑΙ ΤΟ ΠΛΗΡΩΣΕ ΑΥΤΟ ΤΟ ΙΔΙΟ ΑΡΧΕΙΟ: το docblock από πάνω γράφει
    //    το κριτήριο ως παράδειγμα, οπότε η πύλη διάβαζε τη ΔΙΚΗ ΤΗΣ τεκμηρίωση, εξήγαγε
    //    «ταυτοποιητή» και ανέφερε 11 αδήλωτες γραμματοσειρές αντί για 1 (σχήμα `Κ7β`, 3.50).
    const text = stripComments(fs.readFileSync(path.join(repoRoot, rel), 'utf8'));
    const re = /addFileToVFS\(\s*['"][^'"]+\.(?:ttf|otf|woff2?)['"]\s*,\s*([A-Za-z_$][\w$]*)/g;
    for (const m of text.matchAll(re)) idents.add(m[1]);
  }
  const owners = new Set();
  for (const ident of idents) {
    for (const rel of gitGrepFiles(repoRoot, `export const ${ident}`)) owners.add(rel);
  }
  return [...owners].sort();
}

function readJson(repoRoot, rel, what) {
  const file = path.join(repoRoot, rel);
  if (!fs.existsSync(file)) {
    throw new Error(`${rel} λείπει — ${what} χωρίς αυθεντία, και «καμία παραβίαση» θα ήταν ψέμα.`);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * Η απογραφή. Το `override` υπάρχει **μόνο** για τη σουίτα — η παραγωγή ρωτά πάντα το git.
 */
function takeInventory(repoRoot, override = {}) {
  // ⚠️ **Η ΑΥΘΕΝΤΙΑ ΔΙΑΒΑΖΕΤΑΙ ΠΡΩΤΗ.** Αν το μητρώο λείπει, το σφάλμα πρέπει να **ονομάζει το
  //    μητρώο** — όχι να σκάει πρώτα το `git` με «spawnSync ENOENT», μήνυμα που στέλνει τον
  //    επόμενο να ψάχνει λάθος πράγμα (άγκυρα `Κ12`).
  const registry = override.registry ?? readJson(repoRoot, REGISTRY_FILE, 'το μητρώο').assets;
  const allowlist = override.allowedLicenses
    ?? readJson(repoRoot, ALLOWLIST_FILE, 'η λίστα αδειών').allowedLicenses;
  const files = override.files ?? tracked(repoRoot);
  const shipped = override.shipped
    ?? [...binaryAssets(files), ...base64FontModules(repoRoot)].sort();

  return {
    repoRoot,
    files,
    shipped,
    registry: registry || {},
    allowed: new Set(allowlist || []),
    evidenceOf: override.evidenceOf ?? ((rel) => E.readEvidence(repoRoot, rel)),
    attributionExists: override.attributionExists
      ?? ((rel) => !!rel && fs.existsSync(path.join(repoRoot, rel))),
    existsOnDisk: override.existsOnDisk ?? ((rel) => fs.existsSync(path.join(repoRoot, rel))),
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
  if (!inv.allowed.has(ev.spdx)) {
    return [STATES.LICENSE_NOT_ALLOWED,
      `«${ev.spdx}» δεν είναι στο ${ALLOWLIST_FILE} — απόφαση N.5`];
  }
  if (ATTRIBUTION_REQUIRED.has(ev.spdx) && !inv.attributionExists(entry.attribution)) {
    return [STATES.UNATTRIBUTED,
      `η «${ev.spdx}» απαιτεί το κείμενό της να ταξιδεύει· δεν βρέθηκε αρχείο απόδοσης`];
  }
  return [STATES.DECLARED_ALLOWED, `${ev.spdx} · ${ev.family ?? '—'}`];
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

  return { rows, tally: tallyOf(rows) };
}

function tallyOf(rows) {
  const known = new Set(Object.values(STATES));
  const tally = Object.fromEntries([...known].map((s) => [s, 0]));
  for (const r of rows) {
    if (!known.has(r.state)) throw new Error(`CHECK 3.69 — άγνωστη κατάσταση «${r.state}»`);
    tally[r.state] += 1;
  }
  return tally;
}

const idsOf = (verdict, state) => verdict.rows.filter((r) => r.state === state).map((r) => r.id);

module.exports = {
  REGISTRY_FILE, ALLOWLIST_FILE, ATTRIBUTION_REQUIRED,
  STATES, BLOCKING, RATCHETED,
  tracked, binaryAssets, base64FontModules, gitGrepFiles,
  takeInventory, judge, tallyOf, idsOf,
};
