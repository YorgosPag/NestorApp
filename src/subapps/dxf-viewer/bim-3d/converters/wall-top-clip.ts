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
import { wallTiltShearAt, isWallTilted } from '../../bim/geometry/wall-tilt';
import type { WallParams } from '../../bim/types/wall-types';
import {
  safeUnion,
  safeIntersection,
  safeDifference,
  type ClipGeom,
} from '../../bim/geometry/shared/safe-polygon-boolean';
import type { MultiPolygon } from 'polygon-clipping';
// Low-level plan-geometry helpers (Google 500-line SRP split — ADR-404).
import {
  AREA_EPS,
  toClipGeom,
  ringArea,
  ringToPts,
  diffQuadMinusHostPieces,
  centroid,
  lowestHostAt,
  hostUndersidePlaneMm,
  buildTopFootprintFromBottom,
} from './wall-top-clip-internal';
import { projectVerticesTo2D } from '../../bim/geometry/shared/polygon-utils';

const MM_TO_M = 0.001;

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
    // Approximation note (sloped-underside host): το footprint shift χρησιμοποιεί
    // shear(undersideZmm), δηλ. το nominal/start-point ύψος. Για κεκλιμένη κάτω-παρειά
    // το Hu μεταβάλλεται per-vertex, οπότε αυστηρά κάθε κορυφή θέλει δικό της shift· το
    // σφάλμα = Δh·tan(tilt) σε plan (Δh = εύρος κλίσης) → sub-mm για τυπικά δοκάρια →
    // αμελητέο. Η ακρίβεια που μετράει για watertightness καλύπτεται από το per-vertex
    // dCut στο clipWallBandTopRegionsTilted.
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
  /**
   * Ύψος κάτω δακτυλίου **ανά κορυφή** (τοπικά m), `length === bottomFootprint.length`.
   * Flat host → όλες οι τιμές ίσες (== Hu). Κεκλιμένη κάτω-παρειά host → ακολουθεί την
   * παρειά per-vertex (sloped loft bottom). ADR-404 Phase 4.2 sloped-host support.
   */
  readonly bottomLocalM: readonly number[];
  /** ύψος πάνω δακτυλίου (τοπικά m). */
  readonly nominalLocalM: number;
}


/**
 * ADR-404 Phase 4.3 — **critical heights** όπου αλλάζει η **τοπολογία** του
 * `quad − host(t)`, με `host(t) = hostFootprint − t·dCut`, `t∈[0,1]` (γραμμική
 * μετατόπιση της κοπής από `Hu` (t=0) στο `nominal` (t=1)).
 *
 * Καθώς η κοπή μετατοπίζεται, γωνίες/ακμές του host περνούν μέσα από το quad →
 * η διατομή αποκτά/χάνει κορυφές **και σπάει σε πολλά πολύγωνα** (ακόμη και από
 * edge-edge bridging, ΟΧΙ μόνο vertex incidences). Ένα single-ring loft σταθερού
 * count δεν το αναπαριστά → τρύπες. Σπάμε τη ζώνη σε υπο-διαστήματα σταθερής
 * τοπολογίας (όπου το constructive loft είναι exact).
 *
 * **Robust ανίχνευση = sampling + bisection** του «signature» (πλήθος πολυγώνων +
 * ταξινομημένα vertex counts) — πιάνει ΚΑΘΕ τοπολογική μεταβολή ανεξαρτήτως αιτίας
 * (το αναλυτικό vertex-on-edge μοντέλο χάνει τα edge-edge bridges). Επιστρέφει τα
 * εσωτερικά boundary `t∈(0,1)` (refined ~1e-6) ταξινομημένα/dedup.
 */
