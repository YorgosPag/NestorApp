/**
 * ADR-650 M7 — ο καθαρός πυρήνας των ελληνικών παραδοτέων.
 *
 * Ελέγχονται τα δύο πράγματα που, αν σπάσουν, παράγουν **λάθος νομικό έγγραφο**:
 *   1. οι ανοχές του §10 (η «2% ΚΑΙ ≤40cm» είναι ο ΑΥΣΤΗΡΟΤΕΡΟΣ όρος, όχι ο χαλαρότερος)·
 *   2. η εμβαδομέτρηση/περίμετρος του οικοπέδου (mm → m²/m μέσω του units SSoT).
 * Και το ότι ό,τι λείπει **δεν σιωπά** (warnings), αντί να βγει μισός φάκελος αθόρυβα.
 */

import {
  AREA_TOLERANCE_PCT,
  checkAreaTolerance,
  checkPerimeterTolerance,
  runToleranceChecks,
  toleranceVerdict,
} from '../deliverables/greek-survey-rules';
import {
  buildCoordinateTable,
  buildPlotMeasurements,
  buildVolumeTable,
} from '../deliverables/survey-tables';
import { buildSurveyDeliverables } from '../deliverables/build-survey-deliverables';
import {
  MAX_IN_SCENE_COORDINATE_ROWS,
  selectInSceneSections,
} from '../deliverables/survey-sheet';
import type { TinSampler } from '../tin-sampler';
import type { CutFillResult, TopoPoint } from '../topo-types';

/** Επίπεδος δειγματολήπτης — το Ζ των κορυφών δεν είναι το αντικείμενο αυτών των tests. */
const FLAT_SAMPLER: TinSampler = { zAtMm: () => 10_000 };
const NO_SAMPLER: TinSampler = { zAtMm: () => null };

/** Τετράγωνο 20m × 20m σε canonical mm ⇒ 400 m², περίμετρος 80 m. */
const SQUARE_20M = [
  { x: 0, y: 0 },
  { x: 20_000, y: 0 },
  { x: 20_000, y: 20_000 },
  { x: 0, y: 20_000 },
];

const LABELS = {
  volume: { cut: 'Εκσκαφή', fill: 'Επίχωση', net: 'Καθαρό' },
  tolerance: {
    area: 'Εμβαδόν',
    perimeter: 'Περίμετρος',
    pass: 'ΟΚ',
    fail: 'ΕΚΤΟΣ',
    notDeclared: '—',
  },
  titles: {
    coordinates: 'Συντεταγμένες',
    plot: 'Οικόπεδο',
    volumes: 'Χωματουργικά',
    tolerance: 'Ανοχές',
  },
};

describe('ADR-650 M7 — ανοχές §10 (Ν.4495/2017)', () => {
  it('εμβαδόν: ±5% εντός σχεδίου, ±10% εκτός', () => {
    expect(AREA_TOLERANCE_PCT['in-plan']).toBe(5);
    expect(AREA_TOLERANCE_PCT['out-of-plan']).toBe(10);

    // Τίτλος 400 m². Εντός σχεδίου ⇒ ανοχή 20 m².
    expect(checkAreaTolerance(419, 400, 'in-plan').status).toBe('pass');
    expect(checkAreaTolerance(421, 400, 'in-plan').status).toBe('fail');
    // Το ΙΔΙΟ νούμερο περνά εκτός σχεδίου (ανοχή 40 m²).
    expect(checkAreaTolerance(421, 400, 'out-of-plan').status).toBe('pass');
  });

  it('περίμετρος: ισχύει ο ΑΥΣΤΗΡΟΤΕΡΟΣ από 2% και 40cm', () => {
    // Μικρό οικόπεδο (περίμετρος 10 m): το 2% (=0.20 m) είναι αυστηρότερο από το cap 0.40 m.
    expect(checkPerimeterTolerance(10.19, 10).status).toBe('pass');
    expect(checkPerimeterTolerance(10.25, 10).status).toBe('fail');

    // Μεγάλο οικόπεδο (περίμετρος 100 m): το 2% (=2.00 m) θα ήταν χαλαρό — κόβει το cap 0.40 m.
    expect(checkPerimeterTolerance(100.39, 100).status).toBe('pass');
    expect(checkPerimeterTolerance(100.6, 100).status).toBe('fail');
    expect(checkPerimeterTolerance(100.6, 100).allowed).toBeCloseTo(0.4, 6);
  });

  it('χωρίς δηλωμένη τιμή δεν υπάρχει έλεγχος — ποτέ ψεύτικο «πέρασε»', () => {
    const check = checkAreaTolerance(400, null, 'in-plan');
    expect(check.status).toBe('not-declared');
    expect(check.allowed).toBeNull();
    expect(check.deviation).toBeNull();

    expect(toleranceVerdict([check])).toBe('not-declared');
  });

  it('ένα fail αρκεί για να μην περάσει ο φάκελος', () => {
    const checks = runToleranceChecks(
      { areaM2: 500, perimeterM: 80 },
      { areaM2: 400, perimeterM: 80, zone: 'in-plan' },
    );
    expect(toleranceVerdict(checks)).toBe('fail');
  });
});

