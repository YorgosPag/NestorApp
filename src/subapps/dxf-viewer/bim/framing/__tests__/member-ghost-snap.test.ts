/**
 * ADR-508 — dispatcher (`resolveMemberGhostSnapFromStore`), column face snap, generic
 * collector (`collectMemberSnapTargets`) και flush justification. Scene units = mm.
 */

import { resolveMemberColumnFaceSnap } from '../member-column-face-snap';
import { resolveMemberGhostSnapFromStore } from '../member-ghost-snap';
import { collectMemberSnapTargets } from '../member-snap-targets';
import { resolveMemberColumnFlushJustification } from '../member-column-flush';
import type { Entity } from '../../../types/entities';

/** Τετράγωνη κολόνα 400×400 με κέντρο (200,200). */
const COLUMN_FP = [
  { x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 400 }, { x: 0, y: 400 },
];

describe('resolveMemberColumnFaceSnap — ΣΥΝΕΧΗΣ face snap (ADR-508 ενοποίηση)', () => {
  it('Ανατολική παρειά, cursor στο κέντρο → start στην παρειά (x=400), centerline=κέντρο + faceFrame', () => {
    const r = resolveMemberColumnFaceSnap({ x: 700, y: 200 }, [COLUMN_FP], {
      memberWidthScene: 200, ghostLenScene: 1200, captureScene: 600,
    });
    expect(r).not.toBeNull();
    expect(r!.face).toBe('E');
    expect(r!.third).toBe('mid');
    expect(r!.start).toEqual({ x: 400, y: 200 });
    expect(r!.end).toEqual({ x: 1600, y: 200 });
    // ADR-508 §dim — εκθέτει faceFrame (→ listening dimensions & στις κολόνες). E face = κάθετος άξονας.
    expect(r!.faceFrame).toBeDefined();
    expect(r!.faceFrame.axisDir).toEqual({ x: 0, y: 1 });
    expect(r!.faceFrame.ghostHalfWidth).toBe(0);
  });

  it('ΣΥΝΕΧΗΣ ολίσθηση: cursor εκτός κέντρου, ΧΩΡΙΣ step → start ακολουθεί τον cursor (όχι 12-jump)', () => {
    // y=250 (μεσαίο third). Παλιά (διακριτό) → κούμπωνε στο κέντρο (200). Τώρα συνεχές → 250.
    const r = resolveMemberColumnFaceSnap({ x: 700, y: 250 }, [COLUMN_FP], {
      memberWidthScene: 200, ghostLenScene: 1200, captureScene: 600,
    });
    expect(r!.face).toBe('E');
    expect(r!.start.y).toBeCloseTo(250);
  });

  it('Proportional βήμα: με dominantUnitScene → ολίσθηση σε λεπτό βήμα = πλάτος/N', () => {
    // COLUMN 400×400, πλάτος 200, dominantUnit=1cm → N=round(400/10)=40 → βήμα = 200/40 = 5mm.
    const r = resolveMemberColumnFaceSnap({ x: 700, y: 212 }, [COLUMN_FP], {
      memberWidthScene: 200, ghostLenScene: 1200, captureScene: 600, dominantUnitScene: 10,
    });
    expect(r!.start.y).toBeCloseTo(210); // 212 → πλησιέστερο πολλαπλάσιο του 5mm
  });

  it('Μακριά από κολόνα (πέρα από capture) → null', () => {
    const r = resolveMemberColumnFaceSnap({ x: 5000, y: 5000 }, [COLUMN_FP], {
      memberWidthScene: 200, ghostLenScene: 1200, captureScene: 600,
    });
    expect(r).toBeNull();
  });
});

