/**
 * @fileoverview **Η ΠΗΓΗ ΠΛΑΚΙΔΙΩΝ** (ADR-884 Φ2γ · §4.9) — με ψεύτικο runtime: καμία κλήση δικτύου, κανένας καμβάς.
 *
 * - **Ε** — επίπεδο: το μεγαλύτερο που χωρά στη συσκευή· κάθε πλακίδιο του επιπέδου ζητείται μία φορά, στη θέση του.
 * - **Δ** — διαδρομές: ίδιες με του ψήστη (`tileSegments`), κάτω από τη ρίζα μέσων της περιήγησης.
 * - **Π** — προεπισκόπηση: μία λωρίδα, κομμένη ανά όψη με τη σειρά του `TOUR_CUBE_FACES`· ποτέ **μετά** τις καθαρές όψεις.
 * - **Σ** — η μπροστινή όψη ζητείται πρώτη· η ακύρωση φτάνει σε κάθε αίτημα.
 */

import { API_ROUTES } from '@/config/domain-constants';
import { previewSegments, tileSegments } from '@/lib/spatial-tour/tileset/tour-tileset-layout';
import { TOUR_CUBE_FACES } from '@/lib/spatial-tour/viewer/tour-cube-faces';
import type { TourManifestStop } from '@/lib/spatial-tour/tour-manifest-stop';

import { createTilePanoramaSource, fetchTileBlob, TILE_FETCH_ATTEMPTS, type TileSourceRuntime } from '../tile-panorama-source';

const SUBJECT = { kind: 'company-property', id: 'prop_1' } as const;
const HASH = 'f'.repeat(64);
const ROOT = API_ROUTES.SPATIAL_TOURS.MEDIA_ROOT(SUBJECT.kind, SUBJECT.id);
const stop = (faceSize: number): TourManifestStop => ({
  captureId: 'tcap_1', nodeId: 'tnod_1', capturedAt: '2026-09-27T00:00:00.000Z', headingRad: 0, tilesetHash: HASH, faceSize,
});
const url = (segments: readonly string[]) => `${ROOT}/${segments.join('/')}`;

interface Recorder {
  readonly runtime: TileSourceRuntime;
  readonly fetched: string[];
  readonly signals: AbortSignal[];
  readonly draws: Array<{ readonly size: number; readonly x: number; readonly y: number }>;
  readonly crops: Array<{ readonly x: number; readonly y: number; readonly size: number }>;
  releasePreview: () => void;
}

function recorder(options: { readonly holdPreview?: boolean; readonly failPreview?: boolean } = {}): Recorder {
  let releasePreview = () => undefined as void;
  const previewGate = options.holdPreview ? new Promise<void>((r) => { releasePreview = r; }) : Promise.resolve();
  const rec: Recorder = {
    fetched: [], signals: [], draws: [], crops: [],
    releasePreview: () => releasePreview(),
    runtime: {
      fetchBlob: async (u, signal) => {
        rec.fetched.push(u);
        rec.signals.push(signal);
        if (u.endsWith('preview.jpg')) {
          await previewGate;
          if (options.failPreview) throw new Error('404');
        }
        return new Blob([u]);
      },
      decode: async (_blob, crop) => {
        if (crop !== undefined) rec.crops.push(crop);
        return { close: () => undefined } as unknown as ImageBitmap;
      },
      createFace: (size) => ({ canvas: { width: size } as HTMLCanvasElement, draw: (_image, x, y) => rec.draws.push({ size, x, y }) }),
    },
  };
  return rec;
}

const load = (rec: Recorder, faceSize: number, maxFaceSize: number, onPreview?: () => void, signal = new AbortController().signal) =>
  createTilePanoramaSource(SUBJECT, rec.runtime).load(stop(faceSize), { signal, maxFaceSize, onPreview });

describe('Ε — επίπεδο και πλακίδια', () => {
  it('όψη 2560 σε συσκευή 2048 ⇒ επίπεδο 2 (2048): 16 πλακίδια ανά όψη, στη θέση τους', async () => {
    const rec = recorder();
    const faces = await load(rec, 2560, 2048);
    expect(Object.keys(faces).sort()).toEqual([...TOUR_CUBE_FACES].sort());
    expect(rec.fetched).toHaveLength(6 * 16);
    expect(new Set(rec.fetched).size).toBe(6 * 16);
    expect(rec.draws.every((d) => d.size === 2048)).toBe(true);
    expect(rec.draws.filter((d) => d.x === 1536 && d.y === 1536)).toHaveLength(6);
  });

  it('συσκευή μικρότερη από το πρώτο επίπεδο ⇒ ποτέ κάτω από το πρώτο (512, ένα πλακίδιο)', async () => {
    const rec = recorder();
    await load(rec, 2560, 256);
    expect(rec.fetched).toHaveLength(6);
  });
});

