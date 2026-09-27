/**
 * @fileoverview **Η ΠΗΓΗ ΠΛΑΚΙΔΙΩΝ** (ADR-884 Φ2γ · Φ2ε · §4.9 · §4.11) — με ψεύτικο runtime: καμία κλήση δικτύου, κανένας καμβάς.
 *
 * - **Β** — βάση: μία λωρίδα προεπισκόπησης, κομμένη ανά όψη με τη σειρά του `TOUR_CUBE_FACES`, σε καμβά· αν αποτύχει,
 *   το επίπεδο 0 (έξι πλακίδια) — ποτέ μαύρο.
 * - **Π** — πλακίδια: **ένα αίτημα ανά πλακίδιο που ζητήθηκε** (όχι όλο το επίπεδο), διαδρομή ίδια με του ψήστη, σε καμβά.
 * - **Κ** — κρυφή μνήμη: το ίδιο πλακίδιο δεύτερη φορά ⇒ κανένα αίτημα.
 * - **Σ** — η ακύρωση φτάνει σε κάθε αίτημα.
 */

import { API_ROUTES } from '@/config/domain-constants';
import { previewSegments, tileSegments } from '@/lib/spatial-tour/tileset/tour-tileset-layout';
import { TOUR_CUBE_FACES } from '@/lib/spatial-tour/viewer/tour-cube-faces';
import type { TourManifestStop } from '@/lib/spatial-tour/tour-manifest-stop';

import { createTilePanoramaSource, fetchTileBlob, TILE_FETCH_ATTEMPTS, type TileSourceRuntime } from '../tile-panorama-source';

const SUBJECT = { kind: 'company-property', id: 'prop_1' } as const;
const HASH = 'f'.repeat(64);
const ROOT = API_ROUTES.SPATIAL_TOURS.MEDIA_ROOT(SUBJECT.kind, SUBJECT.id);
const STOP: TourManifestStop = {
  captureId: 'tcap_1', nodeId: 'tnod_1', capturedAt: '2026-09-27T00:00:00.000Z', headingRad: 0, tilesetHash: HASH, faceSize: 2560,
};
const url = (segments: readonly string[]) => `${ROOT}/${segments.join('/')}`;

interface Recorder {
  readonly runtime: TileSourceRuntime;
  readonly fetched: string[];
  readonly signals: AbortSignal[];
  readonly draws: Array<{ readonly size: number; readonly x: number; readonly y: number }>;
  readonly crops: Array<{ readonly x: number; readonly y: number; readonly size: number }>;
}

function recorder(options: { readonly failPreview?: boolean } = {}): Recorder {
  const rec: Recorder = {
    fetched: [], signals: [], draws: [], crops: [],
    runtime: {
      fetchBlob: async (u, signal) => {
        rec.fetched.push(u);
        rec.signals.push(signal);
        if (u.endsWith('preview.jpg') && options.failPreview) throw new Error('404');
        return new Blob([u]);
      },
      decode: async (_blob, crop) => {
        if (crop !== undefined) rec.crops.push(crop);
        return { close: () => undefined } as unknown as ImageBitmap;
      },
      createFace: (size) => ({ canvas: { width: size, height: size } as HTMLCanvasElement, draw: (_image, x, y) => rec.draws.push({ size, x, y }) }),
    },
  };
  return rec;
}

const signal = () => new AbortController().signal;

