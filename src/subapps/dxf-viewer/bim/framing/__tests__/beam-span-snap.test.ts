/**
 * ADR-528 — Beam auto-span between two structural members (pure resolver tests).
 *
 * Επαληθεύει:
 *   (α) per-bay flush σε 2 κολόνες / 2 τοίχοι / μικτό· orientation-agnostic (οριζόντιο/κάθετο/λοξό),
 *   (β) §adjacency: σε σειρά συγγραμμικών (1-2-3-4) επιστρέφει το ΦΑΤΝΩΜΑ του cursor — ΠΟΤΕ span πάνω
 *       από ενδιάμεση στήριξη (το σενάριο του στιγμιότυπου: cursor μεταξύ 2&3 → bay 2-3, όχι 1→4),
 *   (γ) gating (<2 / εκτός ευθείας / εκτός κενού / επικάλυψη → null),
 *   (δ) §whole-line: `resolveBeamSpanChain` → N διαδοχικά φατνώματα (συνεχής δοκός N ανοιγμάτων).
 *
 * Μονάδες: 'mm' (f=1). Όλα τα outlines axis-baked ορθογώνια.
 */

import { resolveBeamSpanSnap, resolveBeamSpanChain } from '../beam-span-snap';
import type { Point2D } from '../../../rendering/types/Types';

/** Axis-aligned ορθογώνιο outline (CCW) κεντραρισμένο σε (cx,cy), διαστάσεων w×h. */
function rect(cx: number, cy: number, w: number, h: number): Point2D[] {
  const hw = w / 2;
  const hh = h / 2;
  return [
    { x: cx - hw, y: cy - hh },
    { x: cx + hw, y: cy - hh },
    { x: cx + hw, y: cy + hh },
    { x: cx - hw, y: cy + hh },
  ];
}

const near = (a: number, b: number, tol = 1e-3): boolean => Math.abs(a - b) <= tol;
const len = (s: { start: Point2D; end: Point2D }): number => Math.hypot(s.end.x - s.start.x, s.end.y - s.start.y);

