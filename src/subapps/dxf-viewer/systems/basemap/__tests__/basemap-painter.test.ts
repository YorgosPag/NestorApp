/**
 * ADR-782 §27.7 — άγκυρες `Ψ` του **ζωγράφου πλακιδίων** (ψηφιδωτό).
 *
 * ## Το ερώτημα, ακριβώς
 * > **«Ο ζωγράφος ακουμπά κάθε πλακίδιο στο εικονοστοιχείο που λέει ο προβολέας;»**
 *
 * ## 🔴 Τι ΔΕΝ ρωτούν αυτές οι άγκυρες — και γιατί η διάκριση είναι το παν
 * Η **μαθηματική** ορθότητα της αλυσίδας είναι **ήδη** αποδεδειγμένη αλλού και **δεν**
 * ξαναγράφεται εδώ: `Μ1`-`Μ10` (μετάβαση-επιστροφή WGS84 ⇄ ΕΓΣΑ'87 κάτω από το εκατοστό),
 * `Φ3`/`Φ8` (η άγκυρα προβάλλεται ακριβώς στην τοπική αρχή), `Φ3β` (τα πλακίδια κάθονται στη
 * Θεσσαλονίκη), `Τ1`-`Τ10` (ποιο επίπεδο, πόσα πλακίδια, πόσο πυκνό πλέγμα).
 *
 * Εδώ ελέγχεται το **επόμενο** σκαλί, που δεν το κοίταζε **κανείς**: η **καλωδίωση** ανάμεσα στα
 * εικονοστοιχεία της **εικόνας** και στα εικονοστοιχεία της **οθόνης**. Μια εναλλαγή `u`↔`v`,
 * ένα λάθος μέγεθος πλακιδίου, ένα ζευγάρωμα λάθος κορυφών ή μια χαμένη αντιστροφή Y δίνουν
 * μαθηματικά **άψογη** αλυσίδα και χάρτη **στο λάθος μέρος** — και η ανοχή `0,02°` της `Φ3β`
 * (≈ **2 km**) αποδεικνύει «σωστή **πόλη**», ποτέ «σωστό **μέτρο**».
 *
 * ## Η δεύτερη φωνή
 * Ο καταγραφέας κρατά την **πραγματική** μήτρα που φτάνει στον καμβά (με σωστή σημασιολογία
 * `save`/`restore` και **σύνθεση**, όπως το `ctx.transform`). Η άγκυρα εφαρμόζει εκείνη τη μήτρα
 * σε ένα σημείο της **εικόνας** και ρωτά πού προσγειώνεται. Η αναμενόμενη απάντηση έρχεται από
 * την αλυσίδα SSoT — και στην `Ψ1` από **χειρόγραφο** τύπο οθόνης, ώστε το σκαλί «κόσμος →
 * εικονοστοιχείο» να έχει μάρτυρα που δεν είναι ο εαυτός του.
 *
 * ⚠️ Η `Ψ6` είναι η **μόνη** μη-ταυτολογική ως προς την παρεμβολή: ρωτά σημείο που **δεν είναι
 * κορυφή**, δηλαδή εκεί όπου το αφινικό τρίγωνο **ψεύδεται** — και απαιτεί το ψέμα να μένει κάτω
 * από την ίδια την υπόσχεση του πλέγματος ({@link WARP_TOLERANCE_PX}), διαβασμένη από την πηγή.
 */

import { paintBasemap, SEAM_BLEED_PX } from '../basemap-painter';
import { assessTileWarp, buildTileWarpMesh, WARP_TOLERANCE_PX } from '../basemap-warp';
import { geographicToDisplayMm, geographicToWorldMm } from '../basemap-projection';
import { chooseZoomLevel, tilesForDisplayRect } from '../basemap-tile-model';
import { visibleDisplayRect } from '../../../rendering/core/visible-display-rect';
import { BASEMAP_SOURCES } from '../basemap-source';
import {
  geographicToTileFraction,
  tileFractionToGeographic,
  tileFractionToTileId,
  type TileId,
} from '../web-mercator';
import {
  makeWorldToDisplayProjector,
  type WorldToDisplayProjector,
} from '../../geo-referencing/geo-transform';
import { CoordinateTransforms as CT } from '../../../rendering/core/CoordinateTransforms';
import { DRAWING_AREA_CHROME } from '../../../rendering/core/drawing-area';
import type { Point2D, ViewTransform, Viewport } from '../../../rendering/types/Types';

// Το δίκτυο και το `Image` δεν έχουν θέση εδώ: το ερώτημα είναι «πού ακουμπά», όχι «τι κατέβηκε».
jest.mock('../basemap-tile-cache', () => ({
  __esModule: true,
  getTileImage: jest.fn(() => ({ width: 256, height: 256 })),
}));
import { getTileImage } from '../basemap-tile-cache';
const mockGetTileImage = getTileImage as jest.MockedFunction<typeof getTileImage>;