describe('ADR-650 M7 — εμβαδομέτρηση οικοπέδου', () => {
  it('τετράγωνο 20m: 400 m² / 80 m περίμετρος (mm → μετρικά μέσω του units SSoT)', () => {
    const plot = buildPlotMeasurements(SQUARE_20M, FLAT_SAMPLER);
    expect(plot.areaM2).toBeCloseTo(400, 6);
    expect(plot.perimeterM).toBeCloseTo(80, 6);
  });

  it('ο πίνακας κορυφών δίνει πλευρές και μήκη σε canonical mm', () => {
    const { table } = buildPlotMeasurements(SQUARE_20M, FLAT_SAMPLER);
    expect(table.rows).toHaveLength(4);
    expect(table.rows[0].cells.side).toBe('1-2');
    expect(table.rows[0].cells.sideLength).toBeCloseTo(20_000, 6);
    // Η τελευταία πλευρά κλείνει το πολύγωνο (4 → 1).
    expect(table.rows[3].cells.side).toBe('4-1');
    expect(table.rows[3].cells.z).toBe(10_000);
  });

  it('κορυφή εκτός αποτύπωσης ⇒ κενό Ζ, ΠΟΤΕ 0', () => {
    const { table } = buildPlotMeasurements(SQUARE_20M, NO_SAMPLER);
    expect(table.rows[0].cells.z).toBeNull();
  });
});

describe('ADR-650 M7 — πίνακες', () => {
  it('ο πίνακας συντεταγμένων κρατά raw mm (η στήλη κάνει τη μετατροπή στην παρουσίαση)', () => {
    const points: TopoPoint[] = [{ x: 486_312_450, y: 4_204_118_200, z: 152_340, code: 'Κ1' }];
    const table = buildCoordinateTable(points);
    expect(table.rows[0].cells).toEqual({
      index: 1,
      x: 486_312_450,
      y: 4_204_118_200,
      z: 152_340,
      code: 'Κ1',
    });
    // Η στήλη Χ δηλώνει τη μετατροπή — δεν την κάνει ο builder.
    expect(table.columns.find((c) => c.key === 'x')?.valueType).toBe('dimension-mm-to-m');
  });

  it('οι όγκοι φτάνουν σε m³/m² (mm³ → m³ μία φορά, στο units SSoT)', () => {
    const result: CutFillResult = {
      cutVolumeMm3: 812e9,
      fillVolumeMm3: 145e9,
      netVolumeMm3: 667e9,
      cutAreaMm2: 300e6,
      fillAreaMm2: 100e6,
      evaluatedTriangles: 10,
      skippedTriangles: 0,
    };
    const table = buildVolumeTable(result, LABELS.volume);
    expect(table.rows[0].cells.volume).toBeCloseTo(812, 6);
    expect(table.rows[0].cells.area).toBeCloseTo(300, 6);
    // Το «καθαρό» δίνεται ως απόλυτο μέγεθος — το πρόσημο το λέει η ετικέτα.
    expect(table.rows[2].cells.volume).toBeCloseTo(667, 6);
  });
});

