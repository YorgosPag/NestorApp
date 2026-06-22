/**
 * column-face-snap — ADR-398 §Column smart-ghost face-snap (ADR-508 reuse).
 *
 * Επαληθεύει το πιστό «δοκάρι→κολώνα» mirror: κάθε παρειά × ζώνη → σωστή auto-λαβή + flush
 * position, 🟢 valid σε μακριά παρειά / 🔴 overlap σε κοντή άκρη δοκαριού, continuous slide,
 * κολόνα-στόχος (όλες οι παρειές έγκυρες), capture distance.
 */

import {
  resolveColumnFaceSnap,
  resolveColumnFaceSnapFromTargets,
  type ColumnFaceSnap,
} from '../column-face-snap';
import { collectSceneSnapTargets } from '../../framing/scene-snap-targets';
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

/** Οριζόντιος τοίχος: άξονας y=0 (x −1000..1000), πάχος 200 (y −100..100). endsAxis = 'x'. */
function horizontalWall(id = 'wall-h'): Entity {
  return {
    id,
    type: 'wall',
    geometry: {
      axisPolyline: { points: [{ x: -1000, y: 0 }, { x: 1000, y: 0 }] },
      outerEdge: { points: [{ x: -1000, y: 100 }, { x: 1000, y: 100 }] },
      innerEdge: { points: [{ x: -1000, y: -100 }, { x: 1000, y: -100 }] },
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

describe('resolveColumnFaceSnap — wall target (ίδια συμπεριφορά με δοκάρι)', () => {
  const wall = [horizontalWall()];

  it('μακριά παρειά τοίχου (N) → 🟢 beam, anchor s, flush στην παρειά', () => {
    const r = snap({ x: 0, y: 200 }, wall)!;
    expect(r.face).toBe('N');
    expect(r.status).toBe('beam');
    expect(r.anchor).toBe('s');
    expect(r.position).toEqual({ x: 0, y: 100 });
  });

  it('κοντή άκρη τοίχου (E) → 🟢 beam (ΕΠΙΤΡΕΠΕΤΑΙ κολώνα — ΟΧΙ red όπως δοκάρι)', () => {
    const r = snap({ x: 1100, y: 0 }, wall)!;
    expect(r.face).toBe('E');
    expect(r.status).toBe('beam');
  });

  it('κοντή άκρη τοίχου (W) → 🟢 beam', () => {
    const r = snap({ x: -1100, y: 0 }, wall)!;
    expect(r.face).toBe('W');
    expect(r.status).toBe('beam');
  });

  it('lo zone τοίχου → anchor sw flush γωνία', () => {
    const r = snap({ x: -1000, y: 200 }, wall)!;
    expect(r.third).toBe('lo');
    expect(r.anchor).toBe('sw');
    expect(r.position).toEqual({ x: -1000, y: 100 });
  });
});

describe('resolveColumnFaceSnap — ADR-398 §3.9 wall-axis CENTER snap (mirror §3.1b)', () => {
  // horizontalWall: άξονας y=0 (x −1000..1000), πάχος 200 (y ±100) → halfThickness=100, όριο=50.
  const wall = [horizontalWall()];

  it('cursor πάνω στον άξονα (y=0) → κέντρο κολώνας στον άξονα, anchor center, 🟢', () => {
    const r = snap({ x: 0, y: 0 }, wall)!;
    expect(r.anchor).toBe('center');
    expect(r.status).toBe('beam');
    expect(r.position).toEqual({ x: 0, y: 0 });
  });

  it('εσωτερική ζώνη (perp 30 ≤ 50) → center-on-axis (foot στον άξονα, ΟΧΙ flush)', () => {
    const r = snap({ x: 500, y: 30 }, wall)!;
    expect(r.anchor).toBe('center');
    expect(r.position).toEqual({ x: 500, y: 0 }); // foot στον άξονα στο x=500
  });

  it('continuous slide κατά μήκος άξονα — η position ακολουθεί τον cursor', () => {
    const west = snap({ x: -400, y: -20 }, wall)!;
    const east = snap({ x: 400, y: 20 }, wall)!;
    expect(west.anchor).toBe('center');
    expect(east.anchor).toBe('center');
    expect(west.position).toEqual({ x: -400, y: 0 });
    expect(east.position).toEqual({ x: 400, y: 0 });
  });

  it('εξωτερική ζώνη μέσα στον τοίχο (perp 70 > 50) → flush παρειά (ΟΧΙ center)', () => {
    const r = snap({ x: 0, y: 70 }, wall)!;
    expect(r.anchor).toBe('s'); // N face flush
    expect(r.position).toEqual({ x: 0, y: 100 });
  });

  it('πέρα από την άκρη του τοίχου (along εκτός) → flush short-end (ΟΧΙ center)', () => {
    const r = snap({ x: 1100, y: 0 }, wall)!;
    expect(r.anchor).toBe('w'); // E face flush, ΟΧΙ center
    expect(r.position).toEqual({ x: 1000, y: 0 });
  });

  it('δοκάρι ΔΕΝ παίρνει axis-center (μόνο τοίχος) — μένει flush face', () => {
    const r = snap({ x: 0, y: 0 }, [horizontalBeam()]);
    // cursor στον άξονα δοκαριού: ΟΧΙ wallFrame → flush path (S ή N face), anchor ΟΧΙ center
    expect(r?.anchor).not.toBe('center');
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

describe('resolveColumnFaceSnap — slab edge (ADR-398 §3.10 axis-relative — η ρίζα του handoff)', () => {
  /** Τετράγωνη πλάκα x 0..2000, y 0..2000. */
  function slab(id = 'slab-1'): Entity {
    return {
      id,
      type: 'slab',
      geometry: {
        polygon: {
          vertices: [{ x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 2000, y: 2000 }, { x: 0, y: 2000 }],
        },
      },
    } as unknown as Entity;
  }

  // Το `slabEdgeTargets` μοντελοποιεί κάθε ακμή ως πολύ λεπτή band ±eps (eps = len·0.001 = 2 για
  // ακμή 2000)· ο axis-relative resolver κουμπώνει flush στην κοντινή όψη → η κολώνα εδράζεται
  // εντός ~eps της ακμής (αμελητέο, ΙΔΙΟ μοντέλο με τοίχο/δοκάρι).
  const EDGE_EPS = 2.001;

  it('κοντά στην κάτω ακμή (y=0) → κουμπώνει flush στην ακμή (position.y ≈ 0 ± eps)', () => {
    const r = snap({ x: 1000, y: 120 }, [slab()])!;
    expect(Math.abs(r.position.y)).toBeLessThanOrEqual(EDGE_EPS);
    expect(r.position.x).toBeCloseTo(1000);
    expect(r.status).toBe('beam');
  });

  it('κοντά στην δεξιά ακμή (x=2000) → κουμπώνει flush (position.x ≈ 2000 ± eps)', () => {
    const r = snap({ x: 1880, y: 1000 }, [slab()])!;
    expect(Math.abs(r.position.x - 2000)).toBeLessThanOrEqual(EDGE_EPS);
    expect(r.position.y).toBeCloseTo(1000);
  });

  it('axis-aligned ακμή → rotation 0 (μηδέν regression)', () => {
    expect(snap({ x: 1000, y: 120 }, [slab()])!.rotation).toBe(0);
  });

  // ADR-398 §3.10b — τρίγωνη πλάκα με ΛΟΞΗ ακμή 45° (0,0)→(2000,2000).
  function diagonalSlab(): Entity {
    return {
      id: 'slab-d', type: 'slab',
      geometry: { polygon: { vertices: [{ x: 0, y: 0 }, { x: 2000, y: 2000 }, { x: 0, y: 2000 }] } },
    } as unknown as Entity;
  }

  it('ΛΟΞΗ ακμή πλάκας (45°) → η κολώνα ΣΤΡΕΦΕΤΑΙ flush (rotation ≈ 45°, ΟΧΙ πάντα ορθή)', () => {
    const r = snap({ x: 1100, y: 900 }, [diagonalSlab()])!;
    expect(Math.abs(r.rotation - 45)).toBeLessThan(1);
    expect(r.status).toBe('beam');
  });

  it('μακριά από κάθε ακμή (κέντρο πλάκας, > capture) → null', () => {
    expect(snap({ x: 1000, y: 1000 }, [slab()])).toBeNull();
  });
});

describe('collectSceneSnapTargets + resolveColumnFaceSnapFromTargets (core SSoT)', () => {
  it('διαχωρίζει σωστά κολόνες/δοκάρια/πλάκες ανά είδος', () => {
    const t = collectSceneSnapTargets([horizontalBeam(), columnTarget(3000, 0)]);
    expect(t.beamTargets).toHaveLength(1);
    expect(t.footprints).toHaveLength(1);
    expect(t.wallTargets).toHaveLength(0);
    expect(t.slabTargets).toHaveLength(0);
  });

  it('ο core δίνει ΤΟ ΙΔΙΟ αποτέλεσμα με το wrapper (preview ≡ commit path)', () => {
    const entities = [horizontalBeam()];
    const cursor: Point2D = { x: 0, y: 250 };
    const viaWrapper = resolveColumnFaceSnap(cursor, entities, 'mm');
    const viaCore = resolveColumnFaceSnapFromTargets(cursor, collectSceneSnapTargets(entities), 'mm');
    expect(viaCore).toEqual(viaWrapper);
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
