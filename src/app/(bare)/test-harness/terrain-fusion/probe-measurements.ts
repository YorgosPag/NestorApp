/**
 * ADR-920 §14.12 Β0 — τα όργανα των μετρήσεων (α)–(στ). Κάθε συνάρτηση **παράγει αριθμούς**· δεν κρίνει.
 *
 * ⚠️ Ό,τι δεν μετριέται από κώδικα το γράφει ρητά ως `null` — ποτέ τιμή που μοιάζει με μέτρηση (π.χ. η μνήμη GPU των
 * πλακιδίων δεν φαίνεται στο `performance.memory`).
 */

import type { Map as MapLibreMap } from 'maplibre-gl';

import { pointInPolygon } from '@/lib/geometry/planar-polygon';

import { fusedHeightAt } from './fusion-compose';
import { readBitmapPixels } from './fusion-host';
import { summarize, tileOfLngLat, type LngLat, type NumberSummary } from './fusion-math';
import { askFusion, clearFusionLog, coarseArchive, fusionLog, type FusionLogEntry, type FusionMode } from './fusion-protocol';
import { lngLatOfLocal, PROBE_RING, tinHeightAt, type ProbeSurface } from './synthetic-site';

const IDLE_TIMEOUT_MS = 25_000;

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

interface TileStats {
  readonly requested: number;
  readonly ok: number;
  readonly cancelled: number;
  readonly failed: number;
  readonly byZoom: Readonly<Record<string, number>>;
  readonly byComposition: Readonly<Record<string, number>>;
  readonly wallMs: NumberSummary;
  readonly coarseMs: NumberSummary;
  readonly composeMs: NumberSummary;
  readonly bitmapMs: NumberSummary;
}

function countBy(entries: readonly FusionLogEntry[], keyOf: (entry: FusionLogEntry) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of entries) counts[keyOf(entry)] = (counts[keyOf(entry)] ?? 0) + 1;
  return counts;
}

function numbers(entries: readonly FusionLogEntry[], pick: (entry: FusionLogEntry) => number | null): number[] {
  return entries.map(pick).filter((value): value is number => value !== null);
}

function tileStats(entries: readonly FusionLogEntry[]): TileStats {
  const ok = entries.filter((entry) => entry.outcome === 'ok');
  return {
    requested: entries.length,
    ok: ok.length,
    cancelled: entries.filter((entry) => entry.outcome === 'cancelled').length,
    failed: entries.filter((entry) => entry.outcome === 'failed').length,
    byZoom: countBy(entries, (entry) => `z${entry.tile.z}`),
    byComposition: countBy(ok, (entry) => entry.composition ?? 'unknown'),
    wallMs: summarize(numbers(ok, (entry) => entry.wallMs)),
    coarseMs: summarize(numbers(ok, (entry) => entry.coarseMs)),
    composeMs: summarize(numbers(ok, (entry) => entry.composeMs)),
    bitmapMs: summarize(numbers(ok, (entry) => entry.bitmapMs)),
  };
}

// ── (α) πόσα πλακίδια DEM ζητά κάθε όψη ────────────────────────────────────────────────────────────────────────────

const SWEEP_ZOOMS = [16, 17, 18, 19, 20] as const;
const SWEEP_PITCHES = [0, 60, 80] as const;

interface ViewSample {
  readonly zoom: number;
  readonly pitch: number;
  readonly idled: boolean;
  readonly settleMs: number;
  readonly tiles: TileStats;
  /** Αιτήματα προς το αρχείο υψομέτρου που είδε το **κύριο νήμα** (σκίαση + σύντηξη σε `main`)· του Worker δεν φαίνονται. */
  readonly archiveRequestsMainThread: number;
  readonly archiveBytesMainThread: number;
}

function archiveTraffic(since: number): { readonly requests: number; readonly bytes: number } {
  const { url } = coarseArchive();
  const entries = performance
    .getEntriesByType('resource')
    .filter((entry): entry is PerformanceResourceTiming => entry.name.startsWith(url) && entry.startTime >= since);
  return { requests: entries.length, bytes: entries.reduce((sum, entry) => sum + entry.transferSize, 0) };
}

/** Μία όψη: πρώτα ηρεμεί ο χάρτης, μετά αδειάζει η μνήμη πλακιδίων εδάφους, και μετριέται τι ξαναζητήθηκε. */
async function sampleView(map: MapLibreMap, center: LngLat, zoom: number, pitch: number, reload: () => void): Promise<ViewSample> {
  map.jumpTo({ center: [center.lng, center.lat], zoom, pitch, bearing: 30 });
  await waitForIdle(map);
  clearFusionLog();
  const since = performance.now();
  reload();
  const idled = await waitForIdle(map);
  const traffic = archiveTraffic(since);
  return {
    zoom,
    pitch,
    idled,
    settleMs: Math.round(performance.now() - since),
    tiles: tileStats(fusionLog()),
    archiveRequestsMainThread: traffic.requests,
    archiveBytesMainThread: traffic.bytes,
  };
}