describe('Β — βάση', () => {
  it('ΕΝΑ αίτημα: η λωρίδα προεπισκόπησης, κομμένη ανά όψη με τη σειρά του TOUR_CUBE_FACES', async () => {
    const rec = recorder();
    await createTilePanoramaSource(SUBJECT, rec.runtime).base(STOP, signal());
    expect(rec.fetched).toEqual([url(previewSegments(HASH))]);
    expect(rec.crops.map((c) => c.y)).toEqual(TOUR_CUBE_FACES.map((_f, i) => i * 256));
  });

  it('κάθε όψη της βάσης ΕΙΝΑΙ καμβάς (ποτέ ImageBitmap: το three αγνοεί το flipY ⇒ ανάποδα — ζωντανά, Φ2δ)', async () => {
    const rec = recorder();
    const faces = await createTilePanoramaSource(SUBJECT, rec.runtime).base(STOP, signal());
    expect(TOUR_CUBE_FACES.map((face) => faces[face].width)).toEqual(TOUR_CUBE_FACES.map(() => 256));
    expect(rec.draws.filter((d) => d.size === 256 && d.x === 0 && d.y === 0)).toHaveLength(TOUR_CUBE_FACES.length);
  });

  it('αποτυχία προεπισκόπησης ⇒ βάση από το επίπεδο 0 (έξι πλακίδια), όχι μαύρο', async () => {
    const rec = recorder({ failPreview: true });
    const faces = await createTilePanoramaSource(SUBJECT, rec.runtime).base(STOP, signal());
    expect(rec.fetched.slice(1).sort()).toEqual(TOUR_CUBE_FACES.map((face) => url(tileSegments(HASH, 0, face, 0, 0))).sort());
    expect(TOUR_CUBE_FACES.map((face) => faces[face].width)).toEqual(TOUR_CUBE_FACES.map(() => 512));
  });
});

describe('Π — πλακίδια ένα-ένα', () => {
  it('τα επίπεδα της στάσης είναι της διάταξης (όψη 2560 ⇒ 512 · 1024 · 2048 · 2560)', () => {
    expect(createTilePanoramaSource(SUBJECT, recorder().runtime).tiles?.levels(STOP)).toEqual([512, 1024, 2048, 2560]);
  });

  it('ένα πλακίδιο ⇒ ΕΝΑ αίτημα, στη διαδρομή του ψήστη, σε καμβά 512', async () => {
    const rec = recorder();
    const tile = await createTilePanoramaSource(SUBJECT, rec.runtime).tiles?.tile(STOP, { level: 3, face: 'left', row: 4, col: 2 }, signal());
    expect(rec.fetched).toEqual([url(tileSegments(HASH, 3, 'left', 4, 2))]);
    expect(tile?.width).toBe(512);
  });
});

describe('Κ — κρυφή μνήμη', () => {
  it('το ίδιο πλακίδιο δεύτερη φορά ⇒ κανένα αίτημα, ο ΙΔΙΟΣ καμβάς', async () => {
    const rec = recorder();
    const tiles = createTilePanoramaSource(SUBJECT, rec.runtime).tiles;
    const address = { level: 1, face: 'front', row: 0, col: 1 } as const;
    const first = await tiles?.tile(STOP, address, signal());
    const second = await tiles?.tile(STOP, address, signal());
    expect(second).toBe(first);
    expect(rec.fetched).toHaveLength(1);
  });
});

describe('Κ — κρυφή μνήμη βάσης (η προφόρτωση γείτονα ΕΙΝΑΙ η βάση της άφιξης)', () => {
  it('η ίδια στάση δεύτερη φορά ⇒ κανένα αίτημα, οι ΙΔΙΕΣ όψεις', async () => {
    const rec = recorder();
    const source = createTilePanoramaSource(SUBJECT, rec.runtime);
    const first = await source.base(STOP, signal());
    const second = await source.base(STOP, signal());
    expect(second).toBe(first);
    expect(rec.fetched).toHaveLength(1);
  });
});

describe('Σ — ακύρωση', () => {
  it('το signal του καλούντος φτάνει στο αίτημα', async () => {
    const rec = recorder();
    const controller = new AbortController();
    await createTilePanoramaSource(SUBJECT, rec.runtime).tiles?.tile(STOP, { level: 0, face: 'up', row: 0, col: 0 }, controller.signal);
    expect(rec.signals).toEqual([controller.signal]);
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
