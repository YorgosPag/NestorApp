/**
 * @fileoverview ADR-923 §5.15.2 (Θ.2α-3) — **Οι μικρογραφίες ενός φορτωμένου εγγράφου**: μνήμη, ουρά, συγκομιδή.
 * Ένα store ανά έγγραφο (ο κάτοχος είναι το `usePdfThumbnails`)· καμία React εδώ.
 * @module components/file-manager/pdf-thumbnail-store
 *
 * 🔑 **Από το ΙΔΙΟ έγγραφο** (`PdfDocProxy`) — ποτέ δεύτερο `getDocument`: σε έντυπο με άδεια θα ήταν δεύτερη λήψη.
 * 🔑 **Συγκομιδή μηδενικού κόστους** (`offerRendered`, το `setImage` του pdf.js): κάθε σελίδα που ζωγράφισε ήδη ο κύριος
 *    καμβάς γίνεται μικρογραφία με σμίκρυνση — κανένα byte, καμία απόδοση. Όποια σελίδα είδε ο αναγνώστης δεν ξαναζητείται.
 * 🔑 **Φρένο δικτύου** (`request`): μόνο ό,τι ζητά η ορατή λωρίδα, το πολύ {@link THUMB_CONCURRENCY} ταυτόχρονα, και ό,τι
 *    βγήκε εκτός **ακυρώνεται** (το `cancel()` της απόδοσης) — σε γρήγορη κύλιση 300 σελίδων δεν κατεβαίνουν 300 σελίδες.
 * 🔑 Απόδοση στο 2× του στόχου και σταδιακή υποδιπλασίαση (pdf.js `#reduceImage`): καθαρό κείμενο σε μικρό μέγεθος.
 * 🔑 Κλειδί = (σελίδα, στροφή): η στροφή αλλάζει την εικόνα, όχι τη σελίδα.
 */

import { createExternalStore, type ExternalStore } from '@/lib/state/createExternalStore';

import type { PdfDocProxy, PdfPageProxy } from './pdf-canvas-config';

/** Πλάτος μικρογραφίας σε CSS px — ένα για τη λίστα και για την ανάλυση της εικόνας. */
export const THUMB_CSS_WIDTH = 120;
export const THUMB_CONCURRENCY = 2;
/** Ανώτατο dpr μικρογραφίας: πάνω από 2 δεν φαίνεται διαφορά σε 120 px, κοστίζει μνήμη. */
const THUMB_MAX_DPR = 2;

export interface PdfThumbnail {
  readonly url: string;
  /** Λόγος ύψους/πλάτους της εικόνας **όπως φαίνεται** (με τη στροφή). */
  readonly aspect: number;
}

type RenderTask = { cancel(): void; promise: Promise<void> };
/** Μία εκτέλεση — η **ταυτότητα** της, ώστε μια ακυρωμένη που τελειώνει αργότερα να μη σβήσει τη νεότερη του ίδιου κλειδιού. */
interface ThumbRun { task: RenderTask | null }

const keyOf = (page: number, rotation: number): string => `${page}:${rotation}`;

function thumbPixelWidth(): number {
  const dpr = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, THUMB_MAX_DPR);
  return Math.round(THUMB_CSS_WIDTH * dpr);
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  return canvas;
}

/** Σταδιακή υποδιπλασίαση ως το 2× και τελικό σχέδιο στο πλάτος στόχου (πιο καθαρό από ένα άλμα). */
export function reduceToWidth(source: HTMLCanvasElement, targetWidth: number): HTMLCanvasElement {
  let current = source;
  while (current.width > targetWidth * 2) {
    const half = createCanvas(Math.ceil(current.width / 2), Math.ceil(current.height / 2));
    half.getContext('2d')?.drawImage(current, 0, 0, half.width, half.height);
    current = half;
  }
  const out = createCanvas(targetWidth, Math.round((current.height * targetWidth) / current.width));
  const ctx = out.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff'; // χαρτί, όχι θέμα — η σελίδα PDF είναι λευκή και στο σκοτεινό
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(current, 0, 0, out.width, out.height);
  }
  return out;
}

function toBlobUrl(canvas: HTMLCanvasElement): Promise<string | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : null), 'image/png');
  });
}

async function renderPage(page: PdfPageProxy, rotation: number, track: (task: RenderTask) => void): Promise<HTMLCanvasElement> {
  const base = page.getViewport({ scale: 1, rotation });
  const target = thumbPixelWidth();
  const viewport = page.getViewport({ scale: (target * 2) / base.width, rotation });
  const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D context');
  const task = page.render({ canvasContext: ctx, viewport });
  track(task);
  await task.promise;
  return reduceToWidth(canvas, target);
}