describe('Δ — διαδρομές ίδιες με του ψήστη', () => {
  it('κάθε αίτημα είναι `tileSegments` κάτω από τη ρίζα μέσων', async () => {
    const rec = recorder();
    await load(rec, 1024, 4096);
    const expected = TOUR_CUBE_FACES.flatMap((face) => [0, 1].flatMap((row) => [0, 1].map((col) => url(tileSegments(HASH, 1, face, row, col)))));
    expect([...rec.fetched].sort()).toEqual([...expected].sort());
  });
});

describe('Π — προεπισκόπηση', () => {
  it('μία λωρίδα, κομμένη ανά όψη με τη σειρά του TOUR_CUBE_FACES, πριν τις καθαρές όψεις', async () => {
    const rec = recorder();
    const onPreview = jest.fn();
    await load(rec, 1024, 4096, onPreview);
    expect(rec.fetched[0]).toBe(url(previewSegments(HASH)));
    expect(onPreview).toHaveBeenCalledTimes(1);
    expect(rec.crops.map((c) => c.y)).toEqual(TOUR_CUBE_FACES.map((_f, i) => i * 256));
  });

  it('κάθε όψη της προεπισκόπησης ΕΙΝΑΙ καμβάς (ποτέ ImageBitmap: το three αγνοεί το flipY ⇒ ανάποδα — ζωντανά, Φ2δ)', async () => {
    const rec = recorder();
    const onPreview = jest.fn();
    await load(rec, 1024, 4096, onPreview);
    const faces = onPreview.mock.calls[0][0] as Record<string, { width: number }>;
    expect(TOUR_CUBE_FACES.map((face) => faces[face].width)).toEqual(TOUR_CUBE_FACES.map(() => 256));
    expect(rec.draws.filter((d) => d.size === 256 && d.x === 0 && d.y === 0)).toHaveLength(TOUR_CUBE_FACES.length);
  });

  it('προεπισκόπηση που αργεί ΠΕΡΑ από τις καθαρές όψεις ⇒ δεν παραδίδεται ποτέ (καμία υποβάθμιση)', async () => {
    const rec = recorder({ holdPreview: true });
    const onPreview = jest.fn();
    await load(rec, 1024, 4096, onPreview);
    rec.releasePreview();
    await new Promise((r) => setTimeout(r, 0));
    expect(onPreview).not.toHaveBeenCalled();
  });

  it('αποτυχία προεπισκόπησης δεν ρίχνει τη φόρτωση', async () => {
    const rec = recorder({ failPreview: true });
    await expect(load(rec, 1024, 4096, jest.fn())).resolves.toBeDefined();
  });
});

describe('Σ — σειρά και ακύρωση', () => {
  it('η μπροστινή όψη ζητείται πρώτη', async () => {
    const rec = recorder();
    await load(rec, 512, 4096);
    expect(rec.fetched[0]).toBe(url(tileSegments(HASH, 0, 'front', 0, 0)));
  });

  it('το ίδιο signal φτάνει σε κάθε αίτημα', async () => {
    const rec = recorder();
    const controller = new AbortController();
    await load(rec, 1024, 4096, undefined, controller.signal);
    expect(rec.signals.every((s) => s === controller.signal)).toBe(true);
  });
});

describe('Ε — επανάληψη πλακιδίου (ζωντανά, Φ2δ: `socket hang up` ⇒ 503 σε ΕΝΑ πλακίδιο έριχνε ΟΛΗ την καθαρή εικόνα)', () => {
  const BLOB = { tile: true } as unknown as Blob;
  const ok = { ok: true, status: 200, blob: async () => BLOB } as unknown as Response;
  const status = (code: number) => ({ ok: false, status: code, blob: async () => BLOB }) as unknown as Response;
  const run = (responses: ReadonlyArray<Response | Error>) => {
    const calls: number[] = [];
    const fetchImpl = jest.fn(async () => {
      const next = responses[calls.length];
      calls.push(calls.length);
      if (next instanceof Error) throw next;
      return next;
    });
    const promise = fetchTileBlob('/tile', new AbortController().signal, { fetch: fetchImpl as unknown as typeof fetch, backoffMs: () => 0 });
    return { promise, fetchImpl };
  };

  it('503 και μετά 200 ⇒ το πλακίδιο έρχεται', async () => {
    const { promise, fetchImpl } = run([status(503), ok]);
    await expect(promise).resolves.toBe(BLOB);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('δικτυακή αστοχία και μετά 200 ⇒ το πλακίδιο έρχεται', async () => {
    const { promise } = run([new TypeError('socket hang up'), ok]);
    await expect(promise).resolves.toBe(BLOB);
  });

  it('401/404 = κρίση ⇒ ΚΑΜΙΑ επανάληψη', async () => {
    const { promise, fetchImpl } = run([status(401), ok]);
    await expect(promise).rejects.toThrow('tile 401');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('επίμονο 5xx ⇒ σταματά μετά από TILE_FETCH_ATTEMPTS', async () => {
    const { promise, fetchImpl } = run([status(503), status(503), status(503), ok]);
    await expect(promise).rejects.toThrow('tile 503');
    expect(fetchImpl).toHaveBeenCalledTimes(TILE_FETCH_ATTEMPTS);
  });
});
