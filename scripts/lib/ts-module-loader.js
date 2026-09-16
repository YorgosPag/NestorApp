#!/usr/bin/env node
/**
 * Ο ΕΝΑΣ ΦΟΡΤΩΤΗΣ TypeScript ΓΙΑ ΤΑ SCRIPTS — transpile, ΟΧΙ type-check.
 *
 * Κάποιες πύλες ρωτούν **τιμές** που ζουν σε αρχεία `.ts` και έχουν νόημα μόνο **αφού
 * εκτελεστούν** (μητρώο κάλυψης κανόνων · ιστορικό φορέα · περίγραμμα νομικών εγγράφων).
 * Το AST δεν αρκεί εκεί· χρειάζεται `require`.
 *
 * 🧹 **Εξήχθη 2026-09-16 (ADR-861 Φ3, N.0.2)** από το `firestore-rules/load-manifest.js`,
 * του οποίου το ίδιο το σχόλιο έγραφε *«αν χρειαστείς δεύτερο script, κάλεσε ΑΥΤΟ — μην
 * ξαναγράψεις το register»*. Η πύλη νομικών εγγράφων ήταν ο δεύτερος καταναλωτής.
 *
 * ⚠️ `skipProject: true` — σκόπιμα: τα αρχεία που φορτώνονται εδώ είναι **χωρίς εισαγωγές**
 * (ή εκτός `tsconfig`), και θέλουμε τιμές, όχι έλεγχο τύπων (N.17).
 * ⚠️ Καμία ανάλυση ψευδωνύμων `@/`: ό,τι φορτώνεται εδώ **δεν** πρέπει να τα χρησιμοποιεί.
 *
 * @module scripts/lib/ts-module-loader
 */

'use strict';

let registered = false;

/** Ενεργοποιεί τη μεταγλώττιση TypeScript για `require()`, μία φορά ανά διεργασία. */
function registerTypeScript() {
  if (registered) return;
  // eslint-disable-next-line global-require -- σκόπιμα lazy: το ts-node είναι devDependency.
  require('ts-node').register({
    transpileOnly: true,
    skipProject: true,
    compilerOptions: {
      module: 'commonjs',
      target: 'es2022',
      esModuleInterop: true,
      resolveJsonModule: true,
      moduleResolution: 'node',
    },
  });
  registered = true;
}

/** Φορτώνει ένα module `.ts` **εκτελώντας** το. */
function requireTypeScript(absolutePath) {
  registerTypeScript();
  // eslint-disable-next-line import/no-dynamic-require, global-require
  return require(absolutePath);
}

module.exports = { registerTypeScript, requireTypeScript };
