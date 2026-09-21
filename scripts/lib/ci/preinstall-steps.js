'use strict';

/**
 * ADR-770 · ADR-757 — **«ΤΡΕΧΕΙ ΑΥΤΟ ΤΟ ΒΗΜΑ ΧΩΡΙΣ `node_modules`;»**
 *
 * Πολλά workflows τρέχουν τις φθηνές πύλες **πριν** από το `pnpm install`, ώστε ένα σπασμένο
 * lockfile να μην κρύβει ποτέ πραγματική παλινδρόμηση. Αυτό ισχύει **μόνο** αν το βήμα δεν κάνει
 * `require` πακέτου — και αυτό **ποτέ** δεν το έλεγχε μηχανή, μόνο σχόλιο στο workflow
 * («πριν προσθέσεις βήμα εδώ: grep»). Μετρημένο: απέτυχε **δύο** φορές στο
 * `ui-contrast-ratchet.yml`:
 *   · 08/08 — τρία βήματα (3.39 · 3.41 · 3.45) φόρτωναν `typescript`.
 *   · 27/08 — το `fcd8e094` έκανε το CHECK 3.38 να φορτώνει `tailwindcss/loadConfig` (μέσω
 *     `require.resolve`, αόρατο σε grep για `require('`) ⇒ **κόκκινο 37 φορές** επί 3+ εβδομάδες,
 *     και τα βήματα από κάτω **δεν εκτελέστηκαν ποτέ**.
 *
 * Στατική κλειστότητα των **σχετικών** `require` από το script του βήματος· ό,τι μένει γυμνό και
 * δεν είναι built-in είναι πακέτο. Πιάνει `require(…)` **και** `require.resolve(…)`.
 * ⚠️ Δηλωμένο όριο: `require(μεταβλητή)` δεν φαίνεται — δεν υπάρχει στα scripts σήμερα.
 *
 * @module scripts/lib/ci/preinstall-steps
 */

const fs = require('node:fs');
const path = require('node:path');
const { builtinModules } = require('node:module');

const { readWorkflowSteps, significantLines } = require('./workflow-meta');

