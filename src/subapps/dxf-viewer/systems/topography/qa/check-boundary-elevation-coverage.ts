/**
 * ADR-725 — «πόσο από το ΟΙΚΟΠΕΔΟ στηρίζεται σε μέτρηση και πόσο σε εικασία;»
 *
 * ── Γιατί υπάρχει ───────────────────────────────────────────────────────────────────────────
 * Το ADR-720 απέδειξε, με μετρημένα νούμερα από το εργοτάξιο, ότι σε πραγματικό τοπογραφικό τα
 * σημεία **εντός** του οικοπέδου μπορεί να είναι σχεδόν όλα δισδιάστατα: **29 σημεία CSV εντός/επί
 * του ορίου, μόνο 6 με υψόμετρο**. Η τριγωνοποίηση δεν παραπονιέται ποτέ γι' αυτό — γεμίζει το κενό
 * με τρίγωνα που πηδούν πάνω από το οικόπεδο, από βολή γείτονα σε βολή γείτονα, και το αποτέλεσμα
 * φαίνεται μια χαρά.
 *
 * 🔴 Είναι σφάλμα **ΤΙΜΗΣ, όχι εμφάνισης**: αυτή ακριβώς η περιοχή είναι που κόβει το ADR-718 και
 * πάνω της υπολογίζονται οι **όγκοι εκσκαφής** (ADR-650 M6). Κενό δεδομένων που γεμίζει με
 * παρεμβολή δίνει όγκο **με σιγουριά και χωρίς προειδοποίηση** — και ο όγκος τιμολογείται.
 *
 * ── Δύο αστοχίες, δύο ευρήματα (δεν συγχωνεύονται) ──────────────────────────────────────────
 *   `coverageGap`         — μέρος του οικοπέδου **δεν καλύπτεται καθόλου** από την επιφάνεια. Εκεί
 *                           δεν υπάρχει παρεμβολή· υπάρχει **τρύπα**, και ο όγκος μετράει σιωπηλά 0.
 *   `interpolatedSupport` — το οικόπεδο **καλύπτεται**, αλλά από τρίγωνα-γέφυρες που αντλούν το
 *                           υψόμετρό τους από μακριά. Ο αριθμός βγαίνει· απλώς είναι εικασία.
 *
 * ── ⚠️ Γιατί το κριτήριο ΔΕΝ είναι «τρίγωνα με 3 κορυφές εντός του ορίου» ────────────────────
 * Ήταν η προφανής πρώτη ιδέα και είναι **λάθος**, με δύο τρόπους:
 *
 * 1. **Δομική μεροληψία.** Κάθε τρίγωνο που ακουμπά την περίμετρο έχει σχεδόν πάντα μία κορυφή
 *    έξω — γεωμετρικά αναπόφευκτο **ακόμα και σε τέλεια αποτύπωση**. Το έλλειμμα είναι περιμετρική
 *    λωρίδα ≈ `P·d/2`. Για το πραγματικό οικόπεδο (A = 223 m², P = 61,4 m) με d ≈ 3 m βγαίνει
 *    **≈41% του εμβαδού με μηδέν σφάλμα**. Κατώφλι πάνω σε αυτό ανάβει σε **κάθε** μικρό αστικό
 *    οικόπεδο ⇒ ευθεία παραβίαση του «μηδέν ψευδώς θετικά» (§9: QA που κραυγάζει παύει να διαβάζεται).
 * 2. **Λάθος ερώτημα.** Σημείο 2 m έξω από το όριο είναι **καλή** στήριξη· σημείο 40 m μακριά είναι
 *    εικασία. Το κρίσιμο δεν είναι πού πέφτει η κορυφή σε σχέση με μια **νομική** γραμμή — είναι
 *    **πόσο μακριά έγινε η μέτρηση**.
 *
 * ── Το κριτήριο που ισχύει: αυτο-βαθμονομούμενο μήκος ακμής ─────────────────────────────────
 * Η βιομηχανική απάντηση σε αυτό ακριβώς το ερώτημα είναι το **ESRI «Delineate TIN Data Area»**:
 * αφαιρεί από την έγκυρη περιοχή δεδομένων τα τρίγωνα με ακμή πάνω από κατώφλι, και το κατώφλι
 * βγαίνει **από τη μέση απόσταση κόμβων της ίδιας της αποτύπωσης**, ποτέ ως απόλυτο νούμερο σε
 * μέτρα. Βλ. `BRIDGING_EDGE_MEDIAN_MULTIPLIER` για το γιατί διάμεσος και γιατί 3×.
 *
 * Η ιδιότητα που το κάνει ασφαλές: αποτύπωση **ομοιόμορφα** αραιή παντού δεν ανάβει τίποτα — σωστά,
 * το οικόπεδο έχει την ίδια ποιότητα με το υπόλοιπο. Ανάβει μόνο όταν το οικόπεδο είναι **σχετικά**
 * πιο κενό από την αποτύπωση που το περιβάλλει, που είναι ακριβώς το περιστατικό του ADR-720.
 *
 * Καθαρό: μηδέν store, μηδέν side effects. Δεν αγγίζει τίποτα — αναφέρει, και ο μηχανικός πιστοποιεί.
 *
 * @see ../tin-clip-to-boundary — το «τρίγωνο ∩ όριο» ζει ΕΚΕΙ· εδώ απλώς καλείται δύο φορές
 * @see ../topo-surface-area — το plan εμβαδόν μιας TIN, μία φορά γραμμένο
 * @see docs/centralized-systems/reference/adrs/ADR-725-boundary-elevation-coverage.md
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { Point3D } from '../../../bim/types/bim-base';
import type { TinSurface, TopoBoundary, TopoPoint } from '../topo-types';
import type { TopoQaFlag, TopoQaSeverity } from './topo-qa-types';
import { TOPO_QA_CONFIG } from './topo-qa-config';
import { tinEdgeLength, tinEdgeLengths } from './topo-qa-topology';
import { median } from '../../../utils/statistics';
import {
  pointInPolygonCovers, polygonArea, polygon2DAreaCentroid,
  DEFAULT_BOUNDARY_TOLERANCE_MM,
} from '../../../bim/geometry/shared/polygon-utils';
import { clipTinToBoundary } from '../tin-clip-to-boundary';
import { topoSurfaceAreas } from '../topo-surface-area';
import { hasElevation } from '../topo-point-elevation';
import { worldToLocal } from '../topo-local-origin';

const {
  COVERAGE_GAP_MIN_FRACTION, COVERAGE_GAP_HIGH_FRACTION,
  BRIDGING_EDGE_MEDIAN_MULTIPLIER, INTERPOLATED_MIN_FRACTION, INTERPOLATED_HIGH_FRACTION,
} = TOPO_QA_CONFIG;

/** Ο δακτύλιος ως `Point3D` — το `polygon-utils` δουλεύει σε 3Δ κορυφές με αδιάφορο z. */
function lift(verts: readonly Point2D[]): Point3D[] {
  return verts.map((p) => ({ x: p.x, y: p.y, z: 0 }));
}

