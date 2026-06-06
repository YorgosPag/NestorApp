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
 *      Οι **γωνίες είναι mitered** (κοινό εξωτερικό σημείο = τομή των δύο
 *      γειτονικών offset-γραμμών) → η προεξοχή συνεχίζει κατά μήκος του hip και
 *      δεν αφήνει κενό (Revit-grade· στις τετράρριχτες όλες οι γωνίες γεμίζουν).
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
  RoofRidgeLine,
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
  /**
   * Κορφιάδες/hips (από `geometry.ridges`) — προαιρετικά. Όταν δίνονται, ένα
   * footprint edge που **διασχίζει** κορφιά/hip (π.χ. το αέτωμα/rake δίρριχτης
   * περνά κάτω από τον κορφιά → δύο νερά) **σπάει** σε υπο-ακμές στο σημείο
   * διέλευσης, ώστε κάθε υπο-ακμή να ακολουθεί ΤΟ ΔΙΚΟ της νερό (αλλιώς ένα μόνο
   * governing plane βγάζει την προεξοχή πάνω από τη στέγη στη μισή πλευρά).
   */
  readonly ridges?: readonly RoofRidgeLine[];
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

/**
 * Τομή δύο ευθειών (σημείο `p` + διεύθυνση `d`). Λύνει `p1 + t·d1 = p2 + u·d2`
 * για `t` (cross-product). `null` όταν ~παράλληλες (καμία/άπειρες τομές).
 */
function lineIntersect(p1: Vec2, d1: Vec2, p2: Vec2, d2: Vec2): Vec2 | null {
  const denom = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((p2.x - p1.x) * d2.y - (p2.y - p1.y) * d2.x) / denom;
  return { x: p1.x + t * d1.x, y: p1.y + t * d1.y };
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
 * μόνο όταν υπάρχει προεξοχή. Τα εξωτερικά plan-σημεία `O0`/`O1` είναι τα **κοινά
 * mitered** σημεία των γωνιών (τομή γειτονικών offset-γραμμών) → οι strips
 * γειτονικών ακμών μοιράζονται την ίδια ακμή στη γωνία (μηδέν κενό· συνεχίζει
 * την κλίση κατά μήκος του hip). Επιστρέφει επίσης τα εξωτερικά plan-σημεία.
 */
function buildEdgeQuads(
  frame: EdgeFrame,
  overhangMm: number,
  O0: Vec2,
  O1: Vec2,
  cfg: RoofEaveDetailInput,
): { quads: RoofEaveQuad[]; outer: RoofEaveEdgeOutline } {
  const { v0, v1, outward, plane } = frame;
  const { basePivotZ, s, thicknessMm } = cfg;
  const overhangCanvas = Math.max(0, overhangMm) * s;

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

// ─── Ridge-crossing split ───────────────────────────────────────────────────────

/**
 * Παράμετρος `t∈[0,1]` του `p` πάνω στο τμήμα `a→b`, ή `null` αν δεν κάθεται
 * πάνω του (κάθετη απόσταση > `tol`). `lenRef` = κλίμακα για το tol.
 */
function paramOnSegment(a: Point3D, b: Point3D, p: Vec2, tol: number): number | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-12) return null;
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  const px = a.x + t * dx;
  const py = a.y + t * dy;
  const dist2 = (p.x - px) ** 2 + (p.y - py) ** 2;
  if (dist2 > tol * tol) return null;
  return t;
}

/**
 * Σπάει footprint edges που **διασχίζουν** κορφιά/hip (τα endpoints τους πέφτουν
 * ΑΥΣΤΗΡΑ μέσα στην ακμή) σε υπο-ακμές στο σημείο διέλευσης. Κάθε υπο-ακμή
 * κληρονομεί το `RoofEdgeSlope` της μητρικής → ο per-edge `governingPlane`
 * διαλέγει σωστά το νερό κάθε πλευράς (το αέτωμα/rake ακολουθεί την κλίση). Χωρίς
 * ridges (ή κανένα crossing) → επιστρέφει τα αρχικά. Pure.
 */