/** Το βήμα που γεμίζει το `node_modules`. Όλα τα προηγούμενα του job τρέχουν χωρίς αυτό. */
const INSTALL_RE = /\b(?:pnpm|npm|yarn)\s+(?:install|ci)\b/;
/** `node scripts/<…>.js` — το σημείο εισόδου που φορτώνει ο runner. */
const NODE_SCRIPT_RE = /\bnode\s+((?:\.\/)?scripts\/[\w./-]+\.[cm]?js)\b/g;
const REQUIRE_RE = /\brequire(?:\.resolve)?\(\s*['"]([^'"]+)['"]/g;

const BUILTINS = new Set(builtinModules);
const isBuiltin = (spec) => spec.startsWith('node:') || BUILTINS.has(spec.split('/')[0]);
const packageOf = (spec) => spec.split('/').slice(0, spec.startsWith('@') ? 2 : 1).join('/');

/**
 * Τα πακέτα που φορτώνει (μεταβατικά) ένα script, με το αρχείο που τα ζητά.
 * @returns {{pkg:string, via:string}[]}
 */
function packageRequires(entry, root) {
  const found = new Map();
  const seen = new Set();
  const stack = [path.resolve(root, entry)];
  while (stack.length > 0) {
    const file = stack.pop();
    if (seen.has(file) || !fs.existsSync(file)) continue;
    seen.add(file);
    for (const [, spec] of fs.readFileSync(file, 'utf8').matchAll(REQUIRE_RE)) {
      if (spec.startsWith('.')) {
        stack.push(resolveLocal(path.dirname(file), spec));
      } else if (!isBuiltin(spec) && !found.has(packageOf(spec))) {
        found.set(packageOf(spec), path.relative(root, file).split(path.sep).join('/'));
      }
    }
  }
  return [...found].map(([pkg, via]) => ({ pkg, via }));
}

/** `./x` ⇒ `./x.js` · `./x/index.js` — η επίλυση του Node για σχετικό specifier. */
function resolveLocal(dir, spec) {
  const base = path.resolve(dir, spec);
  for (const candidate of [base, `${base}.js`, `${base}.cjs`, `${base}.json`, path.join(base, 'index.js')]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return base;
}

/**
 * Εγκαθιστά εξαρτήσεις αυτό το βήμα; — `run:` με install, ή **τοπικό** composite action
 * (`uses: ./.github/actions/…`) που το κάνει μέσα του (π.χ. `firebase-identity`).
 */
function installs(step, root) {
  if (step.run !== null) return INSTALL_RE.test(step.run);
  if (!step.uses.startsWith('./')) return false;
  const dir = path.resolve(root, step.uses);
  const file = ['action.yml', 'action.yaml'].map((name) => path.join(dir, name)).find((p) => fs.existsSync(p));
  return Boolean(file) && significantLines(fs.readFileSync(file, 'utf8')).some((l) => INSTALL_RE.test(l.body));
}

/**
 * Κάθε βήμα **πριν** από το install που φορτώνει πακέτο — σε όλα τα workflows.
 * @param {string[]} workflowFiles
 * @returns {{workflow:string, job:string, script:string, pkg:string, via:string}[]}
 */
function preinstallViolations(workflowFiles, root) {
  const out = [];
  for (const file of workflowFiles) {
    const installed = new Set();
    for (const step of readWorkflowSteps(file)) {
      if (installed.has(step.job)) continue;
      if (installs(step, root)) { installed.add(step.job); continue; }
      if (step.run === null) continue;
      for (const [, script] of step.run.matchAll(NODE_SCRIPT_RE)) {
        for (const { pkg, via } of packageRequires(script, root)) {
          out.push({ workflow: path.basename(file), job: step.job, script, pkg, via });
        }
      }
    }
  }
  return out;
}

/** `actions/setup-node@vN` — από τη v5 και μετά το cache ενεργοποιείται ΜΟΝΟ ΤΟΥ. */
const SETUP_NODE_RE = /^actions\/setup-node@v(\d+)\b/;
const FIRST_IMPLICIT_CACHE_MAJOR = 5;

/**
 * **Η ίδια ερώτηση, από την πλευρά του action**: «ζητά αυτό το βήμα κάτι που δεν έχει
 * εγκατασταθεί;».
 *
 * Το `actions/setup-node@v5` (Node 24) ενεργοποιεί cache **σιωπηρά** για όποιον package manager
 * δηλώνει το `packageManager` του `package.json` (`getNameFromPackageManagerField` — npm, yarn
 * **ή pnpm**). Εδώ δηλώνεται `pnpm`, άρα κάθε `setup-node` χωρίς ρητό `cache:` αρχίζει να τρέχει
 * `pnpm store path` — και στα jobs που **σκόπιμα** δεν εγκαθιστούν τίποτα (9 το 2026-09-21) το
 * `pnpm` δεν υπάρχει ⇒ το βήμα **αποτυγχάνει**. Κανόνας: η απόφαση cache είναι **ρητή** —
 * `cache: pnpm` ή `package-manager-cache: false`, ποτέ σιωπηρή.
 * ⚠️ Δηλωμένο όριο: σαρώνει workflows· τα composite actions (`.github/actions/*`) όχι.
 * @param {string[]} workflowFiles
 * @returns {{workflow:string, job:string, uses:string}[]}
 */
function implicitCacheViolations(workflowFiles) {
  const out = [];
  for (const file of workflowFiles) {
    for (const step of readWorkflowSteps(file)) {
      const major = step.uses === null ? null : step.uses.match(SETUP_NODE_RE);
      if (!major || Number(major[1]) < FIRST_IMPLICIT_CACHE_MAJOR) continue;
      if ('cache' in step.with || 'package-manager-cache' in step.with) continue;
      out.push({ workflow: path.basename(file), job: step.job, uses: step.uses });
    }
  }
  return out;
}

module.exports = { packageRequires, preinstallViolations, implicitCacheViolations, INSTALL_RE };
