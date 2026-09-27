/**
 * @fileoverview **ΠΟΙΑ ΠΛΑΚΙΔΙΑ ΒΛΕΠΕΙ Ο ΕΠΙΣΚΕΠΤΗΣ ΤΩΡΑ, ΚΑΙ ΣΕ ΠΟΙΑ ΑΝΑΛΥΣΗ** — η επιλογή επιπέδου κατά πυκνότητα
 * εικονοστοιχείων και η λίστα ορατών πλακιδίων με σειρά «από το κέντρο προς τα έξω» (ADR-884 Φ2ε · §4.11). Καθαρό.
 * @related `tour-cube-faces.ts` (η ΜΙΑ σύμβαση όψεων — καμία δεύτερη γεωμετρία εδώ) · `../tileset/tour-tileset-layout.ts`
 *   (`tileUvRect`, `tilesPerSide`) · `components/spatial-tour/viewer/tour-tile-streamer.ts` (ο μόνος καταναλωτής)
 * @module lib/spatial-tour/viewer/tour-tile-visibility
 *
 * 🔴 **Γιατί υπάρχει** (ζωντανή δοκιμή με ΠΡΑΓΜΑΤΙΚΗ λήψη 8192×4096, 2026-09-27): ο θεατής κατέβαζε **ολόκληρο** το
 * επίπεδο-στόχο στις 6 όψεις (96–150 πλακίδια) πριν δείξει οτιδήποτε καθαρό· με ~820 ms ανά πλακίδιο από το Storage
 * (μετρημένο) η καθαρή εικόνα δεν ερχόταν ποτέ. Οι συνθετικές δοκιμές (54 πλακίδια) το έκρυβαν.
 * 🏆 **Όπως οι μεγάλοι** (Marzipano · Photo Sphere Viewer CubemapTiles · Pannellum multires · krpano): **μόνο τα ορατά**,
 * το πιο κεντρικό **πρώτο**, και επίπεδο όσο χρειάζεται η οθόνη — ζουμ ⇒ ψηλότερο επίπεδο, ποτέ περισσότερο.
 *
 * 🧭 **Χώρος του κύβου**: η μηχανή στρέφει ΚΑΙ τον κύβο ΚΑΙ την κάμερα κατά την κατεύθυνση λήψης (`heading`) — μέσα στον
 * κύβο αλληλοαναιρείται. Γι' αυτό εδώ αρκούν yaw · κλίση · πεδίο · αναλογία (`TourView`).
 */

import { tilesPerSide, tileUvRect } from '../tileset/tour-tileset-layout';

import {
  cubeFaceUvToDirection, type Direction3, directionToCubeFace, TOUR_CUBE_FACES, type TourCubeFace, yawPitchToDirection,
} from './tour-cube-faces';
import type { TourView } from './tour-viewer-view';

/** Ένα πλακίδιο ενός επιπέδου — η ταυτότητά του στο tileset. */
export interface TourTileAddress {
  readonly level: number;
  readonly face: TourCubeFace;
  readonly row: number;
  readonly col: number;
}

/** Ορατό πλακίδιο με προτεραιότητα: μικρότερο = νωρίτερα (γωνία από το κέντρο θέασης· το περιθώριο έρχεται μετά). */
export interface TourTileNeed extends TourTileAddress {
  readonly priority: number;
}

export interface TourTileFrame {
  readonly view: TourView;
  /** Πλάτος/ύψος του καμβά. */
  readonly aspect: number;
}

/**
 * Περιθώριο γύρω από το κάδρο: πλακίδια που **θα** φανούν με μια μικρή στροφή, ζητούνται μετά από τα ορατά — ώστε το
 * σύρσιμο να μη βρίσκει θολή λωρίδα στην άκρη.
 */
const TILE_VIEW_MARGIN_RAD = (15 * Math.PI) / 180;

/** Η τιμή προτεραιότητας του περιθωρίου — πάντα πίσω από κάθε ορατό (η γωνία από το κέντρο είναι ≤ π). */
const MARGIN_PRIORITY_OFFSET = 2 * Math.PI;

/** Δείγματα ανά πλευρά πλακιδίου/κάδρου για το «τέμνονται;» — 3 ⇒ γωνίες, μέσα ακμών, κέντρο. */
const SAMPLES = [0, 0.5, 1] as const;