export async function sweepViews(map: MapLibreMap, center: LngLat, reload: () => void): Promise<ViewSample[]> {
  performance.setResourceTimingBufferSize(4000);
  const samples: ViewSample[] = [];
  for (const zoom of SWEEP_ZOOMS) {
    for (const pitch of SWEEP_PITCHES) samples.push(await sampleView(map, center, zoom, pitch, reload));
  }
  return samples;
}

// ── (β) χρόνος ανά πλακίδιο και καρέ σε πτήση ─────────────────────────────────────────────────────────────────────

const FLIGHT_MS = 6000;

interface FlightSample {
  readonly mode: FusionMode;
  readonly durationMs: number;
  readonly frames: number;
  readonly frameMs: NumberSummary;
  /** Καρέ πάνω από 33 ms (κάτω από 30 fps) και πάνω από 50 ms. */
  readonly framesOver33Ms: number;
  readonly framesOver50Ms: number;
  readonly tiles: TileStats;
}

/** Πτήση 6 s (στροφή 180° + ζουμ 17,5 → 19) με **άδεια** μνήμη πλακιδίων εδάφους — η χειρότερη περίπτωση. */
export async function measureFlight(map: MapLibreMap, center: LngLat, mode: FusionMode, reload: () => void): Promise<FlightSample> {
  map.jumpTo({ center: [center.lng, center.lat], zoom: 17.5, pitch: 60, bearing: 0 });
  await waitForIdle(map);
  clearFusionLog();
  reload();
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
    mode,
    durationMs,
    frames: frameMs.length,
    frameMs: summarize(frameMs),
    framesOver33Ms: frameMs.filter((ms) => ms > 33).length,
    framesOver50Ms: frameMs.filter((ms) => ms > 50).length,
    tiles: tileStats(fusionLog()),
  };
}

// ── (γ) πιστότητα των bytes ───────────────────────────────────────────────────────────────────────────────────────

interface BitmapFidelity {
  readonly mode: FusionMode;
  readonly bytes: number;
  /** Bytes που διαβάστηκαν διαφορετικά από ό,τι γράφτηκαν (`createImageBitmap(ImageData)` → καμβάς 2Δ → ανάγνωση). */
  readonly mismatchedBytes: number;
  readonly maxDelta: number;
  readonly composition: string;
}

export async function checkBitmapFidelity(mode: FusionMode, center: LngLat, surface: ProbeSurface): Promise<BitmapFidelity> {
  const reply = await askFusion(mode, {
    kind: 'tile', tile: tileOfLngLat(center, 18), archive: coarseArchive(), surface: surface.spec, keepPixels: true,
  });
  if (reply.kind !== 'tile' || reply.pixels === null) throw new Error('terrain-fusion: fidelity check got no pixels');
  const read = readBitmapPixels(reply.bitmap);
  reply.bitmap.close();
  let mismatchedBytes = 0, maxDelta = 0;
  for (let i = 0; i < read.length; i++) {
    const delta = Math.abs(read[i] - reply.pixels[i]);
    if (delta > 0) { mismatchedBytes++; maxDelta = Math.max(maxDelta, delta); }
  }
  return { mode, bytes: read.length, mismatchedBytes, maxDelta, composition: reply.composition };
}

/** Τοπικά σημεία μέσα στο περίγραμμα, σε πλέγμα `stepM`. */
function interiorPoints(stepM: number): { readonly x: number; readonly y: number }[] {
  const xs = PROBE_RING.map((p) => p.x);
  const ys = PROBE_RING.map((p) => p.y);
  const points: { x: number; y: number }[] = [];
  for (let y = Math.min(...ys); y <= Math.max(...ys); y += stepM) {
    for (let x = Math.min(...xs); x <= Math.max(...xs); x += stepM) if (pointInPolygon({ x, y }, PROBE_RING)) points.push({ x, y });
  }
  return points;
}

interface TerrainQueryCheck {
  readonly exaggeration: number | null;
  readonly points: number;
  readonly unanswered: number;
  /** `queryTerrainElevation − αναμενόμενο ύψος σύντηξης`: μέση τιμή = σταθερή μετατόπιση αναφοράς της MapLibre. */
  readonly meanErrorM: number | null;
  /** Το σφάλμα **αφού αφαιρεθεί** η μέση τιμή — αυτό δείχνει αν τα ύψη πέρασαν σωστά από τη MapLibre. */
  readonly residualM: NumberSummary;
}

