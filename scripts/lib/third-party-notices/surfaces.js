/**
 * CHECK 3.84 / ADR-863 — ΠΟΙΑ ΠΑΚΕΤΑ ΦΤΑΝΟΥΝ ΣΤΟΝ BROWSER;
 *
 * Το **φέρον** ερώτημα όλης της πύλης. Ό,τι κατεβαίνει στον browser είναι **αντίγραφο** ⇒ η
 * άδεια απαιτεί το κείμενό της να ταξιδέψει μαζί. Ό,τι μένει στον server **εκτελείται** χωρίς
 * να διανέμεται — γι' αυτό η εξαίρεση LGPL του `sharp` γράφει ρητά «server-side».
 *
 * ## 🔴 Μετρημένο 2026-09-16: ΚΑΝΕΝΑ υπάρχον εργαλείο δεν το απαντά
 *
 * | Εργαλείο | Τι δίνει | Γιατί ΔΕΝ αρκεί |
 * |---|---|---|
 * | `scripts/bundle-analyzer.js` | bytes ανά αρχείο κάτω από `.next/static` | **καμία** ονομασία πακέτου· η σταθερά `WEBPACK_STATS` δηλώνεται και **δεν διαβάζεται ποτέ** |
 * | `.dependency-cruiser.cjs` | γράφος `src → src` | **αποκλείει ρητά** το `node_modules` (`exclude`, όχι μόνο `doNotFollow`) ⇒ μηδέν ακμές προς πακέτα |
 * | `knip.json` | «χρησιμοποιείται κάπου» | **ανακατεύει** client (`page.tsx`) και server (`route.ts`) στον ίδιο γράφο |
 * | `.next/build-manifest.json` | ονόματα chunk | αδιαφανή hashes στο prod webpack· **καμία** λίστα modules |
 *
 * ## 🏆 Η αρχιτεκτονική: η δήλωση ΔΕΝ αυτοεπιβεβαιώνεται
 *
 * Το **Chromium** δηλώνει `Shipped: yes/no` ανά βιβλιοθήκη — χειρόγραφα, και **κανείς δεν το
 * επαληθεύει**. Εδώ η **αυθεντία είναι το πραγματικό build** (webpack stats από το build που
 * ήδη τρέχει στο `bundle-ratchet.yml` — κανένα δεύτερο build, καμία νέα εξάρτηση), και η
 * δήλωση είναι ο **ελεγχόμενος παρονομαστής**: αν τα stats αντικρούσουν το στιγμιότυπο, η
 * πύλη κοκκινίζει. **Αυτό** είναι που κάνει τον ισχυρισμό «το sharp δεν φτάνει στον browser»
 * επαληθεύσιμο αντί για αυτοεπιβεβαίωση — σήμερα δεν τον ελέγχει τίποτα, και το `sharp`
 * **δεν είναι καν** στα `serverExternalPackages` του `next.config.js`.
 *
 * ⚠️ **Ο ΠΡΑΚΤΟΡΑΣ ΔΕΝ ΤΡΕΧΕΙ `next build`** (N.17 · 14 GB heap) ⇒ το στιγμιότυπο **σπέρνεται
 * από το CI**, όπως ήδη γίνεται για τις baselines depcruise/type-complexity/bundle (ADR-598).
 *
 * @module scripts/lib/third-party-notices/surfaces
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { SURFACE } = require('./judge');

const SNAPSHOT_FILE = '.third-party-surfaces.json';

/**
 * Από ποια διαδρομή module βγαίνει το **όνομα πακέτου**.
 *
 * Καλύπτει και τις δύο διατάξεις: επίπεδη (`node_modules/foo/dist/x.js`) και **απομονωμένη**
 * του pnpm (`node_modules/.pnpm/foo@1.2.3/node_modules/foo/dist/x.js`) — το `.npmrc` ορίζει
 * `node-linker=isolated`, άρα η **δεύτερη** είναι η πραγματική εδώ. Ένας αναλυτής που ήξερε
 * μόνο την πρώτη θα επέστρεφε `.pnpm` ως «όνομα πακέτου» για **κάθε** module.
 */
function packageNameFromModulePath(modulePath) {
  const normalized = String(modulePath || '').replace(/\\/g, '/');
  const segments = normalized.split('/node_modules/');
  if (segments.length < 2) return null;
  const tail = segments[segments.length - 1];
  const parts = tail.split('/').filter(Boolean);
  if (!parts.length) return null;
  const name = parts[0].startsWith('@') && parts.length > 1 ? `${parts[0]}/${parts[1]}` : parts[0];
  return name === '.pnpm' ? null : name;
}

