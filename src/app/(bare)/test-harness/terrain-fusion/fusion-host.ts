/**
 * ADR-920 §14.12 Β0 — ο χειριστής του πρωτοτύπου: διαβάζει το χοντρό από το αρχείο PMTiles, ψηφιδώνει, επιστρέφει
 * `ImageBitmap`. Ο **ίδιος** χειριστής τρέχει στον Worker και στο κύριο νήμα — αυτό συγκρίνει η μέτρηση (β).
 *
 * 🔑 **Ποτέ κενή απάντηση**: πλακίδιο που λείπει από το αρχείο (έξω από την επικράτεια) γίνεται επίπεδο 0 m. Κενό/204
 * θα έριχνε το έδαφος της MapLibre στον πρόγονο χαμηλού ζουμ.
 */

import { PMTiles } from 'pmtiles';

import { composeTile, sampleCoarse, type CoarseTile } from './fusion-compose';
import {
  ancestorTile,
  FUSION_TILE_SIZE,
  mercatorXOfLng,
  mercatorYOfLat,
  readTerrarium,
  tileKey,
  tileOfLngLat,
  type LngLat,
  type TileId,
} from './fusion-math';
import { buildProbeSurface, type ProbeSurface, type ProbeSurfaceSpec } from './synthetic-site';

/** Το αρχείο του χοντρού, όπως το δηλώνει το μητρώο (`elevationSource`) — περνά ως δεδομένο και στον Worker. */
export interface CoarseArchive {
  /** `https://…` (χωρίς το σχήμα `pmtiles://`). */
  readonly url: string;
  readonly maxZoom: number;
}

export type FusionRequest =
  | {
      readonly kind: 'tile';
      readonly tile: TileId;
      readonly archive: CoarseArchive;
      readonly surface: ProbeSurfaceSpec | null;
      /** `true` ⇒ η απάντηση φέρει και τα bytes που κωδικοποιήθηκαν, για τον έλεγχο πιστότητας (γ). */
      readonly keepPixels: boolean;
    }
  | { readonly kind: 'sample'; readonly archive: CoarseArchive; readonly points: readonly LngLat[] };

interface FusionTileReply {
  readonly kind: 'tile';
  readonly bitmap: ImageBitmap;
  readonly pixels: Uint8ClampedArray<ArrayBuffer> | null;
  readonly composition: 'fused' | 'coarse' | 'flat';
  readonly measuredPixels: number;
  readonly transitionPixels: number;
  /** Ανάγνωση + αποκωδικοποίηση του χοντρού (0 όταν ήρθε από τη μνήμη). */
  readonly coarseMs: number;
  readonly composeMs: number;
  readonly bitmapMs: number;
}

export type FusionReply =
  | FusionTileReply
  /** Ύψος του χοντρού ανά σημείο· `null` όπου το αρχείο δεν έχει πλακίδιο. */
  | { readonly kind: 'sample'; readonly heights: readonly (number | null)[] };

/** Τα pixels είναι **δεδομένα**, όχι χρώμα: καμία μετατροπή χρωματικού χώρου, κανένας πολλαπλασιασμός με το άλφα. */
const RAW_PIXELS: ImageBitmapOptions = { colorSpaceConversion: 'none', premultiplyAlpha: 'none' };

/** Πόσα αποκωδικοποιημένα χοντρά πλακίδια μένουν στη μνήμη (512² × 4 bytes το καθένα ≈ 1 MB). */
const COARSE_CACHE_ENTRIES = 24;

type Context2d = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

function context2d(width: number, height: number): Context2d {
  if (typeof OffscreenCanvas !== 'undefined') {
    const context = new OffscreenCanvas(width, height).getContext('2d', { willReadFrequently: true });
    if (context !== null) return context;
  }
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (context !== null) return context;
  }
  throw new Error('terrain-fusion: no 2D canvas available to read pixels');
}

/** Τα bytes ενός `ImageBitmap`, όπως τα δίνει ο καμβάς 2Δ. */
export function readBitmapPixels(bitmap: ImageBitmap): Uint8ClampedArray {
  const context = context2d(bitmap.width, bitmap.height);
  context.drawImage(bitmap, 0, 0);
  return context.getImageData(0, 0, bitmap.width, bitmap.height).data;
}

