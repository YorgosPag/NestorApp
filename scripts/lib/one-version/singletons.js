/**
 * CHECK 3.65 · Ζ — ΚΑΤΟΧΟΙ ΚΑΘΟΛΙΚΗΣ ΣΤΟΙΒΑΣ (ADR-800 §Ζ · ADR-915 §15)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ΤΟ ΕΡΩΤΗΜΑ: «επιλύεται κάθε πακέτο που κρατά κατάσταση ΣΕ ΕΠΙΠΕΔΟ MODULE σε
 * ΑΚΡΙΒΩΣ ΜΙΑ έκδοση — σε ΟΛΟ τον γράφο, όχι μόνο στις άμεσες εξαρτήσεις;»
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Τα κατάστιχα Α-Ε κρίνουν **άμεσες** εξαρτήσεις και αφήνουν **σκόπιμα** έξω τους
 * μεταβατικούς doppelgangers: είναι εκατοντάδες, και οι περισσότεροι είναι αθώοι.
 * **Μία κλάση δεν είναι αθώα**: πακέτα με μεταβλητή επιπέδου module (στοίβα,
 * μετρητή, default context). Δύο αντίγραφα του module σημαίνουν **δύο στοίβες**, και
 * δύο στοίβες σημαίνουν ότι ο ένας καταναλωτής **δεν βλέπει** τον άλλον.
 *
 * 🔴 ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ (2026-10-16): Dialog → `react-dismissable-layer@1.1.11`, Popover →
 * `@1.1.15`. Το popover δεν μάθαινε ότι κάθεται πάνω σε modal, κρατούσε το
 * `body { pointer-events: none }` του διαλόγου, και **κάθε** ημερολόγιο μέσα σε διάλογο
 * έγινε ακλίκ από τις 2026-07-10 — **και στην παραγωγή**. Καμία πύλη δεν ρωτούσε.
 *
 * 🔑 ΓΙΑΤΙ ΚΛΕΙΣΤΟ ΣΥΝΟΛΟ ΜΕ ΛΟΓΟ ΚΑΙ ΟΧΙ ΑΝΙΧΝΕΥΣΗ: το «κρατά καθολική κατάσταση;»
 * δεν διαβάζεται αξιόπιστα από το όνομα ή το manifest. Κάθε μέλος δηλώνεται με τη
 * **συγκεκριμένη** μεταβλητή που το κάνει μοναδικό — ελέγξιμο με ένα grep στο `dist`.
 * Μέλος που λείπει από το lockfile ⇒ ⛔ (τυπογραφικό ή νεκρή δήλωση· ποτέ σιωπηλό
 * «πράσινο επειδή δεν βρέθηκε» — το σχήμα «0 = κανείς δεν κοίταξε»).
 *
 * 🏆 Το `@open-pioneer/check-pnpm-duplicates` κρίνει όλον τον γράφο και πνίγεται στα
 * αθώα· το `pnpm dedupe` διορθώνει **μία φορά** και δεν εμποδίζει την επανεμφάνιση.
 * Εδώ: **ολόκληρος** ο γράφος, αλλά **μόνο** για όσα η διπλή παρουσία είναι **σφάλμα
 * συμπεριφοράς**, και ⛔ στο commit που θα το ξανάφερνε.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { GATE_STATES: S, MIN_REASON_LENGTH } = require('./contract.js');

/** Το κλειδί ενός πακέτου στο μπλοκ `packages:` — `  name@version:` ή `  'name@version':`. */
const PACKAGE_KEY = /^ {2}(?:'([^']+)'|([^\s:']+)):(?:\s.*)?$/;

/** `@scope/name@1.2.3` → { name, version }. Το `@` της εμβέλειας ΔΕΝ είναι διαχωριστικό. */
function splitKey(key) {
  const at = key.lastIndexOf('@');
  if (at <= 0) throw new Error(`pnpm-lock.yaml packages: κλειδί χωρίς έκδοση: ${JSON.stringify(key)}`);
  return { name: key.slice(0, at), version: key.slice(at + 1) };
}

/**
 * Όλες οι επιλυμένες εκδόσεις ανά όνομα, από το μπλοκ `packages:`.
 * FAIL-CLOSED: γραμμή στο επίπεδο κλειδιού που δεν αναγνωρίζεται ⇒ `throw` με το περιεχόμενο.
 * @returns {Map<string, Set<string>>}
 */
function resolvedVersions(repoRoot) {
  const lines = fs.readFileSync(path.join(repoRoot, 'pnpm-lock.yaml'), 'utf8').split(/\r?\n/);
  const start = lines.indexOf('packages:');
  if (start < 0) throw new Error('pnpm-lock.yaml: δεν βρέθηκε μπλοκ "packages:".');
  const versions = new Map();
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^\S/.test(line) && line.trim()) break; // επόμενο μπλοκ ανώτατου επιπέδου
    if (!/^ {2}\S/.test(line)) continue; // κενή γραμμή ή πεδίο εγγραφής
    const m = line.match(PACKAGE_KEY);
    if (!m) throw new Error(`pnpm-lock.yaml:${i + 1} — μη αναγνωρίσιμο κλειδί packages: ${JSON.stringify(line)}`);
    const { name, version } = splitKey(m[1] ?? m[2]);
    if (!versions.has(name)) versions.set(name, new Set());
    versions.get(name).add(version);
  }
  return versions;
}

/** Ζ · ΚΡΙΣΗ — ένα κλειδί του κλειστού συνόλου, μία γραμμή στο κατάστιχο. */
function judgeSingletons(repoRoot, singletons, push) {
  const versions = resolvedVersions(repoRoot);
  for (const [name, entry] of Object.entries(singletons).sort()) {
    const reason = entry && typeof entry === 'object' ? entry.reason : null;
    const holds = entry && typeof entry === 'object' ? entry.holds : null;
    if (typeof reason !== 'string' || reason.trim().length < MIN_REASON_LENGTH || typeof holds !== 'string' || !holds.trim()) {
      push(S.SINGLETON_REASONLESS, name, `θέλει "holds" (η μεταβλητή επιπέδου module) και "reason" >=${MIN_REASON_LENGTH} χαρακτήρες`);
      continue;
    }
    const found = versions.get(name);
    if (!found || found.size === 0) {
      push(S.SINGLETON_ABSENT, name, 'δηλώνεται κάτοχος αλλά δεν υπάρχει στο lockfile — τυπογραφικό ή νεκρή δήλωση');
      continue;
    }
    if (found.size > 1) {
      push(S.SINGLETON_SPLIT, name,
        `${[...found].sort().join(' και ')} — δύο αντίγραφα του "${holds}" · κάρφωσε ΜΙΑ έκδοση στο pnpm.overrides`);
      continue;
    }
    push(S.SINGLETON_ONE, name, `${[...found][0]} · ${holds}`);
  }
}

module.exports = { judgeSingletons, resolvedVersions, splitKey };
