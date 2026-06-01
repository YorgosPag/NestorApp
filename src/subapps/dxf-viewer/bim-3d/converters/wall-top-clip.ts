/**
 * Wall-top footprint clip (ADR-401 — γωνιακή διασταύρωση) — SSoT.
 *
 * Όταν ένας attached τοίχος περνά **υπό γωνία** κάτω από δομικό host (δοκάρι/πλάκα),
 * η κορυφή του ΔΕΝ είναι μία κεκλιμένη πλάκα από παρειά σε παρειά (αυτό αφήνει
 * τριγωνικά κενά + overlap). Είναι **επίπεδες περιοχές** στο ύψος της κάτω-παρειάς
 * του host όπου το αποτύπωμα του host καλύπτει τον τοίχο, και στο `nominal` αλλού,
 * με **κατακόρυφο σκαλοπάτι** κατά μήκος της αληθινής ακμής του host.
 *
 * Εδώ κόβουμε (boolean) το plan-polygon ενός κομματιού τοίχου με τα host footprints:
 *   - `inside  = quad ∩ ⋃ hosts` → κορυφή = κάτω-παρειά host (ανά vertex· flat host
 *     → σταθερή, κεκλιμένο → επίπεδο). Lower-envelope: σε επικάλυψη παίρνουμε το host
 *     με τη χαμηλότερη παρειά στο κέντρο της περιοχής.
 *   - `outside = quad − ⋃ hosts` → κορυφή = `nominal`.
 * Κάθε περιοχή είναι **επίπεδη/planar** → ο `buildColumnPrismGeometry` (per-vertex
 * N-gon prism) τη βγάζει συμπαγή. Γειτονικές περιοχές διαφορετικού ύψους μοιράζονται
 * την ακμή του host → το ψηλότερο prism δίνει το κατακόρυφο σκαλοπάτι (watertight).
 *
 * Convention μονάδων: `quad` + host footprints στο **ίδιο** plan space (mirror του
 * `buildSlopedWallPieceGeometry`: τα plan coords περνούν αυτούσια ως world x,-y). Τα
 * `*Mm` είναι απόλυτα mm (ADR-369 datum)· έξοδος top/base σε **τοπικά μέτρα** πάνω από
 * το δάπεδο (`(z − FFL)·0.001`, ίδια σύμβαση με `makeWallTopLocalFn`).
 *
 * @see bim-3d/converters/column-piece-geometry.ts — `buildColumnPrismGeometry` (ο prism builder)
 * @see bim/geometry/host-footprint-eval.ts — `hostUndersideAt` (κάτω-παρειά στο σημείο)
 * @see bim/geometry/shared/safe-polygon-boolean.ts — robust boolean SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md §2.4
 */

import type { Pt2, HostFootprintInput } from '../../bim/geometry/wall-host-plan-builder';
import { buildHostUndersidePlans } from '../../bim/geometry/wall-host-plan-builder';
import { hostUndersideAt } from '../../bim/geometry/host-footprint-eval';
import { wallTiltShearAt, isWallTilted } from '../../bim/geometry/wall-tilt';
import type { WallParams } from '../../bim/types/wall-types';
import {
  safeUnion,
  safeIntersection,
  safeDifference,
  type ClipGeom,
} from '../../bim/geometry/shared/safe-polygon-boolean';
import type { MultiPolygon, Ring } from 'polygon-clipping';

const MM_TO_M = 0.001;
/** Όριο εμβαδού (plan units²) κάτω από το οποίο μια περιοχή είναι sliver → skip. */
const AREA_EPS = 1e-9;

/**
 * Context κοπής που περνά ο `BimSceneLayer.syncWalls` στον converter: τα attach
 * hosts (footprints absolute-mm undersides) + το nominal top (absolute mm).
 */
export interface WallTopClipContext {
  readonly hosts: readonly HostFootprintInput[];
  readonly nominalTopMm: number;
  /**
   * ADR-401 (γωνιακή διασταύρωση — face crossings) — τα f-fractions (0..1) όπου η
   * **εξωτερική Ή η εσωτερική παρειά** του τοίχου τέμνει ένα attach host. Ο
   * converter σπάει τον τοίχο σε κομμάτια **εδώ** (ΟΧΙ στις τομές του άξονα) ώστε
   * κάθε ακριανό κομμάτι να βγαίνει καθαρό **ορθογώνιο** και κάθε transition
   * κομμάτι **καθαρά τρίγωνα** μετά το clip (μηδέν πεντάγωνα). Εσωτερικά μόνο.
   * @see wallTopFaceCrossingBreakpoints
   */
  readonly breakpoints: readonly number[];
}