describe('resolveBeamSpanSnap — per-bay (ADR-528)', () => {
  it('(α) γεφυρώνει 2 κολόνες οριζόντια — άκρα flush στις αντικριστές παρειές', () => {
    const colA = rect(0, 0, 400, 400);      // δεξιά παρειά x=200
    const colB = rect(2000, 0, 400, 400);   // αριστερή παρειά x=1800
    const r = resolveBeamSpanSnap({ x: 1000, y: 0 }, [colA, colB], 'mm');
    expect(r).not.toBeNull();
    expect(near(r!.start.x, 200)).toBe(true);
    expect(near(r!.end.x, 1800)).toBe(true);
    expect(near(r!.dist, 0)).toBe(true);
    // guide = κέντρο→κέντρο
    expect(near(r!.guide.a.x, 0)).toBe(true);
    expect(near(r!.guide.b.x, 2000)).toBe(true);
  });

  it('(α2) 2 τοίχοι + μικτό κολόνα/τοίχος (ένα μέλος = το outline του)', () => {
    const wallA = rect(0, 0, 250, 2000);    // δεξιά παρειά x=125
    const wallB = rect(3000, 0, 250, 2000); // αριστερή παρειά x=2875
    const r = resolveBeamSpanSnap({ x: 1500, y: 0 }, [wallA, wallB], 'mm');
    expect(r).not.toBeNull();
    expect(near(r!.start.x, 125)).toBe(true);
    expect(near(r!.end.x, 2875)).toBe(true);

    const col = rect(0, 0, 400, 400);       // δεξιά παρειά x=200
    const wall = rect(2500, 0, 250, 1800);  // αριστερή παρειά x=2375
    const m = resolveBeamSpanSnap({ x: 1200, y: 0 }, [col, wall], 'mm');
    expect(m).not.toBeNull();
    expect(near(m!.start.x, 200)).toBe(true);
    expect(near(m!.end.x, 2375)).toBe(true);
  });

  it('(α3) orientation-agnostic — κάθετο + λοξό (45°)', () => {
    const v = resolveBeamSpanSnap({ x: 0, y: 1000 }, [rect(0, 0, 400, 400), rect(0, 2000, 400, 400)], 'mm');
    expect(v).not.toBeNull();
    expect(near(v!.start.y, 200)).toBe(true);
    expect(near(v!.end.y, 1800)).toBe(true);

    const dgn = resolveBeamSpanSnap({ x: 1000, y: 1000 }, [rect(0, 0, 400, 400), rect(2000, 2000, 400, 400)], 'mm');
    expect(dgn).not.toBeNull();
    expect(near(dgn!.start.x, 200, 1)).toBe(true);
    expect(near(dgn!.end.x, 1800, 1)).toBe(true);
  });

  // ── §adjacency — ΤΟ ΣΕΝΑΡΙΟ ΤΟΥ ΣΤΙΓΜΙΟΤΥΠΟΥ (4 συγγραμμικές κολόνες Β-Ν) ──────────
  const col1 = rect(0, 0, 400, 400);
  const col2 = rect(0, 2000, 400, 400);
  const col3 = rect(0, 4000, 400, 400);
  const col4 = rect(0, 6000, 400, 400);
  const four = [col1, col2, col3, col4];

  it('(β) cursor μεταξύ 2&3 → bay 2-3 (ΟΧΙ span 1→4 πάνω από ενδιάμεσες)', () => {
    const r = resolveBeamSpanSnap({ x: 0, y: 3000 }, four, 'mm');
    expect(r).not.toBeNull();
    // bay 2-3: από βόρεια παρειά col2 (y=2200) έως νότια παρειά col3 (y=3800)
    expect(near(r!.start.y, 2200)).toBe(true);
    expect(near(r!.end.y, 3800)).toBe(true);
    expect(near(len(r!), 1600)).toBe(true);     // ΟΧΙ ~5600 (1→4)
  });

  it('(β2) cursor μεταξύ 1&2 → bay 1-2· μεταξύ 3&4 → bay 3-4', () => {
    const b12 = resolveBeamSpanSnap({ x: 0, y: 1000 }, four, 'mm');
    expect(near(b12!.start.y, 200)).toBe(true);
    expect(near(b12!.end.y, 1800)).toBe(true);
    const b34 = resolveBeamSpanSnap({ x: 0, y: 5000 }, four, 'mm');
    expect(near(b34!.start.y, 4200)).toBe(true);
    expect(near(b34!.end.y, 5800)).toBe(true);
  });

  it('(β3) #4 ως ΤΟΙΧΟΣ (μικτή σειρά) — bay 3-wall flush στην παρειά τοίχου', () => {
    const wall4 = rect(0, 6000, 1000, 250); // τοίχος· νότια παρειά y=5875
    const r = resolveBeamSpanSnap({ x: 0, y: 5000 }, [col1, col2, col3, wall4], 'mm');
    expect(r).not.toBeNull();
    expect(near(r!.start.y, 4200)).toBe(true);  // col3 βόρεια παρειά
    expect(near(r!.end.y, 5875)).toBe(true);    // wall νότια παρειά
  });

  it('(γ) gating: <2 / εκτός ευθείας / εκτός κενού / επικάλυψη → null', () => {
    expect(resolveBeamSpanSnap({ x: 0, y: 0 }, [col1], 'mm')).toBeNull();
    expect(resolveBeamSpanSnap({ x: 1000, y: 900 }, [rect(0, 0, 400, 400), rect(2000, 0, 400, 400)], 'mm')).toBeNull();
    expect(resolveBeamSpanSnap({ x: 2500, y: 0 }, [rect(0, 0, 400, 400), rect(2000, 0, 400, 400)], 'mm')).toBeNull();
    expect(resolveBeamSpanSnap({ x: 150, y: 0 }, [rect(0, 0, 400, 400), rect(300, 0, 400, 400)], 'mm')).toBeNull();
  });

  it('(γ2) nearest-wins: δύο παράλληλες ευθείες → νικά η κοντινότερη', () => {
    const r = resolveBeamSpanSnap({ x: 1000, y: 50 }, [rect(0, 0, 400, 400), rect(2000, 0, 400, 400), rect(0, 3000, 400, 400), rect(2000, 3000, 400, 400)], 'mm');
    expect(r).not.toBeNull();
    expect(near(r!.start.y, 0)).toBe(true);
    expect(near(r!.dist, 50)).toBe(true);
  });
});

