import 'server-only';

/**
 * @fileoverview **Ο ΑΝΙΧΝΕΥΤΗΣ ΠΡΟΣΩΠΩΝ, ΖΩΝΤΑΝΟΣ** — το YuNet στο `onnxruntime-web` (WASM) μέσα σε **worker thread**, με ρητό
 * κύκλο ζωής: γεννιέται στην πρώτη σάρωση, πεθαίνει μετά από αδράνεια (ADR-884 Φ2ζ ζ4 · §4.15).
 * @related `yunet-worker-source.ts` (ο κώδικας του worker) · `yunet-decode.ts` (οι αριθμοί) · `../tour-face-scan.ts` (ο καταναλωτής) ·
 *   `data/models/face-detection/README.md` · `scripts/vendor-face-detector-runtime.cjs` (ο runtime στο standalone) · `Dockerfile` (`COPY data/models`)
 * @module server/spatial-tour/face-detection/yunet-session
 *
 * ⚖️ **`onnxruntime-web`, όχι `onnxruntime-node`**: το image είναι `node:22-alpine` (musl) και το `onnxruntime-node` δεν έχει
 *   έτοιμα binaries για musl (microsoft/onnxruntime#9483). WASM = χωρίς native. MIT (N.5).
 * 🧵 **Worker, όχι κύριο νήμα** (μετρημένο 2026-09-29): μία εκτέλεση WASM είναι **συγχρονισμένη** ~0,3–1,2 s — στο κύριο νήμα θα
 *   πάγωνε κάθε αίτημα του site για ~10 s ανά λήψη. Στο worker ο βρόχος γεγονότων μένει ελεύθερος. **Ένα** νήμα WASM μέσα του:
 *   δεν στερούμε CPU από τα αιτήματα — η σάρωση είναι παρασκήνιο.
 * 🧠 **Η μνήμη του WASM δεν μικραίνει ποτέ** ⇒ ο worker **τερματίζεται** μετά από `IDLE_MS` χωρίς δουλειά· ξαναγεννιέται στην επόμενη.
 * 🔒 **Fail-closed**: μοντέλο με άλλο sha256, worker που πέθανε, εκτέλεση που κόλλησε (`RUN_TIMEOUT_MS`) ⇒ απόρριψη ⇒ ο ψήστης
 *   **αναβάλλει** (ποτέ «ψήσε χωρίς σάρωση»)· ο worker ξεχνιέται και η επόμενη λήψη ξεκινά καθαρά.
 */

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Worker } from 'node:worker_threads';

import type { YunetInput, YunetOutputs } from './yunet-decode';
import { YUNET_WORKER_SOURCE, type YunetWorkerReply, type YunetWorkerRequest } from './yunet-worker-source';

/** Το αρχείο του μοντέλου (μέσα στον φάκελο μοντέλων). */
const TOUR_FACE_MODEL_FILE = 'face_detection_yunet_2026may.onnx';
/** Το sha256 του — καρφωμένο: άλλο αρχείο ⇒ άλλο μοντέλο ⇒ άλλη `TOUR_FACE_DETECTOR_VERSION`, ποτέ σιωπηλά. */
export const TOUR_FACE_MODEL_SHA256 = 'ebafce4e3c118d6554634be5c27ab333b4c047a9a8c3faf1d7cf93101c22f0f0';
/** Ο φάκελος μοντέλων (σχετικά με τη ρίζα της διεργασίας — `/app` στο image), ή το `FACE_MODEL_DIR`. */
const DEFAULT_FACE_MODEL_DIR = 'data/models/face-detection';
/** Αδράνεια μετά την οποία ο worker τερματίζεται (η μνήμη του WASM επιστρέφει στο σύστημα). */
const IDLE_MS = 60_000;
/** Μία εκτέλεση 2560² κρατά ~1,2 s· αν περάσει αυτό, ο worker θεωρείται κολλημένος. */
const RUN_TIMEOUT_MS = 60_000;

/** Η διαδρομή του μοντέλου — ίδια λογική με τη βάση GeoIP (ADR-894): env, αλλιώς σχετικά με το `cwd`. */
export function faceModelPath(): string {
  return path.join(process.env.FACE_MODEL_DIR || path.join(process.cwd(), DEFAULT_FACE_MODEL_DIR), TOUR_FACE_MODEL_FILE);
}

async function verifiedModel(): Promise<ArrayBuffer> {
  const bytes = await readFile(faceModelPath());
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (digest !== TOUR_FACE_MODEL_SHA256) throw new Error(`Face model sha256 mismatch: ${digest}`);
  return new Uint8Array(bytes).buffer;
}

