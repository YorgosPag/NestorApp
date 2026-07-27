/**
 * ADR-662 §13 — λαβές τοπογραφικής επιφάνειας: το lock του ΝΕΟΥ συμβολαίου.
 *
 * Μέχρι 2026-07-27 η επιφάνεια ήταν ρητά grip-less, καρφωμένο σε test. Αυτό το αρχείο
 * κλειδώνει τι σημαίνει «έχει πλέον λαβές», και ειδικά τα **τρία** σημεία που, αν σπάσουν,
 * παράγουν σιωπηλά λάθος αποτέλεσμα αντί για κρασάρισμα:
 *
 *   1. **Καμία λαβή χωρίς προορισμό** — κορυφή που ήρθε από γραμμή ασυνέχειας δεν παίρνει
 *      λαβή. Αν σπάσει, ξαναγεννιέται το bug ADR-654 (λαβή που φαίνεται και δεν κάνει τίποτα).
 *   2. **Ταυτότητα με συντεταγμένες, όχι με δείκτη** — ο TIN builder κάνει dedup, οπότε
 *      `positions[i] ≠ points[i]`. Αν κάποιος «απλοποιήσει» σε δείκτη, το τεστ με τα
 *      συμπίπτοντα σημεία τον πιάνει· χωρίς αυτό θα μετακινούσε **λάθος μέτρηση**.
 *   3. **Τα δύο πλαίσια (DISPLAY/WORLD)** — σε geo-referenced έργο, παράλειψη του
 *      `unproject` δίνει λαβή που δείχνει σωστά και γράφει αλλού. Τα τεστ τρέχουν και με
 *      στραμμένη/μετατοπισμένη geo-reference, γιατί το identity μονοπάτι τα κρύβει όλα.
 */

import type { TopoSurfaceEntity } from '../../../types/topo-surface';
import type { TopoPoint } from '../topo-types';
import { clearTopo, setTopoPoints, setTopoBreaklines, getTopoPoints } from '../TopoPointStore';
import { invalidateTopoSurface } from '../topo-surface';
import { setGeoReference } from '../../geo-referencing/geo-reference-store';
import {
  topoSurfaceVertexGrips,
  topoVertexGripKind,
  decodeTopoVertexGripKind,
  applyTopoSurfaceGripDrag,
} from '../topo-surface-grips';
import {
  resolveSurveyPointIndexAt,
  moveSurveyPoint,
  displayDeltaToWorld,
  invalidateTopoSurveyPointIndex,
} from '../topo-survey-point-resolve';
import { buildTopoSurfaceEntity } from '../topo-surface-entity';

/** Τέσσερις γωνίες τετραγώνου 10m (canonical mm) — τριγωνοποιούνται σε 2 τρίγωνα. */
const SQUARE: readonly TopoPoint[] = [
  { x: 0, y: 0, z: 0 },
  { x: 10_000, y: 0, z: 0 },
  { x: 10_000, y: 10_000, z: 1000 },
  { x: 0, y: 10_000, z: 1000 },
];

/** Καθαρή σκηνή: χωρίς αυτό, τα μνημονευμένα TIN/ευρετήρια διαρρέουν μεταξύ tests. */
function seed(points: readonly TopoPoint[] = SQUARE): TopoSurfaceEntity {
  clearTopo();
  invalidateTopoSurface();
  invalidateTopoSurveyPointIndex();
  setTopoPoints(points, 'existing');
  const entity = buildTopoSurfaceEntity('existing', 'lyr_test');
  if (!entity) throw new Error('fixture: η επιφάνεια δεν τριγωνοποιήθηκε');
  return entity;
}