const OSM = BASEMAP_SOURCES['osm-standard'];
/** Πλατεία Αριστοτέλους — το ίδιο σημείο με τις άγκυρες `Φ`, ώστε τα ευρήματα να συγκρίνονται. */
const THESSALONIKI = { lat: 40.6326, lon: 22.9412 } as const;
const VIEWPORT: Viewport = { width: 1200, height: 800 };
/**
 * Μετατοπίσεις **μη μηδενικές και ασύμμετρες** επίτηδες: μηδενικά offsets κάνουν κάθε λάθος
 * πρόσημο ή χαμένο όρο να ακυρώνεται μόνος του, δηλαδή άγκυρα που περνά κατά τύχη.
 */
const TRANSFORM: ViewTransform = { scale: 0.02, offsetX: 137, offsetY: -211 };
/** Ακρίβεια σύγκρισης θέσης, σε εικονοστοιχεία — όριο διπλής ακρίβειας, όχι «σχεδόν». */
const EXACT_PX = 1e-6;

// ── Ο καταγραφέας ────────────────────────────────────────────────────────────────────────────

interface Matrix {
  readonly a: number; readonly b: number; readonly c: number;
  readonly d: number; readonly e: number; readonly f: number;
}

/** Μία σχεδίαση εικόνας: η **ισχύουσα** μήτρα και το **ήδη κλεισμένο** clip, σε px οθόνης. */
interface ImageDraw {
  readonly matrix: Matrix;
  readonly clip: readonly Point2D[];
  readonly alpha: number;
}

const IDENTITY: Matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

/** `m × t` — η σημασιολογία του `ctx.transform`: ο νέος μετασχηματισμός μπαίνει **δεξιά**. */
function compose(m: Matrix, t: Matrix): Matrix {
  return {
    a: m.a * t.a + m.c * t.b,
    b: m.b * t.a + m.d * t.b,
    c: m.a * t.c + m.c * t.d,
    d: m.b * t.c + m.d * t.d,
    e: m.a * t.e + m.c * t.f + m.e,
    f: m.b * t.e + m.d * t.f + m.f,
  };
}

/** Το σημείο της **εικόνας** περασμένο από τη μήτρα — δηλαδή πού ακουμπά στην οθόνη. */
function applyMatrix(m: Matrix, p: Point2D): Point2D {
  return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f };
}

interface Recorder {
  readonly ctx: CanvasRenderingContext2D;
  readonly draws: ImageDraw[];
  /** Πόσες φορές γράφτηκε το `globalAlpha` — η άγκυρα `Ψ8` μετρά ακριβώς αυτό. */
  readonly alphaWrites: () => number;
  readonly saves: () => number;
}

function createRecordingCtx(): Recorder {
  const draws: ImageDraw[] = [];
  let state = { matrix: IDENTITY, alpha: 1 };
  const stack: (typeof state)[] = [];
  let path: Point2D[] = [];
  let clip: readonly Point2D[] = [];
  let alphaWrites = 0;
  let saves = 0;

  const ctx = {
    save: (): void => { stack.push({ ...state }); saves += 1; },
    restore: (): void => { state = stack.pop() ?? state; },
    beginPath: (): void => { path = []; },
    moveTo: (x: number, y: number): void => { path.push({ x, y }); },
    lineTo: (x: number, y: number): void => { path.push({ x, y }); },
    closePath: (): void => {},
    clip: (): void => { clip = path.slice(); },
    transform: (a: number, b: number, c: number, d: number, e: number, f: number): void => {
      state = { ...state, matrix: compose(state.matrix, { a, b, c, d, e, f }) };
    },
    drawImage: (): void => { draws.push({ matrix: state.matrix, clip, alpha: state.alpha }); },
    set globalAlpha(value: number) { alphaWrites += 1; state = { ...state, alpha: value }; },
    get globalAlpha() { return state.alpha; },
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high' as CanvasRenderingContext2D['imageSmoothingQuality'],
  };

  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    draws,
    alphaWrites: () => alphaWrites,
    saves: () => saves,
  };
}

// ── Εργαλεία της άγκυρας ─────────────────────────────────────────────────────────────────────

/** Το πλακίδιο του επιπέδου `z` που περιέχει τη Θεσσαλονίκη. */
function thessalonikiTile(z: number): TileId {
  return tileFractionToTileId(geographicToTileFraction(THESSALONIKI.lat, THESSALONIKI.lon, z), z);
}

/**
 * **Η αναμενόμενη απάντηση**: πού λέει η αλυσίδα ότι κάθεται το σημείο `(u, v)` του πλακιδίου.
 * Πλακίδιο → WGS84 → χαρτί → οθόνη, όλα από SSoT.
 */
function chainScreenOf(
  tile: TileId,
  u: number,
  v: number,
  projector: WorldToDisplayProjector | null,
): Point2D {
  const geo = tileFractionToGeographic(tile.x + u, tile.y + v, tile.z);
  const display = geographicToDisplayMm(geo.lat, geo.lon, projector);
  return CT.worldToScreen(display, TRANSFORM, VIEWPORT);
}

/** Το σημείο `(u, v)` σε εικονοστοιχεία **της εικόνας** του πλακιδίου. */
function imagePointOf(u: number, v: number, tileSizePx: number): Point2D {
  return { x: u * tileSizePx, y: v * tileSizePx };
}

