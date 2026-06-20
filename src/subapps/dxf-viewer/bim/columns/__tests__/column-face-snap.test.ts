/**
 * column-face-snap — ADR-398 §Column smart-ghost face-snap (ADR-508 reuse).
 *
 * Επαληθεύει το πιστό «δοκάρι→κολώνα» mirror: κάθε παρειά × ζώνη → σωστή auto-λαβή + flush
 * position, 🟢 valid σε μακριά παρειά / 🔴 overlap σε κοντή άκρη δοκαριού, continuous slide,
 * κολόνα-στόχος (όλες οι παρειές έγκυρες), capture distance.
 */

import { resolveColumnFaceSnap, type ColumnFaceSnap } from '../column-face-snap';
import type { Entity } from '../../../types/entities';
import type { Point2D } from '../../../rendering/types/Types';

// ── Test fixtures (scene units = mm → factor 1, capture = 600) ────────────────

/** Οριζόντιο δοκάρι: μήκος 2000 (x −1000..1000), πλάτος 300 (y −150..150). endsAxis = 'x'. */
function horizontalBeam(id = 'beam-h'): Entity {
  return {
    id,
    type: 'beam',
    geometry: {
      axisPolyline: { points: [{ x: -1000, y: 0 }, { x: 1000, y: 0 }] },
      outline: {
        vertices: [
          { x: -1000, y: -150 }, { x: 1000, y: -150 },
          { x: 1000, y: 150 }, { x: -1000, y: 150 },
        ],
      },
    },
  } as unknown as Entity;
}

/** Κάθετο δοκάρι: x −150..150, y −1000..1000. endsAxis = 'y'. */
function verticalBeam(id = 'beam-v'): Entity {
  return {
    id,
    type: 'beam',
    geometry: {
      axisPolyline: { points: [{ x: 0, y: -1000 }, { x: 0, y: 1000 }] },
      outline: {
        vertices: [
          { x: -150, y: -1000 }, { x: 150, y: -1000 },
          { x: 150, y: 1000 }, { x: -150, y: 1000 },
        ],
      },
    },
  } as unknown as Entity;
}

/** Ορθογώνια κολόνα-στόχος κεντραρισμένη στο (cx,cy), 400×400. */
function columnTarget(cx: number, cy: number, id = 'col-1'): Entity {
  return {
    id,
    type: 'column',
    geometry: {
      footprint: {
        vertices: [
          { x: cx - 200, y: cy - 200 }, { x: cx + 200, y: cy - 200 },
          { x: cx + 200, y: cy + 200 }, { x: cx - 200, y: cy + 200 },
        ],
      },
    },
  } as unknown as Entity;
}

const snap = (cursor: Point2D, entities: Entity[]): ColumnFaceSnap | null =>
  resolveColumnFaceSnap(cursor, entities, 'mm');

