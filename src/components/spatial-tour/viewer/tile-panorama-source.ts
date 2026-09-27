/**
 * @fileoverview **Η ΠΗΓΗ ΠΛΑΚΙΔΙΩΝ** — η πραγματική υλοποίηση του `TourPanoramaSource`: διαλέγει επίπεδο που χωρά στη συσκευή,
 * κατεβάζει τα πλακίδια του από το `GET …/media/…` (με το κουπόνι-cookie) και τα συνθέτει σε έξι όψεις (ADR-884 Φ2γ · §4.9).
 * @related `lib/spatial-tour/tileset/tour-tileset-layout.ts` (**η** διάταξη — ίδια με τον ψήστη) · `tour-panorama-source.ts`
 *   (η διεπαφή) · `app/api/spatial-tours/[kind]/[subjectId]/media/[...path]/route.ts` (ο σερβιτόρος)
 * @module components/spatial-tour/viewer/tile-panorama-source
 *
 * 🔑 **Προεπισκόπηση πρώτα** (Marzipano `cubeMapPreviewUrl` · Pannellum fallback): **ένα** αίτημα, έξι όψεις 256², ώστε η
 * οθόνη να δείξει τον χώρο αμέσως· τα καθαρά πλακίδια ακολουθούν. Η προεπισκόπηση είναι **βοήθεια**, όχι προϋπόθεση:
 * αποτυχία της δεν ρίχνει τη φόρτωση.
 * 🔑 **Η μπροστινή όψη ζητείται πρώτη** (το κέντρο της λήψης, εκεί που προσγειώνεται συνήθως το βλέμμα) — ο browser
 * εξυπηρετεί με τη σειρά που ζητήθηκαν.
 * 🔑 **Ποτέ υποβάθμιση**: προεπισκόπηση που φτάνει **μετά** τα καθαρά πλακίδια δεν παραδίδεται.
 * 🔑 **Ακύρωση** (`signal`): κάθε `fetch` τη σέβεται — τρία κλικ στη σειρά δεν κατεβάζουν τρία πανοράματα.
 */

import { API_ROUTES } from '@/config/domain-constants';
import { calculateBackoff } from '@/lib/api/api-client-transport';
import {
  TOUR_PREVIEW_FACE_SIZE,
  TOUR_TILE_SIZE,
  levelIndexFor,
  previewRowOf,
  previewSegments,
  tileSegments,
  tilesPerSide,
  tilesetLevels,
} from '@/lib/spatial-tour/tileset/tour-tileset-layout';
import { TOUR_CUBE_FACES, type TourCubeFace } from '@/lib/spatial-tour/viewer/tour-cube-faces';
import type { TourManifestStop } from '@/lib/spatial-tour/tour-manifest-stop';
import type { TourSubject } from '@/types/spatial-tour';

import type { TourCubeFaceImages, TourPanoramaLoadOptions, TourPanoramaSource } from './tour-panorama-source';

/** Ό,τι χρειάζεται από τον browser — ώστε το test να δώσει δικό του, χωρίς δίκτυο και χωρίς καμβά. */
export interface TileSourceRuntime {
  readonly fetchBlob: (url: string, signal: AbortSignal) => Promise<Blob>;
  readonly decode: (blob: Blob, crop?: { readonly x: number; readonly y: number; readonly size: number }) => Promise<ImageBitmap>;
  readonly createFace: (size: number) => { readonly canvas: HTMLCanvasElement; readonly draw: (image: ImageBitmap, x: number, y: number) => void };
}

/** Πόσες φορές ζητείται ένα πλακίδιο: 1 + 2 επαναλήψεις (οι PSV/Marzipano ξαναζητούν το πλακίδιο που χάθηκε). */
export const TILE_FETCH_ATTEMPTS = 3;

export interface TileFetchDeps {
  readonly fetch: typeof fetch;
  /** Η ΙΔΙΑ καθυστέρηση με τον πελάτη του API (`calculateBackoff`) — καμία δεύτερη πολιτική. */
  readonly backoffMs: (attempt: number) => number;
}

function waitOrAbort(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { signal.removeEventListener('abort', onAbort); resolve(); }, ms);
    function onAbort() { clearTimeout(timer); reject(signal.reason); }
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/** `window.fetch` θέλει `this = window` — καλείται μέσα από συνάρτηση, ποτέ ως μέθοδος άλλου αντικειμένου. */
const BROWSER_TILE_FETCH: TileFetchDeps = { fetch: (input, init) => fetch(input, init), backoffMs: calculateBackoff };

/**
 * **Ένα πλακίδιο, με επανάληψη στο παροδικό** (ζωντανή επαλήθευση ADR-884 Φ2δ: `socket hang up` του Storage ⇒ 503 σε ΕΝΑ
 * από 54 πλακίδια ⇒ χανόταν ΟΛΗ η καθαρή εικόνα). Ίδιος κανόνας με `shouldRetry` του πελάτη: δίκτυο/`5xx` ξανά, `4xx`
 * ποτέ (κρίση — π.χ. έληξε το κουπόνι).
 */