/** Ελάχιστο σχήμα γεωμετρίας τοίχου που χρειάζεται ο breakpoint helper. */
interface WallEdgePoints {
  readonly outerEdge: { readonly points: readonly Pt2[] };
  readonly innerEdge: { readonly points: readonly Pt2[] };
}

/** Όριο για «εσωτερικό» breakpoint — τα 0/1 (άκρα τοίχου) δεν σπάνε. */
const EDGE_EPS = 1e-6;

/**
 * Face-crossing breakpoints (0..1, αύξουσα, εσωτερικά μόνο) — τα f-fractions όπου η
 * εξωτερική Ή η εσωτερική παρειά του τοίχου τέμνει ένα attach host.
 *
 * Γιατί παρειές κι όχι άξονας: ο `computeWallOpeningPieces` παραμετροποιεί ΚΑΙ τις
 * δύο παρειές με το ίδιο `f` (outer: `oS→oE`, inner: `iS→iE`). Σπάζοντας στις
 * **axis** crossings, ένα ακριανό κομμάτι περιέχει την τριγωνική «μύτη» του host
 * (η μία παρειά είναι ήδη κάτω από το host) → μετά το clip βγαίνει **πεντάγωνο**.
 * Σπάζοντας στις **face** crossings (union outer+inner), τα ακριανά κομμάτια δεν
 * έχουν καμία επικάλυψη host → καθαρά ορθογώνια, και τα transition κομμάτια κόβονται
 * σε καθαρά τρίγωνα. Τα `t0/t1` βγαίνουν από `buildHostUndersidePlans` (ίδιο SSoT
 * projection με το axis profile, απλώς παραμετροποιημένο ανά παρειά).
 */
export function wallTopFaceCrossingBreakpoints(
  geom: WallEdgePoints,
  hosts: readonly HostFootprintInput[],
): number[] {
  const oPts = geom.outerEdge.points;
  const iPts = geom.innerEdge.points;
  if (oPts.length < 2 || iPts.length < 2 || hosts.length === 0) return [];
  const set = new Set<number>();
  const add = (s: Pt2, e: Pt2): void => {
    for (const plan of buildHostUndersidePlans(s, e, hosts)) {
      if (plan.t0 > EDGE_EPS && plan.t0 < 1 - EDGE_EPS) set.add(plan.t0);
      if (plan.t1 > EDGE_EPS && plan.t1 < 1 - EDGE_EPS) set.add(plan.t1);
    }
  };
  add(oPts[0], oPts[oPts.length - 1]);
  add(iPts[0], iPts[iPts.length - 1]);
  return [...set].sort((a, b) => a - b);
}

/**
 * ADR-404 ↔ ADR-401 — **tilt-aware** attach clip.
 *
 * Σε **κεκλιμένο** (battered) attached τοίχο, το ADR-404 Phase 4 shear (`emit()` του
 * `buildStraightWallWithOpenings`) μετατοπίζει την κορυφή κάθε pocket region κατά
 * `wallTiltShearAt(params, Hu)` σε plan (`Hu` = host underside height) — αλλά το host
 * (δοκάρι) μένει ακίνητο → η εγκοπή ξεμένει από το δοκάρι («τρύπα», το δοκάρι δεν
 * χωνεύει). Αντιστάθμιση: μετατοπίζουμε **κάθε host footprint κατά `−shear(Hu)` ΠΡΙΝ
 * το clip** → μετά τον τελικό shear η κορυφή του pocket προσγειώνεται ξανά **ακριβώς
 * κάτω από το δοκάρι**. Geometrically exact για flat-underside host (η επαφή είναι στο
 * επίπεδο `Hu`)· το κατακόρυφο σκαλοπάτι γέρνει σωστά (top@Hu και nominal@H shear-άρουν
 * διαφορετικά). Τα breakpoints recompute-άρονται από τα μετατοπισμένα hosts ώστε το
 * split του τοίχου να ταιριάζει με τον clip. `undersideZmm`/`undersideZmmAt`
 * (τα ΥΨΗ) μένουν ανέπαφα — μόνο η **plan-θέση** αντισταθμίζεται· το `undersideZmmAt`
 * wrap-άρεται να αποτιμά στο αρχικό (un-shifted) σημείο. No-op όταν ο τοίχος είναι
 * επίπεδος (ο καλών gate-άρει σε `isWallTilted`).
 *
 * @see mesh-slope-shear.ts (applyWallTilt — ο τελικός shear που αντισταθμίζουμε)
 * @see bim/geometry/wall-tilt.ts (wallTiltShearAt — ΤΟ ΙΔΙΟ SSoT με Phase 4 & 2Δ)
 */
