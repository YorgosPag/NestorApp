/**
 * ADR-911 Δ3 — **Τοπολογική πρόταση λειτουργίας τοίχου**: ποιος τοίχος βλέπει το εξωτερικό.
 *
 * Το πάχος δεν αρκεί: εσωτερικός φέρων 250 mm και εξωτερικός 250 mm έχουν το ίδιο πάχος.
 * Εδώ η απάντηση βγαίνει από τη **θέση**: εξωτερικός είναι ο τοίχος που μια παρειά του
 * συνορεύει με το εξωτερικό του κελύφους.
 *
 * Το «εξωτερικό» δεν μπορεί να βρεθεί με απλό γέμισμα: οι τοίχοι του σχεδίου είναι κομμάτια
 * που σταματούν στα ανοίγματα, άρα κάθε πόρτα εισόδου θα άφηνε το γέμισμα να μπει μέσα. Γι'
 * αυτό το κέλυφος **διαστέλλεται** πρώτα κατά R (⇒ κλείνουν κενά ≤ 2R) και μετά γεμίζεται
 * το εξωτερικό του από το πλαίσιο. Κάθε παρειά ρωτά ένα σημείο **R πιο έξω** από την ίδια:
 *
 *   στερεό → διαστολή R → γέμισμα από το πλαίσιο → δειγματοληψία σε απόσταση R από την παρειά
 *
 * ⚠️ Το εξωτερικό ΔΕΝ διαστέλλεται πίσω προς τον τοίχο: η επαναδιαστολή θα έμπαινε από κάθε
 * άνοιγμα πλάτους w έως w/2 μέσα στο κτίριο και θα έβγαζε «εξωτερικούς» τους κοντούς
 * εσωτερικούς τοίχους δίπλα στις πόρτες. Η δειγματοληψία στο R δεν έχει αυτή τη διαρροή.
 *
 * ⚠️ Είναι **ΠΡΟΤΑΣΗ**, όχι μέτρηση. Γνωστά όρια: (α) εξωτερική εσοχή στενότερη από ~2R
 * (π.χ. μικρός εξώστης) κλείνει μαζί με τα ανοίγματα και οι τοίχοι της βγαίνουν
 * «εσωτερικοί»· (β) κοντός εξωτερικός τοίχος δίπλα σε εσωτερική γωνία μπορεί να χάσει την
 * πλειοψηφία των σταθμών του. Ο
 * άνθρωπος επιβεβαιώνει ανά ομάδα πάχους· τίποτα δεν γράφεται από εδώ.
 *
 * ΚΑΘΑΡΟ (pure) — zero React/DOM/store.
 *
 * @see ./wall-proposal.ts (ο καταναλωτής)
 * @see docs/centralized-systems/reference/adrs/ADR-911-model-from-drawing-assistant.md §5 Δ3
 */

import type { Point2D } from '../../rendering/types/Types';
import { MODEL_FROM_DRAWING_LIMITS } from '../../config/tolerance-config';
import { pointInPolygonCovers } from '../geometry/shared/polygon-point-location';
import { detectedRectAxis, type DetectedRectangle } from '../walls/wall-in-region';

export type WallFunctionSuggestion = 'exterior' | 'interior';

/** Σταθμοί δειγματοληψίας κατά μήκος κάθε παρειάς (κλάσματα του μήκους, μακριά από τα άκρα). */
const FACE_STATIONS: readonly number[] = [0.2, 0.35, 0.5, 0.65, 0.8];

/** Ράστερ πάνω στο πλαίσιο του σχεδίου. Όλα σε scene units· `cell` = πλευρά κελιού. */
interface Grid {
  readonly minX: number;
  readonly minY: number;
  readonly cell: number;
  readonly cols: number;
  readonly rows: number;
}

function buildGrid(polygons: readonly (readonly Point2D[])[], padding: number, minThickness: number): Grid {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const poly of polygons) {
    for (const p of poly) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
  }
  const width = maxX - minX + 2 * padding;
  const height = maxY - minY + 2 * padding;
  // Κελί = μισό του λεπτότερου τοίχου (κανένας δεν πέφτει ανάμεσα σε κέντρα κελιών), αλλά
  // ποτέ τόσο μικρό που το ράστερ να ξεπεράσει το όριο κελιών.
  const cellForBudget = Math.sqrt((width * height) / MODEL_FROM_DRAWING_LIMITS.ENVELOPE_MAX_CELLS);
  const cell = Math.max(minThickness / 2, cellForBudget);
  return {
    minX: minX - padding,
    minY: minY - padding,
    cell,
    cols: Math.max(1, Math.ceil(width / cell)),
    rows: Math.max(1, Math.ceil(height / cell)),
  };
}

/** Σημαδεύει τα κελιά που το κέντρο τους πέφτει μέσα (ή πάνω) σε κάποιο πολύγωνο. */
function rasterize(polygons: readonly (readonly Point2D[])[], grid: Grid): Uint8Array {
  const solid = new Uint8Array(grid.cols * grid.rows);
  for (const poly of polygons) {
    const xs = poly.map((p) => p.x);
    const ys = poly.map((p) => p.y);
    const c0 = Math.max(0, Math.floor((Math.min(...xs) - grid.minX) / grid.cell));
    const c1 = Math.min(grid.cols - 1, Math.floor((Math.max(...xs) - grid.minX) / grid.cell));
    const r0 = Math.max(0, Math.floor((Math.min(...ys) - grid.minY) / grid.cell));
    const r1 = Math.min(grid.rows - 1, Math.floor((Math.max(...ys) - grid.minY) / grid.cell));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const centre = { x: grid.minX + (c + 0.5) * grid.cell, y: grid.minY + (r + 0.5) * grid.cell };
        if (pointInPolygonCovers(centre, poly)) solid[r * grid.cols + c] = 1;
      }
    }
  }
  return solid;
}

