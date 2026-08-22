#!/usr/bin/env node
/**
 * =============================================================================
 * ΕΙΝΑΙ ΑΥΤΗ Η ΔΙΑΔΡΟΜΗ ΕΠΙΦΑΝΕΙΑ ΤΗΣ ΠΑΡΑΓΩΓΗΣ; (CHECK 3.51 Χ · ADR-790)
 * =============================================================================
 *
 * 🔑 **ΤΟ ΕΥΡΗΜΑ ΠΟΥ ΓΕΝΝΗΣΕ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ**: *η λίστα διαδρομών του `src/app/**`
 * ΔΕΝ είναι η λίστα διαδρομών που σερβίρει η παραγωγή.* Ο χρησμός το ανακάλυψε
 * μόνος του στην πρώτη του εκτέλεση πάνω στην εικόνα (2026-08-22, run
 * `32561828111`): **4** διαδρομές απάντησαν **404**, και «404» δεν είναι «καθαρό».
 * Η άρνησή του να γράψει baseline ήταν **σωστή** — αυτό που έλειπε ήταν το
 * λεξιλόγιο για να πει *γιατί*.
 *
 * ┌───────────────────────────────────────────────────────────────────────────┐
 * │ ⚠️ ΕΔΩ ΔΕΝ ΥΠΑΡΧΕΙ ΚΑΜΙΑ ΛΙΣΤΑ ΔΙΑΔΡΟΜΩΝ. ΥΠΑΡΧΟΥΝ **ΜΗΧΑΝΙΣΜΟΙ**.        │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * Το `.i18n-ssr-served.json` δηλώνει **πώς** μια διαδρομή παρακρατείται, με
 * **υποχρεωτικό λόγο** ανά εγγραφή· **ποιες** διαδρομές είναι, το απαντά κάθε
 * φορά η **αυθεντία που ονομάζει η εγγραφή**:
 *
 *   `middleware-scanner-path`   → ο πίνακας `SCANNER_PATHS` του `src/middleware.ts`
 *   `in-page-production-guard`  → ο φρουρός **μέσα στην ίδια τη σελίδα**
 *
 * Μια χειρόγραφη λίστα θα ήταν το σχήμα που έχει αποτύχει **μετρημένα** τρεις
 * φορές σε αυτό το repo (CHECK 3.34: απόκλιση **63** · CHECK 3.37: **18 vs 26** ·
 * CHECK 3.57: **19 από τις 20**). Εδώ η απόκλιση είναι **δομικά αδύνατη**: δεν
 * υπάρχει δεύτερο αντίγραφο για να αποκλίνει.
 *
 * ΔΥΟ ΑΝΕΞΑΡΤΗΤΟΙ ΚΑΝΟΝΕΣ, ΠΟΤΕ ΕΝΑΣ ΜΕ «Ή» (μάθημα CHECK 3.41)
 * --------------------------------------------------------------
 *   **Κ1** δηλωμένη παρακρατημένη ⇒ ο server ΔΕΝ πρέπει να την απαντά κανονικά
 *   **Κ2** μη δηλωμένη ⇒ ο server ΟΦΕΙΛΕΙ να την απαντά· 404 ⇒ ⛔ `route-unreachable`
 *
 * Ένας κανόνας με «ή» θα έμενε **πράσινος και προς τις δύο κατευθύνσεις**: μια
 * ζωντανή διαδρομή που έπεσε θα περνούσε ως «μάλλον παρακρατημένη», και ένα
 * harness που διέρρευσε θα περνούσε ως «μάλλον σερβίρεται».
 *
 * ⚠️ **fail-closed παντού**: αν η αυθεντία δεν διαβάζεται (μετονομάστηκε το
 * σύμβολο, μετακόμισε το αρχείο), η συνάρτηση **σκάει με όνομα**. Ένα σιωπηλά
 * κενό σύνολο παρακράτησης θα έβγαζε **κάθε** παρακρατημένη διαδρομή ⛔ — φρουρός
 * που κατηγορεί για δικό του σφάλμα· ένα σιωπηλά **γεμάτο** θα έσβηνε τον Κ2.
 * =============================================================================
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DECLARATIONS = '.i18n-ssr-served.json';

/** Οι μηχανισμοί που ξέρει να εκτελέσει αυτό το αρχείο. Άγνωστο είδος ⇒ throw. */
const KINDS = Object.freeze(['middleware-scanner-path', 'in-page-production-guard']);

/**
 * Διαβάζει έναν πίνακα σταθερών συμβολοσειρών **από τον πραγματικό κώδικα**.
 *
 * ⚠️ Σκόπιμα κειμενικό και **σκόπιμα αυστηρό**: μηδέν ταίριασμα ⇒ `throw`. Το
 * ζητούμενο δεν είναι «να μη σκάσει» — είναι να **μην απαντήσει κενό σύνολο** αν
 * κάποιος μετονομάσει το σύμβολο. Ένα κενό `SCANNER_PATHS` εδώ θα σήμαινε
 * «καμία διαδρομή δεν παρακρατείται», δηλαδή **τέσσερα ψεύτικα ⛔**.
 *
 * @returns {string[]}
 */