/**
 * Η ίδια επιφάνεια με **μόνο** τα τρίγωνα-γέφυρες. Shallow copy: το `clipTinToBoundary` και το
 * `topoSurfaceAreas` διαβάζουν αποκλειστικά `positions` / `elevations` / `triangles` / `origin`,
 * οπότε τα `bounds` / `flatTriangleCount` που κληρονομούνται αυτούσια είναι μεν υπερεκτίμηση αλλά
 * **δεν διαβάζονται από κανέναν στη διαδρομή αυτή**. Η εναλλακτική — να ξαναϋπολογιστούν — θα ήταν
 * δεύτερος υπολογισμός bounds για να μη διαβαστεί ποτέ.
 */
function bridgesOnly(surface: TinSurface): TinSurface {
  const lengths = tinEdgeLengths(surface);
  if (lengths.length === 0) return { ...surface, triangles: [] };
  const limit = median(lengths) * BRIDGING_EDGE_MEDIAN_MULTIPLIER;
  const triangles = surface.triangles.filter(([i, j, k]) => Math.max(
    tinEdgeLength(surface, i, j), tinEdgeLength(surface, j, k), tinEdgeLength(surface, k, i),
  ) > limit);
  return { ...surface, triangles };
}

/** Το plan εμβαδόν της `surface` **μέσα** στον δακτύλιο, μέσω των δύο υπαρχουσών SSoT. */
function planAreaInsideMm2(surface: TinSurface, ring: readonly Point2D[]): number {
  return topoSurfaceAreas(clipTinToBoundary(surface, ring)).plan2DMm2;
}

