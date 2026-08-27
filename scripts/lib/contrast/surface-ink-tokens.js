/**
 * **Ποια ονόματα χρώματος του Tailwind λύνονται, ως ΜΕΛΑΝΙ, σε token ΕΠΙΦΑΝΕΙΑΣ;**
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * ΤΟ ΕΡΩΤΗΜΑ — ΚΑΙ ΓΙΑΤΙ ΕΙΝΑΙ ΡΟΛΟΣ, ΟΧΙ ΑΝΤΙΘΕΣΗ (ADR-770 §16)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Το CHECK 3.38 γεννήθηκε ρωτώντας για **ένα** token: *«πού ζητά ο κώδικας
 * `text-primary`;»*. Ο λόγος ήταν εμπειρικός — το `--primary` ήταν το token που
 * **βρέθηκε** σπασμένο. Δεν ήταν όμως το μόνο της κλάσης του: στις 2026-08-27 το
 * «Αποσύνδεση» μετρήθηκε **1,67:1** σε ζωντανή οθόνη, και η αιτία ήταν **ίδια στη
 * μορφή** — το `--destructive` είναι χρώμα **επιφάνειας** που χρησιμοποιούνταν ως
 * **μελάνι**. Η πύλη δεν το είδε επειδή ρωτούσε ονομαστικά για το `primary`.
 *
 * 🔑 **ΤΟ ΚΡΙΤΗΡΙΟ ΕΙΝΑΙ ΔΟΜΙΚΟ, ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ ΟΛΟ ΤΟ ΝΟΗΜΑ.** Δεν μετρά λόγους
 * αντίθεσης· ρωτά *«χρησιμοποιείται εδώ ως μελάνι κάτι που το λεξιλόγιο δηλώνει
 * επιφάνεια;»*. Έτσι δεν έχει κατώφλια, δεν έχει επιφάνειες, δεν έχει ζεύγη.
 *
 * ⛔ **ΤΟ ΠΡΟΦΑΝΕΣ ΚΡΙΤΗΡΙΟ ΕΧΕΙ ΗΔΗ ΑΠΟΡΡΙΦΘΕΙ ΤΡΕΙΣ ΦΟΡΕΣ — ΜΗΝ ΓΙΝΕΙΣ Η ΤΕΤΑΡΤΗ.**
 * «Κάθε ζεύγος κειμένου × επιφάνειας ≥4,5:1» μετρήθηκε στο §12.3: **141 από 230**,
 * γεμάτο ζεύγη που **δεν συμβαίνουν** (λευκό σε λευκή κάρτα) ⇒ >10% ψευδώς θετικά σε
 * μπλοκάρουσα πύλη = **αποτυχία σχεδίασης**. Το §14 το επιχείρησε ξανά από άλλη πόρτα
 * και απορρίφθηκε ξανά. Μετρήθηκε **και τέταρτη φορά** πριν γραφτεί αυτό το αρχείο:
 * το «έχει το μελάνι σπίτι;» έβγαλε **47 ευρήματα στα 102 κριθέντα (46%)**, με
 * ολόκληρη την οικογένεια `--showcase-*` ως θόρυβο — τα showcase έχουν **δικές τους**
 * επιφάνειες. Το κριτήριο ρόλου βγάζει **μηδέν** τέτοιο θόρυβο, γιατί δεν ρωτά πού
 * κάθεται το μελάνι.
 *
 * ⚠️ **Η ΛΙΣΤΑ ΠΑΡΑΓΕΤΑΙ, ΔΕΝ ΓΡΑΦΕΤΑΙ.** Ένα χειρόγραφο `['primary','destructive',…]`
 * θα ήταν **δεύτερη αλήθεια**: θα κατήγγειλε το `text-destructive` για πάντα, ακόμη και
 * μετά τη διόρθωση του §15 που το έστειλε στο `--text-error`. Επειδή παράγεται, η πύλη
 * **σβήνει μόνη της** το εύρημα τη στιγμή που το token διορθώνεται — και **ανάβει μόνη
 * της** αν κάποιος το ξαναγυρίσει.
 *
 * @module scripts/lib/contrast/surface-ink-tokens
 * @see ADR-770 §16 — Στρώμα 3, ο διαχωρισμός ρόλου
 */

'use strict';