async function decodeCoarse(id: TileId, bytes: ArrayBuffer): Promise<CoarseTile> {
  const bitmap = await createImageBitmap(new Blob([bytes]), RAW_PIXELS);
  const pixels = readBitmapPixels(bitmap);
  const size = bitmap.width;
  bitmap.close();
  const heights = new Float32Array(size * size);
  for (let i = 0; i < heights.length; i++) heights[i] = readTerrarium(pixels[i * 4], pixels[i * 4 + 1], pixels[i * 4 + 2]);
  return { id, size, heights };
}

interface CoarseReader {
  readonly read: (archive: CoarseArchive, id: TileId) => Promise<CoarseTile | null>;
  readonly isCached: (archive: CoarseArchive, id: TileId) => boolean;
}

function createCoarseReader(): CoarseReader {
  const archives = new Map<string, PMTiles>();
  const tiles = new Map<string, Promise<CoarseTile | null>>();
  const keyOf = (archive: CoarseArchive, id: TileId): string => `${archive.url}#${tileKey(id)}`;
  const archiveOf = (url: string): PMTiles => {
    const known = archives.get(url);
    if (known !== undefined) return known;
    const opened = new PMTiles(url);
    archives.set(url, opened);
    return opened;
  };
  const load = async (archive: CoarseArchive, id: TileId): Promise<CoarseTile | null> => {
    const response = await archiveOf(archive.url).getZxy(id.z, id.x, id.y);
    return response === undefined ? null : decodeCoarse(id, response.data);
  };
  return {
    isCached: (archive, id) => tiles.has(keyOf(archive, id)),
    read: (archive, id) => {
      const key = keyOf(archive, id);
      const known = tiles.get(key);
      if (known !== undefined) return known;
      // ⚠️ Αποτυχία ΔΕΝ μένει στη μνήμη: το επόμενο αίτημα ξαναδοκιμάζει το δίκτυο.
      const pending = load(archive, id).catch((error: unknown) => { tiles.delete(key); throw error; });
      tiles.set(key, pending);
      const oldest = tiles.keys().next();
      if (tiles.size > COARSE_CACHE_ENTRIES && oldest.done !== true) tiles.delete(oldest.value);
      return pending;
    },
  };
}

export type FusionHost = (request: FusionRequest) => Promise<FusionReply>;

export function createFusionHost(): FusionHost {
  const reader = createCoarseReader();
  let surface: { readonly key: string; readonly built: ProbeSurface } | null = null;
  const surfaceOf = (spec: ProbeSurfaceSpec | null): ProbeSurface | null => {
    if (spec === null) return null;
    const key = JSON.stringify(spec);
    if (surface?.key !== key) surface = { key, built: buildProbeSurface(spec) };
    return surface.built;
  };

  const answerTile = async (request: Extract<FusionRequest, { kind: 'tile' }>): Promise<FusionTileReply> => {
    const coarseId = ancestorTile(request.tile, request.archive.maxZoom);
    const cached = reader.isCached(request.archive, coarseId);
    const t0 = performance.now();
    const coarse = await reader.read(request.archive, coarseId);
    const t1 = performance.now();
    const composed = composeTile(request.tile, coarse, surfaceOf(request.surface));
    const t2 = performance.now();
    const image = new ImageData(composed.rgba, FUSION_TILE_SIZE, FUSION_TILE_SIZE);
    const bitmap = await createImageBitmap(image, RAW_PIXELS);
    return {
      kind: 'tile',
      bitmap,
      pixels: request.keepPixels ? composed.rgba.slice() : null,
      composition: composed.kind,
      measuredPixels: composed.measuredPixels,
      transitionPixels: composed.transitionPixels,
      coarseMs: cached ? 0 : t1 - t0,
      composeMs: t2 - t1,
      bitmapMs: performance.now() - t2,
    };
  };

  const answerSample = async (request: Extract<FusionRequest, { kind: 'sample' }>): Promise<FusionReply> => {
    const heights: (number | null)[] = [];
    for (const point of request.points) {
      const coarse = await reader.read(request.archive, tileOfLngLat(point, request.archive.maxZoom));
      heights.push(coarse === null ? null : sampleCoarse(coarse, mercatorXOfLng(point.lng), mercatorYOfLat(point.lat)));
    }
    return { kind: 'sample', heights };
  };

  return (request) => (request.kind === 'tile' ? answerTile(request) : answerSample(request));
}