export function computeTiltLoftCriticalTs(
  quad: readonly Pt2[], host: readonly Pt2[], dCut: Pt2,
): number[] {
  // Topology signature του quad − host(t): «#polys:sorted vertex-counts». Η διαφορά
  // υπολογίζεται robust (analytic half-plane peel για κυρτό host) → το sig ΠΟΤΕ δεν
  // διαφθείρεται από clipper failure στα σχεδόν-εκφυλισμένα t (πρώην root cause των κενών).
  const sig = (t: number): string => {
    const hostT = host.map((p) => ({ x: p.x - t * dCut.x, y: p.y - t * dCut.y }));
    const counts = diffQuadMinusHostPieces(quad, hostT).map((pts) => pts.length);
    counts.sort((a, b) => a - b);
    return `${counts.length}:${counts.join(',')}`;
  };
  const SAMPLES = 48;
  const boundaries: number[] = [];
  let prevT = 0;
  let prevSig = sig(0);
  for (let k = 1; k <= SAMPLES; k++) {
    const t = k / SAMPLES;
    const s = sig(t);
    if (s !== prevSig) {
      // bisect [prevT, t] για το boundary (όπου το sig αλλάζει από prevSig).
      let lo = prevT, hi = t;
      for (let iter = 0; iter < 26; iter++) {
        const mid = (lo + hi) / 2;
        if (sig(mid) === prevSig) lo = mid; else hi = mid;
      }
      if (hi > 1e-6 && hi < 1 - 1e-6) boundaries.push(hi);
      prevSig = s;
    }
    prevT = t;
  }
  // dedup
  const out: number[] = [];
  for (const t of boundaries) if (!out.length || t - out[out.length - 1] > 1e-5) out.push(t);
  return out;
}

/**
 * ADR-404 Phase 4.3 — **topology-aware** loft bands για μια outside μεταβατική ζώνη.
 *
 * Σπάει το `Hu→nominal` στα critical heights (`computeTiltLoftCriticalTs`) και χτίζει
 * **ένα slab loft ανά υπο-διάστημα ανά sub-polygon**: σε κάθε slab η τοπολογία είναι
 * σταθερή → η robust διαφορά (`diffQuadMinusHostPieces`, analytic peel για κυρτό host)
 * δίνει τα σωστά convex κομμάτια (συμπεριλαμβανομένων splits) και το constructive
 * `buildTopFootprintFromBottom` δίνει την **exact** πάνω κάτοψη (no
 * topology change μέσα στο slab). Η παρειά δοκαριού είναι επίπεδη → τα slabs είναι
 * **συνεπίπεδα** (μηδέν stepping). Z γραμμικά μεταξύ `Hu` (flat ref) και `nominal`· το
 * slab-0 bottom ακολουθεί per-vertex την κεκλιμένη κάτω-παρειά (`huLocalMAt`).
 */
