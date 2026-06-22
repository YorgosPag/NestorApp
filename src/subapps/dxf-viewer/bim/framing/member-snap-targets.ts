/**
 * Generic linear-member snap-target collector — pure SSoT (ADR-508 unified linear-member framing).
 *
 * Μαζεύει από τη σκηνή τους face-snap στόχους για το ghost-before-click ΚΑΘΕ γραμμικού
 * εργαλείου (δοκάρι/τοίχος):
 *   · **Κολόνες** → footprint πολύγωνα (12-θέσεων face snap + flush) — ΠΑΝΤΑ.
 *   · **Γραμμικά μέλη** (δοκάρια/τοίχοι, ανά `memberKinds`) → `{ axis, outline }` για το
 *     member-to-member Τ-framing.
 *
 * Το δοκάρι έχει έτοιμο κλειστό `geometry.outline`· ο τοίχος ΟΧΙ → χτίζουμε κλειστό δακτύλιο
 * από `outerEdge` + αντεστραμμένο `innerEdge` (επαρκές για `projectPolygonOnAxis` extents +
 * `coveredIntervals` coverage). Pure: ΙΔΙΑ δεδομένα που διαβάζει το commit path από το store
 * (preview === commit).
 *
 * @see ./linear-member-face-snap.ts — LinearMemberSnapTarget consumer
 * @see ./scene-snap-targets.ts — collectSceneSnapTargets (ο κοινός consumer, ΕΝΑ SSoT)
 * @see docs/centralized-systems/reference/adrs/ADR-508-unified-linear-member-framing.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { closedRingFromEdges } from '../geometry/shared/polygon-utils';
import { rectangleCorners } from '../walls/wall-from-entity';
import { arcToPolyline } from '../../utils/geometry/GeometryUtils';
import { arcVisibleCcwRange } from '../../rendering/entities/shared/geometry-arc-utils';
import type { ArcMeta, LinearMemberSnapTarget } from './linear-member-face-snap';

/**
 * Είδος μέλους που μπορεί να γίνει face-snap στόχος (πλάκα = οι ακμές της· `'line'` = σκέτη γραμμή,
 * `polyline`/`lwpolyline`, `rectangle` ΚΑΙ `circle` (περιφέρεια tessellated) — όλα zero-width edges
 * μέσω `edgeBandTarget`).
 */
export type MemberSnapKind = 'beam' | 'wall' | 'slab' | 'line';

export interface MemberSnapTargets {
  /** Column footprints (world-baked 2Δ πολύγωνα). */
  readonly footprints: Point2D[][];
  /** Γραμμικά μέλη ως {axis, outline}. */
  readonly memberTargets: LinearMemberSnapTarget[];
}

export interface CollectMemberSnapTargetsOptions {
  /** Ποια γραμμικά μέλη μπαίνουν στους στόχους (οι κολόνες πάντα). */
  readonly memberKinds: readonly MemberSnapKind[];
  /** Προαιρετικό id προς αποκλεισμό (π.χ. το μέλος υπό επεξεργασία). */
  readonly excludeId?: string;
}

type Pts = readonly { readonly x: number; readonly y: number }[];

function toPoint2D(pts: Pts): Point2D[] {
  return pts.map((v) => ({ x: v.x, y: v.y }));
}

/** Beam outline (έτοιμο κλειστό footprint). */
function beamTarget(e: Entity): LinearMemberSnapTarget | null {
  const g = (e as {
    geometry?: {
      axisPolyline?: { points?: Pts };
      outline?: { vertices?: Pts };
    };
  }).geometry;
  const axis = g?.axisPolyline?.points;
  const outline = g?.outline?.vertices;
  if (axis && axis.length >= 2 && outline && outline.length >= 3) {
    return { id: e.id, axis: toPoint2D(axis), outline: toPoint2D(outline) };
  }
  return null;
}

/** Wall outline = outerEdge + αντεστραμμένο innerEdge (κλειστός δακτύλιος). */
function wallTarget(e: Entity): LinearMemberSnapTarget | null {
  const g = (e as {
    geometry?: {
      axisPolyline?: { points?: Pts };
      outerEdge?: { points?: Pts };
      innerEdge?: { points?: Pts };
    };
  }).geometry;
  const axis = g?.axisPolyline?.points;
  const outer = g?.outerEdge?.points;
  const inner = g?.innerEdge?.points;
  if (!axis || axis.length < 2 || !outer || outer.length < 2 || !inner || inner.length < 2) return null;
  // SSoT `closedRingFromEdges` (polygon-utils) — όχι inline `[...outer, ...inner.reverse()]`.
  const outline = closedRingFromEdges(toPoint2D(outer), toPoint2D(inner));
  if (outline.length < 3) return null;
  return { id: e.id, axis: toPoint2D(axis), outline };
}

