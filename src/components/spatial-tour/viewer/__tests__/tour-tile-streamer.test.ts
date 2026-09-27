/**
 * @fileoverview **Η ΡΟΗ ΠΛΑΚΙΔΙΩΝ** (ADR-884 Φ2ε · §4.11) — ψεύτικη μηχανή, πηγή και ουρά· αληθινός πυρήνας ορατότητας.
 *
 * - **Ο** — μόνο τα ορατά, το κεντρικό πρώτο, επίπεδο κατά πυκνότητα οθόνης (όχι 150 πλακίδια ανά σημείο).
 * - **Α** — αλλαγή στάσης ⇒ ό,τι έτρεχε για την παλιά **ακυρώνεται** και πλακίδιό της δεν φτάνει ποτέ στη νέα (M11).
 * - **Σ** — πλακίδιο που αποτυγχάνει δεν σταματά τα άλλα, και δεν ξαναζητείται σε κάθε κίνηση (M13/M14).
 * - **Κ** — στροφή ⇒ ό,τι βγήκε από το κάδρο πριν ξεκινήσει φεύγει από την ουρά.
 * - **Π** — προφόρτωση: τα πλακίδια της θέασης άφιξης, πίσω από κάθε πλακίδιο του κάδρου.
 */

import { createPriorityTaskQueue } from '@/lib/async/priority-task-queue';
import { tilesetLevels } from '@/lib/spatial-tour/tileset/tour-tileset-layout';
import type { TourManifestStop } from '@/lib/spatial-tour/tour-manifest-stop';
import type { TourTileAddress } from '@/lib/spatial-tour/viewer/tour-tile-visibility';
import { initialView } from '@/lib/spatial-tour/viewer/tour-viewer-view';

import { createTourCameraStore, setCameraView } from '../tour-camera-store';
import type { TourPanoramaEngine } from '../tour-panorama-engine';
import type { TourFaceImage, TourPanoramaSource } from '../tour-panorama-source';
import { createTourTileStreamer } from '../tour-tile-streamer';

const stopOf = (captureId: string): TourManifestStop => ({
  captureId, nodeId: `n_${captureId}`, capturedAt: '2026-09-27T00:00:00.000Z', headingRad: 0, tilesetHash: captureId.repeat(8), faceSize: 2560,
});
const A = stopOf('a');
const B = stopOf('b');
const IMAGE = { width: 512, height: 512 } as TourFaceImage;

interface Request {
  readonly stop: string;
  readonly address: TourTileAddress;
  readonly signal: AbortSignal;
  readonly resolve: () => void;
  readonly reject: () => void;
}