const { loadTailwindColors, resolveClassToken } = require('./tailwind-class-resolver');
const { SURFACE_TOKEN_PATTERN } = require('./css-token-themes');

/** Το φόρτωμα του config κοστίζει ~300ms· η παραγωγή γίνεται μία φορά ανά ρίζα. */
const cache = new Map();

/**
 * Ισοπέδωσε το δέντρο μιας παλέτας σε ονόματα κλάσης, όπως τα ισοπεδώνει το Tailwind.
 *
 * ⚠️ **Το `DEFAULT` ΔΕΝ γίνεται τμήμα του ονόματος** — είναι η τιμή του γονέα
 * (`colors.destructive.DEFAULT` ⇒ κλάση `text-destructive`, ποτέ `text-destructive-DEFAULT`).
 */
function flattenNames(node, prefix = '', out = new Set(), depth = 0) {
  if (depth > 4 || !node || typeof node !== 'object') return out;
  for (const [key, value] of Object.entries(node)) {
    if (key === 'DEFAULT') {
      if (prefix) out.add(prefix);
      continue;
    }
    const name = prefix ? `${prefix}-${key}` : key;
    if (typeof value === 'string') out.add(name);
    else flattenNames(value, name, out, depth + 1);
  }
  return out;
}

/**
 * **Τα ονόματα που, ως `text-<όνομα>`, βάφουν με token ΕΠΙΦΑΝΕΙΑΣ.**
 *
 * @param {string} repoRoot Ρίζα με `tailwind.config.ts`.
 * @returns {string[]} Ταξινομημένα **από το μακρύτερο**, ώστε η εναλλαγή του regex να
 *   προτιμά το ειδικότερο (`sidebar-background` πριν το `background`) — αλλιώς το
 *   κοντότερο θα «έτρωγε» το πρόθεμα και θα άφηνε ουρά που μοιάζει με `inert-class`.
 */
function surfaceInkNames(repoRoot = process.cwd()) {
  if (cache.has(repoRoot)) return cache.get(repoRoot);

  const palette = loadTailwindColors(repoRoot);
  const candidates = flattenNames(palette.byUtility.text || palette.colors);
  const names = [];
  for (const name of candidates) {
    const resolved = resolveClassToken(`text-${name}`, palette);
    if (!resolved || resolved.form !== 'css-var') continue;
    if (!SURFACE_TOKEN_PATTERN.test(resolved.varName)) continue;
    names.push(name);
  }
  names.sort((a, b) => b.length - a.length || a.localeCompare(b));

  /**
   * 🔴 **Fail-closed.** Άδεια λίστα σημαίνει ότι το `tailwind.config.ts` ή το
   * `globals.css` δεν διαβάστηκαν όπως νομίζουμε — και μια πύλη που σαρώνει για
   * **τίποτα** αναφέρει «0 παραβιάσεις», δηλαδή γράφει μόνη της το «0 = κανείς δεν
   * κοίταξε» που όλη αυτή η εκστρατεία κυνηγά.
   */
  if (names.length === 0) {
    throw new Error(
      'surface-ink-tokens: κανένα όνομα δεν λύθηκε σε token επιφάνειας — fail-closed. ' +
        'Είτε το tailwind.config.ts δεν διαβάστηκε, είτε το SURFACE_TOKEN_PATTERN άλλαξε.',
    );
  }

  cache.set(repoRoot, names);
  return names;
}

/**
 * Το regex του σαρωτή, **παραγόμενο** από τα ονόματα.
 *
 * Διατηρεί **αυτούσιους** τους δύο μετρημένους αποκλεισμούς του CHECK 3.38 — καθένας
 * τους ήταν πραγματική λανθασμένη μέτρηση πριν γραφτεί:
 *   · κατάληξη `-foreground` = το **αντίθετο** token (κοντά στο λευκό)·
 *   · προηγούμενο `-` ή λέξη = **όνομα μεταβλητής CSS** (`--color-text-primary`), όχι κλάση.
 */
function surfaceInkRegex(names) {
  return new RegExp(
    `(?<![-\\w])text-(?:${names.join('|')})(?!-foreground)(\\/\\d{1,3})?([a-z][a-z0-9-]*)?`,
    'g',
  );
}

module.exports = { surfaceInkNames, surfaceInkRegex, flattenNames };