describe('ADR-529 Φ1 — cursor ΣΤΗΝ παρειά + κοίλα/Γ μέλη', () => {
  it('cursor ΠΑΝΩ/μέσα στην παρειά μέλους (όχι στο κενό) → γεφυρώνει', () => {
    const colA = rect(0, 0, 400, 400);      // δεξιά παρειά x=200
    const colB = rect(2000, 0, 400, 400);   // αριστερή παρειά x=1800
    // cursor x=150 = ΜΕΣΑ στην colA (έως x=200), όχι στο γεωμετρικό κενό — με την along-margin γεφυρώνει.
    const r = resolveBeamSpanSnap({ x: 150, y: 0 }, [colA, colB], 'mm');
    expect(r).not.toBeNull();
    expect(near(r!.start.x, 200)).toBe(true);
    expect(near(r!.end.x, 1800)).toBe(true);
  });

  it('face-to-face (κάθετο σε παρειά) προηγείται λοξής γωνία-σε-γωνία (σενάριο στιγμιότυπου Wall1→Col2 vs Col4)', () => {
    const wall1 = rect(0, 0, 400, 400);       // ανατ. παρειά x=200
    const col2 = rect(1000, 0, 400, 400);     // δυτ. παρειά x=800 (οριζόντια — face-to-face)
    const col4 = rect(1000, -1000, 400, 400); // λοξά κάτω-δεξιά (γωνία-σε-γωνία)
    // cursor στη ΝΑ γωνία του wall1: πέφτει ΠΑΝΩ στη λοξή ευθεία wall1→col4 (perp≈14) αλλά μακριά από
    // την οριζόντια wall1→col2 (perp≈180). Χωρίς face-preference θα κέρδιζε το λοξό· τώρα κερδίζει το face.
    const r = resolveBeamSpanSnap({ x: 200, y: -180 }, [wall1, col2, col4], 'mm');
    expect(r).not.toBeNull();
    expect(near(r!.start.x, 200, 1)).toBe(true);
    expect(near(r!.end.x, 800, 1)).toBe(true);          // → col2 (οριζόντια), ΟΧΙ col4
    expect(near(r!.end.y, r!.start.y, 1)).toBe(true);   // ΟΡΙΖΟΝΤΙΟ δοκάρι (ΟΧΙ λοξά προς col4 ~ −800)
    expect(r!.end.y > -400).toBe(true);                 // σαφώς όχι η λοξή ευθεία προς col4
  });

  it('Φ3 justified third-alignment: cursor βόρεια/κέντρο/νότια → north-flush / centered / south-flush', () => {
    const wall = rect(0, 0, 400, 600);     // ανατ. παρειά x=200, NS εύρος [−300,300]
    const col = rect(1000, 0, 400, 600);   // δυτ. παρειά x=800
    const W = 200; // πλάτος δοκαριού → ημι-πλάτος 100
    // Βόρεια (hi): κέντρο δοκαριού = +300 − 100 = +200 → βόρεια όψη στο +300 (βόρεια παρειά τοίχου).
    const n = resolveBeamSpanSnap({ x: 200, y: 250 }, [wall, col], 'mm', W);
    expect(near(n!.start.y, 200, 1)).toBe(true);
    expect(near(n!.start.y + W / 2, 300, 1)).toBe(true);
    // ADR-529 Φ3 — το faceFrame υπάρχει → οι σιελ listening dimensions ζωγραφίζονται (justified north-flush).
    expect(n!.faceFrame).toBeDefined();
    expect(near(n!.faceFrame!.ghostCenterAlong, 200, 1)).toBe(true);
    expect(near(n!.faceFrame!.faceAlongMax, 300, 1)).toBe(true);
    // Κέντρο (mid): κεντραρισμένο στον άξονα της παρειάς (y=0).
    const c = resolveBeamSpanSnap({ x: 200, y: 0 }, [wall, col], 'mm', W);
    expect(near(c!.start.y, 0, 1)).toBe(true);
    // Νότια (lo): κέντρο = −300 + 100 = −200 → νότια όψη στο −300 (νότια παρειά τοίχου).
    const s = resolveBeamSpanSnap({ x: 200, y: -250 }, [wall, col], 'mm', W);
    expect(near(s!.start.y, -200, 1)).toBe(true);
    expect(near(s!.start.y - W / 2, -300, 1)).toBe(true);
  });

  it('κοίλος Γ τοίχος → start στην ανατολική παρειά του ΟΡΙΖΟΝΤΙΟΥ σκέλους (όχι centroid/γωνία)', () => {
    // Γ (κεφαλαίο): κατακόρυφο σκέλος δυτικά [0,200]×[0,1000] + οριζόντιο σκέλος βόρεια [0,1000]×[800,1000].
    // Ανατολική παρειά οριζόντιου σκέλους: x=1000, y∈[800,1000]. Το centroid (~322,678) θα έγερνε τον άξονα.
    const gamma: Point2D[] = [
      { x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 800 },
      { x: 1000, y: 800 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 },
    ];
    const col = rect(2000, 900, 400, 400); // αντικριστή κολόνα — δυτική παρειά x=1800
    const r = resolveBeamSpanSnap({ x: 1000, y: 900 }, [gamma, col], 'mm');
    expect(r).not.toBeNull();
    expect(near(r!.start.x, 1000, 1)).toBe(true);  // ανατ. παρειά οριζόντιου σκέλους (ΟΧΙ γωνία/centroid)
    expect(near(r!.start.y, 900, 1)).toBe(true);
    expect(near(r!.end.x, 1800, 1)).toBe(true);    // δυτική παρειά κολόνας
    expect(near(r!.end.y, 900, 1)).toBe(true);
  });
});

