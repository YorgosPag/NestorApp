#!/usr/bin/env node
/**
 * CHECK 3.112 — **Η ΠΥΛΗ ΤΟΥ ΕΝΟΣ ΓΡΑΦΕΑ ΤΗΣ ΔΗΜΟΣΙΑΣ ΒΙΤΡΙΝΑΣ** (ADR-923 §5.13).
 *
 * Η ΕΡΩΤΗΣΗ: «αγγίζει κάποιος το δημόσιο έγγραφο καταλόγου, το outbox του ή το ράφι του ΕΞΩ από τους δηλωμένους κατόχους;»
 *
 * 🔴 Οι κανόνες κλείνουν τον πελάτη, ΟΧΙ το Admin SDK. Ένας δεύτερος γραφέας θα έβγαζε έγγραφο που διαβάζει ανώνυμος χωρίς
 * συνθήκη δημοσίευσης, χωρίς κλειστό σχήμα και χωρίς φράχτη: ανακλημένος προμηθευτής θα ξαναφαινόταν, και το jest του γραφέα
 * θα έμενε πράσινο.
 *
 * 🔑 Ένας κανόνας, πίνακας φυλαγμένων συμβόλων: κάθε γραμμή του μητρώου = σύμβολο + οι κάτοχοί του με λόγο. Η κρίση ζει στο
 * κοινό `lib/write-authority/symbol-owner-gate` (μοιράζεται με την 3.113, ADR-928)· εδώ μένει μόνο ό,τι είναι δικό της.
 * ⚠️ Μετρούνται χρήσεις στο AST: σχόλιο που ονομάζει το σύμβολο και ο ορισμός του στο δικό του αρχείο δεν είναι χρήση.
 *
 * Μόνο στο `src/`, εκτός tests: το κρίνει το κοινό `scanScope`. @see docs/gates/3.112.md
 */

'use strict';

const { defineSymbolOwnerGate } = require('./lib/write-authority/symbol-owner-gate');

const REGISTRY_FILE = '.public-catalog-authority.json';

const { measure, report, main, loadRegistry, STATES, BLOCKING } = defineSymbolOwnerGate({
  check: '3.112',
  skipEnv: 'SKIP_PUBLIC_CATALOG_AUTHORITY',
  ok: 'η δημόσια βιτρίνα έχει ΕΝΑΝ γραφέα, ΕΝΑ outbox και ΜΙΑ πόρτα μέσων',
  registryFile: REGISTRY_FILE,
  outsideState: 'public-catalog-touched-outside-owner',
  report: {
    title: '🛒 CHECK 3.112 — Πύλη του ενός γραφέα της δημόσιας βιτρίνας (ADR-923 §5.13)',
    width: 38,
    remedy: [
      `ΘΕΡΑΠΕΙΑ: το δημόσιο έγγραφο αλλάζει ΜΟΝΟ με σημείωση στο outbox, και το αδειάζει ο \`drainPublicModel\`. Νέος κάτοχος`,
      `συμβόλου = γραμμή στο ${REGISTRY_FILE}, με λόγο.`,
    ],
  },
});

if (require.main === module) process.exit(main());

module.exports = { measure, report, main, loadRegistry, STATES, BLOCKING, REGISTRY_FILE };
