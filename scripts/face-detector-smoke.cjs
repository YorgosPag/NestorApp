#!/usr/bin/env node
/**
 * @fileoverview **Smoke του ανιχνευτή προσώπων** (ADR-884 Φ2ζ ζ4) — εκτελεί τον **ΙΔΙΟ** worker της παραγωγής
 * (`yunet-worker-source.ts`) με `cwd` τον φάκελο που δίνεται, φορτώνει το μοντέλο και τρέχει μία εκτέλεση.
 *
 * Χρήση:  node scripts/face-detector-smoke.cjs [φάκελος]      (προεπιλογή: η ρίζα του repo)
 * CI:     node scripts/face-detector-smoke.cjs .next/standalone   — αποδεικνύει ότι το standalone του Next **λύνει**
 *         το `require('onnxruntime-web')` και βρίσκει το `.wasm` (η φόρτωσή τους είναι δυναμική, ο ιχνηλάτης δεν τα βλέπει μόνος).
 *
 * Γιατί υπάρχει: χωρίς αυτά ο ψήστης **αναβάλλει** κάθε λήψη (fail-closed) — σωστό για την ιδιωτικότητα, αλλά σιωπηλό στην
 * παραγωγή. Εδώ το μαθαίνουμε πριν φτιαχτεί το image.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { Worker } = require('node:worker_threads');
const ts = require('typescript');

const REPO = path.resolve(__dirname, '..');
const SOURCE_FILE = path.join(REPO, 'src/server/spatial-tour/face-detection/yunet-worker-source.ts');
const MODEL_FILE = path.join(REPO, 'data/models/face-detection/face_detection_yunet_2026may.onnx');
const EXPECTED_OUTPUTS = 12;
const TIMEOUT_MS = 60_000;

/** Ο κώδικας του worker από την πηγή του — μία αλήθεια, κανένα αντίγραφο. */
function workerSource() {
  const { outputText } = ts.transpileModule(fs.readFileSync(SOURCE_FILE, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const mod = new Module(SOURCE_FILE);
  mod._compile(outputText, SOURCE_FILE);
  return mod.exports.YUNET_WORKER_SOURCE;
}

function ask(worker, message, transfer) {
  return new Promise((resolve, reject) => {
    worker.once('message', (reply) => (reply.ok ? resolve(reply) : reject(new Error(reply.error))));
    worker.once('error', reject);
    worker.postMessage(message, transfer);
  });
}

async function main() {
  const target = path.resolve(process.argv[2] || REPO);
  const source = workerSource();
  process.chdir(target);
  const worker = new Worker(source, { eval: true });
  const timer = setTimeout(() => { console.error('❌ timeout'); process.exit(1); }, TIMEOUT_MS);
  const model = new Uint8Array(fs.readFileSync(MODEL_FILE)).buffer;
  await ask(worker, { id: 1, kind: 'load', model }, [model]);
  const size = 640;
  const data = new Float32Array(3 * size * size).buffer;
  const reply = await ask(worker, { id: 2, kind: 'run', data, width: size, height: size }, [data]);
  const outputs = Object.keys(reply.outputs || {});
  clearTimeout(timer);
  await worker.terminate();
  if (outputs.length !== EXPECTED_OUTPUTS) throw new Error(`expected ${EXPECTED_OUTPUTS} outputs, got ${outputs.length}`);
  console.log(`✅ face detector runs from ${target} (${outputs.length} outputs)`);
}

main().catch((error) => {
  console.error(`❌ face detector smoke failed: ${error && error.message}`);
  process.exit(1);
});