/**
 * ADR-398 §3.11 / ADR-508 §slab — **κοινός SSoT**: ΕΝΑ zero-width edge (ακμή πλάκας Ή σκέτη γραμμή)
 * → `LinearMemberSnapTarget`. Μοντέλο: η ακμή = **κεντρική γραμμή** μιας πολύ λεπτής συμμετρικής band
 * (±eps) → δύο όψεις → ο `resolveLinearMemberFaceSnap` κουμπώνει flush στην κοντινή όψη ΚΑΙ
 * (§3.11) η κολώνα κεντράρει στον άξονα. `null` σε εκφυλισμένο τμήμα. Reuse από `slabEdgeTargets`
 * (ανά ακμή) ΚΑΙ `lineTarget` (σκέτη γραμμή) — μηδέν διπλό band math.
 */
function edgeBandTarget(a: Point2D, b: Point2D, id: string, arc?: ArcMeta): LinearMemberSnapTarget | null {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;
  const px = dy / len, py = -dx / len; // μοναδιαία κάθετη της ακμής
  const eps = len * 0.001;             // αμελητέα συμμετρική band → ακμή ≈ κεντρική γραμμή
  const outline: Point2D[] = [
    { x: a.x + px * eps, y: a.y + py * eps },
    { x: b.x + px * eps, y: b.y + py * eps },
    { x: b.x - px * eps, y: b.y - py * eps },
    { x: a.x - px * eps, y: a.y - py * eps },
  ];
  // ADR-398 §3.12 — η χορδή κύκλου/τόξου φέρει τη γεωμετρία περιφέρειας (arc) ώστε οι listening
  // dimensions να μετρούν μήκος τόξου· ευθεία ακμή/γραμμή → `arc` undefined (αμετάβλητη).
  return { id, axis: [{ x: a.x, y: a.y }, { x: b.x, y: b.y }], outline, ...(arc ? { arc } : {}) };
}

/**
 * ADR-398 §3.11 — **κοινός SSoT**: ακολουθία κορυφών → ΕΝΑ zero-width edge target **ανά τμήμα** (reuse
 * `edgeBandTarget`). `closed` → προσθέτει και το τμήμα `last→first`. Το μοιράζονται **ΠΛΑΚΑ** (κλειστό
 * πολύγωνο) ΚΑΙ **ΠΟΛΥΓΡΑΜΜΗ** (ανοιχτή/κλειστή) — μηδέν διπλό loop. Εκφυλισμένα τμήματα → skip.
 */
function polylineEdgeTargets(
  pts: readonly Point2D[],
  closed: boolean,
  idPrefix: string,
  arc?: ArcMeta,
): LinearMemberSnapTarget[] {
  const out: LinearMemberSnapTarget[] = [];
  const segs = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < segs; i++) {
    const t = edgeBandTarget(pts[i], pts[(i + 1) % pts.length], `${idPrefix}#edge${i}`, arc);
    if (t) out.push(t);
  }
  return out;
}

/**
 * ADR-508 §slab — ΑΚΜΕΣ πλάκας (εδαφόπλακα/δάπεδο/οροφή) → `LinearMemberSnapTarget` ανά ακμή (reuse
 * `polylineEdgeTargets`, closed). Διαβάζει **`geometry.polygon`** (world-baked, ίδιο frame με beam/wall).
 */
function slabEdgeTargets(e: Entity): LinearMemberSnapTarget[] {
  const verts = (e as { geometry?: { polygon?: { vertices?: Pts } } }).geometry?.polygon?.vertices;
  if (!verts || verts.length < 3) return [];
  return polylineEdgeTargets(toPoint2D(verts), true, e.id);
}

/**
 * ADR-398 §3.11 — σκέτη **ΓΡΑΜΜΗ** (`LineEntity`, top-level `start`/`end`) → ΕΝΑ zero-width
 * `LinearMemberSnapTarget` (reuse κοινού `edgeBandTarget`) ώστε η κολώνα να ολισθαίνει πάνω της
 * **ΙΔΙΑ** με ακμή πλάκας: flush εκατέρωθεν + center-on-axis κατά μήκος.
 */