export function tiltCompensateWallTopClip(
  ctx: WallTopClipContext,
  params: WallParams,
  floorElevationMm: number,
  geom: WallEdgePoints,
): WallTopClipContext {
  const shiftedHosts = ctx.hosts.map((h) => {
    const huLocalM = (h.undersideZmm - floorElevationMm) * MM_TO_M;
    const { dx, dy } = wallTiltShearAt(params, huLocalM);
    if (dx === 0 && dy === 0) return h;
    const footprint = h.footprint.map((p) => ({ x: p.x - dx, y: p.y - dy }));
    const atFn = h.undersideZmmAt;
    return {
      ...h,
      footprint,
      // Το ύψος στο μετατοπισμένο σημείο = ύψος του host στο αρχικό σημείο (p + shift).
      undersideZmmAt: atFn ? (pt: Pt2) => atFn({ x: pt.x + dx, y: pt.y + dy }) : atFn,
    };
  });
  return {
    hosts: shiftedHosts,
    nominalTopMm: ctx.nominalTopMm,
    breakpoints: wallTopFaceCrossingBreakpoints(geom, shiftedHosts),
  };
}

/** Μία επίπεδη/planar περιοχή κορυφής τοίχου: footprint + per-vertex top/base (τοπικά m). */
export interface WallTopRegion {
  readonly footprint: readonly Pt2[];
  readonly topLocalM: readonly number[];
  readonly baseLocalM: readonly number[];
}

/** plan polygon → polygon-clipping `Polygon` (single ring). */
function toClipGeom(poly: readonly Pt2[]): ClipGeom {
  return [poly.map((p) => [p.x, p.y] as [number, number])];
}

