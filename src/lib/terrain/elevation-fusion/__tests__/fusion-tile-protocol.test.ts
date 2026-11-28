/**
 * @jest-environment node
 *
 * ADR-920 §14.12 Β4 — το πρωτόκολλο `terrain-fusion://`: αναγνώστης χοντρού · χειριστής · πλευρά κύριου νήματος, δεμένα
 * όπως στην παραγωγή αλλά χωρίς Worker, δίκτυο και καμβά: το «αρχείο» είναι πίνακας από τύπο, η «εικόνα» είναι τα ίδια
 * τα bytes, και ο πελάτης καλεί τον χειριστή επί τόπου.
 *
 * Η άγκυρα: τα bytes που δίνει το πρωτόκολλο είναι **ακριβώς** εκείνα του `composeFusedElevationTile` με ΟΛΗ τη γειτονιά
 * του χοντρού — το πρωτόκολλο δεν αποφασίζει τίποτα για το ύψος.
 */

import { TimeoutError } from '@/lib/async-utils';
import type { ArchiveTileAddress } from '@/lib/geo/osm/osm-archive-tile';
import { elevationFusionTileTemplate } from '@/lib/maps/basemap-catalog';
import { buildListingTerrainSnapshot } from '@/lib/terrain/publication/listing-terrain-snapshot';
import type { ListingTerrainSnapshot } from '@/lib/terrain/publication/listing-terrain-types';
import type { TopoPoint } from '@/lib/terrain/terrain-types';
import type { WorkerRpcCancellableResult } from '@/lib/workers/worker-rpc-protocol';

import { coarseFieldOf, coarseNeighbourhoodOf, coarsePrimaryFor } from '../coarse-elevation-field';
import { createFusionCoarseReader, type CoarseArchiveRef, type CoarseTileHeights, type CoarseTileLoad } from '../fusion-coarse-reader';
import { createFusionTileHost, type FusionTileHandler, type FusionTileReply, type FusionTileRequest } from '../fusion-tile-host';
import { createElevationFusionProtocol, type ElevationFusionProtocol, type ElevationFusionTileEvent } from '../fusion-tile-protocol';
import { fusionPointOf } from '../terrain-fused-elevation';
import { terrainFusionSurfaceOf } from '../terrain-fusion-surface';
import { composeFusedElevationTile } from '../terrain-fusion-tile';

// Το φύλλο με το `import.meta.url` δεν φορτώνεται χωρίς bundler· εδώ δεν γεννιέται Worker.
jest.mock('../fusion-tile-worker-spawn', () => ({ spawnFusionTileWorker: () => null }));

const PX = 8;
const ARCHIVE: CoarseArchiveRef = { url: 'https://tiles.test/elevation.pmtiles', maxZoom: 12, tileSizePx: PX };
const WIDTH_M = 30;
const E0_M = 476_000;
const N0_M = 4_202_000;

/** Αποτύπωση 20 × 20 m στην Αττική, σημεία ανά 2 m, πάνω σε επίπεδο. */
function survey(): ListingTerrainSnapshot {
  const points: TopoPoint[] = [];
  for (let x = -10; x <= 10; x += 2) {
    for (let y = -10; y <= 10; y += 2) {
      points.push({ x: (E0_M + x) * 1000, y: (N0_M + y) * 1000, z: Math.round((100 + 0.1 * x + 0.05 * y) * 1000) });
    }
  }
  const built = buildListingTerrainSnapshot({ points, boundaryWorldMm: null, envelope: null, georeference: { coordinateSystem: 'EPSG:2100' } });
  if (!built.ok) throw new Error(`expected a snapshot, got ${built.reason}`);
  return built.snapshot;
}

const SNAPSHOT = survey();
const SURFACE = terrainFusionSurfaceOf(SNAPSHOT, WIDTH_M);
if (SURFACE === null) throw new Error('expected a fusion surface');
const CENTRE = fusionPointOf(SURFACE.placement.centre);

const tileAt = (z: number): ArchiveTileAddress => ({ z, x: Math.floor(CENTRE.u * 2 ** z), y: Math.floor(CENTRE.v * 2 ** z) });

