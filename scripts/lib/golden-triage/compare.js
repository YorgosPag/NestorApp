'use strict';

/**
 * 🔑 ΣΤΑΘΕΡΟΤΗΤΑ ΥΠΟΨΗΦΙΟΥ — ADR-775 §15
 *
 * Πριν ζητηθεί από άνθρωπο να εγκρίνει μια βάση, ρωτάμε κάτι που **δεν** μπορεί να δει με το
 * μάτι: *«αν το ξανατρέξουμε, βγαίνει το ίδιο;»*.
 *
 * ⚠️ Γιατί δεν είναι πολυτέλεια: μια βάση που εγκρίθηκε από ένα **ασταθές** καρέ κάνει τη
 * σουίτα μονίμως κόκκινη, και η επόμενη αντίδραση είναι πάντα η ίδια — μαζική αποδοχή. Δηλαδή
 * η αστάθεια **γεννά** ακριβώς τη βλάβη που το `cd5f6198` έκανε μία φορά.
 *
 * Πρότυπο: το Skia Gold κρατά **πολλαπλά** αποδεκτά ψηφιακά αποτυπώματα ανά test ακριβώς
 * επειδή η απόδοση δεν είναι πάντα bit-exact. Εμείς δεν έχουμε υπηρεσία· έχουμε όμως το
 * φθηνότερο μισό της ίδιας ιδέας: **δύο περάσματα και σύγκριση**.
 *
 * Καμία νέα εξάρτηση: `pixelmatch` υπάρχει ήδη (N.5).
 */

// ⚠️ Το `pixelmatch@7` είναι **ESM με default export**: το σκέτο `require()` επιστρέφει
// `{ default: fn }` και η κλήση σκάει με «pixelmatch is not a function». Το ίδιο σχήμα με
// τα conditional requires του `visual-regression-basic.test.ts` — εκεί όμως η αποτυχία
// **καταπινόταν** σε `try/catch` και το test συνέχιζε «πράσινο».
const pixelmatchModule = require('pixelmatch');
const pixelmatch = pixelmatchModule.default ?? pixelmatchModule;
const { readPng } = require('./png-stats');

/** Ίδιο κατώφλι με το `SCREENSHOT_OPTIONS` της σουίτας — μία απάντηση για «διαφέρει;». */
const THRESHOLD = 0.01;

/**
 * @returns {{state:'identical'|'stable'|'unstable'|'size-mismatch', diffPixels:number,
 *            ratio:number, width:number, height:number}}
 */
function comparePngs(fileA, fileB, { tolerateRatio = 0 } = {}) {
  const a = readPng(fileA);
  const b = readPng(fileB);
  if (a.width !== b.width || a.height !== b.height) {
    return { state: 'size-mismatch', diffPixels: -1, ratio: 1, width: a.width, height: a.height };
  }
  const total = a.width * a.height;
  const diffPixels = pixelmatch(a.data, b.data, null, a.width, a.height, { threshold: THRESHOLD });
  const ratio = diffPixels / total;
  if (diffPixels === 0) {
    return { state: 'identical', diffPixels, ratio, width: a.width, height: a.height };
  }
  return {
    state: ratio <= tolerateRatio ? 'stable' : 'unstable',
    diffPixels,
    ratio,
    width: a.width,
    height: a.height,
  };
}

module.exports = { comparePngs, THRESHOLD };