/**
 * Πόσα **μετρημένα** σημεία πέφτουν εντός **ή επί** του ορίου. Ο δακτύλιος έρχεται ήδη σε LOCAL.
 *
 * Δισδιάστατα σημεία δεν μετριούνται: το ερώτημα είναι «τι στηρίζει την επιφάνεια εδώ», και ένα
 * σημείο χωρίς Ζ δεν δίνει κορυφή στο TIN (ADR-720). Θα ήταν ακριβώς το ψέμα που ο έλεγχος
 * υπάρχει για να ξεσκεπάσει: **29 σημεία εντός, μόνο 6 μετρημένα**.
 *
 * 🔴 **Γιατί `covers` και όχι σκέτο «εντός» (ADR-730)**: βολή **πάνω στη γραμμή** του οικοπέδου
 * το **στηρίζει** — είναι μέτρηση επί του συνόρου, όχι έξω από αυτό. Μέχρι το 2026-07-29 εδώ
 * καλούνταν το ωμό `pointInPolygon`, που για σημείο επί ακμής απαντά **αυθαίρετα**: το σχόλιο
 * υποσχόταν «εντός/επί» αλλά καμία γραμμή δεν έλεγχε ακμή. Στο πραγματικό εργοτάξιο **10** βολές
 * κάθονται στη γραμμή (≤5 cm) και **2** έχουν υψόμετρο — το `N = 6` της ζωντανής επαλήθευσης
 * βγήκε σωστό **κατά τύχη**. Οικόπεδο με βολές **μόνο στις κορυφές του** (συνηθισμένο σε αστικό
 * τεμάχιο) μπορούσε να μετρηθεί «0 εντός» ⇒ **ψευδές `high`** από το §3.4, δηλαδή ακριβώς η
 * παραβίαση του «μηδέν ψευδώς θετικά» που ο έλεγχος υπάρχει για να αποφύγει.
 *
 * Ανοχή: η προεπιλογή {@link DEFAULT_BOUNDARY_TOLERANCE_MM} (**1 mm** — η προεπιλεγμένη XY
 * tolerance του ArcGIS). Έγκυρη εδώ γιατί `worldToLocal` = καθαρή αφαίρεση origin ⇒ **canonical
 * mm** και στα δύο ορίσματα.
 */
function measuredPointsInside(
  points: readonly TopoPoint[], ringLocal: readonly Point3D[], origin: TinSurface['origin'],
): number {
  let inside = 0;
  for (const point of points) {
    if (!hasElevation(point)) continue;
    if (pointInPolygonCovers(worldToLocal(point, origin), ringLocal)) inside++;
  }
  return inside;
}

/** Ποσοστό ακέραιο, για το μήνυμα — τα `messageParams` είναι ΗΔΗ σε μονάδες παρουσίασης. */
function asPercent(fraction: number): number {
  return Math.round(fraction * 100);
}

function coverageGapFlag(fraction: number, at: Point2D): TopoQaFlag {
  const severity: TopoQaSeverity = fraction >= COVERAGE_GAP_HIGH_FRACTION ? 'high' : 'medium';
  return {
    id: 'boundary-coverage:gap',
    kind: 'boundary-coverage',
    severity,
    at,
    // Χωρίς `atZMm`: το εύρημα αφορά ΠΕΡΙΟΧΗ, και το κεντροειδές του οικοπέδου δεν έχει δικό του
    // υψόμετρο. Ίδια πειθαρχία με το boundary-closure centroid — το 3Δ overlay δειγματοληπτεί το
    // TIN, και κρύβει τον δείκτη όταν ούτε αυτό μπορεί να απαντήσει (βλ. `TopoQaFlag.atZMm`).
    messageKey: 'topography.qa.flag.coverageGap',
    messageParams: { percent: asPercent(fraction) },
  };
}