/** Το χοντρό ως τύπος του παγκόσμιου pixel: διαφορετικό σε κάθε πλακίδιο, ώστε ένας γείτονας που λείπει να φαίνεται. */
function coarseHeights({ z, x, y }: ArchiveTileAddress): Float32Array {
  void z;
  return Float32Array.from({ length: PX * PX }, (_, i) => 300 + 0.25 * (x * PX + (i % PX)) - 0.125 * (y * PX + Math.floor(i / PX)));
}

interface RigState {
  /** Κάθε αίτημα που έφτασε στον χειριστή, με τη σειρά. */
  readonly requests: FusionTileRequest[];
  /** Κάθε φόρτωση του «αρχείου». */
  readonly loads: string[];
  readonly events: ElevationFusionTileEvent[];
  /** Οι επόμενες τόσες φορτώσεις του «αρχείου» αποτυγχάνουν. */
  failures: number;
}

interface Rig extends RigState {
  readonly protocol: ElevationFusionProtocol<Uint8ClampedArray>;
  readonly host: FusionTileHandler<Uint8ClampedArray>;
}

function createRig(heightsOf: (address: ArchiveTileAddress) => CoarseTileHeights = coarseHeights): Rig {
  const rig: RigState = { requests: [], loads: [], events: [], failures: 0 };
  const load: CoarseTileLoad = async (_archive, address) => {
    rig.loads.push(`${address.z}/${address.x}/${address.y}`);
    if (rig.failures > 0) { rig.failures--; throw new Error('network down'); }
    return heightsOf(address);
  };
  const host = createFusionTileHost<Uint8ClampedArray>({
    reader: createFusionCoarseReader({ load, maxBytes: 64 * PX * PX * 4, timeoutMs: 1_000 }),
    encode: async (rgba) => rgba.slice(),
    tileCacheBytes: 64 * PX * PX * 4,
    thread: 'main',
    now: () => 0,
  });
  const never = new AbortController().signal;
  const run = async (body: FusionTileRequest, { signal = never }: { readonly signal?: AbortSignal }): Promise<WorkerRpcCancellableResult<FusionTileReply<Uint8ClampedArray>>> => {
    rig.requests.push(body);
    if (signal.aborted) return { kind: 'cancelled' };
    try {
      return { kind: 'ok', value: await host(body, { signal }) };
    } catch (error: unknown) {
      return signal.aborted ? { kind: 'cancelled' } : { kind: 'failed', error: error instanceof Error ? error.message : String(error) };
    }
  };
  const protocol = createElevationFusionProtocol<Uint8ClampedArray>({
    client: { run, call: async (body) => { const result = await run(body, {}); return result.kind === 'cancelled' ? { kind: 'failed', error: 'cancelled' } : result; } },
    archive: () => ARCHIVE,
    now: () => 0,
    onTile: (event) => { rig.events.push(event); },
  });
  return Object.assign(rig, { protocol, host });
}

const urlOf = (template: string, { z, x, y }: ArchiveTileAddress): string =>
  template.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));

const idle = new AbortController().signal;

/** Ο ορισμός: ο ψηφιδωτής με ΟΛΗ τη γειτονιά του χοντρού. */
function definitionOf(tile: ArchiveTileAddress, snapshot: ListingTerrainSnapshot | null): Uint8ClampedArray {
  const primary = coarsePrimaryFor(tile, ARCHIVE.maxZoom);
  const coarse = coarseFieldOf(primary, PX, coarseNeighbourhoodOf(primary).map((address) => ({ address, heights: coarseHeights(address) })));
  const surface = snapshot === null ? null : terrainFusionSurfaceOf(snapshot, WIDTH_M);
  return composeFusedElevationTile({ tile, tileSizePx: PX, coarse, surface }).rgba;
}

