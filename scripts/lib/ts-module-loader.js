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
 * ⚠️ `skipProject: true` — σκόπιμα: θέλουμε τιμές, όχι έλεγχο τύπων (N.17).
 * 🔑 Το ψευδώνυμο `@/*` → `src/*` (`tsconfig.base.json` · `jest.config.js`) λύνεται εδώ (2026-10-29).
 * Μέχρι τότε ο κανόνας ήταν «ό,τι φορτώνεται εδώ ΔΕΝ χρησιμοποιεί `@/`» — μια συνθήκη που
 * κανείς δεν έβλεπε από το αρχείο που φορτώνεται: το `constants/platform-operator.ts` απέκτησε
 * εισαγωγές από το SSoT ημερομηνιών και η CHECK 3.85 έσπασε με `Cannot find module`.
 * ⚠️ Μόνο το `@/`· όποιο άλλο ψευδώνυμο θέλει πρώτα γραμμή στο `tsconfig.base.json`.
 *
 * 🔑 **ΟΨΗ ΤΟΥ COMMIT (ADR-924)** — `materializeTypeScriptClosure`: η κλειστότητα εισαγωγών από το
 * ευρετήριο, υλοποιημένη σε στιγμιότυπο. Το `@/` λύνεται **στο δέντρο του αρχείου που ζητά**
 * (repo ή στιγμιότυπο), ώστε ένα module του στιγμιοτύπου να μη φορτώσει ποτέ σιωπηλά τον δίσκο.
 *
 * @module scripts/lib/ts-module-loader
 */

'use strict';

const fs = require('fs');
const Module = require('module');
const path = require('path');

const { createCommitView, materializeIndex } = require('./git-index-snapshot');
const { importClosure } = require('./ts-import-closure');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const ALIAS_PREFIX = '@/';

let registered = false;
/** Ρίζες στιγμιοτύπων· ό,τι δεν ανήκει σε καμία ανήκει στο repo. */
const snapshotRoots = new Set();

/** Το δέντρο (repo ή στιγμιότυπο) στο οποίο ανήκει ένα αρχείο. */
function treeOf(filename) {
  if (typeof filename === 'string') {
    for (const root of snapshotRoots) {
      if (filename.startsWith(`${root}${path.sep}`)) return root;
    }
  }
  return REPO_ROOT;
}

const isBare = request => !request.startsWith('.') && !path.isAbsolute(request) && !request.startsWith(ALIAS_PREFIX);

/** `@/x` → `<δέντρο>/src/x`· εξωτερικό πακέτο από στιγμιότυπο → `node_modules` του repo. */
function registerSrcAlias() {
  const resolve = Module._resolveFilename;
  Module._resolveFilename = function resolveSrcAlias(request, parent, ...rest) {
    const tree = treeOf(parent && parent.filename);
    if (request.startsWith(ALIAS_PREFIX)) {
      return resolve.call(this, path.join(tree, 'src', request.slice(ALIAS_PREFIX.length)), parent, ...rest);
    }
    if (tree !== REPO_ROOT && isBare(request)) {
      try {
        return resolve.call(this, request, parent, ...rest);
      } catch {
        return require.resolve(request, { paths: [REPO_ROOT] });
      }
    }
    return resolve.call(this, request, parent, ...rest);
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

/**
 * Στιγμιότυπο του ευρετηρίου με ό,τι χρειάζεται για να **εκτελεστούν** τα `entries` — η κλειστότητα
 * εισαγωγών τους, όπως θα δεσμευτεί, συν τα `extra` (αρχεία ή φάκελοι δεδομένων).
 * Ο καλών φορτώνει με `requireTypeScript(path.join(snapshot.root, rel))` και καλεί `dispose()` όταν
 * τελειώσει· τα ήδη φορτωμένα modules μένουν στη μνήμη.
 * @param {{repoRoot?: string, entries: string[], extra?: string[]}} options σχετικά μονοπάτια (posix)
 * @returns {{root: string, files: string[], dispose: () => void}}
 */
function materializeTypeScriptClosure({ repoRoot = REPO_ROOT, entries, extra = [] }) {
  const view = createCommitView({ repoRoot, include: rel => rel.startsWith('src/') });
  const closure = importClosure({ entries, readText: view.readText, has: view.has });
  const snapshot = materializeIndex({ repoRoot, pathspecs: [...closure, ...extra], rawBytes: true });
  // ⚠️ realpath: το `require` κρατά το πραγματικό μονοπάτι, ενώ το tmpdir των Windows μπορεί να είναι 8.3.
  const root = fs.realpathSync.native(snapshot.root);
  snapshotRoots.add(root);
  return {
    root,
    files: snapshot.files,
    dispose() {
      snapshotRoots.delete(root);
      snapshot.dispose();
    },
  };
}

module.exports = { registerTypeScript, requireTypeScript, materializeTypeScriptClosure };