/**
 * BFS πολλαπλών πηγών (4-γειτονιά): επιστρέφει τα κελιά που φτάνονται από τις `seeds` σε
 * ≤ `maxSteps` βήματα, περνώντας μόνο από κελιά όπου `passable` είναι 1. Με `maxSteps`
 * άπειρο είναι γέμισμα· με πεπερασμένο είναι διαστολή (ρομβικό στοιχείο).
 */
function spread(seeds: Uint8Array, passable: Uint8Array | null, grid: Grid, maxSteps: number): Uint8Array {
  const reached = Uint8Array.from(seeds);
  let frontier: number[] = [];
  for (let i = 0; i < seeds.length; i++) if (seeds[i]) frontier.push(i);
  for (let step = 0; step < maxSteps && frontier.length > 0; step++) {
    const next: number[] = [];
    for (const i of frontier) {
      const c = i % grid.cols;
      const neighbours = [c > 0 ? i - 1 : -1, c < grid.cols - 1 ? i + 1 : -1, i - grid.cols, i + grid.cols];
      for (const n of neighbours) {
        if (n < 0 || n >= reached.length || reached[n] || (passable && !passable[n])) continue;
        reached[n] = 1;
        next.push(n);
      }
    }
    frontier = next;
  }
  return reached;
}

/** Το εξωτερικό του διεσταλμένου κελύφους (κενά ≤ 2R κλειστά), ως μάσκα κελιών. */
function outsideMask(solid: Uint8Array, grid: Grid, radiusCells: number): Uint8Array {
  const dilated = spread(solid, null, grid, radiusCells);
  const open = dilated.map((v) => (v ? 0 : 1));
  // Το πλαίσιο είναι εγγυημένα ελεύθερο: το padding είναι μεγαλύτερο από την ακτίνα κλεισίματος.
  const border = new Uint8Array(solid.length);
  for (let c = 0; c < grid.cols; c++) { border[c] = 1; border[(grid.rows - 1) * grid.cols + c] = 1; }
  for (let r = 0; r < grid.rows; r++) { border[r * grid.cols] = 1; border[r * grid.cols + grid.cols - 1] = 1; }
  return spread(border, open, grid, Infinity);
}

function isOutside(point: Point2D, mask: Uint8Array, grid: Grid): boolean {
  const c = Math.floor((point.x - grid.minX) / grid.cell);
  const r = Math.floor((point.y - grid.minY) / grid.cell);
  if (c < 0 || r < 0 || c >= grid.cols || r >= grid.rows) return true;
  return mask[r * grid.cols + c] === 1;
}

/** `true` αν η πλειοψηφία των σταθμών μιας παρειάς, `radius` πιο έξω από αυτήν, βλέπει εξωτερικό. */
function faceSeesOutside(
  rect: DetectedRectangle,
  side: 1 | -1,
  radius: number,
  mask: Uint8Array,
  grid: Grid,
): boolean {
  const { start, end, length, thickness } = detectedRectAxis(rect);
  if (!(length > 0)) return false;
  const nx = (-(end.y - start.y) / length) * side;
  const ny = ((end.x - start.x) / length) * side;
  const reach = thickness / 2 + radius + 1.5 * grid.cell;
  const hits = FACE_STATIONS.filter((t) =>
    isOutside(
      { x: start.x + (end.x - start.x) * t + nx * reach, y: start.y + (end.y - start.y) * t + ny * reach },
      mask,
      grid,
    ),
  ).length;
  return hits * 2 > FACE_STATIONS.length;
}

/**
 * Για κάθε ορθογώνιο-τοίχο: βλέπει το εξωτερικό (έστω από μία παρειά) ή όχι.
 *
 * @param rects        τα ανιχνευμένα ορθογώνια-τοίχοι (scene units)
 * @param obstacles    άλλα στερεά του κελύφους (π.χ. αποτυπώματα κολωνών) — κλείνουν γωνίες
 * @param mmToScene    πόσες μονάδες σκηνής είναι ένα mm
 */
export function suggestWallFunctions(
  rects: readonly DetectedRectangle[],
  obstacles: readonly (readonly Point2D[])[],
  mmToScene: number,
): ReadonlyMap<DetectedRectangle, WallFunctionSuggestion> {
  const out = new Map<DetectedRectangle, WallFunctionSuggestion>();
  if (rects.length === 0) return out;
  const radius = MODEL_FROM_DRAWING_LIMITS.ENVELOPE_CLOSING_RADIUS_MM * mmToScene;
  const polygons = [...rects.map((r) => r.polygon as readonly Point2D[]), ...obstacles];
  const minThickness = Math.min(...rects.map((r) => detectedRectAxis(r).thickness));
  const grid = buildGrid(polygons, radius * 2, minThickness);
  const mask = outsideMask(rasterize(polygons, grid), grid, Math.ceil(radius / grid.cell));
  for (const rect of rects) {
    const exterior =
      faceSeesOutside(rect, 1, radius, mask, grid) || faceSeesOutside(rect, -1, radius, mask, grid);
    out.set(rect, exterior ? 'exterior' : 'interior');
  }
  return out;
}
