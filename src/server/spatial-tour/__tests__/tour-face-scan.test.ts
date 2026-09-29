/**
 * @jest-environment node
 *
 * @fileoverview **Η ΣΑΡΩΣΗ ΠΡΟΣΩΠΩΝ ΜΙΑΣ ΛΗΨΗΣ** (ADR-884 Φ2ζ ζ4 · §4.15) — με τον **πραγματικό** ανιχνευτή (YuNet στο
 * `onnxruntime-web`, σε worker) πάνω σε συνθετικό πανόραμα με πρόσωπο σε **γνωστή** κατεύθυνση (`fixtures/face-equirect.ts`).
 *
 * - **Κ** — κεντρικό πρόσωπο: ΕΝΑΣ κύκλος, κέντρο πάνω στο πρόσωπο, ακτίνα που το σκεπάζει.
 * - **Α** — πάνω σε **ακμή** κύβου και στη **ραφή** ±180°: ένα πρόσωπο, μία περιοχή (όχι δύο μισές).
 * - **Π** — πρόσωπο **δίπλα στον φακό** (πέρα από τα ~300 px της πρώτης βαθμίδας): το πιάνει η πυραμίδα.
 * - **Ν** — πολλά πρόσωπα ⇒ τόσοι κύκλοι· **κανένα** πρόσωπο ⇒ κανένας.
 * - **Δ** — η διάταξη πλακιδίων/βαθμίδων καλύπτει ολόκληρη την όψη με την επικάλυψη που δηλώνει.
 */

jest.mock('server-only', () => ({}));
jest.setTimeout(120_000);

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { TOUR_FACE_SCAN_MAX_TILE_PX, TOUR_FACE_SCAN_TILE_OVERLAP_PX, TOUR_REDACTION_MAX_RADIUS_RAD } from '@/constants/spatial-tour-vocabulary';
import { angularDistance } from '@/lib/spatial-tour/tileset/tour-redaction-mask';

import { disposeFaceDetector, faceModelPath } from '../face-detection/yunet-session';
import { faceScanSizes, faceScanTiles, scanFaces } from '../tour-face-scan';
import { decodeEquirect } from '../tour-tileset-render';
import { equirectWithFaces, type FacePlacement } from './fixtures/face-equirect';

const WIDTH = 2048;
const FACE_WIDTH = 0.35;

afterAll(() => disposeFaceDetector());

async function scan(placements: readonly FacePlacement[]) {
  return scanFaces(await decodeEquirect(await equirectWithFaces(WIDTH, placements)));
}

/** Ο κύκλος βρίσκεται **πάνω** στο πρόσωπο και το σκεπάζει — η φωτογραφία έχει το πρόσωπο στο κέντρο της (~58% του πλάτους). */
function expectCovers(region: { yawRad: number; pitchRad: number; radiusRad: number }, at: FacePlacement): void {
  const offset = angularDistance(region.yawRad, region.pitchRad, at.yawRad, at.pitchRad);
  expect(offset).toBeLessThan(0.3 * region.radiusRad);
  expect(region.radiusRad).toBeGreaterThanOrEqual(0.3 * at.widthRad);
  expect(region.radiusRad).toBeLessThanOrEqual(Math.min(at.widthRad, TOUR_REDACTION_MAX_RADIUS_RAD));
}

describe('Κ — κεντρικό πρόσωπο', () => {
  it('ΕΝΑΣ κύκλος, με κέντρο πάνω στο πρόσωπο και ακτίνα που το σκεπάζει', async () => {
    const at = { yawRad: 0, pitchRad: 0, widthRad: FACE_WIDTH };
    const faces = await scan([at]);
    expect(faces).toHaveLength(1);
    expectCovers(faces[0], at);
  });

  it('πάνω από τον ορίζοντα (προς την πάνω όψη)', async () => {
    const at = { yawRad: -0.8, pitchRad: 0.6, widthRad: FACE_WIDTH };
    const faces = await scan([at]);
    expect(faces).toHaveLength(1);
    expectCovers(faces[0], at);
  });
});