/**
 * **Το επίπεδο που χρειάζεται η οθόνη**: μια όψη (90°) πρέπει να έχει `ύψος καμβά (συσκευής) / tan(πεδίο/2)`
 * εικονοστοιχεία ώστε ένα εικονοστοιχείο εικόνας ≈ ένα εικονοστοιχείο οθόνης (κανόνας Marzipano). Το **μικρότερο**
 * επίπεδο που φτάνει· αν κανένα, το ανώτερο.
 */
export function chooseTileLevel(levels: readonly number[], viewportHeightDevicePx: number, fovV: number): number {
  if (levels.length === 0) return 0;
  const needed = viewportHeightDevicePx / Math.tan(fovV / 2);
  const index = levels.findIndex((size) => size >= needed);
  return index === -1 ? levels.length - 1 : index;
}

/**
 * **Το quad ενός πλακιδίου** πάνω στον μοναδιαίο κύβο της μηχανής: θέσεις (4 κορυφές × xyz) και `uv` (4 × uv), με σειρά
 * πάνω-αριστερά · πάνω-δεξιά · κάτω-αριστερά · κάτω-δεξιά, και δείκτες δύο τριγώνων. Οι γωνίες βγαίνουν από την ΙΔΙΑ
 * σύμβαση (`cubeFaceUvToDirection`) με τον ψήστη — ένα πλακίδιο δεν μπορεί να πέσει σε άλλη θέση από εκεί που κόπηκε.
 * `uv (0, 1)` = πάνω-αριστερά της εικόνας (ο καμβάς ανεβαίνει με `flipY`).
 */
export function tileQuad(address: TourTileAddress, levelSize: number): { readonly positions: number[]; readonly uvs: number[]; readonly indices: number[] } {
  const r = tileUvRect(levelSize, address.row, address.col);
  const corners: ReadonlyArray<readonly [number, number, number, number]> = [
    [r.u0, r.v1, 0, 1],
    [r.u1, r.v1, 1, 1],
    [r.u0, r.v0, 0, 0],
    [r.u1, r.v0, 1, 0],
  ];
  const positions: number[] = [];
  const uvs: number[] = [];
  for (const [u, v, tu, tv] of corners) {
    const d = cubeFaceUvToDirection(address.face, u, v);
    positions.push(d.x, d.y, d.z);
    uvs.push(tu, tv);
  }
  return { positions, uvs, indices: [0, 2, 1, 1, 2, 3] };
}

/** Κατεύθυνση κύβου → χώρος κάμερας (η κάμερα κοιτάζει `-Z`): πρώτα yaw (γύρω από `Y`), μετά κλίση (γύρω από `X`). */
function toCamera(d: Direction3, view: TourView): Direction3 {
  const cy = Math.cos(view.yaw);
  const sy = Math.sin(view.yaw);
  const x = d.x * cy + d.z * sy;
  const z1 = -d.x * sy + d.z * cy;
  const cp = Math.cos(view.pitch);
  const sp = Math.sin(view.pitch);
  return { x, y: d.y * cp + z1 * sp, z: -d.y * sp + z1 * cp };
}

/** Το αντίστροφο του `toCamera`. */
function fromCamera(c: Direction3, view: TourView): Direction3 {
  const cp = Math.cos(view.pitch);
  const sp = Math.sin(view.pitch);
  const y = c.y * cp - c.z * sp;
  const z1 = c.y * sp + c.z * cp;
  const cy = Math.cos(view.yaw);
  const sy = Math.sin(view.yaw);
  return { x: c.x * cy - z1 * sy, y, z: c.x * sy + z1 * cy };
}

interface Frustum {
  readonly tanX: number;
  readonly tanY: number;
}

function frustumOf(frame: TourTileFrame, marginRad: number): Frustum {
  const tanY = Math.tan(Math.min(Math.PI * 0.49, frame.view.fov / 2 + marginRad));
  const tanX = Math.tan(Math.min(Math.PI * 0.49, Math.atan(Math.tan(frame.view.fov / 2) * frame.aspect) + marginRad));
  return { tanX, tanY };
}

function insideFrustum(d: Direction3, view: TourView, f: Frustum): boolean {
  const c = toCamera(d, view);
  if (c.z >= 0) return false;
  return Math.abs(c.x / -c.z) <= f.tanX && Math.abs(c.y / -c.z) <= f.tanY;
}