/** Signed εμβαδόν (shoelace): θετικό ⇒ CCW στο plan (x,y), αρνητικό ⇒ CW. */
function signedRingArea(pts: readonly Pt2[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

/** Εμβαδόν (absolute) — για sliver filter. */
function ringArea(pts: readonly Pt2[]): number {
  return Math.abs(signedRingArea(pts));
}

/**
 * Outer ring ενός clipped polygon → `Pt2[]`, (α) αφαιρώντας **συνεχόμενες διπλές
 * κορυφές** (το polygon-clipping βγάζει περιστασιακά zero-length ακμές σε γωνιακές
 * τομές — π.χ. ένα τρίγωνο με την κάτω κορυφή διπλή) ΚΑΙ το closing vertex, και
 * (β) **κανονικοποιώντας σε CCW**. Το `buildColumnPrismGeometry` υποθέτει CCW
 * footprint για να βγάλει το πάνω καπάκι με normal **+Y** (κοιτά πάνω)· η
 * `polygon-clipping` ΔΕΝ εγγυάται σταθερό winding (intersection vs difference, ανά
 * region) → χωρίς αυτό μερικά regions έβγαζαν **ανεστραμμένο** καπάκι (normal −Y)
 * → ασυνεπής φωτισμός/σκιά στις οριζόντιες επιφάνειες (top/bottom) του τοίχου.
 */
function ringToPts(ring: Ring): Pt2[] {
  const pts: Pt2[] = [];
  for (const [x, y] of ring) {
    const prev = pts[pts.length - 1];
    if (prev && Math.abs(prev.x - x) < 1e-12 && Math.abs(prev.y - y) < 1e-12) continue;
    pts.push({ x, y });
  }
  if (pts.length > 1) {
    const a = pts[0];
    const b = pts[pts.length - 1];
    if (Math.abs(a.x - b.x) < 1e-12 && Math.abs(a.y - b.y) < 1e-12) pts.pop();
  }
  if (pts.length >= 3 && signedRingArea(pts) < 0) pts.reverse();
  return pts;
}

/** Κεντροειδές (μέσος όρος κορυφών — επαρκές για convex/simple regions). */
function centroid(pts: readonly Pt2[]): Pt2 {
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p.x;
    y += p.y;
  }
  return { x: x / pts.length, y: y / pts.length };
}

/**
 * Ο host με τη **χαμηλότερη** κάτω-παρειά στο σημείο `pt` (lower-envelope winner), ή
 * `null` αν κανείς δεν καλύπτει το `pt`. Χρήση: επιλογή host για μια inside περιοχή
 * (μέσω του κεντροειδούς της — robust σε boundary vertices που το point-test απορρίπτει).
 */
function lowestHostAt(hosts: readonly HostFootprintInput[], pt: Pt2): HostFootprintInput | null {
  let best: HostFootprintInput | null = null;
  let bestZ = Infinity;
  for (const h of hosts) {
    const z = hostUndersideAt(h, pt);
    if (z !== null && z < bestZ) {
      bestZ = z;
      best = h;
    }
  }
  return best;
}

/** Κάτω-παρειά host στο `pt` (flat scalar ή κεκλιμένο επίπεδο· χωρίς point-test). */
function hostUndersidePlaneMm(h: HostFootprintInput, pt: Pt2): number {
  return h.undersideZmmAt ? h.undersideZmmAt(pt) : h.undersideZmm;
}

/**
 * Κόβει το `quad` ενός profile-following κομματιού τοίχου με τα host footprints και
 * επιστρέφει τις επίπεδες/planar περιοχές κορυφής (lower-envelope nominal ∧ hosts).
 *
 * @param quad           plan polygon του κομματιού (scene units, π.χ. `[Ao,Bo,Bi,Ai]`).
 * @param hosts          attach hosts (footprints στο ίδιο plan space, absolute-mm undersides).
 * @param nominalTopMm   nominal κορυφή (absolute mm) όπου δεν υπάρχει host.
 * @param floorElevationMm FFL ορόφου (absolute mm) — datum για mm→local m.
 * @param baseLocalM     βάση του κομματιού (τοπικά m) — flat (ο 3D builder gate-άρει sloped base).
 * @returns Μία περιοχή ανά clipped polygon· κενό όταν τίποτα ορατό.
 */
export function clipWallBandTopRegions(
  quad: readonly Pt2[],
  hosts: readonly HostFootprintInput[],
  nominalTopMm: number,
  floorElevationMm: number,
  baseLocalM: number,
): WallTopRegion[] {
  if (quad.length < 3 || hosts.length === 0) return [];
  const nominalLocalM = (nominalTopMm - floorElevationMm) * MM_TO_M;
  const toLocal = (zmm: number): number => (zmm - floorElevationMm) * MM_TO_M;

  const quadGeom = toClipGeom(quad);
  const hostGeoms = hosts.map((h) => toClipGeom(h.footprint));
  const hostsUnion: ClipGeom = hostGeoms.length === 1
    ? hostGeoms[0]
    : safeUnion(hostGeoms[0], ...hostGeoms.slice(1));

  const inside: MultiPolygon = safeIntersection(quadGeom, hostsUnion);
  const outside: MultiPolygon = safeDifference(quadGeom, hostsUnion);

  const regions: WallTopRegion[] = [];

  // inside: κορυφή = κάτω-παρειά του host που «κερδίζει» στο κεντροειδές (lower-envelope),
  // αποτιμημένη ανά vertex (επίπεδο host plane → χωρίς point-test στις γωνίες). Clamp στο
  // nominal (host πάνω από το ταβάνι → ο τοίχος φτάνει nominal).
  for (const poly of inside) {
    const pts = ringToPts(poly[0]);
    if (pts.length < 3 || ringArea(pts) < AREA_EPS) continue;
    const host = lowestHostAt(hosts, centroid(pts));
    const topLocalM = pts.map((p) => {
      const hostMm = host ? hostUndersidePlaneMm(host, p) : nominalTopMm;
      return toLocal(Math.min(nominalTopMm, hostMm));
    });
    regions.push({ footprint: pts, topLocalM, baseLocalM: pts.map(() => baseLocalM) });
  }

  // outside: κορυφή = nominal (επίπεδη).
  for (const poly of outside) {
    const pts = ringToPts(poly[0]);
    if (pts.length < 3 || ringArea(pts) < AREA_EPS) continue;
    regions.push({
      footprint: pts,
      topLocalM: pts.map(() => nominalLocalM),
      baseLocalM: pts.map(() => baseLocalM),
    });
  }

  return regions;
}

/**
 * ADR-404 ↔ ADR-401 — **tilt-aware** band split (7→9 κομμάτια) — SSoT.
 *
 * Loft band μιας **outside** μεταβατικής περιοχής στη ζώνη `Hu→nominal`: η κάτοψη
 * **αλλάζει** με το ύψος (γερμένες παρειές τοίχου + **κατακόρυφη** κοπή δοκαριού),
 * άρα `bottomFootprint(@Hu) ≠ topFootprint(@nominal)` με 1:1 αντιστοιχία κορυφών.
 * Καταναλώνεται από `buildWallLoftBandGeometry` (wall-piece-geometry.ts).
 */
export interface WallTopLoftBand {
  /** footprint @Hu — κάτω δακτύλιος (= `quad − host_atHu`). CCW. */
  readonly bottomFootprint: readonly Pt2[];
  /** footprint @nominal — πάνω δακτύλιος (= `quad − host_atNominal`), 1:1 με `bottomFootprint`. */
  readonly topFootprint: readonly Pt2[];
  /** ύψος κάτω δακτυλίου (τοπικά m). */
  readonly huLocalM: number;
  /** ύψος πάνω δακτυλίου (τοπικά m). */
  readonly nominalLocalM: number;
}

/** Απόσταση σημείου από τμήμα `ab` < eps ΚΑΙ προβολή εντός [0,1] (endpoint-inclusive). */
function pointOnSegment(p: Pt2, a: Pt2, b: Pt2, eps: number): boolean {
  const abx = b.x - a.x, aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 < eps * eps) return Math.hypot(p.x - a.x, p.y - a.y) < eps;
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
  if (t < -eps || t > 1 + eps) return false;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby)) < eps;
}

