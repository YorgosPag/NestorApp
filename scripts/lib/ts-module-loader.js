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
 * 🔑 Το ψευδώνυμο `@/*` → `src/*` (`tsconfig.base.json` · `jest.config.js`) λύνεται εδώ (2026-10-29).
 * Μέχρι τότε ο κανόνας ήταν «ό,τι φορτώνεται εδώ ΔΕΝ χρησιμοποιεί `@/`» — μια συνθήκη που
 * κανείς δεν έβλεπε από το αρχείο που φορτώνεται: το `constants/platform-operator.ts` απέκτησε
 * εισαγωγές από το SSoT ημερομηνιών και η CHECK 3.85 έσπασε με `Cannot find module`.
 * ⚠️ Μόνο το `@/`· όποιο άλλο ψευδώνυμο θέλει πρώτα γραμμή στο `tsconfig.base.json`.
 *
 * @module scripts/lib/ts-module-loader
 */

'use strict';

const Module = require('module');
const path = require('path');

const SRC_ROOT = path.resolve(__dirname, '..', '..', 'src');
const ALIAS_PREFIX = '@/';

let registered = false;

/** `@/x` → `<repo>/src/x`, για κάθε `require` της διεργασίας — όπως ο `moduleNameMapper` του jest. */
function registerSrcAlias() {
  const resolve = Module._resolveFilename;
  Module._resolveFilename = function resolveSrcAlias(request, ...rest) {
    const target = request.startsWith(ALIAS_PREFIX)
      ? path.join(SRC_ROOT, request.slice(ALIAS_PREFIX.length))
      : request;
    return resolve.call(this, target, ...rest);
  };
}

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
  registerSrcAlias();
  registered = true;
}

/** Φορτώνει ένα module `.ts` **εκτελώντας** το. */
function requireTypeScript(absolutePath) {
  registerTypeScript();
  // eslint-disable-next-line import/no-dynamic-require, global-require
  return require(absolutePath);
}

module.exports = { registerTypeScript, requireTypeScript };
