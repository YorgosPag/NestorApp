#!/usr/bin/env node
/**
 * Shared utility — **Ο ΔΕΙΚΤΗΣ ΠΡΟΣ ΤΟΥΣ ΚΑΝΟΝΕΣ, ΠΑΡΑΓΟΜΕΝΟΣ** (CommonJS).
 *
 * Απαντά *«σε ποιες γραμμές ζει ο κανόνας που καλύπτει αυτή η σουίτα;»* — και τον
 * **υπολογίζει από το ίδιο το αρχείο κανόνων**, κάθε φορά. Χρησιμοποιείται από το
 * CHECK 3.16 (`firestore.rules`) και το CHECK 3.19 (`storage.rules`), με τη σημαία
 * `--map`.
 *
 * ── Γιατί ΠΑΡΑΓΟΜΕΝΟΣ και όχι αποθηκευμένος (ADR-841 §7 Α21.14 · ADR-657 §3.3) ────────
 *
 * Και τα δύο manifest κρατούσαν `rulesRange: [α, β]` **γραμμένο με το χέρι**, και **καμία
 * πύλη δεν το συνέκρινε ποτέ**. Το αποτέλεσμα μετρήθηκε δύο φορές, ανεξάρτητα:
 *
 *   firestore  2026-09-08 : 124 από 127 λάθος (98%), χειρότερη απόκλιση 1853 γραμμές
 *   storage    2026-08-24 : 11 από 11 λάθος (100%)
 *
 * Η αιτία είναι δομική, όχι αμέλεια: **μία** γραμμή που μπαίνει πάνω από ένα block
 * ξεκαρφώνει **όλα** τα επόμενα ταυτόχρονα. Το ADR-657 §3.3 το είχε ήδη διαπιστώσει
 * *(«έσπασε ήδη στο `964fd03e`»)* και σκότωσε το line-number matching υπέρ της
 * **ταυτότητας** (`@pathId` / `collection`).
 *
 * ── Και είναι η πρακτική των μεγάλων, επαληθευμένη ─────────────────────────────────
 *
 *   PHPStan baseline           : δηλώνει ρητά «No line numbers» ως συνειδητή απόφαση
 *   ESLint bulk suppressions   : `{αρχείο: {κανόνας: {count}}}` — καμία γραμμή (v9.24+)
 *
 * ⇒ Η θέση **δεν αποθηκεύεται**. Παράγεται όταν τη ζητήσει άνθρωπος, από την πηγή, και
 * γι' αυτό είναι **αδύνατο** να παλιώσει.
 *
 * 🏆 **Και εδώ πάμε ένα βήμα παραπάνω από εκείνους**: το PHPStan και το ESLint απλώς
 * **δεν λένε** πού είναι το εύρημα. Εδώ ο δείκτης υπάρχει, είναι πλήρης, και ονομάζει
 * και τις **δύο** κατευθύνσεις — και ποιος κανόνας δεν έχει σουίτα, και ποια σουίτα
 * δείχνει σε κανόνα που **δεν υπάρχει πια**.
 *
 * @since 2026-09-08 (ADR-841 §7 Α21.14)
 */

'use strict';

/**
 * @typedef {{ identity: string, lineStart: number, lineEnd: number }} LocatedBlock
 */

/**
 * **Ο χάρτης ταυτότητα → γραμμές**, έτοιμος για εκτύπωση.
 *
 * 🔑 **Δεν τυπώνει — επιστρέφει γραμμές.** Έτσι ο ίδιος υπολογισμός ελέγχεται από άγκυρα
 * χωρίς να συλληφθεί `stdout`, και οι δύο πύλες μπορούν να τον τυπώσουν με τα δικά τους
 * χρώματα.
 *
 * ⚠️ **Οι δύο κατευθύνσεις ΔΕΝ ισοπεδώνονται**: *«κανόνας χωρίς σουίτα»* και *«σουίτα
 * χωρίς κανόνα»* είναι διαφορετικά προβλήματα με διαφορετική θεραπεία — και το δεύτερο
 * είναι ακριβώς αυτό που ένα μπαγιάτικο `rulesRange` **δεν** μπορούσε ποτέ να πει, γιατί
 * ένα λάθος νούμερο μοιάζει με σωστό νούμερο.
 *
 * @param {LocatedBlock[]} blocks Τα blocks του αρχείου κανόνων, όπως τα διάβασε ο parser.
 * @param {string[]} registered Οι ταυτότητες που δηλώνει το manifest.
 * @param {string} rulesFileName Το όνομα του αρχείου, για κλικαρίσιμη διαδρομή.
 * @returns {{ lines: string[], orphanBlocks: string[], danglingEntries: string[] }}
 */