/** Οι ακτίνες του κάδρου (γωνίες · μέσα ακμών · κέντρο), στον χώρο του κύβου. */
function frustumRays(view: TourView, f: Frustum): Direction3[] {
  return SAMPLES.flatMap((sx) => SAMPLES.map((sy) => fromCamera({ x: (2 * sx - 1) * f.tanX, y: (2 * sy - 1) * f.tanY, z: -1 }, view)));
}

const tileKeyOf = (face: TourCubeFace, row: number, col: number) => `${face}/${row}/${col}`;

/** Τα πλακίδια ενός επιπέδου που **περιέχουν** κάποια ακτίνα του κάδρου — πιάνει το στενό ζουμ μέσα σε ένα μεγάλο πλακίδιο. */
function tilesHitByRays(rays: readonly Direction3[], levelSize: number): Set<string> {
  const side = tilesPerSide(levelSize);
  const hit = new Set<string>();
  for (const ray of rays) {
    const { face, u, v } = directionToCubeFace(ray);
    const col = Math.min(side - 1, Math.floor(u * side));
    const row = Math.min(side - 1, Math.floor((1 - v) * side));
    hit.add(tileKeyOf(face, row, col));
  }
  return hit;
}

function tileSamples(face: TourCubeFace, levelSize: number, row: number, col: number): Direction3[] {
  const r = tileUvRect(levelSize, row, col);
  return SAMPLES.flatMap((su) => SAMPLES.map((sv) => cubeFaceUvToDirection(face, r.u0 + su * (r.u1 - r.u0), r.v0 + sv * (r.v1 - r.v0))));
}

/** Γωνία (rad) ανάμεσα στο κέντρο του πλακιδίου και το κέντρο της θέασης. */
function angleFromCenter(face: TourCubeFace, levelSize: number, row: number, col: number, view: TourView): number {
  const r = tileUvRect(levelSize, row, col);
  const d = cubeFaceUvToDirection(face, (r.u0 + r.u1) / 2, (r.v0 + r.v1) / 2);
  const f = yawPitchToDirection(view.yaw, view.pitch);
  const dot = (d.x * f.x + d.y * f.y + d.z * f.z) / Math.hypot(d.x, d.y, d.z);
  return Math.acos(Math.max(-1, Math.min(1, dot)));
}

function isVisibleIn(samples: readonly Direction3[], key: string, hit: ReadonlySet<string>, view: TourView, f: Frustum): boolean {
  return hit.has(key) || samples.some((d) => insideFrustum(d, view, f));
}

/**
 * **Τα πλακίδια του επιπέδου `level` που χρειάζεται το κάδρο** — πρώτα τα ορατά, από το κέντρο προς τα έξω, μετά ο
 * δακτύλιος περιθωρίου. Συντηρητικό: ένα πλακίδιο μπαίνει αν κάποιο δείγμα του (3×3) πέφτει στο κάδρο **ή** αν περιέχει
 * κάποια ακτίνα του κάδρου. Ό,τι είναι πίσω από τον θεατή δεν ζητείται.
 */
export function visibleTiles(frame: TourTileFrame, levelSize: number, level: number, marginRad = TILE_VIEW_MARGIN_RAD): TourTileNeed[] {
  const { view } = frame;
  const inner = frustumOf(frame, 0);
  const outer = frustumOf(frame, marginRad);
  const hitInner = tilesHitByRays(frustumRays(view, inner), levelSize);
  const hitOuter = tilesHitByRays(frustumRays(view, outer), levelSize);
  const side = tilesPerSide(levelSize);
  const needs: TourTileNeed[] = [];
  for (const face of TOUR_CUBE_FACES) {
    for (let row = 0; row < side; row++) {
      for (let col = 0; col < side; col++) {
        const key = tileKeyOf(face, row, col);
        const samples = tileSamples(face, levelSize, row, col);
        const angle = angleFromCenter(face, levelSize, row, col, view);
        if (isVisibleIn(samples, key, hitInner, view, inner)) needs.push({ level, face, row, col, priority: angle });
        else if (isVisibleIn(samples, key, hitOuter, view, outer)) needs.push({ level, face, row, col, priority: MARGIN_PRIORITY_OFFSET + angle });
      }
    }
  }
  return needs.sort((a, b) => a.priority - b.priority);
}
