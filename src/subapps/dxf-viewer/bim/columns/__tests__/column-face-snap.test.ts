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

  it('ΤΩΡΑ και το δοκάρι παίρνει axis-center (ADR-398 §3.11 — ίδιος κώδικας με τοίχο)', () => {
    const r = snap({ x: 0, y: 0 }, [horizontalBeam()])!;
    // cursor στον άξονα δοκαριού (perp 0 ≤ halfThickness/2=75) → κέντρο στον άξονα.
    expect(r.anchor).toBe('center');
    expect(r.position).toEqual({ x: 0, y: 0 });
  });
});

describe('resolveColumnFaceSnap — ADR-398 §3.11 BEAM-axis CENTER snap (νέο αίτημα Giorgio)', () => {
  // horizontalBeam: άξονας y=0 (x −1000..1000), πάχος 300 (y ±150) → halfThickness=150, όριο=75.
  const beam = [horizontalBeam()];

  it('cursor στον άξονα δοκαριού (perp 0) → κέντρο κολώνας στον άξονα, anchor center, 🟢', () => {
    const r = snap({ x: 300, y: 0 }, beam)!;
    expect(r.anchor).toBe('center');
    expect(r.status).toBe('beam');
    expect(r.position).toEqual({ x: 300, y: 0 }); // foot στον άξονα στο x=300
    expect(r.rotation).toBe(0);
  });

  it('εσωτερική ζώνη (perp 50 ≤ 75) → center-on-axis (foot στον άξονα, ΟΧΙ flush)', () => {
    const r = snap({ x: -400, y: 50 }, beam)!;
    expect(r.anchor).toBe('center');
    expect(r.position).toEqual({ x: -400, y: 0 });
  });

  it('continuous slide κατά μήκος του άξονα δοκαριού → η position ακολουθεί', () => {
    const west = snap({ x: -600, y: 20 }, beam)!;
    const east = snap({ x: 600, y: -20 }, beam)!;
    expect(west.anchor).toBe('center');
    expect(east.anchor).toBe('center');
    expect(west.position).toEqual({ x: -600, y: 0 });
    expect(east.position).toEqual({ x: 600, y: 0 });
  });

  it('εξωτερική ζώνη (perp 120 > 75) → flush παρειά (ΟΧΙ center)', () => {
    const r = snap({ x: 0, y: 120 }, beam)!;
    expect(r.anchor).toBe('s'); // N face flush
    expect(r.position).toEqual({ x: 0, y: 150 });
  });

  it('κοντή άκρη δοκαριού (along εκτός) → 🔴 overlap flush (ΟΧΙ center)', () => {
    const r = snap({ x: 1100, y: 0 }, beam)!;
    expect(r.anchor).not.toBe('center');
    expect(r.status).toBe('overlap');
  });

  it('ΛΟΞΟ δοκάρι (45°) → center-on-axis + στραμμένη (rotation ≈ 45)', () => {
    const oblique: Entity = {
      id: 'beam-d', type: 'beam',
      geometry: {
        axisPolyline: { points: [{ x: 0, y: 0 }, { x: 1414, y: 1414 }] },
        outline: {
          vertices: [
            { x: -106, y: 106 }, { x: 1308, y: 1520 },
            { x: 1520, y: 1308 }, { x: 106, y: -106 },
          ],
        },
      },
    } as unknown as Entity;
    const r = snap({ x: 700, y: 700 }, [oblique])!; // πάνω στον λοξό άξονα
    expect(r.anchor).toBe('center');
    expect(Math.abs(r.rotation - 45)).toBeLessThan(1);
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

  it('axis-aligned ορθογώνια κολόνα → rotation 0 (μηδέν regression — edge-snap ίσο feel)', () => {
    expect(snap({ x: 3000, y: 250 }, cols)!.rotation).toBe(0);
  });
});

// ── ADR-398 §3.18 — το φάντασμα ΑΚΟΛΟΥΘΕΙ τις ΛΟΞΕΣ/ΠΟΛΥΓΩΝΙΚΕΣ παρειές (το αίτημα του handoff) ──
describe('resolveColumnFaceSnap — ΛΟΞΗ/ΠΟΛΥΓΩΝΙΚΗ κολόνα-στόχος (slant-following edges)', () => {
  /** Διαμάντι (τετράγωνο στραμμένο 45°) κεντραρισμένο στο (3000,0): όλες οι παρειές στις 45°. */
  function diamondColumn(id = 'col-diamond'): Entity {
    return {
      id, type: 'column', kind: 'polygon',
      geometry: { footprint: { vertices: [
        { x: 3000, y: 200 }, { x: 3200, y: 0 }, { x: 3000, y: -200 }, { x: 2800, y: 0 },
      ] } },
    } as unknown as Entity;
  }
  /** Κανονικό εξάγωνο (κυκλικό περιγεγραμμένο R=200) κεντραρισμένο στο (3000,0). */
  function hexColumn(id = 'col-hex'): Entity {
    return {
      id, type: 'column', kind: 'polygon',
      geometry: { footprint: { vertices: [
        { x: 3200, y: 0 }, { x: 3100, y: 173 }, { x: 2900, y: 173 },
        { x: 2800, y: 0 }, { x: 2900, y: -173 }, { x: 3100, y: -173 },
      ] } },
    } as unknown as Entity;
  }

  it('λοξή παρειά 45° → το φάντασμα ΣΤΡΕΦΕΤΑΙ flush (|rotation| ≈ 45, ΟΧΙ ορθό bbox)', () => {
    // cursor λίγο έξω από το μέσο της ΒΑ παρειάς (3000,200)→(3200,0) (outward normal ≈ (.707,.707)).
    const r = snap({ x: 3135, y: 135 }, [diamondColumn()])!;
    expect(Math.abs(Math.abs(r.rotation) - 45)).toBeLessThan(1);
    expect(r.status).toBe('beam');
  });

  it('λοξή παρειά → flush ΠΑΝΩ στην πραγματική (λοξή) ακμή, ΟΧΙ στο axis-aligned bbox', () => {
    // η ΒΑ ακμή είναι η ευθεία x + y = 3200· το flush σημείο πρέπει να κάθεται πάνω της (facePerp 0).
    const r = snap({ x: 3135, y: 135 }, [diamondColumn()])!;
    expect(r.position.x + r.position.y).toBeCloseTo(3200, 0);
  });

  it('πολυγωνική (εξάγωνο) κολόνα → κουμπώνει σε λοξή παρειά με στροφή ≠ 0', () => {
    // πάνω-δεξιά παρειά (3200,0)→(3100,173): κλίση ≈ atan2(173,-100) → στραμμένη.
    const r = snap({ x: 3200, y: 100 }, [hexColumn()])!;
    expect(r.status).toBe('beam');
    expect(r.rotation).not.toBe(0); // ΑΚΟΛΟΥΘΕΙ τη λοξή παρειά (το bbox θα έδινε 0)
  });

  it('στραμμένη ΟΡΘΟΓΩΝΙΑ κολόνα → edges ακολουθούν τη στροφή (το bbox την ίσιωνε)', () => {
    // ορθογώνιο 400×200 στραμμένο 45° (κέντρο 3000,0): οι μακριές παρειές στις 45°.
    const rotRect: Entity = {
      id: 'col-rot', type: 'column', kind: 'rectangular',
      geometry: { footprint: { vertices: [
        { x: 3000, y: 283 }, { x: 3212, y: 71 }, { x: 3000, y: -283 }, { x: 2788, y: 71 },
      ] } },
    } as unknown as Entity;
    const r = snap({ x: 3170, y: 220 }, [rotRect])!;
    expect(r.rotation).not.toBe(0);
    expect(r.status).toBe('beam');
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

  // ── ADR-398 §3.11 — center-on-axis ολίσθηση πάνω στον άξονα ακμής (το αίτημα του handoff) ──
  describe('§3.11 center-on-axis (threshold ±150mm — Giorgio 2026-06-22)', () => {
    it('cursor κάθετα κοντά στην κάτω ακμή (perp 80 ≤ 150) → ΚΕΝΤΡΟ στον άξονα, anchor center', () => {
      const r = snap({ x: 1000, y: 80 }, [slab()])!;
      expect(r.anchor).toBe('center');
      expect(r.status).toBe('beam');
      expect(r.position).toEqual({ x: 1000, y: 0 }); // foot στον άξονα στο x=1000
      expect(r.rotation).toBe(0); // axis-aligned → ορθή
    });

    it('slide κατά μήκος του άξονα → η position ακολουθεί, anchor μένει center', () => {
      const west = snap({ x: 500, y: 60 }, [slab()])!;
      const east = snap({ x: 1500, y: 60 }, [slab()])!;
      expect(west.anchor).toBe('center');
      expect(east.anchor).toBe('center');
      expect(west.position).toEqual({ x: 500, y: 0 });
      expect(east.position).toEqual({ x: 1500, y: 0 });
    });

    it('cursor τραβηγμένος σε πλευρά (perp 250 > 150) → flush (ΟΧΙ center)', () => {
      const r = snap({ x: 1000, y: 250 }, [slab()])!;
      expect(r.anchor).not.toBe('center');
      expect(r.status).toBe('beam');
      expect(Math.abs(r.position.y)).toBeLessThanOrEqual(EDGE_EPS);
    });

    it('κάθετη ακμή (x=2000), cursor perp 50 → center, foot στον άξονα, rotation 0', () => {
      const r = snap({ x: 1950, y: 1000 }, [slab()])!;
      expect(r.anchor).toBe('center');
      expect(r.position).toEqual({ x: 2000, y: 1000 });
      expect(r.rotation).toBe(0);
    });

    it('ΛΟΞΗ ακμή 45°, cursor perp ≈ 35 ≤ 150 → center + στραμμένη (rotation ≈ 45)', () => {
      const r = snap({ x: 1000, y: 1050 }, [diagonalSlab()])!;
      expect(r.anchor).toBe('center');
      expect(r.status).toBe('beam');
      expect(Math.abs(r.rotation - 45)).toBeLessThan(1);
      expect(r.position.x).toBeCloseTo(1025, 0); // foot πάνω στη διαγώνιο y=x
      expect(r.position.y).toBeCloseTo(1025, 0);
    });
  });
});

describe('resolveColumnFaceSnap — ADR-398 §3.11 σκέτη ΓΡΑΜΜΗ (ίδιο zero-width path με ακμή πλάκας)', () => {
  /** Σκέτη γραμμή (LineEntity, top-level start/end) από (sx,sy)→(ex,ey). */
  function lineEntity(sx: number, sy: number, ex: number, ey: number, id = 'line-1'): Entity {
    return { id, type: 'line', start: { x: sx, y: sy }, end: { x: ex, y: ey } } as unknown as Entity;
  }
  const EDGE_EPS = 2.001; // ίδιο zero-width band μοντέλο με ακμή πλάκας

  const hLine = [lineEntity(0, 0, 2000, 0)]; // οριζόντια γραμμή y=0

  it('cursor κάθετα κοντά στη γραμμή (perp 80 ≤ 150) → ΚΕΝΤΡΟ στον άξονα, anchor center', () => {
    const r = snap({ x: 1000, y: 80 }, hLine)!;
    expect(r.anchor).toBe('center');
    expect(r.status).toBe('beam');
    expect(r.position).toEqual({ x: 1000, y: 0 });
    expect(r.rotation).toBe(0);
  });

  it('slide κατά μήκος της γραμμής → η position ακολουθεί, anchor μένει center', () => {
    const west = snap({ x: 500, y: 60 }, hLine)!;
    const east = snap({ x: 1500, y: -60 }, hLine)!;
    expect(west.anchor).toBe('center');
    expect(east.anchor).toBe('center');
    expect(west.position).toEqual({ x: 500, y: 0 });
    expect(east.position).toEqual({ x: 1500, y: 0 });
  });

  it('cursor εκατέρωθεν, τραβηγμένος σε πλευρά (perp 300 > 150) → flush (ΟΧΙ center)', () => {
    const r = snap({ x: 1000, y: 300 }, hLine)!;
    expect(r.anchor).not.toBe('center');
    expect(Math.abs(r.position.y)).toBeLessThanOrEqual(EDGE_EPS);
  });

  it('κάθετη γραμμή x=0, cursor perp 50 → center, foot στον άξονα', () => {
    const r = snap({ x: 50, y: 1000 }, [lineEntity(0, 0, 0, 2000)])!;
    expect(r.anchor).toBe('center');
    expect(r.position).toEqual({ x: 0, y: 1000 });
  });

  it('ΛΟΞΗ γραμμή 45°, cursor perp ≈ 35 → center + στραμμένη (rotation ≈ 45)', () => {
    const r = snap({ x: 1000, y: 1050 }, [lineEntity(0, 0, 2000, 2000)])!;
    expect(r.anchor).toBe('center');
    expect(Math.abs(r.rotation - 45)).toBeLessThan(1);
    expect(r.position.x).toBeCloseTo(1025, 0);
    expect(r.position.y).toBeCloseTo(1025, 0);
  });

  it('μακριά από τη γραμμή (> capture) → null', () => {
    expect(snap({ x: 1000, y: 1000 }, hLine)).toBeNull();
  });
});

describe('resolveColumnFaceSnap — ADR-398 §3.11 ΠΟΛΥΓΡΑΜΜΗ (ίδιο zero-width path, ένα edge ανά τμήμα)', () => {
  /** Πολυγραμμή (polyline/lwpolyline, top-level vertices+closed). */
  function poly(vertices: Point2D[], closed = false, type: 'polyline' | 'lwpolyline' = 'polyline', id = 'pl-1'): Entity {
    return { id, type, vertices, closed } as unknown as Entity;
  }
  // L-σχήμα ανοιχτό: (0,0)→(2000,0)→(2000,2000) — 2 τμήματα (οριζόντιο + κάθετο).
  const lShape = [poly([{ x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 2000, y: 2000 }])];

  it('cursor κοντά στο 1ο τμήμα (οριζόντιο) → center-on-axis στο y=0', () => {
    const r = snap({ x: 1000, y: 80 }, lShape)!;
    expect(r.anchor).toBe('center');
    expect(r.position).toEqual({ x: 1000, y: 0 });
  });

  it('cursor κοντά στο 2ο τμήμα (κάθετο) → center-on-axis στο x=2000', () => {
    const r = snap({ x: 1920, y: 1000 }, lShape)!;
    expect(r.anchor).toBe('center');
    expect(r.position).toEqual({ x: 2000, y: 1000 });
  });

  it('cursor τραβηγμένος σε πλευρά τμήματος (perp 300 > 150) → flush', () => {
    const r = snap({ x: 1000, y: 300 }, lShape)!;
    expect(r.anchor).not.toBe('center');
  });

  it('ΚΛΕΙΣΤΗ πολυγραμμή → και το τμήμα last→first γίνεται στόχος', () => {
    // τρίγωνο (0,0)→(2000,0)→(1000,1732) closed· το closing edge (1000,1732)→(0,0) είναι λοξό.
    const tri = [poly([{ x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 1000, y: 1732 }], true)];
    // σημείο πάνω στο closing edge (midpoint ≈ (500,866))
    const r = snap({ x: 500, y: 866 }, tri)!;
    expect(r.anchor).toBe('center');
    expect(r.status).toBe('beam');
  });

  it('lwpolyline → ίδια συμπεριφορά με polyline', () => {
    const lw = [poly([{ x: 0, y: 0 }, { x: 2000, y: 0 }], false, 'lwpolyline')];
    const r = snap({ x: 1000, y: 80 }, lw)!;
    expect(r.anchor).toBe('center');
    expect(r.position).toEqual({ x: 1000, y: 0 });
  });
});

describe('resolveColumnFaceSnap — ADR-398 §3.11 ΟΡΘΟΓΩΝΙΟ (4 πλευρές = zero-width edges)', () => {
  /** RectangleEntity (x,y,width,height). */
  function rect(x: number, y: number, w: number, h: number, id = 'rc-1'): Entity {
    return { id, type: 'rectangle', x, y, width: w, height: h } as unknown as Entity;
  }
  const r1 = [rect(0, 0, 2000, 2000)];

  it('cursor κοντά στην κάτω πλευρά (y=0) → center-on-axis', () => {
    const r = snap({ x: 1000, y: 80 }, r1)!;
    expect(r.anchor).toBe('center');
    expect(r.position).toEqual({ x: 1000, y: 0 });
  });

  it('cursor κοντά στη δεξιά πλευρά (x=2000) → center-on-axis', () => {
    const r = snap({ x: 1920, y: 500 }, r1)!;
    expect(r.anchor).toBe('center');
    expect(r.position).toEqual({ x: 2000, y: 500 });
  });

  it('cursor στο κέντρο, > capture από κάθε πλευρά → null', () => {
    expect(snap({ x: 1000, y: 1000 }, r1)).toBeNull();
  });

  it('cursor σε πλευρά αλλά perp > 150 → flush (ΟΧΙ center)', () => {
    const r = snap({ x: 1000, y: 300 }, r1)!;
    expect(r.anchor).not.toBe('center');
  });
});

describe('resolveColumnFaceSnap — ADR-398 §3.11 ΚΥΚΛΟΣ (περιφέρεια tessellated σε zero-width edges)', () => {
  /** CircleEntity (center, radius). */
  function circle(cx: number, cy: number, r: number, id = 'cir-1'): Entity {
    return { id, type: 'circle', center: { x: cx, y: cy }, radius: r } as unknown as Entity;
  }
  const c1 = [circle(0, 0, 1000)]; // κύκλος ακτίνας 1000 στο (0,0)

  it('cursor κοντά στην περιφέρεια → ολίσθηση πάνω στον κύκλο (anchor center, 🟢)', () => {
    const r = snap({ x: 1000, y: 50 }, c1)!; // λίγο έξω από το σημείο (1000,0)
    expect(r.anchor).toBe('center');
    expect(r.status).toBe('beam');
    // foot πάνω στη χορδή ≈ στην περιφέρεια (chord sag μικρό για 24 τμήματα).
    expect(Math.abs(Math.hypot(r.position.x, r.position.y) - 1000)).toBeLessThan(30);
  });

  it('cursor στο κέντρο του κύκλου (> capture από περιφέρεια) → null', () => {
    expect(snap({ x: 0, y: 0 }, c1)).toBeNull();
  });

  // ── ADR-398 §3.12 — arc-length listening dims: faceFrame.arc + ακριβής re-projection ──
  it('§3.12 — faceFrame.arc φέρει τη γεωμετρία περιφέρειας + θέση ΑΚΡΙΒΩΣ στον κύκλο', () => {
    const r = snap({ x: 1000, y: 50 }, c1)!;
    expect(r.faceFrame.arc).toEqual({ center: { x: 0, y: 0 }, radius: 1000, startAngle: 0, endAngle: 360 });
    // re-projection: η κολώνα κάθεται ΑΚΡΙΒΩΣ στην περιφέρεια (όχι chord-inset).
    expect(Math.hypot(r.position.x, r.position.y)).toBeCloseTo(1000, 6);
  });

  it('§3.12 — ΤΟΞΟ (ArcEntity) → faceFrame.arc με τα ΠΡΑΓΜΑΤΙΚΑ άκρα + θέση στο τόξο', () => {
    const arc = { id: 'A1', type: 'arc', center: { x: 0, y: 0 }, radius: 1000, startAngle: 0, endAngle: 180 } as unknown as Entity;
    // cursor 50mm ακτινικά έξω, στη γωνία 50° (mid-chord, ΟΧΙ σε vertex) → κουμπώνει στο τόξο.
    const r = snap({ x: 1050 * Math.cos((50 * Math.PI) / 180), y: 1050 * Math.sin((50 * Math.PI) / 180) }, [arc])!;
    expect(r.faceFrame.arc).toEqual({ center: { x: 0, y: 0 }, radius: 1000, startAngle: 0, endAngle: 180 });
    expect(Math.hypot(r.position.x, r.position.y)).toBeCloseTo(1000, 6);
  });
});

describe('resolveColumnFaceSnap — §3.12 ΤΟΞΟ continuous slide (ΙΔΙΑ συμπεριφορά με κύκλο)', () => {
  /** Ημικύκλιο 0°→180°, r=1000 στο (0,0). */
  const arc = [{ id: 'A1', type: 'arc', center: { x: 0, y: 0 }, radius: 1000, startAngle: 0, endAngle: 180 } as unknown as Entity];
  /** Cursor 50mm ακτινικά έξω από το τόξο στη γωνία `deg`. */
  const outsideAt = (deg: number): Point2D => ({ x: 1050 * Math.cos((deg * Math.PI) / 180), y: 1050 * Math.sin((deg * Math.PI) / 180) });

  it('ολισθαίνει συνεχόμενα κατά μήκος του τόξου (anchor center, 🟢, ΑΚΡΙΒΩΣ στην περιφέρεια)', () => {
    const angles = [20, 50, 80, 110, 140]; // mid-chord (όχι σε vertex 7.5°), εντός span
    const colAngles: number[] = [];
    for (const a of angles) {
      const r = snap(outsideAt(a), arc)!;
      expect(r).not.toBeNull();
      expect(r.anchor).toBe('center');
      expect(r.status).toBe('beam');
      expect(Math.hypot(r.position.x, r.position.y)).toBeCloseTo(1000, 6); // re-projected στην καμπύλη
      colAngles.push((Math.atan2(r.position.y, r.position.x) * 180) / Math.PI);
    }
    // Η θέση της κολώνας ακολουθεί ΜΟΝΟΤΟΝΑ τον cursor κατά μήκος του τόξου (continuous slide).
    for (let i = 1; i < colAngles.length; i++) expect(colAngles[i]).toBeGreaterThan(colAngles[i - 1]);
  });

  it('ΔΕΝ κουμπώνει εκτός του angular span του τόξου (270° σε ημικύκλιο 0-180 → null)', () => {
    expect(snap(outsideAt(270), arc)).toBeNull(); // κάτω ημικύκλιο δεν υπάρχει → καμία χορδή εντός capture
  });

  // ── BUGFIX (Giorgio 2026-06-22): η ολίσθηση εφαρμοζόταν στην ΚΡΥΦΗ πλευρά CW τόξου, όχι στη φανερή ──
  it('CW τόξο (counterclockwise=true): κουμπώνει στη ΦΑΝΕΡΗ πλευρά, ΟΧΙ στο συμπληρωματικό (κρυφό)', () => {
    // start=0,end=90,ccw=true → renderer σχεδιάζει CW → ορατό CCW εύρος = [90→360] (μεγάλο τόξο).
    // Κρυφό = το μικρό [0,90] (πάνω-δεξιά τεταρτημόριο).
    const cw = [{ id: 'CW1', type: 'arc', center: { x: 0, y: 0 }, radius: 1000, startAngle: 0, endAngle: 90, counterclockwise: true } as unknown as Entity];
    // 200° = ΦΑΝΕΡΗ πλευρά (εντός [90→360], mid-chord) → κουμπώνει.
    const visible = snap(outsideAt(200), cw)!;
    expect(visible).not.toBeNull();
    expect(visible.anchor).toBe('center');
    expect(Math.hypot(visible.position.x, visible.position.y)).toBeCloseTo(1000, 6);
    // 45° = ΚΡΥΦΗ πλευρά (συμπληρωματικό) → ΔΕΝ κουμπώνει.
    expect(snap(outsideAt(45), cw)).toBeNull();
  });
});

describe('collectSceneSnapTargets + resolveColumnFaceSnapFromTargets (core SSoT)', () => {
  it('ορθογώνιο → lineTargets (4 πλευρές)', () => {
    const rc = { id: 'R1', type: 'rectangle', x: 0, y: 0, width: 1000, height: 500 } as unknown as Entity;
    expect(collectSceneSnapTargets([rc]).lineTargets).toHaveLength(4);
  });

  it('κύκλος → lineTargets (περιφέρεια tessellated, πολλά τμήματα)', () => {
    const cir = { id: 'C1', type: 'circle', center: { x: 0, y: 0 }, radius: 1000 } as unknown as Entity;
    expect(collectSceneSnapTargets([cir]).lineTargets.length).toBeGreaterThan(8);
  });

  it('διαχωρίζει σωστά κολόνες/δοκάρια/πλάκες/γραμμές ανά είδος', () => {
    const t = collectSceneSnapTargets([horizontalBeam(), columnTarget(3000, 0)]);
    expect(t.beamTargets).toHaveLength(1);
    expect(t.footprints).toHaveLength(1);
    expect(t.wallTargets).toHaveLength(0);
    expect(t.slabTargets).toHaveLength(0);
    expect(t.lineTargets).toHaveLength(0);
  });

  it('σκέτη γραμμή → lineTargets (1 zero-width edge), όχι slab/beam/wall', () => {
    const line = { id: 'L1', type: 'line', start: { x: 0, y: 0 }, end: { x: 1000, y: 0 } } as unknown as Entity;
    const t = collectSceneSnapTargets([line]);
    expect(t.lineTargets).toHaveLength(1);
    expect(t.slabTargets).toHaveLength(0);
    expect(t.beamTargets).toHaveLength(0);
  });

  it('πολυγραμμή ανοιχτή 3 κορυφών → lineTargets (2 τμήματα)· κλειστή → 3', () => {
    const verts = [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }];
    const open = collectSceneSnapTargets([{ id: 'P1', type: 'polyline', vertices: verts, closed: false } as unknown as Entity]);
    expect(open.lineTargets).toHaveLength(2);
    const closed = collectSceneSnapTargets([{ id: 'P2', type: 'lwpolyline', vertices: verts, closed: true } as unknown as Entity]);
    expect(closed.lineTargets).toHaveLength(3);
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