describe('resolveBeamSpanChain — whole-line (ADR-528 §whole-line)', () => {
  const four = [rect(0, 0, 400, 400), rect(0, 2000, 400, 400), rect(0, 4000, 400, 400), rect(0, 6000, 400, 400)];

  it('4 συγγραμμικές κολόνες → 3 διαδοχικά φατνώματα (συνεχής δοκός 3 ανοιγμάτων)', () => {
    const bays = resolveBeamSpanChain({ x: 0, y: 3000 }, four, 'mm');
    expect(bays.length).toBe(3);
    // ταξινομημένα: 1-2, 2-3, 3-4 — κάθε φάτνωμα μήκος 1600, flush στις παρειές
    expect(near(bays[0].start.y, 200)).toBe(true);
    expect(near(bays[0].end.y, 1800)).toBe(true);
    expect(near(bays[1].start.y, 2200)).toBe(true);
    expect(near(bays[2].end.y, 5800)).toBe(true);
    bays.forEach((b) => expect(near(len(b), 1600)).toBe(true));
  });

  it('cursor εκτός ευθείας → άδειο chain', () => {
    expect(resolveBeamSpanChain({ x: 5000, y: 5000 }, four, 'mm')).toHaveLength(0);
  });

  it('2 μόνο μέλη → 1 φάτνωμα', () => {
    const bays = resolveBeamSpanChain({ x: 0, y: 1000 }, [rect(0, 0, 400, 400), rect(0, 2000, 400, 400)], 'mm');
    expect(bays.length).toBe(1);
  });
});