describe('resolveMemberColumnFaceSnap — ADR-508 §center-snap (κέντρο↔κέντρο, nearest-wins)', () => {
  // COLUMN_FP 400×400, center (200,200) → centerCapture = min(200,200)·0.5 = 100.
  const OPTS = { memberWidthScene: 200, ghostLenScene: 1200, captureScene: 600 } as const;

  it('center-wins: cursor κοντά στο centroid (εντός magnet 100) → start = centroid, faceFrame centered', () => {
    const r = resolveMemberColumnFaceSnap({ x: 230, y: 210 }, [COLUMN_FP], OPTS); // dCenter≈31.6 < 100
    expect(r!.start.x).toBeCloseTo(200);
    expect(r!.start.y).toBeCloseTo(200);
    expect(r!.third).toBe('mid');
    expect(r!.faceFrame.facePerp).toBe(0);
    expect(r!.faceFrame.ghostHalfWidth).toBe(0);
    expect(r!.faceFrame.axisDir).toEqual({ x: 0, y: 1 }); // E face → άξονας κατά μήκος Y
  });

  it('face-wins: cursor κοντά σε παρειά (εκτός magnet) → start στην παρειά (όχι centroid)', () => {
    const r = resolveMemberColumnFaceSnap({ x: 560, y: 200 }, [COLUMN_FP], OPTS); // dCenter≈360, dFace≈160
    expect(r!.start.x).toBeCloseTo(400); // ανατολική παρειά, ΟΧΙ 200
  });

  it('tie-break (center-biased ≤): dCenter === dFace εκτός magnet → κέντρο κερδίζει', () => {
    // N face· faceContact=(200,400)· cursor (200,300): dCenter=100=dFace → dCenter>dFace false → center.
    const r = resolveMemberColumnFaceSnap({ x: 200, y: 300 }, [COLUMN_FP], OPTS);
    expect(r!.start.x).toBeCloseTo(200);
    expect(r!.start.y).toBeCloseTo(200);
  });

  it('magnet boundary: dCenter ≤ 100 → κέντρο· dCenter > 100 με παρειά πιο κοντά → παρειά', () => {
    const inside = resolveMemberColumnFaceSnap({ x: 200, y: 295 }, [COLUMN_FP], OPTS); // dCenter=95 < 100
    expect(inside!.start.y).toBeCloseTo(200); // centroid
    const outside = resolveMemberColumnFaceSnap({ x: 200, y: 320 }, [COLUMN_FP], OPTS); // dCenter=120, dFace=80
    expect(outside!.start.y).toBeCloseTo(400); // N παρειά flush
  });

  it('dispatcher: cursor κοντά στο centroid → status neutral + start = centroid + faceFrame', () => {
    const r = resolveMemberGhostSnapFromStore({ x: 230, y: 210 }, [COLUMN_FP], [], 200, 'mm');
    expect(r!.status).toBe('neutral');
    expect(r!.start.x).toBeCloseTo(200);
    expect(r!.start.y).toBeCloseTo(200);
    expect(r!.faceFrame).toBeDefined();
  });
});