export interface PdfThumbnailStore {
  get(page: number, rotation: number): PdfThumbnail | null;
  /** Σήμα έκδοσης (`useSyncExternalStore`): αυξάνει σε κάθε νέα μικρογραφία. */
  readonly version: () => number;
  readonly subscribe: (listener: () => void) => () => void;
  /** Ο κύριος καμβάς μόλις ζωγράφισε αυτή τη σελίδα — συγκομιδή χωρίς δίκτυο. */
  offerRendered(page: number, rotation: number, canvas: HTMLCanvasElement): void;
  /** Οι σελίδες που φαίνονται τώρα, με σειρά προτεραιότητας· ό,τι λείπει από εδώ ακυρώνεται. */
  request(pages: readonly number[], rotation: number): void;
  dispose(): void;
}

interface StoreState {
  readonly cache: Map<string, PdfThumbnail>;
  readonly running: Map<string, ThumbRun>;
  /** Το ΕΝΑ pub/sub της εφαρμογής (`createExternalStore`, SSoT) — εδώ ως μετρητής έκδοσης. */
  readonly signal: ExternalStore<number>;
  wanted: readonly string[];
  disposed: boolean;
}

function storeState(): StoreState {
  return { cache: new Map(), running: new Map(), signal: createExternalStore(0), wanted: [], disposed: false };
}

function remember(state: StoreState, key: string, canvas: HTMLCanvasElement): Promise<void> {
  return toBlobUrl(canvas).then((url) => {
    if (!url) return;
    if (state.disposed || state.cache.has(key)) { URL.revokeObjectURL(url); return; }
    state.cache.set(key, { url, aspect: canvas.height / canvas.width });
    state.signal.set(state.signal.get() + 1);
  });
}

/** Ξεκινά όσες αποδόσεις χωρούν, με τη σειρά του `wanted`. */
function pump(state: StoreState, doc: PdfDocProxy): void {
  for (const key of state.wanted) {
    if (state.running.size >= THUMB_CONCURRENCY) return;
    if (!state.cache.has(key) && !state.running.has(key)) start(state, doc, key);
  }
}

function start(state: StoreState, doc: PdfDocProxy, key: string): void {
  const [page, rotation] = key.split(':').map(Number);
  const run: ThumbRun = { task: null };
  const live = () => !state.disposed && state.running.get(key) === run;
  state.running.set(key, run);
  doc.getPage(page)
    .then((proxy) => {
      if (!live()) throw new Error('Rendering cancelled');
      return renderPage(proxy, rotation, (task) => { run.task = task; });
    })
    .then((canvas) => (live() ? remember(state, key, canvas) : undefined))
    .catch(() => undefined) // μία μικρογραφία που αποτυγχάνει μένει placeholder — ποτέ σφάλμα του θεατή
    .finally(() => {
      if (state.running.get(key) === run) state.running.delete(key);
      if (!state.disposed) pump(state, doc);
    });
}

export function createPdfThumbnailStore(doc: PdfDocProxy): PdfThumbnailStore {
  const state = storeState();
  return {
    get: (page, rotation) => state.cache.get(keyOf(page, rotation)) ?? null,
    version: state.signal.get,
    subscribe: state.signal.subscribe,
    offerRendered(page, rotation, canvas) {
      const key = keyOf(page, rotation);
      // Μόνο σμίκρυνση (pdf.js `setImage`): bitmap μικρότερο από τη μικρογραφία θα έβγαινε θολό — τότε αποδίδεται κανονικά.
      if (state.disposed || state.cache.has(key) || canvas.width < thumbPixelWidth()) return;
      void remember(state, key, reduceToWidth(canvas, thumbPixelWidth()));
    },
    request(pages, rotation) {
      if (state.disposed) return;
      state.wanted = pages.map((page) => keyOf(page, rotation));
      const keep = new Set(state.wanted);
      state.running.forEach((run, key) => {
        if (keep.has(key)) return;
        run.task?.cancel();
        state.running.delete(key);
      });
      pump(state, doc);
    },
    dispose() {
      state.disposed = true;
      state.running.forEach((run) => run.task?.cancel());
      state.running.clear();
      state.cache.forEach((thumb) => URL.revokeObjectURL(thumb.url));
      state.cache.clear();
      state.signal.reset(0);
    },
  };
}