function lineTarget(e: Entity): LinearMemberSnapTarget | null {
  const ln = e as { start?: Point2D; end?: Point2D };
  if (!ln.start || !ln.end) return null;
  return edgeBandTarget({ x: ln.start.x, y: ln.start.y }, { x: ln.end.x, y: ln.end.y }, e.id);
}

/**
 * ADR-398 §3.11 — **ΠΟΛΥΓΡΑΜΜΗ** (`polyline`/`lwpolyline`, top-level `vertices`+`closed?`) → ΕΝΑ
 * zero-width target **ανά τμήμα** (reuse `polylineEdgeTargets`) ώστε η κολώνα να ολισθαίνει σε ΚΑΘΕ
 * τμήμα ΟΠΩΣ σε σκέτη γραμμή/ακμή πλάκας. Bulge τόξα → ευθεία χορδή (προσέγγιση· DEFER true arc).
 */
function polylineTargets(e: Entity): LinearMemberSnapTarget[] {
  const pl = e as { vertices?: Pts; closed?: boolean };
  if (!pl.vertices || pl.vertices.length < 2) return [];
  return polylineEdgeTargets(toPoint2D(pl.vertices), Boolean(pl.closed), e.id);
}

/**
 * ADR-398 §3.11 — **ΟΡΘΟΓΩΝΙΟ** (`RectangleEntity`) → 4 zero-width edges (κλειστή πολυγραμμή): reuse
 * το BIM SSoT `rectangleCorners` (wall-from-entity — x/y/w/h + corner1/corner2 fallback· το ίδιο που
 * καταναλώνει το `perimeter-from-faces`) + `polylineEdgeTargets`. Η κολώνα ολισθαίνει σε ΚΑΘΕ πλευρά
 * ΟΠΩΣ σε γραμμή/πολυγραμμή/ακμή πλάκας. Rotation: DEFER (axis-aligned — consistent με
 * `perimeter-from-faces`· `rectangleCorners` αγνοεί ήδη το `rotation` σε όλο το BIM).
 */
function rectangleTargets(e: Entity): LinearMemberSnapTarget[] {
  const corners = rectangleCorners(e as Parameters<typeof rectangleCorners>[0]);
  if (corners.length < 3) return [];
  return polylineEdgeTargets(corners, true, e.id);
}

/**
 * ADR-398 §3.11 — **ΚΥΚΛΟΣ** (`CircleEntity`, `center`+`radius`) → zero-width edges κατά μήκος της
 * **περιφέρειας**: reuse το public SSoT `arcToPolyline` (κύκλος = πλήρες 360° τόξο → tessellation
 * σε χορδές — ΙΔΙΟ μοντέλο με καμπύλα μέλη: `LinearMemberSnapTarget.axis` = χορδή) + `polylineEdgeTargets`.
 * Η κολώνα ολισθαίνει κατά μήκος της περιφέρειας, εφαπτομενικά ανά χορδή. `closed=false`: το
 * `arcToPolyline` επιστρέφει ήδη το σημείο κλεισίματος (P[last] ≈ P[0]).
 */
function circleTargets(e: Entity): LinearMemberSnapTarget[] {
  const c = e as { center?: Point2D; radius?: number };
  if (!c.center || typeof c.radius !== 'number' || c.radius <= 0) return [];
  const center = { x: c.center.x, y: c.center.y };
  const arc: ArcMeta = { center, radius: c.radius, startAngle: 0, endAngle: 360 };
  const pts = arcToPolyline({ center, radius: c.radius, startAngle: 0, endAngle: 360 });
  // ADR-398 §3.12 — κάθε χορδή φέρει τη γεωμετρία περιφέρειας → arc-length listening dims.
  return pts.length < 2 ? [] : polylineEdgeTargets(pts, false, e.id, arc);
}