function interpolatedSupportFlag(fraction: number, measuredInside: number, at: Point2D): TopoQaFlag {
  // Μηδέν μετρημένα σημεία εντός ⇒ `high` ΑΝΕΞΑΡΤΗΤΑ ποσοστού: ολόκληρο το οικόπεδο είναι
  // παρεμβολή από έξω. Αυτή είναι κατά γράμμα η απαίτηση του ADR-720 §5, και μπαίνει ως
  // αναβάθμιση σοβαρότητας αντί για τρίτη σημαία — μία γραμμή στη λίστα, ολόκληρη η εικόνα.
  const severity: TopoQaSeverity =
    measuredInside === 0 || fraction >= INTERPOLATED_HIGH_FRACTION ? 'high' : 'medium';
  return {
    id: 'boundary-coverage:interpolated',
    kind: 'boundary-coverage',
    severity,
    at,
    messageKey: 'topography.qa.flag.interpolatedSupport',
    messageParams: { percent: asPercent(fraction), points: measuredInside },
  };
}

/**
 * Τα ευρήματα κάλυψης για την επιφάνεια πάνω από το οικόπεδο, σοβαρότερο πρώτα.
 *
 * ⚠️ **Χωρίς όριο ο έλεγχος ΣΙΩΠΑ** — δεν υπάρχει ερώτημα «πόσο του οικοπέδου» όταν δεν υπάρχει
 * οικόπεδο. Το ίδιο για κενή επιφάνεια (το `notEnoughData` της αναφοράς το λέει ήδη) και για
 * εκφυλισμένο δακτύλιο (το `check-boundary-closure` το λέει ήδη, και καλύτερα).
 */
export function checkBoundaryElevationCoverage(
  surface: TinSurface,
  boundary: TopoBoundary | null,
  points: readonly TopoPoint[],
): TopoQaFlag[] {
  const ring = boundary?.vertices ?? [];
  if (ring.length < 3 || surface.triangles.length === 0) return [];

  // Ο δακτύλιος κατεβαίνει στο LOCAL πλαίσιο της επιφάνειας ΜΙΑ φορά, και όλα τα εμβαδά/ελέγχοι
  // «μέσα ή έξω» τρέχουν εκεί. Το `topoSurfaceAreas` ήδη μετρά σε LOCAL· ένα shoelace σε ΕΓΣΑ
  // canonical mm (x~4e8, y~4,5e9 ⇒ γινόμενα ~1,8e18) θα έδινε ένα εμβαδόν 2e8 mm² από καταστροφική
  // ακύρωση όρων 10 τάξεις μεγαλύτερων — δηλαδή θα σύγκρινα δύο αριθμούς μετρημένους αλλιώς.
  const ringLocal = lift(ring.map((p) => worldToLocal(p, surface.origin)));
  const plotAreaMm2 = polygonArea(ringLocal);
  if (!(plotAreaMm2 > 0)) return [];

  const coveredMm2 = planAreaInsideMm2(surface, ring);
  const bridgedMm2 = planAreaInsideMm2(bridgesOnly(surface), ring);

  // Ψαλιδισμένο στο [0,1]: η κομμένη επιφάνεια δεν μπορεί να ξεπεράσει το όριο (ADR-718 —
  // «η μεγέθυνση είναι ΑΔΥΝΑΤΗ, όχι απαγορευμένη»), αλλά ένα αρνητικό ποσοστό από συσσωρευμένο
  // float noise θα τυπωνόταν στην οθόνη ως «-0%» και θα διάβαζε ως σφάλμα του ίδιου του ελέγχου.
  const gapFraction = Math.min(1, Math.max(0, (plotAreaMm2 - coveredMm2) / plotAreaMm2));
  const bridgedFraction = Math.min(1, Math.max(0, bridgedMm2 / plotAreaMm2));

  const at = polygon2DAreaCentroid(ring);
  const flags: TopoQaFlag[] = [];
  if (gapFraction >= COVERAGE_GAP_MIN_FRACTION) flags.push(coverageGapFlag(gapFraction, at));
  if (bridgedFraction >= INTERPOLATED_MIN_FRACTION) {
    const measuredInside = measuredPointsInside(points, ringLocal, surface.origin);
    flags.push(interpolatedSupportFlag(bridgedFraction, measuredInside, at));
  }
  return flags;
}
