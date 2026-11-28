/**
 * ADR-920 §14.12 Β4 — τα όργανα των μετρήσεων, πάνω στο **πρωτόκολλο της παραγωγής**. Κάθε συνάρτηση παράγει αριθμούς·
 * δεν κρίνει.
 *
 * ⚠️ Ό,τι δεν μετριέται από κώδικα το γράφει ρητά ως `null` — ποτέ τιμή που μοιάζει με μέτρηση (π.χ. η μνήμη GPU των
 * πλακιδίων δεν φαίνεται στο `performance.memory`).
 */

import type { Map as MapLibreMap } from 'maplibre-gl';

import {
  elevationFusionCoarseArchive,
  fusedElevationsAt,
  isElevationFusionSupported,
  setElevationFusionTileObserver,
  type ElevationFusionTileEvent,
} from '@/lib/terrain/elevation-fusion/fusion-tile-protocol';
import { groundVerdictAt, type TerrainFusionSurface } from '@/lib/terrain/elevation-fusion/terrain-fusion-surface';
import type { GeoPoint } from '@/types/geo/coordinates';

const IDLE_TIMEOUT_MS = 25_000;

// ── στατιστικά ────────────────────────────────────────────────────────────────────────────────────────────────────

/** Ποσοστημόριο ταξινομημένου πίνακα (πλησιέστερη θέση). Κενός πίνακας ⇒ `null`. */
function quantile(sortedAscending: readonly number[], q: number): number | null {
  if (sortedAscending.length === 0) return null;
  const index = Math.min(sortedAscending.length - 1, Math.max(0, Math.round(q * (sortedAscending.length - 1))));
  return sortedAscending[index];
}

interface NumberSummary {
  readonly count: number;
  readonly min: number | null;
  readonly p50: number | null;
  readonly p95: number | null;
  readonly max: number | null;
  readonly mean: number | null;
}

function summarize(values: readonly number[]): NumberSummary {
  const sorted = [...values].sort((a, b) => a - b);
  const round = (value: number | null): number | null => (value === null ? null : Number(value.toFixed(3)));
  const mean = sorted.length === 0 ? null : sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  return {
    count: sorted.length,
    min: round(quantile(sorted, 0)),
    p50: round(quantile(sorted, 0.5)),
    p95: round(quantile(sorted, 0.95)),
    max: round(quantile(sorted, 1)),
    mean: round(mean),
  };
}

// ── το ημερολόγιο πλακιδίων ───────────────────────────────────────────────────────────────────────────────────────

let log: ElevationFusionTileEvent[] = [];
let listening = false;

/** Αρχίζει να γράφει κάθε αίτημα πλακιδίου του πρωτοκόλλου (μία φορά ανά σελίδα). */
export function startTileLog(): void {
  if (listening) return;
  listening = true;
  setElevationFusionTileObserver((event) => { log.push(event); });
}

type Answered = ElevationFusionTileEvent & { readonly answer: NonNullable<ElevationFusionTileEvent['answer']> };

/** Τι είδους πλακίδιο ήταν, από τα pixels του: μόνο χοντρό · όλο μετρημένο · ανάμεικτο (μέτρηση ή/και ζώνη). */
function compositionOf({ answer }: Answered): 'coarse-only' | 'all-measured' | 'mixed' {
  const { measured, interpolated, indicative, none } = answer.pixels;
  if (measured === 0 && interpolated === 0) return 'coarse-only';
  return interpolated === 0 && indicative === 0 && none === 0 ? 'all-measured' : 'mixed';
}

function countBy<T>(entries: readonly T[], keyOf: (entry: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of entries) counts[keyOf(entry)] = (counts[keyOf(entry)] ?? 0) + 1;
  return counts;
}

function timings(entries: readonly Answered[]) {
  const composed = entries.filter((entry) => !entry.answer.fromMemory);
  return {
    count: entries.length,
    wallMs: summarize(entries.map((entry) => entry.wallMs)),
    coarseMs: summarize(composed.map((entry) => entry.answer.timing.coarseMs)),
    composeMs: summarize(composed.map((entry) => entry.answer.timing.composeMs)),
    encodeMs: summarize(entries.map((entry) => entry.answer.timing.encodeMs)),
  };
}