function buildTiltTransitionLofts(
  quad: readonly Pt2[], hostFootprint: readonly Pt2[], dCut: Pt2,
  huLocalMFlat: number, nominalLocalM: number, huLocalMAt: (p: Pt2) => number, eps: number,
): WallTopLoftBand[] {
  const ts = [0, ...computeTiltLoftCriticalTs(quad, hostFootprint, dCut), 1];
  const lofts: WallTopLoftBand[] = [];
  const zAt = (t: number): number => huLocalMFlat + t * (nominalLocalM - huLocalMFlat);
  for (let j = 0; j < ts.length - 1; j++) {
    const tLo = ts[j], tHi = ts[j + 1];
    if (tHi - tLo < 1e-9) continue;
    const hostLo = hostFootprint.map((p) => ({ x: p.x - tLo * dCut.x, y: p.y - tLo * dCut.y }));
    const slabDCut: Pt2 = { x: (tHi - tLo) * dCut.x, y: (tHi - tLo) * dCut.y };
    const zHi = zAt(tHi);
    // Robust διαφορά (analytic peel για κυρτό host) → ξένα convex κομμάτια ανά slab,
    // ποτέ clipper failure. Σταθερή τοπολογία στο slab → constructive top == true top.
    for (const b of diffQuadMinusHostPieces(quad, hostLo)) {
      // Σταθερή τοπολογία στο slab → constructive top == true top (exact). Αν η κοπή δεν
      // κινείται σε αυτό το sub-polygon (μακριά από host) → κατακόρυφο loft (top==bottom).
      let top = buildTopFootprintFromBottom(b, hostLo, quad, () => slabDCut, eps);
      if (!top || top.length !== b.length || ringArea(top) < AREA_EPS) top = projectVerticesTo2D(b);
      const bottomLocalM = j === 0 ? b.map((p) => huLocalMAt(p)) : b.map(() => zAt(tLo));
      lofts.push({ bottomFootprint: b, topFootprint: top, bottomLocalM, nominalLocalM: zHi });
    }
  }
  return lofts;
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
 * **Scope:** **single host** (flat **ή** κεκλιμένη κάτω-παρειά). Σε κεκλιμένο host
 * (`undersideZmmAt` set, π.χ. δοκάρι με `topElevationEnd≠topElevation`) το `Hu` γίνεται
 * **per-vertex** → sloped loft bottom + per-vertex `Δcut` (η πλαϊνή παρειά δοκαριού
 * παραμένει κατακόρυφη, άρα η κοπή ξαναγίνεται κατακόρυφη σε **κάθε** ύψος της). Multi-host
 * → **fallback** στο vertical `clipWallBandTopRegions` (follow-up).
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
  // Fallback: μη-tilted / multi-host → vertical clip (μηδέν αλλαγή). Κεκλιμένη κάτω-παρειά
  // host (single) ΔΕΝ πέφτει πια εδώ — χειρίζεται per-vertex (sloped loft bottom).
  if (quad.length < 3 || hosts.length !== 1 || !isWallTilted(params)) {
    return {
      prisms: clipWallBandTopRegions(quad, hosts, nominalTopMm, floorElevationMm, baseLocalM),
      lofts: [],
    };
  }

  const host = hosts[0];
  const isSloped = !!host.undersideZmmAt;
  const nominalLocalM = (nominalTopMm - floorElevationMm) * MM_TO_M;
  const toLocal = (zmm: number): number => (zmm - floorElevationMm) * MM_TO_M;

  // Hu (τοπικά m, clamp ≤ nominal): flat → σταθερό· κεκλιμένο → per-vertex από undersideZmmAt.
  const huLocalMFlat = toLocal(Math.min(nominalTopMm, host.undersideZmm));
  const huLocalMAt = (pt: Pt2): number =>
    isSloped ? toLocal(Math.min(nominalTopMm, host.undersideZmmAt!(pt))) : huLocalMFlat;

  // host_atNominal = host_atHu − Δcut· Δcut = shear(nominal) − shear(Hu) (plan). Scalar (flat
  // Hu) για topology-ανάλυση + slab construction· η κεκλιμένη κάτω-παρειά (π.χ. 3.7mm) επηρεάζει
  // ΜΟΝΟ το per-vertex bottom-Z (`huLocalMAt`), ΟΧΙ την plan-τοπολογία (το host footprint είναι
  // σταθερό σε plan· μόνο το underside-Z γέρνει).
  const sNom = wallTiltShearAt(params, nominalLocalM);
  const sHuFlat = wallTiltShearAt(params, huLocalMFlat);
  const dCut: Pt2 = { x: sNom.dx - sHuFlat.dx, y: sNom.dy - sHuFlat.dy };

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

  // outside: ακριανό κομμάτι (καμία φωλιά) → ομοιόμορφο prism @nominal. Transition (έχει
  // pocket) → lower prisms (base→Hu, per-vertex) + **topology-aware** slab lofts (Hu→nominal,
  // ADR-404 Phase 4.3): καθώς η κοπή μετατοπίζεται κατά Δcut ανεβαίνοντας, η διατομή αλλάζει
  // τοπολογία (γωνίες/splits) → σπάμε σε slabs σταθερής τοπολογίας (constructive exact ανά
  // slab, συνεπίπεδη παρειά δοκαριού). Lower prism @Hu == slab-0 loft bottom → watertight.
  for (const b of diffQuadMinusHostPieces(quad, host.footprint)) {
    const topLocalM = hasPocket ? b.map((p) => huLocalMAt(p)) : b.map(() => nominalLocalM);
    prisms.push({ footprint: b, topLocalM, baseLocalM: b.map(() => baseLocalM) });
  }
  if (hasPocket) {
    lofts.push(...buildTiltTransitionLofts(
      quad, host.footprint, dCut, huLocalMFlat, nominalLocalM, huLocalMAt, edgeEps,
    ));
  }

  return { prisms, lofts };
}
