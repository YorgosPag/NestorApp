/**
 * =============================================================================
 * Ο ΕΚΤΕΛΕΣΤΗΣ ONNX ΤΟΥ OCR ΣΤΟΝ BROWSER (ADR-929 Φ0.4)
 * =============================================================================
 *
 * Βάζει το `onnxruntime-web` (WASM) κάτω από τους εγχεόμενους εκτελεστές του κινητήρα (`DetectorRunner`, `OcrRecognizer`
 * του `ocr-tensors.ts`) — η **ίδια** σύνδεση που μετρήθηκε στη Φ0.3 (`run_ts_ocr.cjs`: ίδια βαθμολογία με το Python).
 * Τρέχει **μόνο** μέσα στον Web Worker (`plan-ocr-host.ts`).
 *
 * 🔑 **`onnxruntime-web/wasm`** = `ort.wasm.bundle.min.mjs`: ο κώδικας-κόλλα του WASM είναι **ενσωματωμένος**, άρα
 *   δεν κατεβαίνει κανένα `.mjs` από αλλού. Το WASM δίνεται ως bytes στο `ort.env.wasm.wasmBinary` (το `wasmPaths`
 *   αγνοείται τότε), από τον **ίδιο** επαληθευμένο δρόμο με τα μοντέλα (`ocr-asset-loader.ts`).
 * 🔑 **`numThreads = 1`**: τα νήματα του WASM θέλουν `SharedArrayBuffer` ⇒ COOP/COEP σε όλη την εφαρμογή — όπως ο
 *   YuNet (`yunet-worker-source.ts`), ένα νήμα. Μετρημένο στη Φ0.3: 453″ / 224″ CPU για τις δύο σαρώσεις δοκιμής.
 * 🔒 **Έκδοση**: ο κώδικας-κόλλα και το WASM πρέπει να είναι της **ίδιας** έκδοσης — απόκλιση ⇒ σφάλμα πριν φορτωθεί.
 *
 * @module bim/plan-recognition/ocr/ocr-onnx-runtime
 */

import * as ort from 'onnxruntime-web/wasm';
import { loadVerifiedAsset } from './ocr-asset-loader';
import type { OcrModels } from './ocr-engine';
import { OCR_RUNTIME_VERSION, resolveOcrAssets, type OcrAsset, type OcrModelAssets } from './ocr-model-assets';
import { parseCharacterDict, parseDbThresholds, recognitionClasses } from './ocr-model-config';
import type { DetectorRunner, OcrRecognizer, OcrTensor } from './ocr-tensors';
import { REC_HEIGHT } from './ocr-tensors';

/** Η πρόοδος της φόρτωσης: πόσα από τα αρχεία του μητρώου είναι έτοιμα. */
export interface OcrLoadProgress {
  readonly stage: 'load';
  readonly done: number;
  readonly total: number;
}

export interface OcrLoadContext {
  readonly signal?: AbortSignal;
  readonly onProgress?: (progress: OcrLoadProgress) => void;
}

/** Ο αναγνώστης ρωτιέται μία φορά με είσοδο αυτού του πλάτους, για να μάθουμε το πλήθος κλάσεων της εξόδου του (όπως η Φ0.3). */
const PROBE_WIDTH = 320;

function configureRuntime(wasm: ArrayBuffer): void {
  const version = ort.env.versions.web;
  if (version !== OCR_RUNTIME_VERSION) {
    throw new Error(`ocr-onnx-runtime: onnxruntime-web ${String(version)} != registered wasm ${OCR_RUNTIME_VERSION}`);
  }
  ort.env.wasm.wasmBinary = new Uint8Array(wasm);
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
}

const createSession = (onnx: ArrayBuffer): Promise<ort.InferenceSession> =>
  ort.InferenceSession.create(new Uint8Array(onnx), { executionProviders: ['wasm'] });

/** Μία είσοδος, μία έξοδος (`float32`) — το σχήμα των μοντέλων PP-OCR. */
async function runSingle(session: ort.InferenceSession, input: OcrTensor): Promise<{ data: Float32Array; dims: readonly number[] }> {
  const feeds = { [session.inputNames[0]]: new ort.Tensor('float32', input.data, input.dims) };
  const output = (await session.run(feeds))[session.outputNames[0]];
  if (!(output.data instanceof Float32Array)) throw new Error(`ocr-onnx-runtime: output ${output.type} is not float32`);
  return { data: output.data, dims: output.dims };
}

function detectorRunner(session: ort.InferenceSession): DetectorRunner {
  return async (input) => {
    const out = await runSingle(session, input);
    return { data: out.data, width: out.dims[3], height: out.dims[2], stride: out.dims[3] };
  };
}

async function recognizer(session: ort.InferenceSession, yml: string): Promise<OcrRecognizer> {
  const probe = await runSingle(session, { data: new Float32Array(3 * REC_HEIGHT * PROBE_WIDTH), dims: [1, 3, REC_HEIGHT, PROBE_WIDTH] });
  const classes = recognitionClasses(parseCharacterDict(yml), probe.dims[2]);
  return {
    classes,
    run: async (input) => {
      const out = await runSingle(session, input);
      return { data: out.data, steps: out.dims[1], classes: out.dims[2] };
    },
  };
}

interface LoadedModel {
  readonly session: ort.InferenceSession;
  readonly yml: string;
}

/** Κατεβάζει (ή βρίσκει στο cache) και επαληθεύει κάθε αρχείο, με πρόοδο ανά αρχείο. */
function assetFetcher(base: string, context: OcrLoadContext, total: number): (asset: OcrAsset) => Promise<ArrayBuffer> {
  let done = 0;
  return async (asset) => {
    const bytes = await loadVerifiedAsset(asset, base, context.signal);
    done++;
    context.onProgress?.({ stage: 'load', done, total });
    return bytes;
  };
}

/**
 * Τα μοντέλα του κινητήρα, έτοιμα: εκτελεστής WASM, ανιχνευτής (με τα κατώφλια DB του `inference.yml` του) και οι δύο
 * αναγνώστες (με τις κλάσεις τους ελεγμένες απέναντι στην έξοδο του δικτύου).
 */
export async function loadOcrModels(base: string, context: OcrLoadContext = {}): Promise<OcrModels> {
  const assets = resolveOcrAssets();
  const models = [assets.detector, assets.primary, assets.secondary];
  const fetchAsset = assetFetcher(base, context, 1 + 2 * models.length);
  configureRuntime(await fetchAsset(assets.runtime));
  const text = new TextDecoder();
  const load = async (model: OcrModelAssets): Promise<LoadedModel> => {
    const yml = text.decode(await fetchAsset(model.yml));
    const onnx = await fetchAsset(model.onnx);
    context.signal?.throwIfAborted();
    return { session: await createSession(onnx), yml };
  };
  const detector = await load(assets.detector);
  const primary = await load(assets.primary);
  const secondary = await load(assets.secondary);
  return {
    detect: detectorRunner(detector.session),
    db: parseDbThresholds(detector.yml),
    primary: await recognizer(primary.session, primary.yml),
    secondary: await recognizer(secondary.session, secondary.yml),
  };
}