/**
 * ADR-398 §3.12 — **ΤΟΞΟ** (`ArcEntity`, `center`+`radius`+`startAngle`/`endAngle` σε μοίρες
 * +`counterclockwise`) → zero-width edges κατά μήκος της **ΦΑΝΕΡΗΣ** πλευράς: reuse `arcToPolyline` +
 * `polylineEdgeTargets`. **Κρίσιμο (ADR-398 §3.12 bugfix):** το `arcToPolyline` tessellate-άρει πάντα CCW
 * `start→end` αγνοώντας τη φορά· για να κουμπώσει η κολώνα στην ΟΡΑΤΗ πλευρά (αυτή που σχεδιάζει ο
 * `ArcRenderer` / χτυπιέται από `hitTestArcEntity`) περνάμε το **ορατό CCW εύρος** μέσω του κοινού
 * SSoT `arcVisibleCcwRange` (counterclockwise===true ⇒ swap). Κάθε χορδή φέρει `arc` με αυτό το ορατό
 * εύρος → οι listening dimensions μετρούν προς τα **σωστά (ορατά) άκρα**. `closed=false`.
 */
function arcTargets(e: Entity): LinearMemberSnapTarget[] {
  const a = e as { center?: Point2D; radius?: number; startAngle?: number; endAngle?: number; counterclockwise?: boolean };
  if (!a.center || typeof a.radius !== 'number' || a.radius <= 0) return [];
  if (typeof a.startAngle !== 'number' || typeof a.endAngle !== 'number') return [];
  const center = { x: a.center.x, y: a.center.y };
  // Ορατή πλευρά (κοινό SSoT με hit-test) — ΟΧΙ το συμπληρωματικό (κρυφό) τόξο.
  const { start: startAngle, end: endAngle } = arcVisibleCcwRange(a.startAngle, a.endAngle, a.counterclockwise);
  const arc: ArcMeta = { center, radius: a.radius, startAngle, endAngle };
  const pts = arcToPolyline({ center, radius: a.radius, startAngle, endAngle });
  return pts.length < 2 ? [] : polylineEdgeTargets(pts, false, e.id, arc);
}

/**
 * Μάζεψε column footprints + γραμμικά μέλη ως face-snap στόχους. Pure.
 */
export function collectMemberSnapTargets(
  entities: readonly Entity[],
  opts: Readonly<CollectMemberSnapTargetsOptions>,
): MemberSnapTargets {
  const footprints: Point2D[][] = [];
  const memberTargets: LinearMemberSnapTarget[] = [];
  const wantBeam = opts.memberKinds.includes('beam');
  const wantWall = opts.memberKinds.includes('wall');
  const wantSlab = opts.memberKinds.includes('slab');
  const wantLine = opts.memberKinds.includes('line');

  for (const e of entities) {
    if (opts.excludeId && e.id === opts.excludeId) continue;

    if (e.type === 'column') {
      const verts = (e as { geometry?: { footprint?: { vertices?: Pts } } }).geometry?.footprint?.vertices;
      if (verts && verts.length >= 3) footprints.push(toPoint2D(verts));
      continue;
    }
    if (wantBeam && e.type === 'beam') {
      const t = beamTarget(e);
      if (t) memberTargets.push(t);
      continue;
    }
    if (wantWall && e.type === 'wall') {
      const t = wallTarget(e);
      if (t) memberTargets.push(t);
      continue;
    }
    if (wantSlab && e.type === 'slab') {
      memberTargets.push(...slabEdgeTargets(e)); // κάθε ακμή = ξεχωριστός στόχος
      continue;
    }
    if (wantLine && e.type === 'line') {
      const t = lineTarget(e); // ADR-398 §3.11 — σκέτη γραμμή = zero-width edge (ίδιο με ακμή πλάκας)
      if (t) memberTargets.push(t);
      continue;
    }
    if (wantLine && (e.type === 'polyline' || e.type === 'lwpolyline')) {
      memberTargets.push(...polylineTargets(e)); // §3.11 — κάθε τμήμα πολυγραμμής = zero-width edge
      continue;
    }
    if (wantLine && e.type === 'rectangle') {
      memberTargets.push(...rectangleTargets(e)); // §3.11 — 4 πλευρές ορθογωνίου = zero-width edges
      continue;
    }
    if (wantLine && e.type === 'circle') {
      memberTargets.push(...circleTargets(e)); // §3.11 — περιφέρεια κύκλου = tessellated zero-width edges
      continue;
    }
    if (wantLine && e.type === 'arc') {
      memberTargets.push(...arcTargets(e)); // §3.12 — τόξο = tessellated zero-width edges (arc-length dims)
    }
  }
  return { footprints, memberTargets };
}