/** Τομή δύο **ευθειών** (όχι τμημάτων) p1p2 × p3p4· `null` αν ~παράλληλες. */
function lineIntersect(p1: Pt2, p2: Pt2, p3: Pt2, p4: Pt2): Pt2 | null {
  const d1x = p2.x - p1.x, d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x, d2y = p4.y - p3.y;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-12) return null;
  const tt = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom;
  return { x: p1.x + tt * d1x, y: p1.y + tt * d1y };
}

/**
 * Χτίζει το **top footprint** (@nominal) **απευθείας από** το `bottom` (@Hu) ώστε να
 * εγγυηθεί **1:1 αντιστοιχία κορυφών** — robust σε διαφορετικό vertex count μεταξύ
 * ανεξάρτητων clip (η αιτία που το naive matching αποτύγχανε στο runtime). Κάθε κορυφή
 * `v` του `bottom` κατατάσσεται ως προς το `host_atHu` (`host`) + το `quad`:
 *   - **εκτός host** (quad corner) → αμετάβλητη (η κάτοψη του τοίχου δεν αλλάζει με ύψος).
 *   - **quad-edge ∩ host-edge** (cut crossing) → τομή της ΙΔΙΑΣ quad ακμής με την
 *     **μετατοπισμένη** host ακμή (`host − Δcut`) → κινείται κατά μήκος της παρειάς.
 *   - **host corner εντός quad** (notch tip) → μετατόπιση κατά `−Δcut` (κατακόρυφη ακμή
 *     δοκαριού).
 * Μετά τον `emit()` shear, η κοπή ξαναγίνεται **κατακόρυφη** στο `host_real`. Επιστρέφει
 * `null` (→ fallback) σε εκφυλισμό (παράλληλες ακμές).
 */