describe('Α — ακμές του κύβου και ραφή', () => {
  it.each([
    ['ακμή εμπρός/δεξιά (yaw 45°)', Math.PI / 4, 0],
    ['ακμή εμπρός/πάνω (pitch 45°)', 0, Math.PI / 4],
    ['ραφή ±180°', Math.PI, 0],
  ])('%s ⇒ ένα πρόσωπο, μία περιοχή', async (_, yawRad, pitchRad) => {
    const at = { yawRad, pitchRad, widthRad: FACE_WIDTH };
    const faces = await scan([at]);
    expect(faces).toHaveLength(1);
    expectCovers(faces[0], at);
  });
});

describe('Π — πρόσωπο δίπλα στον φακό', () => {
  it('πολύ μεγάλο για την πρώτη βαθμίδα ⇒ το πιάνει η πυραμίδα', async () => {
    const at = { yawRad: 1.9, pitchRad: -0.1, widthRad: 1.5 };
    const faces = await scan([at]);
    expect(faces).toHaveLength(1);
    expectCovers(faces[0], at);
  });
});

describe('Ν — πλήθος', () => {
  it('τρία πρόσωπα ⇒ τρεις κύκλοι, ο καθένας στο δικό του', async () => {
    const placements = [-2, 0.4, 2.4].map((yawRad) => ({ yawRad, pitchRad: 0.1, widthRad: FACE_WIDTH }));
    const faces = await scan(placements);
    expect(faces).toHaveLength(3);
    for (const at of placements) {
      const nearest = [...faces].sort((a, b) =>
        angularDistance(a.yawRad, a.pitchRad, at.yawRad, at.pitchRad) - angularDistance(b.yawRad, b.pitchRad, at.yawRad, at.pitchRad))[0];
      expectCovers(nearest, at);
    }
  });

  it('κανένα πρόσωπο ⇒ κανένας κύκλος', async () => {
    expect(await scan([])).toEqual([]);
  });
});

describe('Μ — το μοντέλο', () => {
  it('αρχείο μοντέλου με άλλο sha256 ⇒ η σάρωση ΑΠΟΡΡΙΠΤΕΤΑΙ (ποτέ «κανένα πρόσωπο» από άγνωστο μοντέλο)', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'face-model-'));
    writeFileSync(path.join(dir, path.basename(faceModelPath())), Buffer.from('not the model'));
    const previous = process.env.FACE_MODEL_DIR;
    process.env.FACE_MODEL_DIR = dir;
    await disposeFaceDetector();
    try {
      await expect(scan([])).rejects.toThrow(/sha256/);
    } finally {
      if (previous === undefined) delete process.env.FACE_MODEL_DIR;
      else process.env.FACE_MODEL_DIR = previous;
      await disposeFaceDetector();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('Δ — διάταξη σάρωσης', () => {
  it('πυραμίδα: η εγγενής όψη με ταβάνι, μετά οκτάβες — ποτέ μεγέθυνση', () => {
    expect(faceScanSizes(8192)).toEqual([2560, 1280, 640]);
    expect(faceScanSizes(2048)).toEqual([512, 256, 128]);
    expect(faceScanSizes(16384)).toEqual([2560, 1280, 640]);
  });

  it.each([128, 640, 1280, 1408, 1409, 2560, 4096])('πλευρά %i: τα πλακίδια καλύπτουν όλη την όψη, με επικάλυψη ≥ της δηλωμένης', (size) => {
    const tiles = faceScanTiles(size);
    for (const tile of tiles) {
      expect(tile.width).toBeLessThanOrEqual(Math.min(size, TOUR_FACE_SCAN_MAX_TILE_PX));
      expect(tile.left + tile.width).toBeLessThanOrEqual(size);
      expect(tile.top + tile.height).toBeLessThanOrEqual(size);
    }
    const lefts = [...new Set(tiles.map((t) => t.left))].sort((a, b) => a - b);
    expect(lefts[0]).toBe(0);
    expect(lefts[lefts.length - 1] + tiles[0].width).toBe(size);
    for (let k = 1; k < lefts.length; k++) expect(lefts[k - 1] + tiles[0].width - lefts[k]).toBeGreaterThanOrEqual(TOUR_FACE_SCAN_TILE_OVERLAP_PX);
    expect(tiles).toHaveLength(lefts.length ** 2);
  });
});