export async function fetchTileBlob(url: string, signal: AbortSignal, deps: TileFetchDeps = BROWSER_TILE_FETCH): Promise<Blob> {
  for (let attempt = 1; ; attempt++) {
    let status: number | null = null;
    try {
      const response = await deps.fetch(url, { signal, credentials: 'same-origin' });
      if (response.ok) return await response.blob();
      status = response.status;
    } catch (error: unknown) {
      if (signal.aborted) throw error;
    }
    const transient = status === null || status >= 500;
    if (!transient || attempt >= TILE_FETCH_ATTEMPTS) throw new Error(`tile ${status ?? 'network'}`);
    await waitOrAbort(deps.backoffMs(attempt), signal);
  }
}

function createFace(size: number) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('2d context unavailable');
  return { canvas, draw: (image: ImageBitmap, x: number, y: number) => { context.drawImage(image, x, y); image.close(); } };
}

const BROWSER_RUNTIME: TileSourceRuntime = {
  fetchBlob: (url, signal) => fetchTileBlob(url, signal),
  decode: (blob, crop) => (crop === undefined ? createImageBitmap(blob) : createImageBitmap(blob, crop.x, crop.y, crop.size, crop.size)),
  createFace,
};

/** Η σειρά των όψεων: πρώτα αυτή που κοιτάζει ο θεατής (μπροστά = το κέντρο της λήψης), μετά οι υπόλοιπες. */
function faceOrder(first: TourCubeFace = 'front'): readonly TourCubeFace[] {
  return [first, ...TOUR_CUBE_FACES.filter((face) => face !== first)];
}

/** Η προεπισκόπηση: κάθε όψη κόβεται από τη λωρίδα και **ζωγραφίζεται σε καμβά** — ο ΙΔΙΟΣ δρόμος με τις καθαρές όψεις. */
async function loadPreview(runtime: TileSourceRuntime, url: string, signal: AbortSignal): Promise<TourCubeFaceImages> {
  const blob = await runtime.fetchBlob(url, signal);
  const entries = await Promise.all(TOUR_CUBE_FACES.map(async (face) => {
    const crop = await runtime.decode(blob, { x: 0, y: previewRowOf(face) * TOUR_PREVIEW_FACE_SIZE, size: TOUR_PREVIEW_FACE_SIZE });
    const canvas = runtime.createFace(TOUR_PREVIEW_FACE_SIZE);
    canvas.draw(crop, 0, 0);
    return [face, canvas.canvas] as const;
  }));
  return Object.fromEntries(entries) as Record<TourCubeFace, HTMLCanvasElement>;
}

async function loadFace(runtime: TileSourceRuntime, urlOf: (row: number, col: number) => string, size: number, signal: AbortSignal) {
  const face = runtime.createFace(size);
  const side = tilesPerSide(size);
  const cells = Array.from({ length: side * side }, (_, i) => ({ row: Math.floor(i / side), col: i % side }));
  await Promise.all(cells.map(async ({ row, col }) => {
    const image = await runtime.decode(await runtime.fetchBlob(urlOf(row, col), signal));
    face.draw(image, col * TOUR_TILE_SIZE, row * TOUR_TILE_SIZE);
  }));
  return face.canvas;
}

/** **Η πηγή πλακιδίων μιας περιήγησης** — η ρίζα της (είδος + id αγγελίας) δίνει τη διαδρομή των μέσων. */
export function createTilePanoramaSource(subject: TourSubject, runtime: TileSourceRuntime = BROWSER_RUNTIME): TourPanoramaSource {
  const root = API_ROUTES.SPATIAL_TOURS.MEDIA_ROOT(subject.kind, subject.id);
  const url = (segments: readonly string[]) => `${root}/${segments.map(encodeURIComponent).join('/')}`;
  return {
    async load(stop: TourManifestStop, options: TourPanoramaLoadOptions): Promise<TourCubeFaceImages> {
      const { signal, onPreview } = options;
      let settled = false;
      if (onPreview !== undefined) {
        loadPreview(runtime, url(previewSegments(stop.tilesetHash)), signal).then(
          (preview) => { if (!settled && !signal.aborted) onPreview(preview); },
          () => undefined,
        );
      }
      const level = levelIndexFor(stop.faceSize, options.maxFaceSize);
      const size = tilesetLevels(stop.faceSize)[level];
      const faces: Partial<Record<TourCubeFace, HTMLCanvasElement>> = {};
      await Promise.all(faceOrder().map(async (face) => {
        faces[face] = await loadFace(runtime, (row, col) => url(tileSegments(stop.tilesetHash, level, face, row, col)), size, signal);
      }));
      settled = true;
      return faces as Record<TourCubeFace, HTMLCanvasElement>;
    },
  };
}