interface Pending {
  readonly resolve: (reply: YunetWorkerReply) => void;
  readonly reject: (error: Error) => void;
  readonly timer: NodeJS.Timeout;
}

interface Detector {
  readonly worker: Worker;
  readonly pending: Map<number, Pending>;
  ready: Promise<void>;
  nextId: number;
  idle: NodeJS.Timeout | null;
}

let current: Detector | null = null;

/** Ο worker πέθανε ή κόλλησε ⇒ κάθε εκκρεμότητα απορρίπτεται και ο ανιχνευτής ξεχνιέται. */
function fail(detector: Detector, error: Error): void {
  if (current === detector) current = null;
  for (const entry of detector.pending.values()) {
    clearTimeout(entry.timer);
    entry.reject(error);
  }
  detector.pending.clear();
  if (detector.idle !== null) clearTimeout(detector.idle);
  void detector.worker.terminate();
}

/** Χωρίς εκκρεμότητες ο worker δεν κρατά ζωντανή τη διεργασία, και τερματίζεται μετά από αδράνεια. */
function settle(detector: Detector): void {
  if (detector.pending.size > 0) return;
  detector.worker.unref();
  detector.idle = setTimeout(() => fail(detector, new Error('Face detector idle')), IDLE_MS);
  detector.idle.unref();
}

function request(detector: Detector, message: YunetWorkerRequest, transfer: readonly ArrayBuffer[]): Promise<YunetWorkerReply> {
  const id = detector.nextId++;
  if (detector.idle !== null) clearTimeout(detector.idle);
  detector.idle = null;
  detector.worker.ref();
  return new Promise<YunetWorkerReply>((resolve, reject) => {
    const timer = setTimeout(() => fail(detector, new Error('Face detector timed out')), RUN_TIMEOUT_MS);
    detector.pending.set(id, { resolve, reject, timer });
    detector.worker.postMessage({ ...message, id }, [...transfer]);
  });
}

function onReply(detector: Detector, reply: YunetWorkerReply): void {
  const entry = detector.pending.get(reply.id);
  if (entry === undefined) return;
  detector.pending.delete(reply.id);
  clearTimeout(entry.timer);
  if (reply.ok) entry.resolve(reply);
  else entry.reject(new Error(`Face detector: ${reply.error}`));
  settle(detector);
}

function spawn(model: Promise<ArrayBuffer>): Detector {
  const worker = new Worker(YUNET_WORKER_SOURCE, { eval: true });
  const detector: Detector = { worker, pending: new Map(), ready: Promise.resolve(), nextId: 1, idle: null };
  worker.on('message', (reply: YunetWorkerReply) => onReply(detector, reply));
  worker.on('error', (error: Error) => fail(detector, error));
  worker.on('exit', (code) => fail(detector, new Error(`Face detector exited (${code})`)));
  detector.ready = model.then((bytes) => request(detector, { kind: 'load', model: bytes }, [bytes])).then(() => undefined);
  detector.ready.catch((error: unknown) => fail(detector, error instanceof Error ? error : new Error(String(error))));
  return detector;
}

/** Ο ανιχνευτής της διεργασίας — τεμπέλικα· αποτυχία φόρτωσης ⇒ ξεχνιέται, ώστε η επόμενη λήψη να ξαναδοκιμάσει. */
async function faceDetector(): Promise<Detector> {
  const detector = current ?? (current = spawn(verifiedModel()));
  await detector.ready;
  return detector;
}

/** **Μία εκτέλεση** του ανιχνευτή πάνω σε ένα blob. ⚠️ Το `input.data` **μεταφέρεται** στον worker (δεν χρησιμοποιείται ξανά). */
export async function runFaceDetector(input: YunetInput): Promise<YunetOutputs> {
  const detector = await faceDetector();
  const reply = await request(detector, { kind: 'run', data: input.data.buffer, width: input.width, height: input.height }, [input.data.buffer]);
  if (!reply.ok || reply.outputs === undefined) throw new Error('Face detector returned no outputs');
  return Object.fromEntries(Object.entries(reply.outputs).map(([name, data]) => [name, { data: new Float32Array(data) }]));
}

/** Τερματίζει τον ανιχνευτή τώρα (tests · τέλος εντολής backfill). */
export async function disposeFaceDetector(): Promise<void> {
  const detector = current;
  current = null;
  if (detector !== null) fail(detector, new Error('Face detector disposed'));
}