function buildTopFootprintFromBottom(
  bottom: readonly Pt2[], host: readonly Pt2[], quad: readonly Pt2[], dCut: Pt2, eps: number,
): Pt2[] | null {
  const out: Pt2[] = [];
  for (const v of bottom) {
    let hostEdge: readonly [Pt2, Pt2] | null = null;
    for (let i = 0; i < host.length; i++) {
      const a = host[i], b = host[(i + 1) % host.length];
      if (pointOnSegment(v, a, b, eps)) { hostEdge = [a, b]; break; }
    }
    if (!hostEdge) { out.push({ x: v.x, y: v.y }); continue; } // εκτός host → quad corner
    let quadEdge: readonly [Pt2, Pt2] | null = null;
    for (let i = 0; i < quad.length; i++) {
      const a = quad[i], b = quad[(i + 1) % quad.length];
      if (pointOnSegment(v, a, b, eps)) { quadEdge = [a, b]; break; }
    }
    if (quadEdge) {
      // cut crossing: τομή quad ακμής × μετατοπισμένης host ακμής.
      const h0 = { x: hostEdge[0].x - dCut.x, y: hostEdge[0].y - dCut.y };
      const h1 = { x: hostEdge[1].x - dCut.x, y: hostEdge[1].y - dCut.y };
      const p = lineIntersect(quadEdge[0], quadEdge[1], h0, h1);
      if (!p) return null;
      out.push(p);
    } else {
      out.push({ x: v.x - dCut.x, y: v.y - dCut.y }); // host corner εντός quad
    }
  }
  return out;
}

/**
 * ADR-404 ↔ ADR-401 — **tilt-aware** attach clip (9-piece pocket split).
 *
 * Σε **κεκλιμένο** attached τοίχο κάτω από **κατακόρυφο** δοκάρι, ο ομοιόμορφος shear
 * (`emit()` Phase 4) γέρνει ΚΑΙ τη διαγώνια κοπή του δοκαριού → η ζώνη `Hu→nominal`
 * ξεφεύγει από την κατακόρυφη παρειά του δοκαριού (τρύπα/υπέρβαση). Fix: σπάσε κάθε
 * **outside** περιοχή οριζόντια στο `Hu`:
 *   - **κάτω prism** (`base→Hu`, σταθερό footprint `quad − host_atHu`) — γέρνει
 *     ομοιόμορφα· watertight γιατί κάτω από το `Hu` συνυπάρχει το pocket.
 *   - **πάνω loft band** (`Hu→nominal`): `bottomFootprint = quad − host_atHu`,
 *     `topFootprint = quad − host_atNominal` όπου `host_atNominal = host_atHu − Δcut`,
 *     `Δcut = shear(nominal) − shear(Hu)`. Μετά τον `emit()` shear η κοπή ξαναγίνεται
 *     **κατακόρυφη** στο `host_real` (βλ. ADR-404 §Phase 4.2).
 *
 * Τα `inside` (pockets) μένουν ως single-footprint prisms (top = host underside).
 *
 * **Scope:** **single flat host** = ο καθαρός στόχος. Multi-host / sloped underside →
 * **fallback** στο vertical `clipWallBandTopRegions` (current behaviour) — follow-up.
 *
 * @param hosts  τα **ήδη αντισταθμισμένα** (`tiltCompensateWallTopClip`) host_atHu.
 * @returns `prisms` (inside pockets + lower-outside + far-end + fallback) + `lofts`
 *          (upper bands `Hu→nominal`). Άδειο όταν τίποτα ορατό.
 * @see buildWallLoftBandGeometry — ο builder των loft bands
 * @see clipWallBandTopRegions — ο vertical (μη-tilted) clip
 */