describe('resolveMemberColumnFaceSnap — ADR-508 §rotated-column (λοξή ορθογώνια κολόνα)', () => {
  const OPTS = { memberWidthScene: 200, ghostLenScene: 1200, captureScene: 600 } as const;
  const SQRT1_2 = Math.SQRT1_2; // cos45 = sin45 ≈ 0.7071

  /** Τετράγωνο `side` κεντραρισμένο στο (cx,cy), περιστραμμένο `deg` (CCW). Επιστρέφει 4 κορυφές. */
  const rotatedSquare = (side: number, cx: number, cy: number, deg: number) => {
    const h = side / 2;
    const r = (deg * Math.PI) / 180;
    const c = Math.cos(r);
    const s = Math.sin(r);
    return [
      { x: -h, y: -h }, { x: h, y: -h }, { x: h, y: h }, { x: -h, y: h },
    ].map((p) => ({ x: cx + p.x * c - p.y * s, y: cy + p.x * s + p.y * c }));
  };

  it('45° κολόνα, cursor στην (λοξή) E παρειά → ο τοίχος βγαίνει στις 45° (ΟΧΙ οριζόντιος)', () => {
    const fp = rotatedSquare(200, 0, 0, 45);
    // world σημείο κατά μήκος του +u (45°): τοπικό (300,0) → world 300·u.
    const cursor = { x: 300 * SQRT1_2, y: 300 * SQRT1_2 };
    const r = resolveMemberColumnFaceSnap(cursor, [fp], OPTS);
    expect(r).not.toBeNull();
    expect(r!.face).toBe('E');
    // start flush στη λοξή παρειά = κέντρο-παρειάς = 100·u
    expect(r!.start.x).toBeCloseTo(100 * SQRT1_2);
    expect(r!.start.y).toBeCloseTo(100 * SQRT1_2);
    // ΚΡΙΣΙΜΟ: το ghost stub (end−start) δείχνει στις 45° (κάθετα στη λοξή παρειά), όχι οριζόντια.
    const ang = (Math.atan2(r!.end.y - r!.start.y, r!.end.x - r!.start.x) * 180) / Math.PI;
    expect(ang).toBeCloseTo(45);
    // faceFrame: άξονας κατά μήκος της παρειάς = v (135°)· κάθετος = u (45°).
    expect(r!.faceFrame.axisDir.x).toBeCloseTo(-SQRT1_2);
    expect(r!.faceFrame.axisDir.y).toBeCloseTo(SQRT1_2);
    expect(r!.faceFrame.perpDir.x).toBeCloseTo(SQRT1_2);
    expect(r!.faceFrame.perpDir.y).toBeCloseTo(SQRT1_2);
  });

  it('45° κολόνα, cursor κοντά στο κέντρο → center-to-centroid magnet (parity) → start = κέντρο', () => {
    const fp = rotatedSquare(200, 0, 0, 45);
    const r = resolveMemberColumnFaceSnap({ x: 10, y: 10 }, [fp], OPTS); // dCenter τοπικό ≈14 < 50
    expect(r!.start.x).toBeCloseTo(0);
    expect(r!.start.y).toBeCloseTo(0);
    expect(r!.third).toBe('mid');
    expect(r!.faceFrame.facePerp).toBe(0);
  });

  it('30° κολόνα → faceFrame axisDir/perpDir ακολουθούν την πραγματική γωνία παρειάς', () => {
    const fp = rotatedSquare(200, 0, 0, 30);
    const c = Math.cos(Math.PI / 6); // 0.866
    const s = Math.sin(Math.PI / 6); // 0.5
    const cursor = { x: 300 * c, y: 300 * s }; // κατά μήκος +u (30°)
    const r = resolveMemberColumnFaceSnap(cursor, [fp], OPTS);
    expect(r!.face).toBe('E');
    expect(r!.faceFrame.perpDir.x).toBeCloseTo(c); // κάθετος στην παρειά = u (30°)
    expect(r!.faceFrame.perpDir.y).toBeCloseTo(s);
    expect(r!.faceFrame.axisDir.x).toBeCloseTo(-s); // κατά μήκος παρειάς = v (120°)
    expect(r!.faceFrame.axisDir.y).toBeCloseTo(c);
  });

  it('Λοξή κολόνα μακριά (πέρα από capture) → null', () => {
    const fp = rotatedSquare(200, 0, 0, 45);
    expect(resolveMemberColumnFaceSnap({ x: 5000, y: 5000 }, [fp], OPTS)).toBeNull();
  });

  it('ΜΗ-παλινδρόμηση: axis-aligned κολόνα ΔΕΝ περνά από το rotated path (world-aligned faceFrame)', () => {
    const r = resolveMemberColumnFaceSnap({ x: 700, y: 200 }, [COLUMN_FP], OPTS);
    expect(r!.faceFrame.axisDir).toEqual({ x: 0, y: 1 }); // ακριβώς world-aligned (όχι rotated float)
  });

  it('dispatcher: λοξή κολόνα → status neutral + rotated faceFrame', () => {
    const fp = rotatedSquare(200, 0, 0, 45);
    const cursor = { x: 300 * SQRT1_2, y: 300 * SQRT1_2 };
    const r = resolveMemberGhostSnapFromStore(cursor, [fp], [], 200, 'mm');
    expect(r!.status).toBe('neutral');
    expect(r!.faceFrame).toBeDefined();
    expect(r!.faceFrame!.perpDir.x).toBeCloseTo(SQRT1_2);
  });
});

describe('resolveMemberGhostSnapFromStore — column-priority dispatcher', () => {
  const MEMBER = {
    id: 'm1',
    axis: [{ x: 0, y: 0 }, { x: 10000, y: 0 }],
    outline: [{ x: 0, y: -100 }, { x: 10000, y: -100 }, { x: 10000, y: 100 }, { x: 0, y: 100 }],
  };

  it('Κοντά σε κολόνα → status neutral (column wins) + faceFrame (listening dims)', () => {
    const r = resolveMemberGhostSnapFromStore({ x: 700, y: 200 }, [COLUMN_FP], [], 200, 'mm');
    expect(r).not.toBeNull();
    expect(r!.status).toBe('neutral');
    expect(r!.faceFrame).toBeDefined(); // ADR-508 — column branch τώρα γεννά faceFrame
  });

  it('Κολόνα μέσω dispatcher → proportional fine βήμα (όχι 12-jump)', () => {
    // dominantUnit=1cm· κολόνα 400, πλάτος 200 → βήμα 5mm. cursor y=252 → 250.
    const r = resolveMemberGhostSnapFromStore({ x: 700, y: 252 }, [COLUMN_FP], [], 200, 'mm');
    expect(r!.status).toBe('neutral');
    expect(r!.start.y).toBeCloseTo(250);
  });

  it('Χωρίς κολόνα, πάνω σε μέλος → member-to-member framing (status beam)', () => {
    const r = resolveMemberGhostSnapFromStore({ x: 5000, y: 150 }, [], [MEMBER], 200, 'mm');
    expect(r!.status).toBe('beam');
  });

  it('Ούτε κολόνα ούτε μέλος εντός capture → null', () => {
    expect(resolveMemberGhostSnapFromStore({ x: 9e4, y: 9e4 }, [COLUMN_FP], [MEMBER], 200, 'mm')).toBeNull();
  });

  it('Proportional βήμα Giorgio: παρειά 2.5m / νέος 0.25m → βήμα 1mm (ομαλό)', () => {
    // παρειά 2500 ÷ 1cm = 250 τμήματα· πλάτος 250 ÷ 250 = 1mm βήμα → οπτικά συνεχές, deterministic.
    const wall25 = {
      id: 'w', axis: [{ x: 0, y: 0 }, { x: 2500, y: 0 }],
      outline: [{ x: 0, y: -125 }, { x: 2500, y: -125 }, { x: 2500, y: 125 }, { x: 0, y: 125 }],
    };
    const r = resolveMemberGhostSnapFromStore({ x: 1234.7, y: 50 }, [], [wall25], 250, 'mm');
    expect(r!.start.x).toBeCloseTo(1235); // 1234.7 → πλησιέστερο πολλαπλάσιο του 1mm
  });

  it('Μέλος μέσω dispatcher → proportional fine βήμα (πολύ λεπτό ≈ συνεχές)', () => {
    // MEMBER 10000, πλάτος 200 → N=1000 → βήμα 0.2mm (≈ συνεχές). 5123 = πολλαπλάσιο → αμετάβλητο.
    const a = resolveMemberGhostSnapFromStore({ x: 5123, y: 150 }, [], [MEMBER], 200, 'mm');
    expect(a!.start.x).toBeCloseTo(5123);
  });
});

