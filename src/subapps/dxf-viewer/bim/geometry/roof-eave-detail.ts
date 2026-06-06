/**
 * Roof eave detailing (γείσο) — ADR-417 Φ2b. Pure SSoT γεωμετρικός πυρήνας.
 *
 * Παράγει, ανά **περιμετρική ακμή** του footprint, τα κομμάτια του γείσου που
 * κρύβουν την κομμένη στοίβα στρώσεων (Revit «Fine» edge) και δίνουν αληθοφανές
 * αποτέλεσμα «όπως οι μεγάλοι»:
 *
 *   1. **Overhang (προεξοχή)** — η επιφάνεια της στέγης συνεχίζει το επίπεδό της
 *      προς τα έξω κατά `overhangMm` (per-edge, instance-level). Στις χαμηλές
 *      ακμές (eave, `definesSlope===true`) πέφτει· στα αετώματα (rake,
 *      `definesSlope===false`) εκτείνεται πλάγια ακολουθώντας το γειτονικό νερό.
 *   2. **Fascia (μετωπίδα)** — κατακόρυφη σανίδα στο εξωτερικό άκρο που καλύπτει
 *      τη στοίβα στρώσεων (ύψος ≥ πάχος στέγης).
 *   3. **Soffit (υποκάτω επένδυση)** — οριζόντια ή κεκλιμένη πλάκα από τη
 *      μετωπίδα προς τον τοίχο (κρύβει το κενό κάτω από την προεξοχή).
 *
 * ── Μοντέλο (mirror `roof-lower-envelope.ts`) ────────────────────────────────
 * Δουλεύει στον ΙΔΙΟ χώρο συντεταγμένων με τη μηχανή: `outline` xy σε canvas
 * units, υψόμετρα/πάχη σε mm, `s` = canvas units ανά mm. Για κάθε ακμή βρίσκει το
 * **κυρίαρχο** κεκλιμένο επίπεδο ακριβώς εσωτερικά της (το χαμηλότερο «νερό»
 * εκεί) και το εκτείνει — άπειρο επίπεδο, άρα η προεξοχή ακολουθεί ΦΥΣΙΚΑ την
 * κλίση και έξω από το footprint. Έτσι ΕΝΑΣ αλγόριθμος καλύπτει eave ΚΑΙ rake.
 *
 * Καθαρά γεωμετρικό (zero THREE) → unit-testable. Ο 3D converter
 * (`roof-to-three.ts`) και ο 2D renderer (`RoofRenderer.ts`) καταναλώνουν την
 * ίδια έξοδο = μία SSoT (όπως οι κορφιάδες διαβάζουν `geometry.ridges`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-417-bim-roof-element.md §10
 * @see bim/geometry/roof-lower-envelope.ts — ο N-plane solver (κοινά primitives)
 * @see bim-3d/converters/roof-eave-detail-mesh.ts — ο 3D consumer
 */

import type { Point3D } from '../types/bim-base';
import type {
  RoofEdgeSlope,
  RoofSlopeUnit,
  RoofSoffitMode,
} from '../types/roof-types';
import {
  eaveDistance,
  inwardNormal,
  resolveEavePlanes,
  windingSign,
  type EavePlane,
  type Vec2,
} from './roof-lower-envelope';

// ─── Public shapes ────────────────────────────────────────────────────────────

/** Ρόλος ενός quad γείσου — επιλέγει υλικό + προσανατολισμό κανονικού. */
export type RoofEaveQuadRole = 'overhang' | 'fascia' | 'soffit';

/**
 * Ένα τετράπλευρο κομμάτι γείσου (roof-coord: canvas-unit xy, mm z). Το
 * `normalHint` (roof-coord διεύθυνση) λέει προς τα πού πρέπει να «βλέπει» η όψη —
 * ο 3D builder προσανατολίζει το winding ανάλογα (το y-flip του world αλλιώς
 * αντιστρέφει το πρόσημο).
 */
export interface RoofEaveQuad {
  readonly role: RoofEaveQuadRole;
  readonly materialId: string;
  /** 4 κορυφές (canvas-unit xy, mm z). */
  readonly outline: readonly [Point3D, Point3D, Point3D, Point3D];
  /** Επιθυμητή κατεύθυνση κανονικού (roof-coord: canvas xy + mm z). */
  readonly normalHint: Point3D;
}

/** Εξωτερικά plan-σημεία ΜΙΑΣ ακμής (για 2D κάτοψη — z αγνοείται). */
export interface RoofEaveEdgeOutline {
  readonly o0: Point3D;
  readonly o1: Point3D;
}