describe('το πλακίδιο του πρωτοκόλλου', () => {
  it.each([10, 12, 15, 18, 20])('z%i: τα bytes είναι ακριβώς του ψηφιδωτή με όλη τη γειτονιά', async (z) => {
    const { protocol } = createRig();
    const handle = protocol.retain(SNAPSHOT, WIDTH_M);
    const tile = tileAt(z);
    const image = await protocol.loadTile(urlOf(handle.tileTemplate, tile), idle);
    expect(image).toHaveLength(PX * PX * 4);
    expect(Array.from(image)).toEqual(Array.from(definitionOf(tile, SNAPSHOT)));
  });

  it('πλακίδιο που το αρχείο δεν έχει: ποτέ κενό — πλήρες μέγεθος, 0 m, προέλευση «none»', async () => {
    const rig = createRig(() => null);
    const handle = rig.protocol.retain(SNAPSHOT, 0);
    const far: ArchiveTileAddress = { z: 6, x: 1, y: 1 };
    const image = await rig.protocol.loadTile(urlOf(handle.tileTemplate, far), idle);
    expect(image).toHaveLength(PX * PX * 4);
    expect(rig.events[0].answer?.pixels).toEqual({ measured: 0, interpolated: 0, indicative: 0, none: PX * PX });
  });

  it('το ίδιο πλακίδιο ξανά: από τη μνήμη, ίδια bytes, χωρίς νέα ανάγνωση του αρχείου', async () => {
    const rig = createRig();
    const handle = rig.protocol.retain(SNAPSHOT, WIDTH_M);
    const url = urlOf(handle.tileTemplate, tileAt(18));
    const first = await rig.protocol.loadTile(url, idle);
    const loadsAfterFirst = rig.loads.length;
    const second = await rig.protocol.loadTile(url, idle);
    expect(Array.from(second)).toEqual(Array.from(first));
    expect(rig.loads).toHaveLength(loadsAfterFirst);
    expect(rig.events.map((event) => event.answer?.fromMemory)).toEqual([false, true]);
  });

  it('στο βάθος του αρχείου διαβάζεται ΕΝΑ χοντρό πλακίδιο, όχι εννέα', async () => {
    const rig = createRig();
    const handle = rig.protocol.retain(SNAPSHOT, WIDTH_M);
    await rig.protocol.loadTile(urlOf(handle.tileTemplate, tileAt(12)), idle);
    expect(rig.loads).toHaveLength(1);
    expect(rig.events[0].answer?.coarse).toEqual({ memory: 0, network: 1, shared: 0 });
  });
});