function tileStats(entries: readonly ElevationFusionTileEvent[]) {
  const ok = entries.filter((entry): entry is Answered => entry.answer !== null);
  const sum = (pick: (entry: Answered) => number): number => ok.reduce((total, entry) => total + pick(entry), 0);
  return {
    requested: entries.length,
    ok: ok.length,
    cancelled: entries.filter((entry) => entry.outcome === 'cancelled').length,
    failed: entries.filter((entry) => entry.outcome === 'failed').length,
    errors: countBy(entries.filter((entry) => entry.error !== null), (entry) => entry.error ?? ''),
    byZoom: countBy(entries, (entry) => `z${entry.tile.z}`),
    byThread: countBy(ok, (entry) => entry.answer.thread),
    fromMemory: ok.filter((entry) => entry.answer.fromMemory).length,
    /** Χοντρά πλακίδια που διαβάστηκαν: από το δίκτυο · από λήψη άλλου πλακιδίου · από τη μνήμη. */
    coarseTiles: {
      network: sum((entry) => entry.answer.coarse.network),
      shared: sum((entry) => entry.answer.coarse.shared),
      memory: sum((entry) => entry.answer.coarse.memory),
    },
    all: timings(ok),
    coarseOnly: timings(ok.filter((entry) => compositionOf(entry) === 'coarse-only')),
    allMeasured: timings(ok.filter((entry) => compositionOf(entry) === 'all-measured')),
    mixed: timings(ok.filter((entry) => compositionOf(entry) === 'mixed')),
  };
}

// ── όψεις ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Περιμένει το `idle` του χάρτη. `false` ⇒ έληξε ο χρόνος (η μέτρηση το γράφει, δεν το κρύβει). */
export function waitForIdle(map: MapLibreMap, timeoutMs: number = IDLE_TIMEOUT_MS): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    void map.once('idle', () => { clearTimeout(timer); resolve(true); });
  });
}