/** Ρωτά τη MapLibre τι ύψος έχει το έδαφός της μέσα στο οικόπεδο και το συγκρίνει με το ύψος που γράψαμε. */
export function checkTerrainQuery(map: MapLibreMap, surface: ProbeSurface): TerrainQueryCheck {
  const points = interiorPoints(6);
  const errors: number[] = [];
  for (const local of points) {
    const lngLat = lngLatOfLocal(surface, local);
    const answered = map.queryTerrainElevation([lngLat.lng, lngLat.lat]);
    if (answered !== null) errors.push(answered - fusedHeightAt(lngLat, 0, surface));
  }
  const mean = errors.length === 0 ? null : errors.reduce((sum, value) => sum + value, 0) / errors.length;
  return {
    exaggeration: map.getTerrain()?.exaggeration ?? null,
    points: points.length,
    unanswered: points.length - errors.length,
    meanErrorM: mean === null ? null : Number(mean.toFixed(3)),
    residualM: summarize(mean === null ? [] : errors.map((error) => error - mean)),
  };
}

// ── (δ) η διαφορά στην ακμή ───────────────────────────────────────────────────────────────────────────────────────

interface SeamSample {
  readonly offsetM: number;
  readonly transitionM: number;
  readonly edgePoints: number;
  /** `ύψος συνθετικής επιφάνειας στην ακμή − ύψος χοντρού στο ίδιο σημείο`. Αυτό γεφυρώνει η ζώνη μετάβασης. */
  readonly stepM: NumberSummary;
  readonly coarseMissing: number;
}

function ringPoints(spacingM: number): { readonly x: number; readonly y: number }[] {
  const points: { x: number; y: number }[] = [];
  PROBE_RING.forEach((a, i) => {
    const b = PROBE_RING[(i + 1) % PROBE_RING.length];
    const steps = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / spacingM));
    for (let k = 0; k < steps; k++) points.push({ x: a.x + ((b.x - a.x) * k) / steps, y: a.y + ((b.y - a.y) * k) / steps });
  });
  return points;
}

export async function measureSeam(mode: FusionMode, surface: ProbeSurface): Promise<SeamSample> {
  const locals = ringPoints(4);
  const reply = await askFusion(mode, { kind: 'sample', archive: coarseArchive(), points: locals.map((p) => lngLatOfLocal(surface, p)) });
  if (reply.kind !== 'sample') throw new Error('terrain-fusion: seam check got no samples');
  const steps: number[] = [];
  reply.heights.forEach((coarse, i) => {
    const edge = tinHeightAt(surface.tin, locals[i].x, locals[i].y);
    if (coarse !== null && !Number.isNaN(edge)) steps.push(edge - coarse);
  });
  return {
    offsetM: surface.spec.offsetM,
    transitionM: surface.spec.transitionM,
    edgePoints: locals.length,
    stepM: summarize(steps),
    coarseMissing: reply.heights.filter((height) => height === null).length,
  };
}

/** Το ύψος του χοντρού σε ένα σημείο — για τη βάση της συνθετικής επιφάνειας. `null` ⇒ το αρχείο δεν έχει πλακίδιο εκεί. */
export async function coarseHeightAt(mode: FusionMode, point: LngLat): Promise<number | null> {
  const reply = await askFusion(mode, { kind: 'sample', archive: coarseArchive(), points: [point] });
  return reply.kind === 'sample' ? reply.heights[0] : null;
}

// ── (στ) μνήμη · περιβάλλον ───────────────────────────────────────────────────────────────────────────────────────

/** Σωρός JS σε MB (μόνο Chromium)· `null` αλλού. ⚠️ **Δεν** περιλαμβάνει τη μνήμη GPU των πλακιδίων. */
export function jsHeapMb(): number | null {
  const host: object = performance;
  const memory: unknown = 'memory' in host ? host.memory : null;
  if (typeof memory !== 'object' || memory === null || !('usedJSHeapSize' in memory)) return null;
  const used = memory.usedJSHeapSize;
  return typeof used === 'number' ? Number((used / 1_048_576).toFixed(1)) : null;
}

interface ProbeEnvironment {
  readonly userAgent: string;
  readonly devicePixelRatio: number;
  readonly hardwareConcurrency: number;
  readonly canvasCssPx: readonly [number, number];
  readonly canvasDevicePx: readonly [number, number];
  readonly maplibre: string;
  readonly offscreenCanvas: boolean;
}

export function probeEnvironment(map: MapLibreMap): ProbeEnvironment {
  const canvas = map.getCanvas();
  return {
    userAgent: navigator.userAgent,
    devicePixelRatio: window.devicePixelRatio,
    hardwareConcurrency: navigator.hardwareConcurrency,
    canvasCssPx: [canvas.clientWidth, canvas.clientHeight],
    canvasDevicePx: [canvas.width, canvas.height],
    maplibre: map.version,
    offscreenCanvas: typeof OffscreenCanvas !== 'undefined',
  };
}