/** Πρόσημο του σταυρωτού γινομένου — η πλευρά της ακμής στην οποία πέφτει το σημείο. */
function side(a: Point2D, b: Point2D, p: Point2D): number {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
}

/** `true` όταν το σημείο βρίσκεται μέσα (ή πάνω) στο τρίγωνο του clip. */
function insideTriangle(triangle: readonly Point2D[], p: Point2D): boolean {
  if (triangle.length !== 3) return false;
  const s0 = side(triangle[0], triangle[1], p);
  const s1 = side(triangle[1], triangle[2], p);
  const s2 = side(triangle[2], triangle[0], p);
  return (s0 >= 0 && s1 >= 0 && s2 >= 0) || (s0 <= 0 && s1 <= 0 && s2 <= 0);
}

/**
 * **Πού ακούμπησε ο ζωγράφος** το σημείο `(u, v)` της εικόνας.
 *
 * Η ιδιοκτησία κρίνεται από το **ίδιο το clip** που κατέγραψε ο καμβάς — όχι από πλέγμα
 * ξαναχτισμένο στο test: αν κανένα τρίγωνο δεν διεκδικεί το εικονοστοιχείο, αυτό **είναι** το
 * εύρημα (τρύπα στο υπόβαθρο), και μια άγκυρα που θα διάλεγε μόνη της τρίγωνο θα το έκρυβε.
 */
function paintedScreenOf(
  draws: readonly ImageDraw[],
  expected: Point2D,
  u: number,
  v: number,
  tileSizePx: number,
): { readonly point: Point2D; readonly owners: number } {
  const image = imagePointOf(u, v, tileSizePx);
  const owners = draws.filter((d) => insideTriangle(d.clip, expected));
  return {
    point: owners.length > 0 ? applyMatrix(owners[0].matrix, image) : { x: NaN, y: NaN },
    owners: owners.length,
  };
}