function splitOutlineAtRidges(
  verts: readonly Point3D[],
  edges: readonly RoofEdgeSlope[],
  ridges: readonly RoofRidgeLine[],
): { verts: Point3D[]; edges: RoofEdgeSlope[] } {
  if (ridges.length === 0) return { verts: verts.slice(), edges: edges.slice() };
  const n = verts.length;
  // Κλίμακα ανοχής από τη διαγώνιο του bbox (mirror roof-lower-envelope BOUNDARY_EPS).
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const v of verts) {
    if (v.x < minX) minX = v.x; if (v.y < minY) minY = v.y;
    if (v.x > maxX) maxX = v.x; if (v.y > maxY) maxY = v.y;
  }
  const tol = Math.max(1e-6, 1e-4 * Math.hypot(maxX - minX, maxY - minY));
  const tTol = 1e-3;
  const candidates: Vec2[] = [];
  for (const r of ridges) {
    candidates.push({ x: r.a.x, y: r.a.y }, { x: r.b.x, y: r.b.y });
  }

  const outVerts: Point3D[] = [];
  const outEdges: RoofEdgeSlope[] = [];
  for (let i = 0; i < n; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % n];
    outVerts.push(a);
    outEdges.push(edges[i]);
    const onEdge: number[] = [];
    for (const c of candidates) {
      const t = paramOnSegment(a, b, c, tol);
      if (t === null || t <= tTol || t >= 1 - tTol) continue;
      if (onEdge.some((u) => Math.abs(u - t) < tTol)) continue; // dedupe
      onEdge.push(t);
    }
    onEdge.sort((x, y) => x - y);
    for (const t of onEdge) {
      outVerts.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: 0 });
      outEdges.push(edges[i]); // η υπο-ακμή κληρονομεί την κλίση/overhang της μητρικής
    }
  }
  return { verts: outVerts, edges: outEdges };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Παράγει το πλήρες γείσο (όλες οι περιμετρικές ακμές) από resolved roof params.
 * Pure / idempotent. Κενό όταν footprint < 3 κορυφές.
 */
export function buildRoofEaveDetail(cfg: RoofEaveDetailInput): RoofEaveDetail {
  const baseVerts = cfg.outline;
  if (baseVerts.length < 3 || cfg.edges.length !== baseVerts.length) {
    return { quads: [], overhangEdges: [] };
  }
  // Τα νερά (planes) ορίζονται από το ΑΡΧΙΚΟ footprint — το split στους κορφιάδες
  // δεν αλλάζει κλίσεις, μόνο τεμαχίζει την περίμετρο ώστε κάθε υπο-ακμή να πέφτει
  // σε ΕΝΑ νερό.
  const { planes } = resolveEavePlanes(baseVerts, cfg.edges, cfg.slopeUnit);
  const { verts, edges } = splitOutlineAtRidges(baseVerts, cfg.edges, cfg.ridges ?? []);
  const n = verts.length;
  const sign = windingSign(verts);

  // Ανά ακμή: frame + offset-γραμμή (παράλληλη της ακμής, μετατοπισμένη έξω κατά
  // overhang). `offPt` = σημείο της γραμμής στο v0· `offDir` = διεύθυνση ακμής.
  const frames: EdgeFrame[] = [];
  const offPts: Vec2[] = [];
  const offDirs: Vec2[] = [];
  const ohCanvas: number[] = [];
  for (let i = 0; i < n; i++) {
    const frame = buildEdgeFrame(verts, i, sign, planes);
    const oh = Math.max(0, edges[i].overhangMm) * cfg.s;
    frames.push(frame);
    ohCanvas.push(oh);
    offPts.push({ x: frame.v0.x + frame.outward.x * oh, y: frame.v0.y + frame.outward.y * oh });
    offDirs.push({ x: frame.v1.x - frame.v0.x, y: frame.v1.y - frame.v0.y });
  }

  // Mitered εξωτερικό σημείο ανά κορυφή `k` = τομή offset(k-1) ∩ offset(k). Έτσι
  // οι γειτονικές strips μοιράζονται το ΙΔΙΟ σημείο → καμία τρύπα στη γωνία και η
  // προεξοχή συνεχίζει κατά μήκος του hip. Fallback (~παράλληλες ακμές): κάθετο
  // offset της τρέχουσας ακμής.
  const miter: Vec2[] = [];
  for (let k = 0; k < n; k++) {
    const prev = (k - 1 + n) % n;
    const m = lineIntersect(offPts[prev], offDirs[prev], offPts[k], offDirs[k]);
    miter.push(
      m ?? { x: frames[k].v0.x + frames[k].outward.x * ohCanvas[k], y: frames[k].v0.y + frames[k].outward.y * ohCanvas[k] },
    );
  }

  const quads: RoofEaveQuad[] = [];
  const overhangEdges: RoofEaveEdgeOutline[] = [];
  for (let i = 0; i < n; i++) {
    const { quads: eq, outer } = buildEdgeQuads(
      frames[i],
      edges[i].overhangMm,
      miter[i],
      miter[(i + 1) % n],
      cfg,
    );
    quads.push(...eq);
    overhangEdges.push(outer);
  }
  return { quads, overhangEdges };
}
