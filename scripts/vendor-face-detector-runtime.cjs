#!/usr/bin/env node
/**
 * @fileoverview **Ο runtime του ανιχνευτή προσώπων μέσα στο standalone του Next** (ADR-884 Φ2ζ ζ4).
 *
 * Χρήση:  node scripts/vendor-face-detector-runtime.cjs .next/standalone
 *
 * Ο worker του ανιχνευτή κάνει `require('onnxruntime-web')` από το `cwd` (`/app`) και φορτώνει το `.wasm` **δυναμικά** — ο
 * ιχνηλάτης του Next δεν τα βλέπει. 🔴 **Μετρημένο στο CI (run 36686300241)**: το `outputFileTracingIncludes` με το pnpm
 * `node-linker=isolated` αντέγραψε το `package.json` του πακέτου αλλά **όχι** το `dist/` ⇒ `Cannot find module …/ort.node.min.js`.
 * ⇒ Εδώ τα δύο πακέτα (`onnxruntime-web` + η εξάρτησή του `onnxruntime-common`) αντιγράφονται ως **κανονικοί φάκελοι** στο
 * `<standalone>/node_modules/`, από εκεί που τα λύνει η ίδια η Node (καμία έκδοση γραμμένη με το χέρι). Μόνο τα αρχεία που
 * φορτώνει πραγματικά ο worker — όχι τα 144 MB του πακέτου. Η λίστα **αποδεικνύεται** από το smoke σε καθαρό φάκελο, όχι από ίχνος.
 *
 * Επαλήθευση αμέσως μετά: `node scripts/face-detector-smoke.cjs .next/standalone` (ο ΙΔΙΟΣ worker της παραγωγής).
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const REPO = path.resolve(__dirname, '..');

/** Τα αρχεία κάθε πακέτου που φορτώνει ο worker (σχετικά με τη ρίζα του πακέτου). */
const RUNTIME = {
  // ⚠️ Το `.mjs` το φορτώνει ο ESM loader (`import()`), όχι το `fs` ⇒ ένα ίχνος `fs` ΔΕΝ το βλέπει (μετρημένο 2026-09-30).
  'onnxruntime-web': ['package.json', 'LICENSE', 'dist/ort.node.min.js', 'dist/ort-wasm-simd-threaded.mjs', 'dist/ort-wasm-simd-threaded.wasm'],
  'onnxruntime-common': ['package.json', 'LICENSE', 'dist/cjs'],
};

/** Η ρίζα ενός πακέτου όπως τη λύνει η Node από τον φάκελο `from` (πραγματική διαδρομή, όχι symlink). */
function packageRoot(name, from) {
  const entry = createRequire(path.join(from, 'noop.js')).resolve(name);
  let dir = path.dirname(entry);
  while (!fs.existsSync(path.join(dir, 'package.json')) || JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).name !== name) {
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error(`package root of ${name} not found from ${entry}`);
    dir = parent;
  }
  return fs.realpathSync(dir);
}

function vendor(name, sourceRoot, target) {
  const destination = path.join(target, 'node_modules', name);
  fs.rmSync(destination, { recursive: true, force: true });
  for (const rel of RUNTIME[name]) {
    const from = path.join(sourceRoot, rel);
    if (!fs.existsSync(from)) {
      if (rel === 'LICENSE') continue;
      throw new Error(`${name}: missing ${rel}`);
    }
    fs.cpSync(from, path.join(destination, rel), { recursive: true, dereference: true });
  }
  console.log(`✅ ${name} → ${path.relative(REPO, destination)}`);
}

function main() {
  const target = path.resolve(process.argv[2] || '.next/standalone');
  if (!fs.existsSync(target)) throw new Error(`target not found: ${target}`);
  const web = packageRoot('onnxruntime-web', REPO);
  vendor('onnxruntime-web', web, target);
  vendor('onnxruntime-common', packageRoot('onnxruntime-common', web), target);
}

try {
  main();
} catch (error) {
  console.error(`❌ vendor face-detector runtime failed: ${error && error.message}`);
  process.exit(1);
}
