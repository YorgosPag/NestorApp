/**
 * ADR-650 §M10f — ΤΟ ΑΓΚΙΣΤΡΟ ΤΗΣ ΚΛΑΣΗΣ: κάθε τοπογραφικός παραγωγός κάθεται στο σχέδιο.
 *
 * Δεν ελέγχει «οι ισοϋψείς προβάλλονται» (αυτό ήταν το ΔΕΙΓΜΑ). Ελέγχει τον ΚΑΝΟΝΑ, παραμετρικά,
 * πάνω σε ΟΛΟΥΣ τους παραγωγούς: με ενεργή γεωαναφορά, **καμία** συντεταγμένη γεωμετρίας δεν
 * επιτρέπεται να μείνει σε ΕΓΣΑ — αλλιώς το προϊόν γεννιέται 400 χλμ. μακριά από την κάτοψη,
 * αόρατο (ADR-635 culling) και άπιαστο.
 *
 * Το τεστ έχει **αρνητικό μάρτυρα**: ο ίδιος παραγωγός με `null` projector (μη-γεωαναφερμένο
 * έργο) οφείλει να βγάλει τις ωμές ΕΓΣΑ, δηλαδή ΕΞΩ από τη ζώνη. Έτσι αποδεικνύεται ότι ο
 * έλεγχος έχει δόντια: αν κάποιος «διορθώσει» τον παραγωγό ώστε να μην προβάλλει, το πράσινο
 * σκάει — δεν μένει σιωπηλά πράσινο επειδή η ζώνη είναι χαλαρή.
 *
 * Ο δεύτερος κανόνας που καρφώνεται εδώ: **το ΚΕΙΜΕΝΟ δεν προβάλλεται ΠΟΤΕ.** Το Χ,Υ μιας
 * κορυφής οικοπέδου και η τιμή του καννάβου είναι μεγέθη ΕΓΣΑ· η ίδια συμβολοσειρά πρέπει να
 * βγαίνει με ΚΑΙ χωρίς γεωαναφορά.
 */

import { buildContourEntities, type ContourLayerIds } from '../topo-to-entities';
import { buildSurveyPointLabelEntities, type PointLabelLayerIds } from '../topo-point-labels';
import { buildTopoGridEntities } from '../topo-grid-entities';
import { buildNorthArrowEntities } from '../north-arrow-entities';
import { buildTopoGrid, type WorldRectMm } from '../topo-grid-model';
import { DEFAULT_CONTOUR_CONFIG } from '../contour-config';
import {
  getTopoDisplayProjector, projectContourLines, projectWorldPoint, projectWorldPoints,
  projectWorldRings, unprojectRectToWorld,
} from '../topo-display-frame';
import { makeWorldToDisplayProjector, type WorldToDisplayProjector } from '../../geo-referencing/geo-transform';
import { getGeoReference, setGeoReference } from '../../geo-referencing/geo-reference-store';
import type { Point2D } from '../../../rendering/types/Types';
import type { ContourLine, TopoPoint } from '../topo-types';
import type { TinSampler } from '../tin-sampler';

// ── Το πραγματικό οικόπεδο της υπόθεσης (ADR-650): origin του αρχείου + κορυφές γύρω του ──────
const ORIGIN_WORLD = { x: 407_565_290, y: 4_502_055_670 }; // mm — «Ενεργή: 407565.29, 4502055.67 m»
const GEO = { originWorld: ORIGIN_WORLD, rotationDeg: 0 };
const GEO_ROTATED = { originWorld: ORIGIN_WORLD, rotationDeg: 17.5 };

/** Η ζώνη της σκηνής (ADR-635): έξω από ±1e6 mm η οντότητα κόβεται και ο χρήστης δεν βλέπει τίποτα. */
const SCENE_BAND_MM = 1e6;

const WORLD_A: Point2D = { x: 407_723_104, y: 4_502_396_120 }; // η ισοϋψής του screenshot
const WORLD_B: Point2D = { x: 407_680_000, y: 4_502_300_000 };

const CONTOURS: readonly ContourLine[] = [
  { level: 12_500, isMajor: true, closed: false, vertices: [WORLD_A, WORLD_B] },
];
const POINTS: readonly TopoPoint[] = [
  { x: WORLD_A.x, y: WORLD_A.y, z: 103_720, pointNumber: '101', code: 'TREE' },
];
const BOUNDARY: readonly Point2D[] = [WORLD_A, WORLD_B, { x: 407_700_000, y: 4_502_350_000 }];
const RINGS: readonly Point2D[][] = [[WORLD_A, WORLD_B, { x: 407_650_000, y: 4_502_200_000 }]];
const WORLD_RECT: WorldRectMm = {
  minX: 407_600_000, minY: 4_502_200_000, maxX: 407_800_000, maxY: 4_502_400_000,
};