afterEach(() => {
  setGeoReference(null);
  clearTopo();
  invalidateTopoSurface();
  invalidateTopoSurveyPointIndex();
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. Κωδικοποίηση grip kind — καθαρή, χωρίς store
// ─────────────────────────────────────────────────────────────────────────────

describe('grip kind κωδικοποίηση', () => {
  it.each([[0, 0], [0, 7], [3, 12], [10, 0]])(
    'round-trip ring %i κορυφή %i',
    (ringIdx, vertexIdx) => {
      expect(decodeTopoVertexGripKind(topoVertexGripKind(ringIdx, vertexIdx)))
        .toEqual([ringIdx, vertexIdx]);
    },
  );

  it.each(['topo-vertex-', 'topo-vertex-1', 'topo-vertex-1-2-3', 'topo-vertex-a-1'])(
    'απορρίπτει το παραμορφωμένο «%s» αντί να μαντέψει',
    (malformed) => {
      expect(decodeTopoVertexGripKind(malformed as never)).toBeNull();
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Παραγωγή λαβών — το συμβόλαιο «καμία λαβή χωρίς προορισμό»
// ─────────────────────────────────────────────────────────────────────────────

describe('topoSurfaceVertexGrips', () => {
  it('δίνει μία λαβή ανά κορυφή περιγράμματος όταν όλες είναι survey points', () => {
    const entity = seed();
    const vertexCount = entity.footprint.reduce((n, ring) => n + ring.length, 0);
    const grips = topoSurfaceVertexGrips(entity);

    expect(vertexCount).toBeGreaterThan(0);
    expect(grips).toHaveLength(vertexCount);
    // Κάθε λαβή δείχνει σε ΥΠΑΡΚΤΟ σημείο — μια λαβή με δείκτη εκτός ορίων θα έγραφε στο κενό.
    for (const g of grips) {
      expect(g.pointIndex).toBeGreaterThanOrEqual(0);
      expect(g.pointIndex).toBeLessThan(SQUARE.length);
    }
  });

  it('η θέση της λαβής ΕΙΝΑΙ η κορυφή του footprint (ορατό ≡ πιάσιμο)', () => {
    const entity = seed();
    for (const g of topoSurfaceVertexGrips(entity)) {
      expect(entity.footprint[g.ringIdx][g.vertexIdx]).toEqual(g.point);
    }
  });

  it('ΔΕΝ δίνει λαβή σε κορυφή που ήρθε από γραμμή ασυνέχειας (το μάθημα ADR-654)', () => {
    // Η γραμμή ασυνέχειας φέρνει ΝΕΑ κορυφή έξω από το τετράγωνο των survey points, οπότε
    // μεγαλώνει το περίγραμμα με κόμβο που ΔΕΝ είναι μέτρηση.
    clearTopo();
    invalidateTopoSurface();
    invalidateTopoSurveyPointIndex();
    setTopoPoints(SQUARE, 'existing');
    setTopoBreaklines(
      [{ id: 'bl-1', vertices: [{ x: 20_000, y: 5000, z: 500 }, { x: 20_000, y: 6000, z: 500 }], closed: false }],
      'existing',
    );
    const entity = buildTopoSurfaceEntity('existing', 'lyr_test');
    if (!entity) throw new Error('fixture: καμία επιφάνεια');

    const vertexCount = entity.footprint.reduce((n, ring) => n + ring.length, 0);
    const grips = topoSurfaceVertexGrips(entity);

    // Το περίγραμμα ΜΕΓΑΛΩΣΕ από τη γραμμή ασυνέχειας…
    expect(vertexCount).toBeGreaterThan(SQUARE.length);
    // …αλλά οι λαβές είναι ΛΙΓΟΤΕΡΕΣ από τις κορυφές: οι μη-μετρημένες δεν παίρνουν λαβή.
    expect(grips.length).toBeLessThan(vertexCount);
    expect(grips.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Αντιστοίχιση κορυφής → survey point, στα δύο πλαίσια
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveSurveyPointIndexAt', () => {
  /**
   * Το identity μονοπάτι κρύβει ΚΑΘΕ σφάλμα πλαισίου. Η στροφή σπάει το «δούλεψε κατά τύχη»
   * (μετάθεση μόνο), και η μετάθεση σπάει το «ξέχασα το origin».
   */
  const REFERENCES = [
    ['χωρίς geo-reference (identity)', null],
    ['μετάθεση', { originWorld: { x: 500_000, y: 4_200_000 }, rotationDeg: 0 }],
    ['μετάθεση + στροφή', { originWorld: { x: 500_000, y: 4_200_000 }, rotationDeg: 31.7 }],
  ] as const;

  it.each(REFERENCES)('κάθε κορυφή λύνεται στο σωστό σημείο — %s', (_label, geo) => {
    setGeoReference(geo);
    const entity = seed();

    const resolved = entity.footprint.flat().map((v) => resolveSurveyPointIndexAt('existing', v));
    expect(resolved.every((i) => i !== null)).toBe(true);
    // 4 διακριτές κορυφές → 4 ΔΙΑΚΡΙΤΑ σημεία (καμία διπλή αντιστοίχιση στο ίδιο σημείο).
    expect(new Set(resolved).size).toBe(SQUARE.length);
  });

  it('επιστρέφει null για σημείο εκτός επιφάνειας αντί να δώσει το κοντινότερο', () => {
    const entity = seed();
    void entity;
    expect(resolveSurveyPointIndexAt('existing', { x: 999_999, y: 999_999 })).toBeNull();
  });

  it('σε συμπίπτοντα survey points κρατά ΑΥΤΟ που κράτησε και ο TIN (dedup parity)', () => {
    // Δύο σημεία στην ΙΔΙΑ θέση: ο builder τα καταρρέει σε έναν κόμβο και κρατά το ΠΡΩΤΟ.
    // Ένας «απλοποιημένος» resolver με δείκτη θα έδειχνε στο δεύτερο → λάθος μέτρηση.
    const withDuplicate: readonly TopoPoint[] = [
      SQUARE[0],
      { ...SQUARE[0], z: 999 }, // διπλότυπο στη θέση 1
      SQUARE[1], SQUARE[2], SQUARE[3],
    ];
    const entity = seed(withDuplicate);
    const corner = entity.footprint.flat().find((v) => v.x === 0 && v.y === 0);
    expect(corner).toBeDefined();
    expect(resolveSurveyPointIndexAt('existing', corner!)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Οι δύο καθαροί μετασχηματισμοί
// ─────────────────────────────────────────────────────────────────────────────

describe('moveSurveyPoint', () => {
  it('μετακινεί ΜΟΝΟ το στοχευμένο σημείο, planimetric — το υψόμετρο μένει άθικτο', () => {
    const next = moveSurveyPoint(SQUARE, 2, { x: 1000, y: -500 });
    expect(next[2]).toEqual({ x: 11_000, y: 9500, z: 1000 });
    expect(next[0]).toEqual(SQUARE[0]);
    expect(next[3]).toEqual(SQUARE[3]);
  });

  it.each([
    ['μηδενικό delta', 2, { x: 0, y: 0 }],
    ['δείκτης εκτός ορίων', 99, { x: 1, y: 1 }],
    ['αρνητικός δείκτης', -1, { x: 1, y: 1 }],
  ])('σήμα no-op με ταυτότητα αναφοράς — %s', (_label, idx, delta) => {
    expect(moveSurveyPoint(SQUARE, idx, delta)).toBe(SQUARE);
  });
});

describe('displayDeltaToWorld', () => {
  it('χωρίς geo-reference το delta περνά αυτούσιο', () => {
    setGeoReference(null);
    expect(displayDeltaToWorld({ x: 300, y: -120 })).toEqual({ x: 300, y: -120 });
  });

  it('η ΜΕΤΑΘΕΣΗ δεν πρέπει να επιβιώσει: το delta είναι διάνυσμα, όχι σημείο', () => {
    // Χωρίς την αφαίρεση της αρχής, το σημείο θα εκτοξευόταν κατά το originWorld.
    setGeoReference({ originWorld: { x: 500_000, y: 4_200_000 }, rotationDeg: 0 });
    const world = displayDeltaToWorld({ x: 300, y: -120 });
    expect(world.x).toBeCloseTo(300, 6);
    expect(world.y).toBeCloseTo(-120, 6);
  });

  it('η ΣΤΡΟΦΗ πρέπει να επιβιώσει: το μήκος μένει, η διεύθυνση αλλάζει', () => {
    setGeoReference({ originWorld: { x: 500_000, y: 4_200_000 }, rotationDeg: 90 });
    const world = displayDeltaToWorld({ x: 1000, y: 0 });
    expect(Math.hypot(world.x, world.y)).toBeCloseTo(1000, 6);
    expect(world.x).toBeCloseTo(0, 6);
    expect(Math.abs(world.y)).toBeCloseTo(1000, 6);
  });
});

describe('applyTopoSurfaceGripDrag (preview μόνο)', () => {
  const FOOTPRINT = [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]];

  it('μετακινεί ΜΟΝΟ τη στοχευμένη κορυφή', () => {
    const next = applyTopoSurfaceGripDrag(topoVertexGripKind(0, 1), FOOTPRINT, { x: 5, y: 5 });
    expect(next[0][1]).toEqual({ x: 15, y: 5 });
    expect(next[0][0]).toEqual({ x: 0, y: 0 });
    expect(next[0][2]).toEqual({ x: 10, y: 10 });
  });

  it.each([
    ['μηδενικό delta', topoVertexGripKind(0, 1), { x: 0, y: 0 }],
    ['ring εκτός ορίων', topoVertexGripKind(9, 0), { x: 5, y: 5 }],
    ['κορυφή εκτός ορίων', topoVertexGripKind(0, 9), { x: 5, y: 5 }],
  ])('σήμα no-op με ταυτότητα αναφοράς — %s', (_label, kind, delta) => {
    expect(applyTopoSurfaceGripDrag(kind, FOOTPRINT, delta)).toBe(FOOTPRINT);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Ο πλήρης κύκλος: σύρσιμο → η ΠΗΓΗ άλλαξε → το περίγραμμα ακολούθησε
// ─────────────────────────────────────────────────────────────────────────────

describe('ο κύκλος «λαβή → survey point → νέο περίγραμμα»', () => {
  it('η μετακίνηση σημείου επιβιώνει της αναδημιουργίας του περιγράμματος', () => {
    const before = seed();
    const grip = topoSurfaceVertexGrips(before)[0];

    setTopoPoints(moveSurveyPoint(getTopoPoints('existing'), grip.pointIndex, { x: 3000, y: 0 }), 'existing');
    invalidateTopoSurveyPointIndex();
    const after = buildTopoSurfaceEntity('existing', 'lyr_test');

    // Αυτό ακριβώς ήταν αδύνατο με patch στο footprint: το ξαναχτισμένο περίγραμμα
    // κουβαλά την αλλαγή, γιατί η αλλαγή έγινε στην πηγή.
    expect(after).not.toBeNull();
    expect(after!.footprint.flat()).not.toEqual(before.footprint.flat());
    expect(getTopoPoints('existing')[grip.pointIndex].x)
      .toBe(SQUARE[grip.pointIndex].x + 3000);
  });
});