function readStringArrayConst(source, symbol, where) {
  const pattern = new RegExp(String.raw`const\s+` + symbol + String.raw`\b[^=]*=\s*\[([\s\S]*?)\]`);
  const block = source.match(pattern);
  if (!block) throw new Error(`CHECK 3.51 Χ: δεν βρέθηκε ο πίνακας ${symbol} στο ${where} — η αυθεντία μετακόμισε ή μετονομάστηκε`);
  const values = [...block[1].matchAll(/'([^']*)'|"([^"]*)"/g)].map((m) => m[1] ?? m[2]).filter(Boolean);
  if (values.length === 0) throw new Error(`CHECK 3.51 Χ: ο πίνακας ${symbol} στο ${where} διαβάστηκε ΚΕΝΟΣ — fail-closed`);
  return values;
}

/** Οι δηλώσεις, με **επικύρωση σχήματος**: κάθε εγγραφή οφείλει είδος + γραμμένο λόγο. */
function loadDeclarations(projectRoot) {
  const file = path.join(projectRoot, DECLARATIONS);
  if (!fs.existsSync(file)) throw new Error(`CHECK 3.51 Χ: λείπει το ${DECLARATIONS} — το κλειστό σύνολο μηχανισμών παρακράτησης`);
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  const entries = Array.isArray(parsed.withheldBy) ? parsed.withheldBy : null;
  if (!entries || entries.length === 0) throw new Error(`CHECK 3.51 Χ: το ${DECLARATIONS} δεν δηλώνει κανέναν μηχανισμό — fail-closed`);
  for (const entry of entries) {
    if (!KINDS.includes(entry.kind)) throw new Error(`CHECK 3.51 Χ: άγνωστος μηχανισμός παρακράτησης "${entry.kind}" στο ${DECLARATIONS}`);
    if (typeof entry.why !== 'string' || entry.why.trim().length < 20) {
      throw new Error(`CHECK 3.51 Χ: ο μηχανισμός "${entry.kind}" δηλώνεται ΧΩΡΙΣ γραμμένο λόγο — μια εξαίρεση χωρίς λόγο είναι σιωπηλή παράλειψη με άλλο όνομα`);
    }
  }
  return entries;
}

/**
 * Ο κριτής ενός μηχανισμού: `(route) => boolean`.
 *
 * ⚠️ Το `middleware-scanner-path` αντιγράφει **ΑΚΡΙΒΩΣ** το κατηγόρημα του
 * middleware (`pathname.toLowerCase().startsWith(prefix)`) και **όχι** κάτι
 * ακριβέστερο. Το `/db` πιάνει και το `/dbfoo`; **Ναι — και αυτό ακριβώς κάνει
 * και η παραγωγή.** Μια πύλη που μοντελοποιεί κώδικα οφείλει να μοντελοποιεί
 * ΤΟΝ κώδικα, όχι μια βελτιωμένη εκδοχή του που κανείς δεν εκτελεί.
 */
function compileMechanism(entry, projectRoot) {
  if (entry.kind === 'middleware-scanner-path') {
    const where = entry.source;
    const prefixes = readStringArrayConst(fs.readFileSync(path.join(projectRoot, where), 'utf8'), entry.symbol, where);
    return (route) => prefixes.some((prefix) => route.url.toLowerCase().startsWith(prefix));
  }
  // in-page-production-guard — η ΙΔΙΑ Η ΣΕΛΙΔΑ δηλώνει τη διαθεσιμότητά της.
  const call = `${entry.call}(`;
  return (route) => {
    const source = fs.readFileSync(path.join(projectRoot, route.file), 'utf8');
    return source.includes(entry.module) && source.includes(call);
  };
}

/**
 * Δίνει σε κάθε διαδρομή το πεδίο `withheld`.
 *
 * @param {Array<{url: string, file: string}>} routes
 * @param {string} projectRoot
 * @returns {Array<object>} οι ίδιες διαδρομές με `withheld: null | {mechanism, why}`
 */
function decorateWithholding(routes, projectRoot) {
  const compiled = loadDeclarations(projectRoot).map((entry) => ({ entry, matches: compileMechanism(entry, projectRoot) }));
  return routes.map((route) => {
    const hit = compiled.find(({ matches }) => matches(route));
    return { ...route, withheld: hit ? { mechanism: hit.entry.kind, why: hit.entry.why } : null };
  });
}

module.exports = { DECLARATIONS, KINDS, readStringArrayConst, loadDeclarations, compileMechanism, decorateWithholding };