function nextFrame(): Promise<number> {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

const SWEEP_ZOOMS = [16, 17, 18, 19, 20] as const;
const SWEEP_PITCHES = [0, 60, 80] as const;

/** Αιτήματα προς το αρχείο υψομέτρου που είδε το **κύριο νήμα** (η σκίαση· η σύντηξη μόνο όταν τρέχει στο δίχτυ). */
function archiveTrafficMainThread(since: number): { readonly requests: number; readonly bytes: number } {
  const { url } = elevationFusionCoarseArchive();
  const entries = performance
    .getEntriesByType('resource')
    .filter((entry): entry is PerformanceResourceTiming => entry.name.startsWith(url) && entry.startTime >= since);
  return { requests: entries.length, bytes: entries.reduce((total, entry) => total + entry.transferSize, 0) };
}

/** Μία όψη: πρώτα ηρεμεί ο χάρτης, μετά η επιφάνεια ξαναδίνεται ως νέα (άδεια μνήμη), και μετριέται τι ζητήθηκε. */
async function sampleView(map: MapLibreMap, center: GeoPoint, zoom: number, pitch: number, renew: () => void) {
  map.jumpTo({ center: [center.lng, center.lat], zoom, pitch, bearing: 30 });
  await waitForIdle(map);
  log = [];
  const since = performance.now();
  renew();
  const idled = await waitForIdle(map);
  return {
    zoom,
    pitch,
    idled,
    settleMs: Math.round(performance.now() - since),
    tiles: tileStats(log),
    archiveMainThread: archiveTrafficMainThread(since),
  };
}

/** (α) Πόσα πλακίδια ζητά κάθε όψη, και τι κόστισε το καθένα. */
export async function sweepViews(map: MapLibreMap, center: GeoPoint, renew: () => void): Promise<unknown[]> {
  performance.setResourceTimingBufferSize(4000);
  const samples: unknown[] = [];
  for (const zoom of SWEEP_ZOOMS) {
    for (const pitch of SWEEP_PITCHES) samples.push(await sampleView(map, center, zoom, pitch, renew));
  }
  return samples;
}

const FLIGHT_MS = 6000;

/** (β) Πτήση 6 s (στροφή 180° + ζουμ 17,5 → 19) με **άδεια** μνήμη πλακιδίων — η χειρότερη περίπτωση. */
export async function measureFlight(map: MapLibreMap, center: GeoPoint, renew: () => void): Promise<unknown> {
  map.jumpTo({ center: [center.lng, center.lat], zoom: 17.5, pitch: 60, bearing: 0 });
  await waitForIdle(map);
  log = [];
  renew();
  let moving = true;
  void map.once('moveend', () => { moving = false; });
  const startedAt = performance.now();
  map.easeTo({ bearing: 180, zoom: 19, duration: FLIGHT_MS, easing: (t) => t });
  const frameMs: number[] = [];
  let previous = await nextFrame();
  while (moving && performance.now() - startedAt < FLIGHT_MS * 3) {
    const now = await nextFrame();
    frameMs.push(now - previous);
    previous = now;
  }
  const durationMs = Math.round(performance.now() - startedAt);
  await waitForIdle(map);
  return {
    durationMs,
    frames: frameMs.length,
    frameMs: summarize(frameMs),
    framesOver33Ms: frameMs.filter((ms) => ms > 33).length,
    framesOver50Ms: frameMs.filter((ms) => ms > 50).length,
    tiles: tileStats(log),
  };
}

// ── (γ) τα ύψη που ζωγραφίζει ο χάρτης έναντι της συνάρτησης ύψους ───────────────────────────────────────────────

const INTERIOR_STEP_M = 6;

/** Σημεία του πλαισίου πάνω σε μετρημένο έδαφος, σε πλέγμα. */
function measuredPoints(surface: TerrainFusionSurface): GeoPoint[] {
  const { reach } = surface;
  const points: GeoPoint[] = [];
  for (let y = reach.minY; y <= reach.maxY; y += INTERIOR_STEP_M) {
    for (let x = reach.minX; x <= reach.maxX; x += INTERIOR_STEP_M) {
      if (groundVerdictAt(surface, x, y).kind === 'measured') points.push(surface.placement.toGeo(x, y));
    }
  }
  return points;
}

/**
 * Ρωτά τη MapLibre τι ύψος έχει το έδαφός της πάνω στο μετρημένο και το συγκρίνει με το `fusedElevationAt` (ακριβής
 * δρόμος, μέσω του πρωτοκόλλου). Η διαφορά περιέχει τη διγραμμική ανάγνωση της MapLibre ανάμεσα στα pixels.
 */
export async function checkTerrainQuery(map: MapLibreMap, surface: TerrainFusionSurface, surfaceKey: string): Promise<unknown> {
  const points = measuredPoints(surface);
  const expected = await fusedElevationsAt(surfaceKey, points);
  const errors: number[] = [];
  points.forEach((point, i) => {
    const answered = map.queryTerrainElevation([point.lng, point.lat]);
    if (answered !== null) errors.push(answered - expected[i].elevationM);
  });
  const mean = errors.length === 0 ? null : errors.reduce((total, value) => total + value, 0) / errors.length;
  return {
    exaggeration: map.getTerrain()?.exaggeration ?? null,
    points: points.length,
    unanswered: points.length - errors.length,
    provenances: countBy(expected, (elevation) => elevation.provenance),
    meanErrorM: mean === null ? null : Number(mean.toFixed(3)),
    errorM: summarize(errors),
  };
}

// ── (δ) η διαφορά στο χείλος ──────────────────────────────────────────────────────────────────────────────────────

/** `ύψος του χείλους − ύψος του χοντρού στο ίδιο σημείο`, στο μέσο κάθε ακμής του χείλους. Αυτό γεφυρώνει η ζώνη. */
export async function measureSeam(surface: TerrainFusionSurface): Promise<unknown> {
  const middles = surface.rim.map(({ a, b, za, zb }) => ({
    point: surface.placement.toGeo((a.x + b.x) / 2, (a.y + b.y) / 2),
    rimM: (za + zb) / 2,
  }));
  const coarse = await fusedElevationsAt(null, middles.map((middle) => middle.point));
  const steps: number[] = [];
  coarse.forEach((elevation, i) => {
    if (elevation.provenance !== 'none') steps.push(middles[i].rimM - elevation.elevationM);
  });
  return { transitionM: surface.transitionM, rimEdges: middles.length, coarseMissing: middles.length - steps.length, stepM: summarize(steps) };
}

/** Το ύψος του χοντρού σε ένα σημείο — η βάση της συνθετικής επιφάνειας. `null` ⇒ το αρχείο δεν έχει πλακίδιο εκεί. */
export async function coarseHeightAt(point: GeoPoint): Promise<number | null> {
  const [elevation] = await fusedElevationsAt(null, [point]);
  return elevation.provenance === 'none' ? null : elevation.elevationM;
}

// ── (στ) μνήμη · περιβάλλον ───────────────────────────────────────────────────────────────────────────────────────

/** Σωρός JS σε MB (μόνο Chromium)· `null` αλλού. ⚠️ **Δεν** περιλαμβάνει τη μνήμη GPU των πλακιδίων ούτε τον Worker. */
export function jsHeapMb(): number | null {
  const host: object = performance;
  const memory: unknown = 'memory' in host ? host.memory : null;
  if (typeof memory !== 'object' || memory === null || !('usedJSHeapSize' in memory)) return null;
  const used = memory.usedJSHeapSize;
  return typeof used === 'number' ? Number((used / 1_048_576).toFixed(1)) : null;
}

export function probeEnvironment(map: MapLibreMap): unknown {
  const canvas = map.getCanvas();
  return {
    userAgent: navigator.userAgent,
    devicePixelRatio: window.devicePixelRatio,
    hardwareConcurrency: navigator.hardwareConcurrency,
    canvasCssPx: [canvas.clientWidth, canvas.clientHeight],
    canvasDevicePx: [canvas.width, canvas.height],
    maplibre: map.version,
    offscreenCanvas: typeof OffscreenCanvas !== 'undefined',
    fusionSupported: isElevationFusionSupported(),
  };
}
