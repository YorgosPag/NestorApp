/**
 * @fileoverview **Η ΠΗΓΗ ΠΛΑΚΙΔΙΩΝ** — η πραγματική υλοποίηση του `TourPanoramaSource`: η **βάση** είναι η προεπισκόπηση
 * (ένα αίτημα, όλη η σφαίρα), και κάθε **πλακίδιο** ζητείται μόνο του, όταν το ζητήσει ο streamer (ADR-884 Φ2γ · Φ2ε ·
 * §4.9 · §4.11). Όλα μέσω `GET …/media/…` με το κουπόνι-cookie.
 * @related `lib/spatial-tour/tileset/tour-tileset-layout.ts` (**η** διάταξη — ίδια με τον ψήστη) · `tour-panorama-source.ts`
 *   (η διεπαφή) · `tour-tile-streamer.ts` (ποια πλακίδια, πότε) · `app/api/spatial-tours/[kind]/[subjectId]/media/[...path]/route.ts`
 * @module components/spatial-tour/viewer/tile-panorama-source
 *
 * 🔑 **Βάση = προεπισκόπηση** (Marzipano `cubeMapPreviewUrl` · Pannellum fallback): έξι όψεις 256² σε **ένα** αίτημα. Αν
 *   αποτύχει, η βάση πέφτει στο επίπεδο 0 (έξι πλακίδια των 512) — ο επισκέπτης δεν μένει ποτέ σε μαύρο εξαιτίας της.
 * 🔑 **Κάθε πλακίδιο περνά από καμβά**, όπως οι όψεις: ποτέ `ImageBitmap` (το three αγνοεί το `flipY` ⇒ ανάποδα, Φ2δ).
 * 🔑 **Κρυφή μνήμη αποκωδικοποιημένων πλακιδίων** (LRU με όριο bytes): η επιστροφή στο προηγούμενο δωμάτιο είναι
 *   ακαριαία, και η προφόρτωση λειτουργεί ακόμη κι όταν ο browser δεν κρατά (`no-store` του dev, `next.config.js`).
 * 🔑 **Ακύρωση** (`signal`): κάθε `fetch` τη σέβεται — ο streamer ακυρώνει ό,τι δεν χρειάζεται πια.
 */

import { API_ROUTES } from '@/config/domain-constants';
import { calculateBackoff } from '@/lib/api/api-client-transport';
import { createBoundedLru } from '@/lib/cache/bounded-lru';
import {
  TOUR_PREVIEW_FACE_SIZE,
  TOUR_TILE_SIZE,
  previewRowOf,
  previewSegments,
  tileSegments,
  tilesetLevels,
} from '@/lib/spatial-tour/tileset/tour-tileset-layout';
import { TOUR_CUBE_FACES, type TourCubeFace } from '@/lib/spatial-tour/viewer/tour-cube-faces';
import type { TourTileAddress } from '@/lib/spatial-tour/viewer/tour-tile-visibility';
import type { TourManifestStop } from '@/lib/spatial-tour/tour-manifest-stop';
import type { TourSubject } from '@/types/spatial-tour';

import type { TourCubeFaceImages, TourFaceImage, TourPanoramaSource, TourTileProvider } from './tour-panorama-source';

/** Ό,τι χρειάζεται από τον browser — ώστε το test να δώσει δικό του, χωρίς δίκτυο και χωρίς καμβά. */
export interface TileSourceRuntime {
  readonly fetchBlob: (url: string, signal: AbortSignal) => Promise<Blob>;
  readonly decode: (blob: Blob, crop?: { readonly x: number; readonly y: number; readonly size: number }) => Promise<ImageBitmap>;
  readonly createFace: (size: number) => { readonly canvas: HTMLCanvasElement; readonly draw: (image: ImageBitmap, x: number, y: number) => void };
}

/** Πόσες φορές ζητείται ένα πλακίδιο: 1 + 2 επαναλήψεις (οι PSV/Marzipano ξαναζητούν το πλακίδιο που χάθηκε). */
export const TILE_FETCH_ATTEMPTS = 3;

/**
 * Όριο της κρυφής μνήμης πλακιδίων: 64 MiB ≈ 64 πλακίδια 512² RGBA — περίπου ένα κάδρο στο ανώτερο επίπεδο και το
 * προηγούμενο δωμάτιο. Πάνω από αυτό φεύγουν τα λιγότερο πρόσφατα.
 */