describe('resolveColumnFaceSnap — horizontal beam target (endsAxis x)', () => {
  const beam = [horizontalBeam()];

  it('returns null όταν μακριά από κάθε στόχο (> capture)', () => {
    expect(snap({ x: 5000, y: 5000 }, beam)).toBeNull();
  });

  it('N face mid → anchor s, κεντραρισμένη στην πάνω παρειά, 🟢 beam', () => {
    const r = snap({ x: 0, y: 250 }, beam)!;
    expect(r.face).toBe('N');
    expect(r.third).toBe('mid');
    expect(r.anchor).toBe('s');
    expect(r.status).toBe('beam');
    expect(r.position).toEqual({ x: 0, y: 150 });
  });

  it('N face lo (ΒΔ) → anchor sw flush στη ΒΔ γωνία', () => {
    const r = snap({ x: -1000, y: 250 }, beam)!;
    expect(r.face).toBe('N');
    expect(r.third).toBe('lo');
    expect(r.anchor).toBe('sw');
    expect(r.position).toEqual({ x: -1000, y: 150 });
  });

  it('N face hi (ΒΑ) → anchor se flush στη ΒΑ γωνία', () => {
    const r = snap({ x: 1000, y: 250 }, beam)!;
    expect(r.third).toBe('hi');
    expect(r.anchor).toBe('se');
    expect(r.position).toEqual({ x: 1000, y: 150 });
  });

  it('S face mid → anchor n, κάτω παρειά, 🟢 beam', () => {
    const r = snap({ x: 0, y: -250 }, beam)!;
    expect(r.face).toBe('S');
    expect(r.anchor).toBe('n');
    expect(r.status).toBe('beam');
    expect(r.position).toEqual({ x: 0, y: -150 });
  });

  it('E short end → 🔴 overlap (anchor w, ανατολική μικρή παρειά)', () => {
    const r = snap({ x: 1100, y: 0 }, beam)!;
    expect(r.face).toBe('E');
    expect(r.status).toBe('overlap');
    expect(r.anchor).toBe('w');
    expect(r.position).toEqual({ x: 1000, y: 0 });
  });

  it('W short end → 🔴 overlap (anchor e)', () => {
    const r = snap({ x: -1100, y: 0 }, beam)!;
    expect(r.face).toBe('W');
    expect(r.status).toBe('overlap');
    expect(r.anchor).toBe('e');
    expect(r.position).toEqual({ x: -1000, y: 0 });
  });

  it('continuous slide — η position κατά μήκος ακολουθεί τον cursor (monotonic)', () => {
    const west = snap({ x: -500, y: 250 }, beam)!;
    const east = snap({ x: 500, y: 250 }, beam)!;
    expect(west.position.x).toBeLessThan(east.position.x);
    expect(west.position.x).toBe(-500);
    expect(east.position.x).toBe(500);
  });
});

describe('resolveColumnFaceSnap — vertical beam target (endsAxis y)', () => {
  const beam = [verticalBeam()];

  it('E face (μακριά παρειά) → 🟢 beam, anchor w', () => {
    const r = snap({ x: 250, y: 0 }, beam)!;
    expect(r.face).toBe('E');
    expect(r.status).toBe('beam');
    expect(r.anchor).toBe('w');
    expect(r.position).toEqual({ x: 150, y: 0 });
  });

  it('N face (κοντή άκρη) → 🔴 overlap', () => {
    const r = snap({ x: 0, y: 1100 }, beam)!;
    expect(r.face).toBe('N');
    expect(r.status).toBe('overlap');
  });
});

describe('resolveColumnFaceSnap — column target (όλες οι παρειές έγκυρες)', () => {
  const cols = [columnTarget(3000, 0)];

  it('N face κολόνας → 🟢 beam (καμία κοντή άκρη), anchor s', () => {
    const r = snap({ x: 3000, y: 250 }, cols)!;
    expect(r.face).toBe('N');
    expect(r.status).toBe('beam');
    expect(r.anchor).toBe('s');
    expect(r.position).toEqual({ x: 3000, y: 200 });
  });

  it('E face κολόνας → 🟢 beam, anchor w', () => {
    const r = snap({ x: 3250, y: 0 }, cols)!;
    expect(r.face).toBe('E');
    expect(r.status).toBe('beam');
    expect(r.anchor).toBe('w');
    expect(r.position).toEqual({ x: 3200, y: 0 });
  });
});

describe('resolveColumnFaceSnap — nearest-target selection', () => {
  const entities = [horizontalBeam(), columnTarget(3000, 0)];

  it('κοντά στην κολόνα → κουμπώνει στην κολόνα (όχι στο μακρινό δοκάρι)', () => {
    const r = snap({ x: 3000, y: 250 }, entities)!;
    expect(r.position).toEqual({ x: 3000, y: 200 }); // κολόνα N face
    expect(r.targetId).toBeNull(); // footprints δεν φέρουν id (μόνο τα δοκάρια)
  });

  it('κοντά στο δοκάρι → κουμπώνει στο δοκάρι (targetId = beam id)', () => {
    const r = snap({ x: 0, y: 250 }, entities)!;
    expect(r.position).toEqual({ x: 0, y: 150 }); // δοκάρι N face
    expect(r.targetId).toBe('beam-h');
  });
});