const CONTOUR_LAYERS: ContourLayerIds = { major: 'L-MAJ', minor: 'L-MIN', label: 'L-LBL' };
const LABEL_LAYERS: PointLabelLayerIds = {
  elevation: 'L-ELEV', code: 'L-CODE', number: 'L-NUM', boundary: 'L-BND',
};
const SAMPLER: TinSampler = { zAtMm: () => 5000 };
const ALL_ON = { showElevation: true, showPointNumberCode: true, showBoundaryXy: true };

// ── Γενικός εξαγωγέας γεωμετρίας — ό,τι σχήμα κι αν έχει η οντότητα ──────────────────────────
interface GeometryBearing {
  readonly position?: Point2D;
  readonly start?: Point2D;
  readonly end?: Point2D;
  readonly vertices?: readonly Point2D[];
  readonly footprint?: readonly (readonly Point2D[])[];
}

function geometryPoints(entities: readonly GeometryBearing[]): Point2D[] {
  const out: Point2D[] = [];
  for (const e of entities) {
    if (e.position) out.push(e.position);
    if (e.start) out.push(e.start);
    if (e.end) out.push(e.end);
    if (e.vertices) out.push(...e.vertices);
    if (e.footprint) for (const ring of e.footprint) out.push(...ring);
  }
  return out;
}

/** Οι ΕΞΙ παραγωγοί, ο καθένας με τις ΙΔΙΕΣ ΕΓΣΑ εισόδους και τον projector ως τη μόνη διαφορά. */
const PRODUCERS: readonly {
  readonly name: string;
  readonly build: (projector: WorldToDisplayProjector | null) => GeometryBearing[];
}[] = [
  {
    name: 'ισοϋψείς + ετικέτες υψομέτρου (useTopoContours ΚΑΙ regenerate-topo)',
    build: (p) => buildContourEntities(
      projectContourLines(CONTOURS, p), DEFAULT_CONTOUR_CONFIG, CONTOUR_LAYERS, false,
    ),
  },
  {
    name: 'ετικέτες σημείων + κορυφών οικοπέδου (useTopoPointLabels)',
    build: (p) => buildSurveyPointLabelEntities(POINTS, BOUNDARY, SAMPLER, LABEL_LAYERS, ALL_ON, p),
  },
  {
    name: 'κάναβος ΕΓΣΑ, ψημένος στο σχέδιο (useTopoGrid)',
    build: (p) => buildTopoGridEntities(buildTopoGrid(WORLD_RECT, 50_000), 'L-GRID', p),
  },
  {
    name: 'footprint επιφάνειας (buildTopoSurfaceEntity)',
    build: (p) => [{ footprint: projectWorldRings(RINGS, p) }],
  },
  {
    name: 'βορράς (useNorthArrow)',
    build: (p) => buildNorthArrowEntities(projectWorldPoint(WORLD_A, p), 0, 'L-NORTH'),
  },
  {
    name: 'σταυροί ζωντανού καννάβου (TopoGridUnderlayCanvas)',
    build: (p) => [{ vertices: projectWorldPoints(buildTopoGrid(WORLD_RECT, 50_000).crosses, p) }],
  },
];

describe('ADR-650 §M10f — κάθε τοπογραφικός παραγωγός περνά τη ΜΙΑ γέφυρα WORLD→display', () => {
  const projector = makeWorldToDisplayProjector(GEO);

  it.each(PRODUCERS.map((p) => [p.name, p] as const))(
    'με ενεργή γεωαναφορά, ΟΛΗ η γεωμετρία κάθεται μέσα στη ζώνη της σκηνής — %s',
    (_name, producer) => {
      const points = geometryPoints(producer.build(projector));
      expect(points.length).toBeGreaterThan(0);
      for (const pt of points) {
        expect(Number.isFinite(pt.x) && Number.isFinite(pt.y)).toBe(true);
        expect(Math.abs(pt.x)).toBeLessThan(SCENE_BAND_MM);
        expect(Math.abs(pt.y)).toBeLessThan(SCENE_BAND_MM);
      }
    },
  );

  it.each(PRODUCERS.map((p) => [p.name, p] as const))(
    'ΑΡΝΗΤΙΚΟΣ ΜΑΡΤΥΡΑΣ: χωρίς projector το ίδιο προϊόν πέφτει ΕΞΩ από τη ζώνη — %s',
    (_name, producer) => {
      const points = geometryPoints(producer.build(null));
      // Αν αυτό γίνει πράσινο «από μόνο του», ο έλεγχος από πάνω δεν αποδεικνύει τίποτα.
      expect(points.some((pt) => Math.abs(pt.x) > SCENE_BAND_MM || Math.abs(pt.y) > SCENE_BAND_MM)).toBe(true);
    },
  );

  it('η προβολή είναι ΑΚΡΙΒΩΣ ο ενεργός rigid μετασχηματισμός (όχι «περίπου κοντά»)', () => {
    const [contour] = projectContourLines(CONTOURS, projector);
    const expected = projector.project(WORLD_A.x, WORLD_A.y);
    expect(contour.vertices[0].x).toBeCloseTo(expected.x, 6);
    expect(contour.vertices[0].y).toBeCloseTo(expected.y, 6);
    // Το υψόμετρο ΔΕΝ αγγίζεται — ο μετασχηματισμός είναι επίπεδος.
    expect(contour.level).toBe(12_500);
  });

  it('ισχύει και με στροφή (rigid, όχι μόνο μετατόπιση)', () => {
    const rotated = makeWorldToDisplayProjector(GEO_ROTATED);
    for (const producer of PRODUCERS) {
      for (const pt of geometryPoints(producer.build(rotated))) {
        expect(Math.abs(pt.x)).toBeLessThan(SCENE_BAND_MM);
        expect(Math.abs(pt.y)).toBeLessThan(SCENE_BAND_MM);
      }
    }
  });
});