function buildRulesLocationMap(blocks, registered, rulesFileName) {
  const byIdentity = new Map(blocks.map((block) => [block.identity, block]));
  const registeredSet = new Set(registered);

  // 🔑 **Σειρά ΑΡΧΕΙΟΥ, όχι αλφαβητική**: ο άνθρωπος που διαβάζει τον χάρτη έχει ανοιχτό
  //    το αρχείο κανόνων δίπλα. Μια αλφαβητική λίστα θα τον έβαζε να πηδά πάνω-κάτω.
  const lines = blocks
    .slice()
    .sort((a, b) => a.lineStart - b.lineStart)
    .map((block) => {
      const mark = registeredSet.has(block.identity) ? '·' : '?';
      return `  ${mark} ${block.identity} → ${rulesFileName}:${block.lineStart}-${block.lineEnd}`;
    });

  return {
    lines,
    orphanBlocks: blocks.filter((b) => !registeredSet.has(b.identity)).map((b) => b.identity),
    danglingEntries: registered.filter((identity) => !byIdentity.has(identity)),
  };
}


/**
 * 🔴 **ΚΑΙ Η ΕΚΤΥΠΩΣΗ ΕΙΝΑΙ ΚΟΙΝΗ — ΤΟ ΕΠΙΑΣΕ Η ΠΥΛΗ, ΟΧΙ Η ΚΡΙΣΗ ΜΟΥ** (N.18 / CHECK 3.28).
 *
 * Η πρώτη γραφή κεντρικοποίησε τον **υπολογισμό** και άφησε τη **σύνθεση των γραμμών**
 * αυτούσια και στις δύο πύλες — δηλαδή έφτιαξε ακριβώς το *«sibling clone»* που ο κανόνας
 * N.18 περιγράφει ονομαστικά: *«κεντρικοποιείς το Α, γράφεις Β+Γ ως δίδυμα»*. Το
 * `jscpd --diff` το κοκκίνισε **πριν** ειπωθεί «done».
 *
 * 🔑 **Τα χρώματα ταξιδεύουν ως όρισμα** και δεν εισάγονται: κάθε πύλη κρατά τον δικό της
 * πίνακα `C` *(προϋπάρχον διπλότυπο, εκτός εύρους εδώ)*, και μια εισαγωγή θα έδενε αυτό
 * το module στη μία από τις δύο.
 *
 * @param {{
 *   blocks: LocatedBlock[],
 *   registered: string[],
 *   rulesFileName: string,
 *   title: string,
 *   colors: { cyan: string, dim: string, yellow: string, red: string, reset: string },
 * }} input
 * @returns {string[]} Έτοιμες γραμμές προς εκτύπωση, με χρώματα.
 */
function renderRulesLocationMap({ blocks, registered, rulesFileName, title, colors }) {
  const map = buildRulesLocationMap(blocks, registered, rulesFileName);
  const out = [`${colors.cyan}${title}${colors.reset}`, ...map.lines, ''];

  out.push(
    `${colors.dim}  ${map.lines.length} match blocks · ${registered.length} δηλωμένες ταυτότητες${colors.reset}`,
  );
  if (map.orphanBlocks.length > 0) {
    out.push(`${colors.yellow}  ? χωρίς δήλωση: ${map.orphanBlocks.join(', ')}${colors.reset}`);
  }
  if (map.danglingEntries.length > 0) {
    out.push(`${colors.red}  ✖ δηλωμένες χωρίς κανόνα: ${map.danglingEntries.join(', ')}${colors.reset}`);
  }

  return out;
}

module.exports = { buildRulesLocationMap, renderRulesLocationMap };