describe('η επιφάνεια και το κλειδί της', () => {
  it('ο χειριστής ζητά την επιφάνεια που δεν ξέρει· στέλνεται ΜΙΑ φορά, όσα πλακίδια κι αν τη βρήκαν να λείπει', async () => {
    const rig = createRig();
    const handle = rig.protocol.retain(SNAPSHOT, WIDTH_M);
    const tiles = [tileAt(16), tileAt(17), tileAt(18), tileAt(19)];
    const images = await Promise.all(tiles.map((tile) => rig.protocol.loadTile(urlOf(handle.tileTemplate, tile), idle)));
    expect(images.every((image) => image.length === PX * PX * 4)).toBe(true);
    expect(rig.requests.filter((request) => request.kind === 'surface')).toHaveLength(1);
  });

  it('ίδιο αντικείμενο + ίδιο πλάτος ⇒ ίδιο κλειδί· νέο αντικείμενο ή άλλο πλάτος ⇒ νέα διεύθυνση πλακιδίων', () => {
    const { protocol } = createRig();
    const first = protocol.retain(SNAPSHOT, WIDTH_M);
    expect(protocol.retain(SNAPSHOT, WIDTH_M).key).toBe(first.key);
    expect(protocol.retain(SNAPSHOT, 15).key).not.toBe(first.key);
    expect(protocol.retain({ ...SNAPSHOT }, WIDTH_M).tileTemplate).not.toBe(first.tileTemplate);
    expect(first.tileTemplate).toBe(elevationFusionTileTemplate(first.key));
  });

  it('το αίτημα ψηφιδώνεται με την επιφάνεια του ΔΙΚΟΥ του κλειδιού, όχι με τη νεότερη', async () => {
    const rig = createRig();
    const flat = { ...SNAPSHOT, georeference: null };
    const old = rig.protocol.retain(SNAPSHOT, WIDTH_M);
    const next = rig.protocol.retain(flat, WIDTH_M);
    const tile = tileAt(18);
    const [withSurvey, withoutSurvey] = await Promise.all([
      rig.protocol.loadTile(urlOf(old.tileTemplate, tile), idle),
      rig.protocol.loadTile(urlOf(next.tileTemplate, tile), idle),
    ]);
    expect(Array.from(withSurvey)).toEqual(Array.from(definitionOf(tile, SNAPSHOT)));
    expect(Array.from(withoutSurvey)).toEqual(Array.from(definitionOf(tile, null)));
    expect(Array.from(withSurvey)).not.toEqual(Array.from(withoutSurvey));
  });

  it('ο τελευταίος κάτοχος αφήνει ⇒ ο χειριστής ξεχνά· αργοπορημένο αίτημα είναι ακύρωση, όχι σφάλμα', async () => {
    const rig = createRig();
    const a = rig.protocol.retain(SNAPSHOT, WIDTH_M);
    const b = rig.protocol.retain(SNAPSHOT, WIDTH_M);
    a.release();
    a.release();
    expect(rig.requests.some((request) => request.kind === 'forget')).toBe(false);
    b.release();
    expect(rig.requests.filter((request) => request.kind === 'forget')).toEqual([{ kind: 'forget', surface: a.key }]);
    await expect(rig.protocol.loadTile(urlOf(a.tileTemplate, tileAt(18)), idle)).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('ακύρωση και αποτυχία', () => {
  it('ακυρωμένο αίτημα ⇒ AbortError (η MapLibre το αγνοεί), και γράφεται ως ακύρωση', async () => {
    const rig = createRig();
    const handle = rig.protocol.retain(SNAPSHOT, WIDTH_M);
    const abort = new AbortController();
    const pending = rig.protocol.loadTile(urlOf(handle.tileTemplate, tileAt(18)), abort.signal);
    abort.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(rig.events.map((event) => event.outcome)).toEqual(['cancelled']);
  });

  it('το αρχείο δεν απάντησε ⇒ μία ακόμη προσπάθεια· αν πετύχει, το πλακίδιο είναι το σωστό', async () => {
    const rig = createRig();
    const handle = rig.protocol.retain(SNAPSHOT, WIDTH_M);
    const tile = tileAt(12);
    rig.failures = 1;
    const image = await rig.protocol.loadTile(urlOf(handle.tileTemplate, tile), idle);
    expect(Array.from(image)).toEqual(Array.from(definitionOf(tile, SNAPSHOT)));
    expect(rig.loads).toHaveLength(2);
  });

  it('το αρχείο δεν απαντά ⇒ ΣΦΑΛΜΑ, ποτέ ψεύτικο επίπεδο· και η αποτυχία δεν μένει στη μνήμη', async () => {
    const rig = createRig();
    const handle = rig.protocol.retain(SNAPSHOT, WIDTH_M);
    const url = urlOf(handle.tileTemplate, tileAt(12));
    rig.failures = 2;
    await expect(rig.protocol.loadTile(url, idle)).rejects.toThrow('network down');
    expect(rig.events.map((event) => event.outcome)).toEqual(['failed']);
    await expect(rig.protocol.loadTile(url, idle)).resolves.toHaveLength(PX * PX * 4);
  });

  it('διεύθυνση που δεν είναι πλακίδιο ⇒ σφάλμα με όνομα', async () => {
    const { protocol } = createRig();
    await expect(protocol.loadTile('terrain-fusion://s1/3/4', idle)).rejects.toThrow('not a tile address');
  });
});

describe('ύψος σε σημείο, μέσω του πρωτοκόλλου', () => {
  it('μέσα στην αποτύπωση: το μετρημένο· χωρίς επιφάνεια: το χοντρό, «ενδεικτικό»', async () => {
    const { protocol } = createRig();
    const handle = protocol.retain(SNAPSHOT, WIDTH_M);
    const centre = SURFACE.placement.centre;
    const [fused] = await protocol.elevationsAt(handle.key, [centre]);
    const [coarse] = await protocol.elevationsAt(null, [centre]);
    expect(fused.provenance).toBe('measured');
    expect(coarse.provenance).toBe('indicative');
    expect(coarse.elevationM).not.toBeCloseTo(fused.elevationM, 0);
  });
});

describe('ο αναγνώστης του χοντρού', () => {
  const address: ArchiveTileAddress = { z: 12, x: 5, y: 7 };

  /** Φόρτωση που τελειώνει όταν το πει το test, και γράφει αν ακυρώθηκε. */
  function controlledLoad() {
    const state = { calls: 0, aborted: false, release: (_heights: CoarseTileHeights): void => undefined };
    const load: CoarseTileLoad = (_archive, _address, signal) => {
      state.calls++;
      return new Promise((resolve, reject) => {
        state.release = resolve;
        signal.addEventListener('abort', () => { state.aborted = true; reject(new Error('aborted')); }, { once: true });
      });
    };
    return { state, reader: createFusionCoarseReader({ load, maxBytes: 16 * PX * PX * 4, timeoutMs: 40 }) };
  }

  it('δύο που ζητούν το ίδιο πλακίδιο μοιράζονται ΜΙΑ φόρτωση', async () => {
    const { state, reader } = controlledLoad();
    const first = reader.read(ARCHIVE, address, idle);
    const second = reader.read(ARCHIVE, address, idle);
    state.release(coarseHeights(address));
    const readings = await Promise.all([first, second]);
    expect(state.calls).toBe(1);
    expect(readings.map((reading) => reading.origin)).toEqual(['network', 'shared']);
    expect((await reader.read(ARCHIVE, address, idle)).origin).toBe('memory');
  });

  it('ακυρώνει ο ένας από δύο ⇒ η φόρτωση συνεχίζει για τον άλλον', async () => {
    const { state, reader } = controlledLoad();
    const leaving = new AbortController();
    const left = reader.read(ARCHIVE, address, leaving.signal);
    const stayed = reader.read(ARCHIVE, address, idle);
    leaving.abort();
    await expect(left).rejects.toMatchObject({ name: 'AbortError' });
    expect(state.aborted).toBe(false);
    state.release(coarseHeights(address));
    await expect(stayed).resolves.toMatchObject({ origin: 'shared' });
  });

  it('ακυρώνει και ο τελευταίος ⇒ η φόρτωση διακόπτεται και δεν αφήνει τίποτα στη μνήμη', async () => {
    const { state, reader } = controlledLoad();
    const leaving = new AbortController();
    const left = reader.read(ARCHIVE, address, leaving.signal);
    leaving.abort();
    await expect(left).rejects.toMatchObject({ name: 'AbortError' });
    expect(state.aborted).toBe(true);
    const again = reader.read(ARCHIVE, address, idle);
    expect(state.calls).toBe(2);
    state.release(null);
    await expect(again).resolves.toMatchObject({ heights: null, origin: 'network' });
  });

  it('η προθεσμία περνά ⇒ TimeoutError, και η επόμενη ερώτηση ξαναδιαβάζει το αρχείο', async () => {
    const { state, reader } = controlledLoad();
    await expect(reader.read(ARCHIVE, address, idle)).rejects.toBeInstanceOf(TimeoutError);
    const again = reader.read(ARCHIVE, address, idle);
    state.release(coarseHeights(address));
    await expect(again).resolves.toMatchObject({ origin: 'network' });
    expect(state.calls).toBe(2);
  });

  it('πλακίδιο λάθος μεγέθους ⇒ σφάλμα, όχι σιωπηλή ανάγνωση', async () => {
    const reader = createFusionCoarseReader({ load: async () => new Float32Array(9), maxBytes: 1024, timeoutMs: 1_000 });
    await expect(reader.read(ARCHIVE, address, idle)).rejects.toThrow('expected 8²');
  });
});
