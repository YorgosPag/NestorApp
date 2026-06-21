/**
 * ADR-449 Slice X3 — Ο τοίχος ως finish-member της ενιαίας σιλουέτας σοβά.
 *
 * Επαληθεύει: (1) `wallHasPlasterSkin` (DNA με plaster → true· core-only parapet → false),
 * (2) `wallToSilhouetteMember` (core = inset· parapet/skin≤0 → null), (3) integration:
 * `computeStructuralFinishSilhouette` με ΜΟΝΟ τοίχους (πριν επέστρεφε []), (4) contact
 * subtraction — 2 επικαλυπτόμενοι collinear τοίχοι ενώνονται → ο σοβάς σβήνει στην επαφή.
 */

import { wallHasPlasterSkin, wallToSilhouetteMember } from '../wall-finish-source';
import { computeStructuralFinishSilhouette } from '../structural-finish-scene-silhouette';
import type { WallFinishObstacle } from '../structural-finish-scene';
import { buildDefaultWallParams } from '../../../hooks/drawing/wall-completion';
import {
  createDefaultExteriorDna,
  createDefaultParapetDna,
  type WallDna,
} from '../../types/wall-dna-types';

function wall(
  start: { x: number; y: number },
  end: { x: number; y: number },
  opts: { dna?: WallDna; id?: string } = {},
): WallFinishObstacle {
  const base = buildDefaultWallParams(start, end, { height: 3000 });
  const params = opts.dna ? { ...base, dna: opts.dna, thickness: opts.dna.totalThickness } : base;
  return { id: opts.id ?? 'w1', kind: 'straight', params };
}

const fullZ = { zBotMm: 0, zTopMm: 3000 };
const totalLength = (segs: readonly { lengthM: number }[]): number =>
  segs.reduce((s, seg) => s + seg.lengthM, 0);

describe('wallHasPlasterSkin', () => {
  it('exterior DNA (σοβάς + τούβλο + Knauf) → true', () => {
    expect(wallHasPlasterSkin(createDefaultExteriorDna())).toBe(true);
  });
  it('parapet DNA (μονόστρωτο RC core) → false', () => {
    expect(wallHasPlasterSkin(createDefaultParapetDna())).toBe(false);
  });
  it('undefined DNA → false', () => {
    expect(wallHasPlasterSkin(undefined)).toBe(false);
  });
});

describe('wallToSilhouetteMember', () => {
  it('τοίχος με σοβά → member με core footprint (inset προς τα μέσα)', () => {
    const m = wallToSilhouetteMember(wall({ x: 0, y: 0 }, { x: 3000, y: 0 }), 15, fullZ);
    expect(m).not.toBeNull();
    expect(m!.footprint.length).toBeGreaterThanOrEqual(4);
    expect(m!.zBotMm).toBe(0);
    expect(m!.zTopMm).toBe(3000);
  });

  it('parapet (core-only) → null (μένει obstacle, δεν παίρνει σοβά)', () => {
    const m = wallToSilhouetteMember(
      wall({ x: 0, y: 0 }, { x: 3000, y: 0 }, { dna: createDefaultParapetDna() }),
      15,
      fullZ,
    );
    expect(m).toBeNull();
  });

  it('skin ≤ 0 → null', () => {
    expect(wallToSilhouetteMember(wall({ x: 0, y: 0 }, { x: 3000, y: 0 }), 0, fullZ)).toBeNull();
  });
});

describe('computeStructuralFinishSilhouette — ο τοίχος ως member (ADR-449 Slice X3)', () => {
  it('όροφος με ΜΟΝΟ τοίχο → παράγει band σοβά (πριν επέστρεφε [])', () => {
    const bands = computeStructuralFinishSilhouette([], [], [wall({ x: 0, y: 0 }, { x: 3000, y: 0 })], 0);
    expect(bands.length).toBeGreaterThanOrEqual(1);
    expect(bands[0].faces.segments.length).toBeGreaterThan(0);
  });

  it('parapet-only όροφος → καμία band (core-only, χωρίς σοβά)', () => {
    const bands = computeStructuralFinishSilhouette(
      [],
      [],
      [wall({ x: 0, y: 0 }, { x: 3000, y: 0 }, { dna: createDefaultParapetDna() })],
      0,
    );
    expect(bands).toHaveLength(0);
  });

  it('2 επικαλυπτόμενοι collinear τοίχοι → ενιαία σιλουέτα (σοβάς σβήνει στην επαφή)', () => {
    // Α: [0,3000], Β: [2900,6000] collinear στον x → core footprints επικαλύπτονται →
    // safeUnion → ΕΝΑ outline → η εσωτερική επαφή χάνεται (μικρότερο συνολικό μήκος από
    // 2 ανεξάρτητους τοίχους που θα είχαν 2× καθέτως-στον-άξονα άκρα στη συμβολή).
    const joined = computeStructuralFinishSilhouette(
      [],
      [],
      [
        wall({ x: 0, y: 0 }, { x: 3000, y: 0 }, { id: 'a' }),
        wall({ x: 2900, y: 0 }, { x: 6000, y: 0 }, { id: 'b' }),
      ],
      0,
    );
    const separate = computeStructuralFinishSilhouette(
      [],
      [],
      [
        wall({ x: 0, y: 0 }, { x: 3000, y: 0 }, { id: 'a' }),
        wall({ x: 20000, y: 0 }, { x: 23000, y: 0 }, { id: 'b' }),
      ],
      0,
    );
    const joinedLen = joined.reduce((s, b) => s + totalLength(b.faces.segments), 0);
    const separateLen = separate.reduce((s, b) => s + totalLength(b.faces.segments), 0);
    expect(joinedLen).toBeLessThan(separateLen);
  });
});