export function clipWallBandTopRegionsTilted(
  quad: readonly Pt2[],
  hosts: readonly HostFootprintInput[],
  nominalTopMm: number,
  floorElevationMm: number,
  baseLocalM: number,
  params: WallParams,
): { prisms: WallTopRegion[]; lofts: WallTopLoftBand[] } {
  // Fallback: μη-tilted / multi-host / κεκλιμένο host → vertical clip (μηδέν αλλαγή).
  if (quad.length < 3 || hosts.length !== 1 || hosts[0].undersideZmmAt || !isWallTilted(params)) {
    return {
      prisms: clipWallBandTopRegions(quad, hosts, nominalTopMm, floorElevationMm, baseLocalM),
      lofts: [],
    };
  }

  const host = hosts[0];
  const nominalLocalM = (nominalTopMm - floorElevationMm) * MM_TO_M;
  const huMm = Math.min(nominalTopMm, host.undersideZmm);
  const huLocalM = (huMm - floorElevationMm) * MM_TO_M;
  const toLocal = (zmm: number): number => (zmm - floorElevationMm) * MM_TO_M;

  // host_atNominal = host_atHu − Δcut· Δcut = shear(nominal) − shear(Hu) (plan).
  const sNom = wallTiltShearAt(params, nominalLocalM);
  const sHu = wallTiltShearAt(params, huLocalM);
  const dCut: Pt2 = { x: sNom.dx - sHu.dx, y: sNom.dy - sHu.dy };

  // Scale-robust eps για point-on-edge classification: βασισμένο στο **μέγεθος των
  // συντεταγμένων** (όχι στο span του κομματιού — τα μεταβατικά κομμάτια είναι λεπτές
  // φέτες με μικρό span → απόλυτο/span eps ήταν μικροσκοπικό → η κοπή δεν αναγνωριζόταν).
  // Ο θόρυβος του polygon-clipping κλιμακώνεται με το μέγεθος συντεταγμένων → mm & m safe.
  let maxAbs = 0;
  for (const p of quad) maxAbs = Math.max(maxAbs, Math.abs(p.x), Math.abs(p.y));
  for (const p of host.footprint) maxAbs = Math.max(maxAbs, Math.abs(p.x), Math.abs(p.y));
  const edgeEps = Math.max(1e-7, maxAbs * 1e-6);

  const quadGeom = toClipGeom(quad);
  const hostHuGeom = toClipGeom(host.footprint);

  const prisms: WallTopRegion[] = [];
  const lofts: WallTopLoftBand[] = [];

  // inside (pocket): top = host underside (clamp ≤ nominal), base = baseLocalM.
  let hasPocket = false;
  for (const poly of safeIntersection(quadGeom, hostHuGeom)) {
    const pts = ringToPts(poly[0]);
    if (pts.length < 3 || ringArea(pts) < AREA_EPS) continue;
    const topLocalM = pts.map((p) => toLocal(Math.min(nominalTopMm, hostUndersidePlaneMm(host, p))));
    prisms.push({ footprint: pts, topLocalM, baseLocalM: pts.map(() => baseLocalM) });
    hasPocket = true;
  }

  // outside: σπάσε στο Hu **μόνο** όταν το κομμάτι έχει pocket (το δοκάρι το διασχίζει →
  // genuine transition). Κριτήριο geometry-free & robust: ακριανό κομμάτι (καμία φωλιά)
  // → ομοιόμορφο prism @nominal. Στο transition, το top footprint χτίζεται ΑΠΕΥΘΕΙΑΣ από
  // το bottom (constructive, εγγυημένη 1:1 αντιστοιχία) → κάτω prism (base→Hu) + πάνω
  // loft band (Hu→nominal, κατακόρυφη κοπή μετά τον emit shear).
  for (const poly of safeDifference(quadGeom, hostHuGeom)) {
    const b = ringToPts(poly[0]);
    if (b.length < 3 || ringArea(b) < AREA_EPS) continue;
    const t = hasPocket ? buildTopFootprintFromBottom(b, host.footprint, quad, dCut, edgeEps) : null;
    const moved = t !== null && b.some((p, i) =>
      Math.abs(p.x - t[i].x) > edgeEps || Math.abs(p.y - t[i].y) > edgeEps);
    if (t && moved && ringArea(t) >= AREA_EPS) {
      prisms.push({ footprint: b, topLocalM: b.map(() => huLocalM), baseLocalM: b.map(() => baseLocalM) });
      lofts.push({ bottomFootprint: b, topFootprint: t, huLocalM, nominalLocalM });
    } else {
      prisms.push({ footprint: b, topLocalM: b.map(() => nominalLocalM), baseLocalM: b.map(() => baseLocalM) });
    }
  }

  return { prisms, lofts };
}
