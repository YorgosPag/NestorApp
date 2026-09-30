/**
 * @fileoverview **Ο ΚΩΔΙΚΑΣ ΤΟΥ WORKER ΤΟΥ ΑΝΙΧΝΕΥΤΗ** — και το πρωτόκολλο μηνυμάτων του (ADR-884 Φ2ζ ζ4).
 * @related `yunet-session.ts` (ο ιδιοκτήτης του worker) · `scripts/vendor-face-detector-runtime.cjs` (τα αρχεία που φορτώνει, στο standalone)
 * @module server/spatial-tour/face-detection/yunet-worker-source
 *
 * 🔑 **Κείμενο, όχι αρχείο** (`new Worker(source, { eval: true })`): κανένα δεύτερο αρχείο να ξεχάσει ο bundler ή το standalone
 *   του Next. Το `require('onnxruntime-web')` λύνεται από το `cwd` (`/app` στο image) — δηλαδή την είσοδο **CommonJS**
 *   `dist/ort.node.min.js` + `onnxruntime-common/dist/cjs/*` + το ζεύγος `ort-wasm-simd-threaded.{mjs,wasm}` (το `.mjs` με `import()`,
 *   αόρατο σε ίχνος `fs` — το απέδειξε το smoke σε καθαρό φάκελο, 2026-09-30). Ο ιχνηλάτης του Next **δεν** τα φέρνει στο standalone ⇒
 *   `scripts/vendor-face-detector-runtime.cjs` στο CI.
 * 🔑 Οι έξοδοι **αντιγράφονται** (`slice`) πριν μεταφερθούν: ποτέ μεταφορά buffer που ίσως είναι όψη της μνήμης του WASM.
 */

/** Αίτημα προς τον worker (το `id` το βάζει ο ιδιοκτήτης). */
export type YunetWorkerRequest =
  | { readonly kind: 'load'; readonly model: ArrayBuffer }
  | { readonly kind: 'run'; readonly data: ArrayBuffer; readonly width: number; readonly height: number };

/** Απάντηση του worker — `outputs` μόνο σε `run`. */
export type YunetWorkerReply =
  | { readonly id: number; readonly ok: true; readonly outputs?: Readonly<Record<string, ArrayBuffer>> }
  | { readonly id: number; readonly ok: false; readonly error: string };

/** Ο κώδικας του worker (CommonJS, χωρίς εξαρτήσεις πέρα από το `onnxruntime-web`). Ένα νήμα WASM — σκόπιμα. */
export const YUNET_WORKER_SOURCE = `
'use strict';
const { parentPort } = require('node:worker_threads');
const ort = require('onnxruntime-web');
ort.env.wasm.numThreads = 1;
let session = null;

async function load(message) {
  session = await ort.InferenceSession.create(new Uint8Array(message.model), { executionProviders: ['wasm'] });
  parentPort.postMessage({ id: message.id, ok: true });
}

async function run(message) {
  if (session === null) throw new Error('model not loaded');
  const input = new ort.Tensor('float32', new Float32Array(message.data), [1, 3, message.height, message.width]);
  const results = await session.run({ [session.inputNames[0]]: input });
  const outputs = {};
  const transfer = [];
  for (const [name, value] of Object.entries(results)) {
    if (!(value.data instanceof Float32Array)) throw new Error('output ' + name + ' is not float32');
    const copy = value.data.slice();
    outputs[name] = copy.buffer;
    transfer.push(copy.buffer);
  }
  parentPort.postMessage({ id: message.id, ok: true, outputs }, transfer);
}

parentPort.on('message', (message) => {
  (message.kind === 'load' ? load(message) : run(message)).catch((error) => {
    parentPort.postMessage({ id: message.id, ok: false, error: String((error && error.message) || error) });
  });
});
`;