const TILE_CACHE_MAX_BYTES = 64 * 1024 * 1024;

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

/** Η προεπισκόπηση: κάθε όψη κόβεται από τη λωρίδα και **ζωγραφίζεται σε καμβά** — ο ΙΔΙΟΣ δρόμος με τα πλακίδια. */
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

/** Βάρος ενός αποκωδικοποιημένου πλακιδίου στη μνήμη (RGBA). */
const bytesOf = (image: TourFaceImage) => image.width * image.height * 4;

/** Τα πλακίδια μιας περιήγησης — ένα-ένα, με κρυφή μνήμη και σταθερό κλειδί = η διαδρομή. */
function createTileProvider(runtime: TileSourceRuntime, url: (segments: readonly string[]) => string): TourTileProvider {
  const cache = createBoundedLru<TourFaceImage>({ maxWeight: TILE_CACHE_MAX_BYTES, weigh: bytesOf });
  return {
    levels: (stop) => tilesetLevels(stop.faceSize),
    async tile(stop: TourManifestStop, address: TourTileAddress, signal: AbortSignal): Promise<TourFaceImage> {
      const key = url(tileSegments(stop.tilesetHash, address.level, address.face, address.row, address.col));
      const cached = cache.get(key);
      if (cached !== undefined) return cached;
      const image = await runtime.decode(await runtime.fetchBlob(key, signal));
      const face = runtime.createFace(TOUR_TILE_SIZE);
      face.draw(image, 0, 0);
      cache.set(key, face.canvas);
      return face.canvas;
    },
  };
}

/** Βάση χωρίς προεπισκόπηση: το επίπεδο 0 είναι ένα πλακίδιο ανά όψη — έξι αιτήματα, όλη η σφαίρα στα 512. */
async function baseFromFirstLevel(tiles: TourTileProvider, stop: TourManifestStop, signal: AbortSignal): Promise<TourCubeFaceImages> {
  const entries = await Promise.all(TOUR_CUBE_FACES.map(async (face) => [face, await tiles.tile(stop, { level: 0, face, row: 0, col: 0 }, signal)] as const));
  return Object.fromEntries(entries) as Record<TourCubeFace, TourFaceImage>;
}

/** Όριο της κρυφής μνήμης βάσεων: ~10 στάσεις (έξι όψεις 256² RGBA ≈ 1,5 MiB η καθεμία) — οι γείτονες του σημείου. */
const BASE_CACHE_MAX_BYTES = 16 * 1024 * 1024;

const baseBytes = (faces: TourCubeFaceImages) => TOUR_CUBE_FACES.reduce((sum, face) => sum + bytesOf(faces[face]), 0);

/** **Η πηγή πλακιδίων μιας περιήγησης** — η ρίζα της (είδος + id αγγελίας) δίνει τη διαδρομή των μέσων. */
export function createTilePanoramaSource(subject: TourSubject, runtime: TileSourceRuntime = BROWSER_RUNTIME): TourPanoramaSource {
  const root = API_ROUTES.SPATIAL_TOURS.MEDIA_ROOT(subject.kind, subject.id);
  const url = (segments: readonly string[]) => `${root}/${segments.map(encodeURIComponent).join('/')}`;
  const tiles = createTileProvider(runtime, url);
  // Η βάση που προφόρτωσε ο streamer για έναν γείτονα είναι ΑΥΤΗ που θα δει η άφιξη — ένα αίτημα, όχι δύο.
  const bases = createBoundedLru<TourCubeFaceImages>({ maxWeight: BASE_CACHE_MAX_BYTES, weigh: baseBytes });
  async function loadBase(stop: TourManifestStop, signal: AbortSignal): Promise<TourCubeFaceImages> {
    try {
      return await loadPreview(runtime, url(previewSegments(stop.tilesetHash)), signal);
    } catch (error: unknown) {
      if (signal.aborted) throw error;
      return baseFromFirstLevel(tiles, stop, signal);
    }
  }
  return {
    tiles,
    async base(stop: TourManifestStop, signal: AbortSignal): Promise<TourCubeFaceImages> {
      const cached = bases.get(stop.tilesetHash);
      if (cached !== undefined) return cached;
      const faces = await loadBase(stop, signal);
      bases.set(stop.tilesetHash, faces);
      return faces;
    },
  };
}