function harness(concurrency = 2, viewportPx = 700) {
  const requests: Request[] = [];
  const puts: Array<{ readonly stopKey: string; readonly tileKey: string }> = [];
  const has = new Set<string>();
  const engine = {
    viewportHeightDevicePx: () => viewportPx,
    hasTile: (stopKey: string, tileKey: string) => has.has(`${stopKey}:${tileKey}`),
    putTile: (stopKey: string, tileKey: string) => { puts.push({ stopKey, tileKey }); has.add(`${stopKey}:${tileKey}`); },
  } as unknown as TourPanoramaEngine;
  const source: TourPanoramaSource = {
    base: jest.fn(async () => ({}) as never),
    tiles: {
      levels: (stop) => tilesetLevels(stop.faceSize),
      tile: (stop, address, signal) => new Promise<TourFaceImage>((resolve, reject) => {
        requests.push({ stop: stop.captureId, address, signal, resolve: () => resolve(IMAGE), reject: () => reject(new Error('503')) });
      }),
    },
  };
  const camera = createTourCameraStore();
  const queue = createPriorityTaskQueue(concurrency);
  const streamer = createTourTileStreamer({ engine, camera, source, queue });
  return { requests, puts, camera, queue, streamer };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('Ο — μόνο ό,τι φαίνεται', () => {
  it('καμβάς 700px, 65° ⇒ επίπεδο 2048, και το ΠΡΩΤΟ αίτημα είναι front (το κέντρο)', async () => {
    const h = harness();
    h.streamer.focus(A);
    await flush();
    expect(h.requests[0].address).toMatchObject({ level: 2, face: 'front' });
  });

  it('η ουρά δεν ξεπερνά τα ~40 πλακίδια του κάδρου (όχι τα 96 όλου του επιπέδου)', async () => {
    const h = harness(1000);
    h.streamer.focus(A);
    await flush();
    expect(h.requests.length).toBeGreaterThan(0);
    expect(h.requests.length).toBeLessThan(45);
    expect(h.requests.some((r) => r.address.face === 'back')).toBe(false);
  });
});

describe('Α — αλλαγή στάσης (M11)', () => {
  it('ό,τι έτρεχε για την Α ακυρώνεται, και πλακίδιο της Α δεν δίνεται ποτέ ως της Β', async () => {
    const h = harness();
    h.streamer.focus(A);
    await flush();
    const running = h.requests.filter((r) => r.stop === 'a');
    h.streamer.focus(B);
    await flush();
    expect(running.every((r) => r.signal.aborted)).toBe(true);
    // Το δίκτυο «δεν άκουσε» την ακύρωση και το πλακίδιο της Α έφτασε αργά:
    for (const r of running) r.resolve();
    await flush();
    expect(h.puts.filter((p) => p.stopKey === 'a')).toEqual([]);
    expect(h.requests.some((r) => r.stop === 'b')).toBe(true);
  });
});

describe('Σ — απομόνωση σφάλματος', () => {
  it('ένα πλακίδιο αποτυγχάνει ⇒ το επόμενο έρχεται κανονικά, και το αποτυχημένο ΔΕΝ ξαναζητείται στην επόμενη κίνηση', async () => {
    const h = harness(1);
    h.streamer.focus(A);
    await flush();
    const failing = h.requests[0];
    failing.reject();
    await flush();
    h.requests[1].resolve();
    await flush();
    expect(h.puts).toHaveLength(1);
    setCameraView(h.camera, { ...h.camera.get().view, yaw: 0.01 });
    await flush();
    // Άδειασε την ουρά — αν το αποτυχημένο ξαναμπήκε, θα ξεκινήσει κάποια στιγμή.
    for (let guard = 0; guard < 200 && h.queue.stats().running > 0; guard++) {
      h.requests.at(-1)?.resolve();
      await flush();
    }
    // Ταυτότητα = διεύθυνση πλακιδίου (η προτεραιότητα αλλάζει με τη στροφή — δεν είναι μέρος της).
    const same = (a: TourTileAddress) => `${a.level}/${a.face}/${a.row}/${a.col}`;
    const sameAgain = h.requests.filter((r) => same(r.address) === same(failing.address));
    expect(sameAgain).toHaveLength(1);
  });
});

describe('Κ — στροφή', () => {
  it('στροφή 180° ⇒ τα πλακίδια του front που ΠΕΡΙΜΕΝΑΝ φεύγουν· ζητείται το back', async () => {
    const h = harness(1);
    h.streamer.focus(A);
    await flush();
    const queuedBefore = h.queue.stats().queued;
    expect(queuedBefore).toBeGreaterThan(5);
    setCameraView(h.camera, { ...initialView(Math.PI), fov: h.camera.get().view.fov });
    await flush();
    h.requests[0].resolve();
    await flush();
    expect(h.requests[1].address.face).toBe('back');
  });
});

describe('Π — προφόρτωση θέασης άφιξης', () => {
  it('ζητά πλακίδια της στάσης-στόχου ΜΕΤΑ από κάθε πλακίδιο του κάδρου', async () => {
    const h = harness(1);
    h.streamer.focus(A);
    await flush();
    // Το hover στο βελάκι έρχεται ΑΦΟΥ ο επισκέπτης δει το σημείο του.
    h.streamer.prefetch(B, { view: initialView(0), aspect: 16 / 9 });
    await flush();
    let guard = 0;
    while (h.requests.at(-1)?.stop === 'a' && guard++ < 200) {
      h.requests.at(-1)?.resolve();
      await flush();
    }
    const firstB = h.requests.findIndex((r) => r.stop === 'b');
    expect(firstB).toBeGreaterThan(0);
    expect(h.requests.slice(firstB).every((r) => r.stop === 'b')).toBe(true);
  });
});