describe('ADR-650 §M10f — το ΚΕΙΜΕΝΟ μένει ΕΓΣΑ (νομικό μέγεθος)', () => {
  const projector = makeWorldToDisplayProjector(GEO);
  const textsOf = (es: { type?: string; text?: string }[]): string[] =>
    es.filter((e) => e.type === 'text').map((e) => e.text ?? '');

  it('η κορυφή οικοπέδου τυπώνει τις ΕΓΣΑ συντεταγμένες της, όχι τις τοπικές', () => {
    const withGeo = buildSurveyPointLabelEntities(
      POINTS, BOUNDARY, SAMPLER, LABEL_LAYERS, { ...ALL_ON, showElevation: false, showPointNumberCode: false }, projector,
    );
    const without = buildSurveyPointLabelEntities(
      POINTS, BOUNDARY, SAMPLER, LABEL_LAYERS, { ...ALL_ON, showElevation: false, showPointNumberCode: false }, null,
    );
    expect(textsOf(withGeo)).toEqual(textsOf(without));
    expect(textsOf(withGeo)[0]).toContain('Χ407723.10');
  });

  it('η ετικέτα του καννάβου τυπώνει τη στρογγυλή τιμή ΕΓΣΑ σε μέτρα', () => {
    const grid = buildTopoGrid(WORLD_RECT, 50_000);
    const withGeo = textsOf(buildTopoGridEntities(grid, 'L-GRID', projector));
    const without = textsOf(buildTopoGridEntities(grid, 'L-GRID', null));
    expect(withGeo).toEqual(without);
    expect(withGeo).toContain('407650');
  });
});

describe('ADR-650 §M10f — η ΜΙΑ είσοδος που διαβάζει store', () => {
  afterEach(() => setGeoReference(null));

  it('μη-γεωαναφερμένο έργο ⇒ `null` (το fast path είναι ένας έλεγχος που δεν ξεχνιέται)', () => {
    setGeoReference(null);
    expect(getTopoDisplayProjector()).toBeNull();
  });

  it('identity αναφορά ⇒ επίσης `null` (δεν πληρώνουμε μετασχηματισμό για το τίποτα)', () => {
    setGeoReference({ originWorld: { x: 0, y: 0 }, rotationDeg: 0 });
    expect(getTopoDisplayProjector()).toBeNull();
  });

  it('ενεργή αναφορά ⇒ projector που συμφωνεί με τον store', () => {
    setGeoReference(GEO);
    const p = getTopoDisplayProjector();
    expect(p).not.toBeNull();
    expect(getGeoReference()).toEqual(GEO);
    expect(p!.project(WORLD_A.x, WORLD_A.y).x).toBeCloseTo(WORLD_A.x - ORIGIN_WORLD.x, 6);
  });
});

describe('ADR-650 §M10f — unprojectRectToWorld (ο ζωντανός κάναβος ρωτά στο σωστό σύστημα)', () => {
  const projector = makeWorldToDisplayProjector(GEO);
  const DISPLAY_RECT: WorldRectMm = { minX: -50_000, minY: -50_000, maxX: 200_000, maxY: 400_000 };

  it('γυρίζει το ορατό ορθογώνιο πίσω σε ΕΓΣΑ, ώστε οι στρογγυλές γραμμές να έχουν νόημα', () => {
    const world = unprojectRectToWorld(DISPLAY_RECT, projector);
    expect(world.minX).toBeCloseTo(ORIGIN_WORLD.x - 50_000, 6);
    expect(world.maxY).toBeCloseTo(ORIGIN_WORLD.y + 400_000, 6);
    expect(buildTopoGrid(world, 50_000).eastings.length).toBeGreaterThan(0);
  });

  it('χωρίς γεωαναφορά επιστρέφει το ίδιο ορθογώνιο (no-op)', () => {
    expect(unprojectRectToWorld(DISPLAY_RECT, null)).toEqual(DISPLAY_RECT);
  });

  it('με στροφή επιστρέφει το ΠΕΡΙΒΑΛΛΟΝ AABB — υπερ-καλύπτει, δεν κόβει', () => {
    const rotated = makeWorldToDisplayProjector(GEO_ROTATED);
    const world = unprojectRectToWorld(DISPLAY_RECT, rotated);
    const straight = unprojectRectToWorld(DISPLAY_RECT, projector);
    expect(world.maxX - world.minX).toBeGreaterThan(straight.maxX - straight.minX);
  });
});