/** Πλήρες γείσο: 3D quads + 2D περίγραμμα προεξοχής. */
export interface RoofEaveDetail {
  readonly quads: readonly RoofEaveQuad[];
  /** Εξωτερικά άκρα ανά ακμή — closed outer ring για την κάτοψη. */
  readonly overhangEdges: readonly RoofEaveEdgeOutline[];
}

/** Είσοδος του `buildRoofEaveDetail` (όλα τα appearance fields resolved). */
export interface RoofEaveDetailInput {
  readonly outline: readonly Point3D[];
  readonly edges: readonly RoofEdgeSlope[];
  readonly slopeUnit: RoofSlopeUnit;
  /** mm — στάθμη γείσου (eaves datum). */
  readonly basePivotZ: number;
  /** mm — συνολικό πάχος στέγης (== dna.totalThickness). */
  readonly thicknessMm: number;
  /** canvas units ανά mm (`mmToSceneUnits`). */
  readonly s: number;
  /** mm — ύψος ορατής μετωπίδας. */
  readonly fasciaHeightMm: number;
  readonly soffitMode: RoofSoffitMode;
  /** Material της προεξοχής (= κορυφαία επιφάνεια στέγης — συνεχίζει το νερό). */
  readonly overhangMaterialId: string;
  readonly fasciaMaterialId: string;
  readonly soffitMaterialId: string;
}

// ─── Internals ────────────────────────────────────────────────────────────────

/** Κάτω από αυτό (canvas) η προεξοχή θεωρείται μηδενική (καμία strip/soffit). */
const OVERHANG_EPS = 1e-6;

const v2 = (p: Point3D): Vec2 => ({ x: p.x, y: p.y });
const pt = (x: number, y: number, z: number): Point3D => ({ x, y, z });

/**
 * Το «κυρίαρχο» (χαμηλότερο) κεκλιμένο επίπεδο ακριβώς εσωτερικά της ακμής. Για
 * eave ακμή = το ίδιο της το επίπεδο (rise≈0)· για rake/αέτωμα = το γειτονικό
 * νερό. `null` όταν δεν υπάρχουν επίπεδα (flat δώμα).
 */
function governingPlane(planes: readonly EavePlane[], probe: Vec2): EavePlane | null {
  let best: EavePlane | null = null;
  let minRise = Infinity;
  for (const p of planes) {
    const rise = p.ratio * eaveDistance(p, probe);
    if (rise < minRise) {
      minRise = rise;
      best = p;
    }
  }
  return best;
}

/** Υψόμετρο (mm) της κορυφαίας επιφάνειας στο plan-point `p` κατά το `plane`. */
function topZmm(plane: EavePlane | null, basePivotZ: number, s: number, p: Vec2): number {
  if (!plane) return basePivotZ;
  return basePivotZ + (plane.ratio * eaveDistance(plane, p)) / s;
}

/** Quad κατασκευή με ρόλο + υλικό + hint (τυποποιεί το tuple). */
function quad(
  role: RoofEaveQuadRole,
  materialId: string,
  outline: [Point3D, Point3D, Point3D, Point3D],
  normalHint: Point3D,
): RoofEaveQuad {
  return { role, materialId, outline, normalHint };
}

interface EdgeFrame {
  readonly v0: Vec2;
  readonly v1: Vec2;
  /** Εξωτερικό μοναδιαίο κάθετο (canvas) — δείχνει ΕΞΩ από το footprint. */
  readonly outward: Vec2;
  readonly plane: EavePlane | null;
}

/** Γεωμετρικό πλαίσιο μιας ακμής: κορυφές, εξωτερικό κάθετο, κυρίαρχο επίπεδο. */
function buildEdgeFrame(
  outline: readonly Point3D[],
  i: number,
  sign: 1 | -1,
  planes: readonly EavePlane[],
): EdgeFrame {
  const n = outline.length;
  const v0 = v2(outline[i]);
  const v1 = v2(outline[(i + 1) % n]);
  const inward = inwardNormal(outline[i], outline[(i + 1) % n], sign);
  const outward = { x: -inward.x, y: -inward.y };
  // Δειγματοληψία ελάχιστα ΕΣΩΤΕΡΙΚΑ ώστε να βρεθεί το ενεργό νερό (όχι σε κορυφή).
  const len = Math.hypot(v1.x - v0.x, v1.y - v0.y) || 1;
  const probe = {
    x: (v0.x + v1.x) / 2 + inward.x * len * 1e-3,
    y: (v0.y + v1.y) / 2 + inward.y * len * 1e-3,
  };
  return { v0, v1, outward, plane: governingPlane(planes, probe) };
}

/**
 * Quads ΜΙΑΣ ακμής. Πάντα μετωπίδα (καλύπτει τη στοίβα)· overhang strip + soffit
 * μόνο όταν υπάρχει προεξοχή. Επιστρέφει επίσης τα εξωτερικά plan-σημεία.
 */