describe('ADR-650 M7 — buildSurveyDeliverables', () => {
  const points: TopoPoint[] = [
    { x: 0, y: 0, z: 10_000 },
    { x: 20_000, y: 0, z: 11_000 },
    { x: 0, y: 20_000, z: 12_000 },
  ];

  const baseInput = {
    points,
    sampler: FLAT_SAMPLER,
    declared: { areaM2: null, perimeterM: null, zone: 'out-of-plan' as const },
    titles: LABELS.titles,
    volumeLabels: LABELS.volume,
    toleranceLabels: LABELS.tolerance,
  };

  it('χωρίς όριο: ούτε εμβαδομέτρηση ούτε ανοχές — και το λέει', () => {
    const d = buildSurveyDeliverables({ ...baseInput, boundary: null, cutFill: null });
    expect(d.plot).toBeNull();
    expect(d.checks).toHaveLength(0);
    expect(d.warnings).toContain('no-boundary');
    expect(d.warnings).toContain('no-volumes');
    expect(d.sections.map((s) => s.title)).toEqual(['Συντεταγμένες']);
  });

  it('με όριο + δηλωμένο εμβαδόν: βγαίνουν και οι τέσσερις ενότητες', () => {
    const d = buildSurveyDeliverables({
      ...baseInput,
      boundary: SQUARE_20M,
      cutFill: {
        cutVolumeMm3: 1e9, fillVolumeMm3: 0, netVolumeMm3: 1e9,
        cutAreaMm2: 1e6, fillAreaMm2: 0, evaluatedTriangles: 1, skippedTriangles: 0,
      },
      declared: { areaM2: 400, perimeterM: 80, zone: 'in-plan' },
    });
    expect(d.sections).toHaveLength(4);
    expect(d.plot?.areaM2).toBeCloseTo(400, 6);
    expect(d.verdict).toBe('pass');
    expect(d.warnings).toHaveLength(0);
  });
});

describe('ADR-650 M7 — τι μπαίνει ΜΕΣΑ στο σχέδιο', () => {
  function deliverablesWithPoints(count: number) {
    const points: TopoPoint[] = Array.from({ length: count }, (_, i) => ({
      x: i * 1000, y: 0, z: 1000,
    }));
    return buildSurveyDeliverables({
      points,
      boundary: SQUARE_20M,
      sampler: FLAT_SAMPLER,
      cutFill: null,
      declared: { areaM2: null, perimeterM: null, zone: 'out-of-plan' },
      titles: LABELS.titles,
      volumeLabels: LABELS.volume,
      toleranceLabels: LABELS.tolerance,
    });
  }

  it('λίγα σημεία ⇒ ο πίνακας συντεταγμένων μπαίνει στο σχέδιο', () => {
    const selection = selectInSceneSections(deliverablesWithPoints(10));
    expect(selection.droppedCoordinates).toBe(false);
    expect(selection.sections.map((s) => s.title)).toContain('Συντεταγμένες');
  });

  it('πολλά σημεία ⇒ μένει στα αρχεία, και η παράλειψη ΔΕΝ είναι σιωπηλή', () => {
    const selection = selectInSceneSections(
      deliverablesWithPoints(MAX_IN_SCENE_COORDINATE_ROWS + 1),
    );
    expect(selection.droppedCoordinates).toBe(true);
    expect(selection.sections.map((s) => s.title)).not.toContain('Συντεταγμένες');
    // Το οικόπεδο μένει — αυτό είναι το «διάγραμμα εμβαδομέτρησης» που ζητά η δήλωση.
    expect(selection.sections.map((s) => s.title)).toContain('Οικόπεδο');
  });
});