describe('collectMemberSnapTargets — generic scene collector', () => {
  const column = {
    id: 'c1', type: 'column',
    geometry: { footprint: { vertices: COLUMN_FP } },
  } as unknown as Entity;

  const beam = {
    id: 'b1', type: 'beam',
    geometry: {
      axisPolyline: { points: [{ x: 0, y: 0 }, { x: 5000, y: 0 }] },
      outline: { vertices: [{ x: 0, y: -100 }, { x: 5000, y: -100 }, { x: 5000, y: 100 }, { x: 0, y: 100 }] },
    },
  } as unknown as Entity;

  const wall = {
    id: 'w1', type: 'wall',
    geometry: {
      axisPolyline: { points: [{ x: 0, y: 0 }, { x: 5000, y: 0 }] },
      outerEdge: { points: [{ x: 0, y: 100 }, { x: 5000, y: 100 }] },
      innerEdge: { points: [{ x: 0, y: -100 }, { x: 5000, y: -100 }] },
    },
  } as unknown as Entity;

  it('Κολόνες πάντα footprints· walls μόνο όταν ζητηθούν', () => {
    const r = collectMemberSnapTargets([column, wall], { memberKinds: ['wall'] });
    expect(r.footprints).toHaveLength(1);
    expect(r.memberTargets).toHaveLength(1);
    expect(r.memberTargets[0].id).toBe('w1');
    // wall outline = outer + αντεστραμμένο inner → κλειστός δακτύλιος (≥3 κορυφές)
    expect(r.memberTargets[0].outline.length).toBeGreaterThanOrEqual(4);
  });

  it('memberKinds φιλτράρει: μόνο beam → ο τοίχος αγνοείται', () => {
    const r = collectMemberSnapTargets([beam, wall], { memberKinds: ['beam'] });
    expect(r.memberTargets.map((t) => t.id)).toEqual(['b1']);
  });

  it('Τοίχοι + δοκάρια μαζί', () => {
    const r = collectMemberSnapTargets([beam, wall, column], { memberKinds: ['beam', 'wall'] });
    expect(r.memberTargets.map((t) => t.id).sort()).toEqual(['b1', 'w1']);
    expect(r.footprints).toHaveLength(1);
  });

  it('excludeId παραλείπει το μέλος υπό επεξεργασία', () => {
    const r = collectMemberSnapTargets([wall], { memberKinds: ['wall'], excludeId: 'w1' });
    expect(r.memberTargets).toHaveLength(0);
  });
});

describe('resolveMemberColumnFlushJustification — geometric side-face flush', () => {
  it('Άκρο μέσα σε κολόνα, κέντρο πάνω από άξονα → προτίμηση πλευράς', () => {
    // Οριζόντιος άξονας (0,0)→(5000,0)· κολόνα γύρω από το start, κέντρο (200,200) (πάνω).
    const j = resolveMemberColumnFlushJustification(
      { x: 200, y: 0 }, { x: 5000, y: 0 }, [COLUMN_FP], 'left', 250,
    );
    expect(j === 'left' || j === 'right').toBe(true);
  });

  it('Χωρίς κολόνες → fallback', () => {
    expect(resolveMemberColumnFlushJustification({ x: 0, y: 0 }, { x: 5000, y: 0 }, [], 'left')).toBe('left');
  });
});