/** Απόσταση σε εικονοστοιχεία — η μονάδα κάθε ισχυρισμού αυτού του αρχείου. */
function distancePx(a: Point2D, b: Point2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Εμβαδόν πολυγώνου (τύπος του κορδονιού), πάντα θετικό — δεν μας νοιάζει η φορά. */
function polygonArea(points: readonly Point2D[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

function centroidOf(points: readonly Point2D[]): Point2D {
  return {
    x: points.reduce((s, p) => s + p.x, 0) / points.length,
    y: points.reduce((s, p) => s + p.y, 0) / points.length,
  };
}

function paint(
  tile: TileId,
  projector: WorldToDisplayProjector | null,
  overrides: { opacity?: number; tileSizePx?: number; tiles?: readonly TileId[] } = {},
): Recorder {
  const recorder = createRecordingCtx();
  const source = overrides.tileSizePx === undefined
    ? OSM
    : { ...OSM, tileSizePx: overrides.tileSizePx };
  paintBasemap(recorder.ctx, TRANSFORM, VIEWPORT, {
    source,
    tiles: overrides.tiles ?? [tile],
    projector,
    opacity: overrides.opacity ?? 1,
  });
  return recorder;
}

/** Οι τέσσερις γωνίες σε μονάδες πλακιδίου, με τα ονόματά τους. */
const CORNERS = [
  { name: 'ΒΔ', u: 0, v: 0 },
  { name: 'ΒΑ', u: 1, v: 0 },
  { name: 'ΝΑ', u: 1, v: 1 },
  { name: 'ΝΔ', u: 0, v: 1 },
] as const;

beforeEach(() => {
  mockGetTileImage.mockReset();
  mockGetTileImage.mockReturnValue({ width: 256, height: 256 } as unknown as HTMLImageElement);
});

// ── Ψ0 — ο μάρτυρας ──────────────────────────────────────────────────────────────────────────

describe('Ψ0 — ο καταγραφέας κατέγραψε (παρονομαστής)', () => {
  it('Ψ0 — ένα πλακίδιο δίνει ΑΚΡΙΒΩΣ 2·divisions² σχεδιάσεις, και δεν είναι μηδέν', () => {
    // Χωρίς αυτόν τον παρονομαστή, κάθε άγκυρα παρακάτω θα μπορούσε να περνά επειδή δεν
    // ζωγραφίστηκε ΤΙΠΟΤΑ — το σχήμα «0 = κανείς δεν κοίταξε», μέσα στο όργανο που το κυνηγά.
    const tile = thessalonikiTile(17);
    const mesh = buildTileWarpMesh(tile, null, TRANSFORM.scale);
    const { draws } = paint(tile, null);

    expect(draws.length).toBe(2 * mesh.divisions ** 2);
    expect(draws.length).toBeGreaterThan(0);
  });
});

// ── Ψ1 — βαθμονόμηση: χειρόγραφος τύπος οθόνης ───────────────────────────────────────────────

describe('Ψ1 — βαθμονόμηση με ΧΕΙΡΟΓΡΑΦΟ τύπο', () => {
  it('Ψ1 — η ΒΔ γωνία προσγειώνεται εκεί που λέει ο τύπος, γραμμένος με το χέρι', () => {
    // Δεύτερη φωνή για το σκαλί «χαρτί → εικονοστοιχείο». Ο τύπος είναι γραμμένος εδώ ρητά
    // (ADR-782: το `worldY = 0` κάθεται στην ΑΝΩ ακμή της ζώνης του κάτω χάρακα), ενώ οι
    // σταθερές διαβάζονται από το SSoT — αντιγραμμένο «30» θα ήταν δεύτερη αυθεντία.
    const tile = thessalonikiTile(17);
    const { draws } = paint(tile, null);

    const geo = tileFractionToGeographic(tile.x, tile.y, tile.z);
    const display = geographicToDisplayMm(geo.lat, geo.lon, null);
    const byHand: Point2D = {
      x: DRAWING_AREA_CHROME.leftRulerWidth + display.x * TRANSFORM.scale + TRANSFORM.offsetX,
      y: (VIEWPORT.height - DRAWING_AREA_CHROME.bottomRulerHeight)
        - display.y * TRANSFORM.scale - TRANSFORM.offsetY,
    };

    const painted = paintedScreenOf(draws, byHand, 0, 0, OSM.tileSizePx);
    expect(painted.owners).toBeGreaterThan(0);
    expect(distancePx(painted.point, byHand)).toBeLessThan(EXACT_PX);
  });
});

// ── Ψ2-Ψ4 — «πού»: οι τέσσερις γωνίες ────────────────────────────────────────────────────────

describe('Ψ2-Ψ4 — κάθε γωνία στο εικονοστοιχείο της', () => {
  it('Ψ2 — μη γεωαναφερμένο έργο: και οι ΤΕΣΣΕΡΙΣ γωνίες συμφωνούν με την αλυσίδα', () => {
    const tile = thessalonikiTile(17);
    const { draws } = paint(tile, null);

    for (const corner of CORNERS) {
      const expected = chainScreenOf(tile, corner.u, corner.v, null);
      const painted = paintedScreenOf(draws, expected, corner.u, corner.v, OSM.tileSizePx);
      expect(`${corner.name}:${painted.owners > 0}`).toBe(`${corner.name}:true`);
      expect(`${corner.name}:${distancePx(painted.point, expected) < EXACT_PX}`)
        .toBe(`${corner.name}:true`);
    }
  });

  it('Ψ3 — γεωαναφορά ΜΕ ΣΤΡΟΦΗ: το ίδιο, με τον προβολέα στη διαδρομή', () => {
    // Η στροφή είναι το κρίσιμο: χωρίς αυτήν, μια χαμένη κλήση `project` δίνει ΤΑΥΤΟΣΗΜΟ
    // αποτέλεσμα, δηλαδή η άγκυρα θα ήταν τυφλή ακριβώς στη βλάβη που κυνηγά (ADR-650 §M10f:
    // η προβολή ήταν κάποτε απούσα από τέσσερις παραγωγούς).
    const tile = thessalonikiTile(17);
    const projector = makeWorldToDisplayProjector({
      originWorld: { x: 410_000_000, y: 4_500_000_000 },
      rotationDeg: 23.5,
    });
    expect(projector.isIdentity).toBe(false); // αλλιώς η άγκυρα θα ξαναμετρούσε την Ψ2
    const { draws } = paint(tile, projector);

    for (const corner of CORNERS) {
      const expected = chainScreenOf(tile, corner.u, corner.v, projector);
      const painted = paintedScreenOf(draws, expected, corner.u, corner.v, OSM.tileSizePx);
      expect(`${corner.name}:${painted.owners > 0}`).toBe(`${corner.name}:true`);
      expect(`${corner.name}:${distancePx(painted.point, expected) < EXACT_PX}`)
        .toBe(`${corner.name}:true`);
    }
  });

  it('Ψ4 — ο βορράς ζωγραφίζεται ΠΑΝΩ από τον νότο, και το πλακίδιο δεν είναι σημείο', () => {
    // Μια αντιστροφή Y δίνει σωστές αποστάσεις και ανάποδο χάρτη. Ο ισχυρισμός γράφεται
    // χωριστά ώστε η βλάβη να ΟΝΟΜΑΖΕΤΑΙ, αντί να κρύβεται μέσα σε μια σύγκριση απόστασης.
    const tile = thessalonikiTile(17);
    const { draws } = paint(tile, null);

    const nw = chainScreenOf(tile, 0, 0, null);
    const ne = chainScreenOf(tile, 1, 0, null);
    const sw = chainScreenOf(tile, 0, 1, null);
    const paintedNw = paintedScreenOf(draws, nw, 0, 0, OSM.tileSizePx).point;
    const paintedNe = paintedScreenOf(draws, ne, 1, 0, OSM.tileSizePx).point;
    const paintedSw = paintedScreenOf(draws, sw, 0, 1, OSM.tileSizePx).point;

    expect(paintedNw.y).toBeLessThan(paintedSw.y);       // βορράς πάνω
    expect(paintedNw.x).toBeLessThan(paintedNe.x);       // ανατολή δεξιά
    expect(distancePx(paintedNw, paintedNe)).toBeGreaterThan(1);
  });
});

// ── Ψ5 — «πόσο»: η κλίμακα ───────────────────────────────────────────────────────────────────

describe('Ψ5 — η κλίμακα του ζωγραφισμένου πλακιδίου', () => {
  it('Ψ5 — το πλάτος σε εικονοστοιχεία ταυτίζεται με αυτό της αλυσίδας', () => {
    const tile = thessalonikiTile(17);
    const { draws } = paint(tile, null);

    const nw = chainScreenOf(tile, 0, 0, null);
    const ne = chainScreenOf(tile, 1, 0, null);
    const expectedWidth = distancePx(nw, ne);
    const paintedWidth = distancePx(
      paintedScreenOf(draws, nw, 0, 0, OSM.tileSizePx).point,
      paintedScreenOf(draws, ne, 1, 0, OSM.tileSizePx).point,
    );

    expect(expectedWidth).toBeGreaterThan(1); // παρονομαστής: το πλακίδιο έχει όντως μέγεθος
    expect(Math.abs(paintedWidth - expectedWidth)).toBeLessThan(EXACT_PX);
  });
});

// ── Ψ6 — «ανάμεσα»: εκεί όπου το αφινικό ψεύδεται ────────────────────────────────────────────

/**
 * Τα ζεύγη (πυκνότητα, κλίμακα) που παράγει ο **ίδιος ο αγωγός** — από zoom-out σε άδειο σχέδιο
 * μέχρι κοντινό σε λεπτομέρεια κτιρίου. Το επίπεδο **δεν επιλέγεται εδώ**: το λέει το
 * {@link chooseZoomLevel}, αλλιώς η άγκυρα θα δοκίμαζε συνδυασμούς που δεν συμβαίνουν ποτέ.
 */
const PIPELINE_CASES = [1, 2].flatMap((devicePixelRatio) =>
  [1e-5, 1e-4, 1e-3, 0.005, 0.02, 0.1, 1].map((scale) => ({ devicePixelRatio, scale })),
);

/** Το επίπεδο που θα ζητούσε ο αγωγός γι' αυτή την κλίμακα — **ποτέ** επίπεδο διαλεγμένο εδώ. */
function pipelineZoom(testCase: { readonly devicePixelRatio: number; readonly scale: number }): number {
  return chooseZoomLevel({
    pixelsPerMm: testCase.scale,
    devicePixelRatio: testCase.devicePixelRatio,
    latitude: THESSALONIKI.lat,
    source: OSM,
  });
}

/**
 * **Ολόκληρος ο αγωγός** για μια κλίμακα: ορατό ορθογώνιο → επιλογή επιπέδου → επιλογή πλακιδίων.
 *
 * 🔴 Χωρίς αυτό, η άγκυρα διαλέγει **μόνη της** πλακίδιο και ρωτά μόνο ό,τι σκέφτηκε ο συγγραφέας.
 * Η πρώτη γραφή του `Ψ6β` το έκανε ακριβώς αυτό και **κλείδωσε ψέμα** — δες την επικεφαλίδα του.
 */
function pipelineSelection(scale: number, devicePixelRatio: number) {
  const transform = { ...TRANSFORM, scale, offsetX: 0, offsetY: 0 };
  const visible = visibleDisplayRect(transform, VIEWPORT);
  const width = visible.maxX - visible.minX;
  const height = visible.maxY - visible.minY;
  const centre = geographicToWorldMm(THESSALONIKI.lat, THESSALONIKI.lon);
  const rect = {
    minX: centre.x - width / 2, maxX: centre.x + width / 2,
    minY: centre.y - height / 2, maxY: centre.y + height / 2,
  };
  const zoom = pipelineZoom({ devicePixelRatio, scale });
  return tilesForDisplayRect(rect, zoom, null, scale);
}

/**
 * Ο κεντρικός μεσημβρινός της ΕΓΣΑ'87 (Εγκάρσια Mercator). Η προβολή έχει νόημα σε **στενή
 * ζώνη** γύρω του — έξω από αυτήν δεν είναι «λίγο ανακριβής», είναι **χωρίς νόημα**.
 */
const EGSA87_CENTRAL_MERIDIAN = 24;

/** Πόσο μακριά από τον κεντρικό μεσημβρινό κάθεται η ΒΔ γωνία του πλακιδίου, σε μοίρες. */
function meridianDistanceDeg(tile: TileId): number {
  return Math.abs(tileFractionToGeographic(tile.x, tile.y, tile.z).lon - EGSA87_CENTRAL_MERIDIAN);
}

/** Πού ακούμπησε ο ζωγράφος το κέντρο του πρώτου κελιού, και πού λέει η αλυσίδα ότι είναι. */
function cellCentreError(scale: number, tile: TileId): { readonly errorPx: number; readonly divisions: number } {
  const transform = { ...TRANSFORM, scale };
  const recorder = createRecordingCtx();
  paintBasemap(recorder.ctx, transform, VIEWPORT, {
    source: OSM, tiles: [tile], projector: null, opacity: 1,
  });
  const mesh = buildTileWarpMesh(tile, null, scale);
  const u = 0.5 / mesh.divisions;
  const v = 0.5 / mesh.divisions;
  const geo = tileFractionToGeographic(tile.x + u, tile.y + v, tile.z);
  const truth = CT.worldToScreen(geographicToDisplayMm(geo.lat, geo.lon, null), transform, VIEWPORT);
  const owners = recorder.draws.filter((d) => insideTriangle(d.clip, truth));
  if (owners.length === 0) return { errorPx: Number.POSITIVE_INFINITY, divisions: mesh.divisions };
  const painted = applyMatrix(owners[0].matrix, imagePointOf(u, v, OSM.tileSizePx));
  return { errorPx: distancePx(painted, truth), divisions: mesh.divisions };
}

describe('Ψ6 — το εσωτερικό σημείο κάτω από την υπόσχεση του πλέγματος', () => {
  it('Ψ6 — σε ΚΑΘΕ ζεύγος που παράγει ο αγωγός, το κέντρο κελιού μένει κάτω από την ανοχή', () => {
    // Το κέντρο του κελιού είναι το σημείο ΜΕΓΙΣΤΗΣ απόκλισης της αφινικής προσέγγισης — γι'
    // αυτό ελέγχεται αυτό. Κάθεται πάνω στη διαγώνιο, άρα τα δύο τρίγωνα συμφωνούν εκεί: η
    // ετυμηγορία δεν εξαρτάται από το ποιο διεκδικεί το εικονοστοιχείο.
    const verdicts = PIPELINE_CASES.map((testCase) => {
      const z = pipelineZoom(testCase);
      const { errorPx } = cellCentreError(testCase.scale, thessalonikiTile(z));
      return `dpr=${testCase.devicePixelRatio} scale=${testCase.scale}: ${errorPx <= WARP_TOLERANCE_PX}`;
    });

    expect(verdicts.length).toBe(14); // παρονομαστής: πόσα ζεύγη ρωτήθηκαν όντως
    expect(verdicts.filter((v) => !v.endsWith('true'))).toEqual([]);
  });

  it('Ψ6β — το ΣΥΝΟΡΟ: όσο τα πλακίδια είναι κοντά στον μεσημβρινό, το πλέγμα δεν χρειάζεται τίποτα', () => {
    /**
     * 🔴 **Η πρώτη γραφή αυτής της άγκυρας ΚΛΕΙΔΩΝΕ ΨΕΜΑ.** Έλεγε «`divisions === 1` σε όλο το
     * ρεαλιστικό εύρος» — και ήταν αληθές **μόνο για το δείγμα κλιμάκων που διάλεξα**
     * (`1e-5 … 1`), το οποίο δεν έφτανε ποτέ σε **πλήρες zoom-out**. Επιπλέον διάλεγε **μόνη
     * της** το πλακίδιο (`thessalonikiTile(z)`) αντί να ρωτήσει τον αγωγό ποια πλακίδια θα
     * ζητούσε — δηλαδή ρωτούσε μόνο εκεί που ήξερε ήδη την απάντηση.
     *
     * Πλέον περνά ολόκληρος ο αγωγός και το κριτήριο είναι **γεωγραφικό**: όσο τα επιλεγμένα
     * πλακίδια κάθονται κοντά στον κεντρικό μεσημβρινό της ΕΓΣΑ'87, το πλέγμα μένει 1×1.
     */
    const nearMeridian = [1e-6, 1e-5, 1e-4, 1e-3, 0.01, 0.1, 1].map((scale) => {
      const selection = pipelineSelection(scale, 1);
      const tile = selection.tiles[Math.floor(selection.tiles.length / 2)];
      const divisions = buildTileWarpMesh(tile, null, scale).divisions;
      return { scale, far: meridianDistanceDeg(tile), divisions };
    });

    expect(nearMeridian.length).toBe(7);
    // παρονομαστής: όλα ΟΝΤΩΣ μέσα στη ζώνη, αλλιώς η άγκυρα δεν δοκιμάζει αυτό που λέει
    expect(nearMeridian.filter((r) => r.far > 30)).toEqual([]);
    expect([...new Set(nearMeridian.map((r) => r.divisions))]).toEqual([1]);
  });

  it('Ψ6γ — ✅ Η ΘΕΡΑΠΕΙΑ: σε πλήρες zoom-out ό,τι ΕΠΙΣΤΡΕΦΕΤΑΙ τηρεί την υπόσχεση', () => {
    /**
     * 🔴 **Αυτή η άγκυρα τεκμηρίωνε ΖΩΝΤΑΝΟ ελάττωμα** (ADR-782 §27.7): σε πλήρες zoom-out ο
     * αγωγός ζητούσε πλακίδια από την **άλλη άκρη του πλανήτη** και τα ζωγράφιζε παραμορφωμένα.
     * Το §27.9 το έκλεισε — άρα η άγκυρα άλλαξε **ερώτημα**, όχι κατώφλι: δεν ρωτά πια «σπάει;»
     * αλλά «**τηρείται η υπόσχεση σε ό,τι φτάνει στον ζωγράφο;**».
     *
     * ⚠️ Ο **παρονομαστής είναι υποχρεωτικός**: χωρίς το `droppedForFidelity > 0` μια μελλοντική
     * αλλαγή που επιστρέφει **κενή λίστα** θα άφηνε το «κανένα δεν αθετεί» πράσινο κατά κενό
     * αληθές — δηλαδή η άγκυρα θα επιβεβαίωνε τον εαυτό της (σχήμα CHECK 3.51).
     */
    const selection = pipelineSelection(1e-8, 1);

    expect(selection.droppedForFidelity).toBeGreaterThan(0); // παρονομαστής: ΟΝΤΩΣ απορρίφθηκαν
    for (const tile of selection.tiles) {
      expect(assessTileWarp(tile, null, 1e-8).withinTolerance).toBe(true);
    }
  });

  it('Ψ6δ — και το ελάττωμα ΥΠΑΡΧΕΙ ακόμη: καμία υποδιαίρεση δεν σώζει το πλακίδιο', () => {
    // Η προηγούμενη άγκυρα θα ήταν πράσινη και σε έναν κόσμο όπου η Εγκάρσια Mercator δουλεύει
    // παντού — δηλαδή δεν αποδεικνύει ότι το φίλτρο **χρειάζεται**. Εδώ ρωτιέται ο κριτής για
    // ΟΛΟΚΛΗΡΟ το επίπεδο 1: αν πάψει να βρίσκει σπασμένα, το φίλτρο έγινε νεκρός φρουρός
    // (ADR-749 §5) και η `Ψ6γ` από πάνω θα το κρύβει, γιατί εκείνη ρωτά μόνο τα επιζώντα.
    const all: readonly TileId[] = [
      { z: 1, x: 0, y: 0 }, { z: 1, x: 1, y: 0 },
      { z: 1, x: 0, y: 1 }, { z: 1, x: 1, y: 1 },
    ];
    const verdicts = all.map((tile) => assessTileWarp(tile, null, 1e-8));
    const broken = verdicts.filter((v) => !v.withinTolerance);
    const worst = Math.max(...verdicts.map((v) => v.residualPx));

    expect(broken.length).toBeGreaterThan(0);
    expect(broken.every((v) => v.divisions === 8)).toBe(true); // κόλλησαν στο ταβάνι
    expect(worst).toBeGreaterThan(WARP_TOLERANCE_PX * 100);
    // ⚠️ Ο κριτής και ο επιλογέας οφείλουν να λένε τον **ίδιο** αριθμό. Δύο μηχανές που κρίνουν
    // το ίδιο ερώτημα και αποκλίνουν είναι το σχήμα του ADR-749 — εδώ είναι δομικά αδύνατο μόνο
    // επειδή ο επιλογέας καλεί ΑΥΤΟΝ τον κριτή· η άγκυρα το κρατά αδύνατο.
    expect(pipelineSelection(1e-8, 1).droppedForFidelity).toBe(broken.length);
  });
});

// ── Ψ7 — η διαστολή ραφής ────────────────────────────────────────────────────────────────────

describe('Ψ7 — η διαστολή του clip υπάρχει και είναι προς τα ΕΞΩ', () => {
  /**
   * 🔴 **Το πρώτο γράψιμο αυτής της άγκυρας πέρασε ΨΕΥΤΙΚΑ.** Έλεγε «κάθε ακτίνα ξεπερνά το
   * `SEAM_BLEED_PX`» — και η μετάλλαξη `Μ5` (διαστολή → **0**) την άφησε **πράσινη**, γιατί η
   * άγκυρα διάβαζε **τον ίδιο αριθμό που μεταλλάχθηκε**: ο παρονομαστής κουνήθηκε μαζί με τη
   * μετάλλαξη. Ίδιο σχήμα με την άγκυρα των 17 κλειδιών του CHECK 3.51.
   *
   * Γι' αυτό ο πρώτος ισχυρισμός είναι πλέον **γεωμετρικός** — «το clip είναι ΜΕΓΑΛΥΤΕΡΟ από το
   * τρίγωνό του» — δηλαδή δεν αναφέρει καθόλου τη σταθερά· ο δεύτερος κρατά την **ακριβή** τιμή.
   */
  it('Ψ7 — το clip καλύπτει ΠΕΡΙΣΣΟΤΕΡΟ από το τρίγωνό του (καμία ραφή φόντου)', () => {
    // Χωρίς επικάλυψη, δύο γειτονικά τρίγωνα αφήνουν γραμμή φόντου ενός εικονοστοιχείου: σε
    // πλέγμα 8×8 αυτό είναι 128 ορατές ραφές ανά πλακίδιο.
    const tile = thessalonikiTile(17);
    const { draws } = paint(tile, null);
    const mesh = buildTileWarpMesh(tile, null, TRANSFORM.scale);
    expect(mesh.divisions).toBe(1);     // η αντιστοίχιση τριγώνου↔clip παρακάτω το προϋποθέτει
    expect(draws.length).toBe(2);

    const nw = chainScreenOf(tile, 0, 0, null);
    const ne = chainScreenOf(tile, 1, 0, null);
    const se = chainScreenOf(tile, 1, 1, null);
    const sw = chainScreenOf(tile, 0, 1, null);
    // Η σειρά είναι συμβόλαιο του ζωγράφου: κάθε κελί σπάει στη διαγώνιο ΒΔ→ΝΑ.
    const triangles = [[nw, ne, se], [nw, se, sw]];

    for (let i = 0; i < triangles.length; i += 1) {
      expect(draws[i].clip.length).toBe(3);
      expect(polygonArea(draws[i].clip)).toBeGreaterThan(polygonArea(triangles[i]));
    }
  });

  it('Ψ7β — η διαστολή είναι ΑΚΡΙΒΩΣ η δηλωμένη, και η δηλωμένη δεν είναι μηδέν', () => {
    expect(SEAM_BLEED_PX).toBeGreaterThan(0); // παρονομαστής: η υπόσχεση υπάρχει καν

    const tile = thessalonikiTile(17);
    const { draws } = paint(tile, null);
    const triangle = [
      chainScreenOf(tile, 0, 0, null),
      chainScreenOf(tile, 1, 0, null),
      chainScreenOf(tile, 1, 1, null),
    ];
    // Η διαστολή είναι ακτινική ως προς το κεντροειδές, άρα το κεντροειδές ΔΕΝ μετακινείται
    // και κάθε ακτίνα οφείλει να μεγαλώνει κατά ακριβώς τη δηλωμένη τιμή.
    const centre = centroidOf(triangle);
    for (let i = 0; i < 3; i += 1) {
      const bare = distancePx(triangle[i], centre);
      const dilated = distancePx(draws[0].clip[i], centre);
      expect(Math.abs(dilated - bare - SEAM_BLEED_PX)).toBeLessThan(EXACT_PX);
    }
  });
});

// ── Ψ8 — η αδιαφάνεια ────────────────────────────────────────────────────────────────────────

describe('Ψ8 — η αδιαφάνεια μπαίνει ΜΙΑ φορά', () => {
  it('Ψ8 — ένα γράψιμο globalAlpha για όλα τα πλακίδια, όχι ένα ανά πλακίδιο', () => {
    // Ανά πλακίδιο, οι επικαλύψεις της διαστολής θα ζωγραφίζονταν δύο φορές: η θεραπεία της
    // ραφής θα γεννούσε ορατό πλέγμα με άλλο χρώμα. Ο μετρητής το κάνει δομικό.
    const z = 17;
    const tile = thessalonikiTile(z);
    const neighbours: TileId[] = [tile, { z, x: tile.x + 1, y: tile.y }];
    const recorder = paint(tile, null, { opacity: 0.55, tiles: neighbours });

    expect(recorder.alphaWrites()).toBe(1);
    expect(recorder.draws.length).toBeGreaterThan(2);
    for (const draw of recorder.draws) expect(draw.alpha).toBe(0.55);
  });
});

// ── Ψ9-Ψ11 — οι αρνήσεις ─────────────────────────────────────────────────────────────────────

describe('Ψ9-Ψ11 — πότε ο ζωγράφος ΔΕΝ ακουμπά τίποτα', () => {
  it('Ψ9 — εικόνα που δεν έφτασε ακόμη: καμία σχεδίαση, καμία εξαίρεση', () => {
    mockGetTileImage.mockReturnValue(null);
    const { draws } = paint(thessalonikiTile(17), null);
    expect(draws.length).toBe(0);
  });

  it('Ψ10 — μηδενική αδιαφάνεια ή κενή λίστα: ούτε save στον καμβά', () => {
    const invisible = paint(thessalonikiTile(17), null, { opacity: 0 });
    expect(invisible.draws.length).toBe(0);
    expect(invisible.saves()).toBe(0);

    const empty = paint(thessalonikiTile(17), null, { tiles: [] });
    expect(empty.draws.length).toBe(0);
    expect(empty.saves()).toBe(0);
  });

  it('Ψ11 — εκφυλισμένο τρίγωνο: ο φρουρός κόβει, καμία μήτρα NaN δεν φτάνει στον καμβά', () => {
    // Πάροχος με μηδενικό μέγεθος πλακιδίου ⇒ κάθε τρίγωνο εικόνας έχει μηδενικό εμβαδόν.
    // Χωρίς τον φρουρό, το `setTransform` δέχεται τα NaN ΣΙΩΠΗΛΑ και ο καμβάς σταματά να
    // ζωγραφίζει για το υπόλοιπο του καρέ — «ο χάρτης εξαφανίζεται τυχαία».
    const { draws } = paint(thessalonikiTile(17), null, { tileSizePx: 0 });
    expect(draws.length).toBe(0);

    const healthy = paint(thessalonikiTile(17), null);
    expect(healthy.draws.length).toBeGreaterThan(0);
    for (const draw of healthy.draws) {
      for (const value of [draw.matrix.a, draw.matrix.b, draw.matrix.c, draw.matrix.d, draw.matrix.e, draw.matrix.f]) {
        expect(Number.isFinite(value)).toBe(true);
      }
    }
  });
});