function buildEdgeQuads(
  frame: EdgeFrame,
  overhangMm: number,
  cfg: RoofEaveDetailInput,
): { quads: RoofEaveQuad[]; outer: RoofEaveEdgeOutline } {
  const { v0, v1, outward, plane } = frame;
  const { basePivotZ, s, thicknessMm } = cfg;
  const overhangCanvas = Math.max(0, overhangMm) * s;

  // Plan-σημεία: εσωτερικά (footprint) + εξωτερικά (προεξοχή).
  const O0: Vec2 = { x: v0.x + outward.x * overhangCanvas, y: v0.y + outward.y * overhangCanvas };
  const O1: Vec2 = { x: v1.x + outward.x * overhangCanvas, y: v1.y + outward.y * overhangCanvas };

  const ziTop0 = topZmm(plane, basePivotZ, s, v0);
  const ziTop1 = topZmm(plane, basePivotZ, s, v1);
  const zoTop0 = topZmm(plane, basePivotZ, s, O0);
  const zoTop1 = topZmm(plane, basePivotZ, s, O1);

  // Η μετωπίδα καλύπτει ΤΟΥΛΑΧΙΣΤΟΝ όλο το πάχος της στοίβας.
  const coverMm = Math.max(cfg.fasciaHeightMm, thicknessMm);
  const zoBot0 = zoTop0 - coverMm;
  const zoBot1 = zoTop1 - coverMm;

  const quads: RoofEaveQuad[] = [];
  const hasOverhang = overhangCanvas > OVERHANG_EPS;

  // 1) Overhang strip (κορυφαία επιφάνεια — συνεχίζει το νερό προς τα έξω).
  if (hasOverhang) {
    quads.push(quad('overhang', cfg.overhangMaterialId, [
      pt(v0.x, v0.y, ziTop0), pt(v1.x, v1.y, ziTop1),
      pt(O1.x, O1.y, zoTop1), pt(O0.x, O0.y, zoTop0),
    ], pt(0, 0, 1)));
  }

  // 2) Fascia (κατακόρυφη μετωπίδα στο εξωτερικό άκρο).
  quads.push(quad('fascia', cfg.fasciaMaterialId, [
    pt(O0.x, O0.y, zoTop0), pt(O1.x, O1.y, zoTop1),
    pt(O1.x, O1.y, zoBot1), pt(O0.x, O0.y, zoBot0),
  ], pt(outward.x, outward.y, 0)));

  // 3) Soffit (υποκάτω επένδυση — μόνο όταν υπάρχει προεξοχή να καλυφθεί).
  if (hasOverhang) {
    // Horizontal: επίπεδο στη στάθμη του κάτω άκρου της μετωπίδας.
    // Sloped: ακολουθεί την κάτω επιφάνεια της στέγης (top − thickness).
    const ziSoffit0 = cfg.soffitMode === 'sloped' ? ziTop0 - thicknessMm : zoBot0;
    const ziSoffit1 = cfg.soffitMode === 'sloped' ? ziTop1 - thicknessMm : zoBot1;
    quads.push(quad('soffit', cfg.soffitMaterialId, [
      pt(O0.x, O0.y, zoBot0), pt(O1.x, O1.y, zoBot1),
      pt(v1.x, v1.y, ziSoffit1), pt(v0.x, v0.y, ziSoffit0),
    ], pt(0, 0, -1)));
  }

  return { quads, outer: { o0: pt(O0.x, O0.y, zoTop0), o1: pt(O1.x, O1.y, zoTop1) } };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Παράγει το πλήρες γείσο (όλες οι περιμετρικές ακμές) από resolved roof params.
 * Pure / idempotent. Κενό όταν footprint < 3 κορυφές.
 */
export function buildRoofEaveDetail(cfg: RoofEaveDetailInput): RoofEaveDetail {
  const verts = cfg.outline;
  if (verts.length < 3 || cfg.edges.length !== verts.length) {
    return { quads: [], overhangEdges: [] };
  }
  const sign = windingSign(verts);
  const { planes } = resolveEavePlanes(verts, cfg.edges, cfg.slopeUnit);

  const quads: RoofEaveQuad[] = [];
  const overhangEdges: RoofEaveEdgeOutline[] = [];
  for (let i = 0; i < verts.length; i++) {
    const frame = buildEdgeFrame(verts, i, sign, planes);
    const { quads: eq, outer } = buildEdgeQuads(frame, cfg.edges[i].overhangMm, cfg);
    quads.push(...eq);
    overhangEdges.push(outer);
  }
  return { quads, overhangEdges };
}
