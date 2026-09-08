#!/usr/bin/env node
/**
 * ADR-298 Α21.16 — Ο ΕΝΑΣ ΦΟΡΤΩΤΗΣ ΤΟΥ ΜΗΤΡΩΟΥ ΚΑΛΥΨΗΣ.
 *
 * Το CHECK 3.16 διαβάζει το `coverage-manifest.ts` με **AST** (Validations A-F):
 * του αρκούν `collection` / `pattern` / `testFile`, που είναι string literals.
 * Η **Validation G** ρωτά κάτι που το AST **δεν μπορεί** να απαντήσει:
 *
 *     «πόσα κελιά έχει τελικά αυτή η εγγραφή;»
 *
 * — γιατί η μήτρα δεν είναι literal· είναι **κλήση συνάρτησης** (`...tenantDirectMatrix()`),
 * και το νόημά της υπάρχει μόνο **αφού εκτελεστεί**. Άρα η Validation G πρέπει να
 * **φορτώσει** το μητρώο, όχι να το διαβάσει.
 *
 * ⚠️ ΓΙΑΤΙ `skipProject: true` — ΔΕΝ ΕΙΝΑΙ ΠΑΡΑΛΕΙΨΗ, ΕΙΝΑΙ ΤΟ ΘΕΜΑ:
 * το root `tsconfig.json` έχει `include` που **δεν περιέχει το `tests/`**. Αν ο
 * φορτωτής σεβόταν το project config, θα προσπαθούσε να μεταγλωττίσει με ρυθμίσεις
 * γραμμένες για το `src/app` — ή θα αρνιόταν εντελώς. Εδώ θέλουμε **transpile,
 * όχι type-check**: τους τύπους τους ελέγχει ο Giorgio περιοδικά (N.17), η πύλη
 * ρωτά **τιμές**.
 *
 * 🔴 ΚΑΙ ΓΙ' ΑΥΤΟ ΑΚΡΙΒΩΣ Η ΠΛΗΡΟΤΗΤΑ ΕΠΙΒΑΛΛΕΤΑΙ ΑΠΟ ΤΟΝ **ΚΑΤΑΣΚΕΥΑΣΤΗ**
 * (`defineMatrix`, `coverage-completeness.ts`) ΚΑΙ ΟΧΙ ΑΠΟ ΤΟΝ ΜΕΤΑΓΛΩΤΤΙΣΤΗ:
 * ένας τυπικός φρουρός σε φάκελο εκτός `tsconfig` δεν εκτελείται **ποτέ** — είναι
 * η ίδια κλάση σφάλματος με το `rulesRange` (ADR-298 Α21.14), και θα ήταν
 * ειρωνικό να τη χτίσουμε μέσα στη διόρθωσή της.
 *
 * ⚠️ ΜΙΑ μηχανή φόρτωσης, ΕΝΑ σημείο. Αν χρειαστείς το μητρώο σε δεύτερο script,
 * κάλεσε **αυτό** — μην ξαναγράψεις το register (μάθημα ADR-749: τέσσερις
 * υλοποιήσεις, τρεις αριθμοί για το ίδιο δέντρο).
 *
 * @see ADR-298 §8 Α21.16
 * @module scripts/lib/firestore-rules/load-manifest
 */

'use strict';

const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const MANIFEST_TS = path.join(
  PROJECT_ROOT,
  'tests',
  'firestore-rules',
  '_registry',
  'coverage-manifest.ts',
);

let registered = false;

/**
 * Ενεργοποιεί τη μεταγλώττιση TypeScript για `require()`, μία φορά ανά διεργασία.
 */
function registerTypeScript() {
  if (registered) return;
  // eslint-disable-next-line global-require -- σκόπιμα lazy: το ts-node είναι
  // devDependency και δεν πρέπει να φορτώνεται όταν τρέχουν μόνο οι A-F.
  require('ts-node').register({
    transpileOnly: true,
    skipProject: true,
    compilerOptions: {
      module: 'commonjs',
      target: 'es2022',
      esModuleInterop: true,
      moduleResolution: 'node',
    },
  });
  registered = true;
}

/**
 * Φορτώνει το μητρώο κάλυψης **εκτελώντας** το.
 *
 * Σημείωση: αν κάποιος builder είναι **μερικός**, η `defineMatrix()` πετάει εδώ,
 * σε αυτό ακριβώς το `require`. Αυτό είναι **επιθυμητό** — η πύλη αναφέρει το
 * μήνυμα αυτούσιο, που ονομάζει τον builder και τα κελιά που λείπουν.
 *
 * @returns {{ coverage: readonly object[] }}
 */
function loadCoverageManifest() {
  registerTypeScript();
  // eslint-disable-next-line import/no-dynamic-require, global-require
  const mod = require(MANIFEST_TS);
  const coverage = mod.FIRESTORE_RULES_COVERAGE;
  if (!Array.isArray(coverage)) {
    throw new Error(
      '[load-manifest] Το coverage-manifest.ts δεν εξήγαγε πίνακα ' +
        '`FIRESTORE_RULES_COVERAGE`. Άλλαξε το σχήμα του μητρώου;',
    );
  }
  return { coverage };
}

module.exports = { loadCoverageManifest, MANIFEST_TS, PROJECT_ROOT };
