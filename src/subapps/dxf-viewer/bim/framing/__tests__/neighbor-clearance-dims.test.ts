/**
 * neighbor-clearance-dims — pure resolver για τις έξυπνες προσωρινές διαστάσεις γύρω από ελεύθερο
 * placement ghost (ADR-508 §neighbor-clearance). Καλύπτει: πλησιέστερη ανά κατεύθυνση (max 4),
 * παρειά-προς-παρειά, overlap gating, threshold, nearest-wins, λοξό μέλος → angleDeg.
 */

import { resolveNeighborClearanceDims, type NeighborClearanceOptions } from '../neighbor-clearance-dims';
import type { SceneSnapTargets } from '../scene-snap-targets';
import type { LinearMemberSnapTarget } from '../linear-member-face-snap';
import type { Point2D } from '../../../rendering/types/Types';

const OPTS: NeighborClearanceOptions = {
  gapOffsetScene: 22,
  minValueScene: 2,
  maxClearanceScene: 2000,
  orthoToleranceDeg: 1,
};

/** Axis-aligned τετράγωνο footprint (4 κορυφές) με κέντρο (cx,cy) και μισό-πλάτος h. */
function sq(cx: number, cy: number, h: number): Point2D[] {
  return [
    { x: cx - h, y: cy - h },
    { x: cx + h, y: cy - h },
    { x: cx + h, y: cy + h },
    { x: cx - h, y: cy + h },
  ];
}

function makeTargets(over: Partial<SceneSnapTargets>): SceneSnapTargets {
  return {
    footprints: [],
    circularFootprints: [],
    beamTargets: [],
    wallTargets: [],
    slabTargets: [],
    footprintEdgeTargets: [],
    lineTargets: [],
    diskTargets: [],
    rectTargets: [],
    wallEntities: [],
    openings: [],
    ...over,
  };
}

const GHOST = sq(0, 0, 50); // κέντρο (0,0), bounds [-50,50]²

describe('resolveNeighborClearanceDims', () => {
  it('μία ευθυγραμμισμένη κολόνα δεξιά → 1 dim (E), παρειά-προς-παρειά, χωρίς γωνία', () => {
    const targets = makeTargets({ footprints: [sq(200, 0, 50)] }); // bounds X [150,250]
    const meta = resolveNeighborClearanceDims(GHOST, targets, 'mm', OPTS);
    expect(meta).not.toBeNull();
    expect(meta!.dims).toHaveLength(1);
    const d = meta!.dims[0];
    expect(d.kind).toBe('clearance');
    expect(d.valueScene).toBeCloseTo(100, 6); // 150 − 50
    expect(d.angleDeg).toBeUndefined(); // ορθή → καμία γωνία
    // witness points πάνω στις δύο αντικριστές παρειές, στο ύψος επικάλυψης (y=0).
    expect(d.p1).toEqual({ x: 50, y: 0 });
    expect(d.p2).toEqual({ x: 150, y: 0 });
  });

  it('κολόνες σε 4 πλευρές → 4 dims (E/W/N/S)', () => {
    const targets = makeTargets({
      footprints: [sq(200, 0, 50), sq(-200, 0, 50), sq(0, 200, 50), sq(0, -200, 50)],
    });
    const meta = resolveNeighborClearanceDims(GHOST, targets, 'mm', OPTS);
    expect(meta!.dims).toHaveLength(4);
    expect(meta!.dims.every((d) => d.valueScene > 0)).toBe(true);
  });

  it('γείτονας χωρίς εγκάρσια επικάλυψη (διαγώνιος) → καμία dim (έξυπνο gating)', () => {
    const targets = makeTargets({ footprints: [sq(200, 300, 50)] }); // ούτε X ούτε Y overlap
    expect(resolveNeighborClearanceDims(GHOST, targets, 'mm', OPTS)).toBeNull();
  });

  it('γείτονας πέρα από το threshold → καμία dim', () => {
    const targets = makeTargets({ footprints: [sq(5000, 0, 50)] }); // gap 4900 > 2000
    expect(resolveNeighborClearanceDims(GHOST, targets, 'mm', OPTS)).toBeNull();
  });

  it('nearest-per-direction: 2 κολόνες δεξιά → κρατά μόνο την πλησιέστερη', () => {
    const targets = makeTargets({ footprints: [sq(200, 0, 50), sq(400, 0, 50)] });
    const meta = resolveNeighborClearanceDims(GHOST, targets, 'mm', OPTS);
    expect(meta!.dims).toHaveLength(1);
    expect(meta!.dims[0].valueScene).toBeCloseTo(100, 6); // η κοντινή, όχι 300
  });

  it('flush γείτονας (μηδενικό διάκενο) → καμία dim (minValue)', () => {
    const targets = makeTargets({ footprints: [sq(100, 0, 50)] }); // bounds X [50,150] → gap 0
    expect(resolveNeighborClearanceDims(GHOST, targets, 'mm', OPTS)).toBeNull();
  });

  it('λοξός τοίχος (45°) → dim με angleDeg ορισμένο (γωνία μόνο σε λοξές)', () => {
    // άξονας (100,100)→(300,300), πλάτος 20 (±10 κατά perp).
    const wall: LinearMemberSnapTarget = {
      id: 'w1',
      axis: [
        { x: 100, y: 100 },
        { x: 300, y: 300 },
      ],
      outline: [
        { x: 107.07, y: 92.93 },
        { x: 307.07, y: 292.93 },
        { x: 292.93, y: 307.07 },
        { x: 92.93, y: 107.07 },
      ],
    };
    // ghost offset perpendicular από το κέντρο του τοίχου ώστε να έχει along-overlap.
    const ghost = sq(270.7, 129.3, 30);
    const meta = resolveNeighborClearanceDims(ghost, makeTargets({ wallTargets: [wall] }), 'mm', OPTS);
    expect(meta).not.toBeNull();
    expect(meta!.dims).toHaveLength(1);
    const d = meta!.dims[0];
    expect(d.angleDeg).toBeDefined();
    expect(d.angleDeg!).toBeCloseTo(135, 0); // ⊥ σε τοίχο 45° → προσανατολισμός dim 135°
  });

  it('καμία γειτονική οντότητα → null', () => {
    expect(resolveNeighborClearanceDims(GHOST, makeTargets({}), 'mm', OPTS)).toBeNull();
  });
});
