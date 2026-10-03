'use strict';
/**
 * **ΦΟΡΤΩΣΗ ΚΑΘΑΡΟΥ TypeScript ΤΗΣ ΕΦΑΡΜΟΓΗΣ ΑΠΟ SCRIPT ΤΟΥ node** — `require('@/…')` χωρίς build.
 *
 * 🔑 Για γεννήτορες που πρέπει να **ΕΚΤΕΛΕΣΟΥΝ** το SSoT (π.χ. `z.toJSONSchema` πάνω στα σχήματα του συμβολαίου,
 * ADR-904 Ε6) — όχι απλώς να το διαβάσουν ως AST, όπως η προβολή του CHECK 3.93.
 *
 * Μηχανή: `@swc/core` (ήδη devDependency, Apache-2.0 — ο ίδιος μεταγλωττιστής του `@swc/jest`). Μόνο **αφαίρεση
 * τύπων** + CommonJS· **κανένας** έλεγχος τύπων (N.17). Το `@/` λύνεται στο `src/`, όπως στο `tsconfig`/`jest`.
 *
 * ⛔ **Μόνο για leaf modules**: ό,τι κάνει import `server-only`, `next/*` ή Firebase θα **ρίξει** εδώ — και αυτό είναι
 * το σωστό σήμα: ένα συμβόλαιο που χρειάζεται τον διακομιστή για να **περιγραφεί** δεν είναι καθαρό.
 *
 * Χρήση:  const { requireTs } = require('./lib/ts-require');  requireTs(root, '@/contracts/…');
 */

const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');

const { transformSync } = require('@swc/core');

const TS_EXTENSIONS = ['.ts', '.tsx'];
let registeredRoot = null;

function transpile(source, filename) {
  const { code } = transformSync(source, {
    filename,
    sourceMaps: false,
    module: { type: 'commonjs' },
    jsc: {
      target: 'es2022',
      parser: { syntax: 'typescript', tsx: filename.endsWith('.tsx') },
    },
  });
  return code;
}

/** `@/x/y` → `<root>/src/x/y` · σχετικά μένουν ως έχουν· το node βρίσκει μετά την κατάληξη `.ts` μόνο του. */
function aliasOf(request, root) {
  return request.startsWith('@/') ? path.join(root, 'src', request.slice(2)) : request;
}

function register(root) {
  if (registeredRoot !== null) {
    if (registeredRoot !== root) throw new Error(`ts-require already registered for ${registeredRoot}`);
    return;
  }
  registeredRoot = root;
  for (const ext of TS_EXTENSIONS) {
    Module._extensions[ext] = (module, filename) => {
      module._compile(transpile(fs.readFileSync(filename, 'utf8'), filename), filename);
    };
  }
  const originalResolve = Module._resolveFilename;
  Module._resolveFilename = function resolveWithAlias(request, parent, ...rest) {
    return originalResolve.call(this, aliasOf(request, root), parent, ...rest);
  };
}

/** Φόρτωσε ένα module TypeScript της εφαρμογής (με `@/`), μετά από εγγραφή του φορτωτή για αυτή τη ρίζα. */
function requireTs(root, specifier) {
  register(root);
  return require(aliasOf(specifier, root));
}

module.exports = { requireTs };