/**
 * Τα ονόματα πακέτων που εμφανίζονται σε **client** chunks ενός webpack stats object.
 *
 * ⚠️ **ΠΟΤΕ ΣΙΩΠΗΛΟ ΚΕΝΟ.** Αν το σχήμα δεν είναι αυτό που περιμένουμε (άλλη έκδοση webpack,
 * Turbopack, `stats.modules` απόν), επιστρέφεται `{ok: false}` **με όνομα** — γιατί μια κενή
 * λίστα εδώ θα διαβαζόταν ως «κανένα πακέτο δεν φτάνει στον browser», δηλαδή το «0 = κανείς
 * δεν κοίταξε» που αυτό το repo έχει πληρώσει μετρημένα έξι φορές.
 *
 * @returns {{ok: true, packages: string[], modules: number} | {ok: false, detail: string}}
 */
function packagesFromStats(stats) {
  if (!stats || typeof stats !== 'object') return { ok: false, detail: 'τα stats δεν είναι αντικείμενο' };
  const modules = Array.isArray(stats.modules) ? stats.modules : null;
  if (!modules) return { ok: false, detail: 'λείπει το `modules[]` — λάθος σχήμα ή stats χωρίς `modules: true`' };
  if (!modules.length) return { ok: false, detail: '`modules[]` κενό — το build δεν μετρήθηκε' };

  const names = new Set();
  for (const mod of modules) {
    const name = packageNameFromModulePath(mod && (mod.nameForCondition || mod.name));
    if (name) names.add(name);
  }
  if (!names.size) {
    return { ok: false, detail: `${modules.length} modules αλλά ΚΑΝΕΝΑ node_modules — απίθανο· πιθανό λάθος σχήμα διαδρομής` };
  }
  return { ok: true, packages: [...names].sort(), modules: modules.length };
}

/**
 * Το στιγμιότυπο επιφανειών. Fail-closed: αν λείπει, **κάθε** πακέτο γίνεται `surface-unknown`
 * (⛔ zero-tol) αντί να θεωρηθεί σιωπηλά «server».
 *
 * @returns {{ok: true, snapshot: object} | {ok: false, detail: string}}
 */
function loadSnapshot(repoRoot, { readFile = fs.readFileSync, exists = fs.existsSync } = {}) {
  const file = path.join(repoRoot, SNAPSHOT_FILE);
  if (!exists(file)) return { ok: false, detail: `λείπει το ${SNAPSHOT_FILE} — σπείρε το από το CI (bundle-ratchet, seed=true)` };
  try {
    const snapshot = JSON.parse(readFile(file, 'utf8'));
    if (!Array.isArray(snapshot.browser)) return { ok: false, detail: `${SNAPSHOT_FILE}: λείπει η λίστα «browser»` };
    return { ok: true, snapshot };
  } catch (error) {
    return { ok: false, detail: `${SNAPSHOT_FILE}: ${error.message}` };
  }
}

/**
 * Η επιφάνεια ενός πακέτου κατά το στιγμιότυπο.
 *
 * ⚠️ Το `browser` **υπερισχύει κάθε δήλωσης**: αν το build λέει ότι κατεβαίνει, κατεβαίνει —
 * ανεξάρτητα από το τι ισχυρίζεται κάποιος στο `claims`. Η αντίστροφη προτεραιότητα θα
 * επέτρεπε σε μια δήλωση να **κρύψει** μετρημένο γεγονός, που είναι ο ορισμός της
 * αυτοεπιβεβαίωσης.
 */
function surfaceOf(snapshot, packageName) {
  if (snapshot.browser.includes(packageName)) return SURFACE.BROWSER;
  const claim = snapshot.claims && snapshot.claims[packageName];
  if (claim && claim.surface === SURFACE.SERVER) return SURFACE.SERVER;
  return snapshot.measured === true ? SURFACE.SERVER : SURFACE.UNKNOWN;
}

/**
 * Ισχυρισμοί που το build **διέψευσε**: κάποιος δήλωσε «δεν φτάνει στον browser» και τα stats
 * λένε το αντίθετο. **Εδώ πέφτει το `sharp`** αν κάποτε διαρρεύσει στο client bundle.
 */
function refutedClaims(snapshot, measuredBrowserPackages) {
  const claims = snapshot.claims || {};
  return Object.entries(claims)
    .filter(([name, claim]) => claim.surface === SURFACE.SERVER && measuredBrowserPackages.includes(name))
    .map(([name, claim]) => ({ name, why: claim.why }));
}

module.exports = {
  SNAPSHOT_FILE,
  packageNameFromModulePath,
  packagesFromStats,
  loadSnapshot,
  surfaceOf,
  refutedClaims,
};
