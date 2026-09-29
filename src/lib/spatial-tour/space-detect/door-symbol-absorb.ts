/**
 * @fileoverview **ΤΟ ΣΥΜΒΟΛΟ ΤΗΣ ΠΟΡΤΑΣ ΔΕΝ ΟΡΙΖΕΙ ΧΩΡΟ** — απορρόφηση τόξου + φύλλου από το περίγραμμα ενός ανιχνευμένου χώρου
 * (ADR-884 §4.14 Γ3γ-2β · «Σύμβολο πόρτας στο όριο»). Καθαρό, χωρίς μονάδες (ο καλών δίνει τα όρια στις μονάδες του δακτυλίου).
 * @related `space-detect.ts` (`outlineOf`: DP → **εδώ** → ορθογώνια έλξη) · `lib/geometry/orthogonal-snap.ts` (`axisDeviation`)
 * @module lib/spatial-tour/space-detect/door-symbol-absorb
 *
 * 🏆 **Όπως οι μεγάλοι**: στο Revit η πόρτα **δεν** είναι room-bounding — το όριο του χώρου συνεχίζει πάνω στην παρειά του τοίχου
 *   σαν να μην είχε κοπεί· στην αναγνώριση κατόψεων (CubiCasa, Macé κ.ά.) η περιοχή που σαρώνει η πόρτα **ανήκει στο δωμάτιο**.
 *   Στην εικόνα όμως τόξο και φύλλο είναι μελάνι ίδιου πάχους με τις γραμμές των τοίχων ⇒ το περίγραμμα «δαγκώνεται» από το
 *   τόξο και τυλίγεται γύρω από το φύλλο (μετρημένο στην πραγματική κάτοψη: εγκοπή 0,5 × 0,1 m, ακμές 20°–63°).
 * 🔑 **Γιατί στο περίγραμμα και όχι πρότυπο στην εικόνα**: κάθε σχεδιαστής ζωγραφίζει το τόξο αλλιώς (μετρήθηκε τόξο που ΔΕΝ είναι
 *   κύκλος με κέντρο τον μεντεσέ) — ένα πρότυπο θα ήταν εύθραυστο. Το σταθερό γνώρισμα σε κάθε κάτοψη: οι **τοίχοι είναι ευθείες
 *   στους άξονες**, το σύμβολο της πόρτας είναι το **μόνο λοξό/καμπύλο** κομμάτι, και απλώνεται **το πολύ ένα πλάτος πόρτας**.
 * 🔑 **Ο κανόνας**: ανάμεσα σε δύο ακμές-«τοίχους» (σε άξονα, ≥ `anchorMin`) μια αλυσίδα με **λοξή** ακμή αντικαθίσταται από τη
 *   **γωνία** των δύο τοίχων (κάθετοι) ή από τη **συνέχεια** του τοίχου (ίδια φορά, μετατόπιση ≤ `revealMax`) — αν όλη η αλυσίδα
 *   μένει μέσα σε `reach` (πλάτος πόρτας + παρειά). Πολλές δυνατές ⇒ αυτή με τις **περισσότερες** λοξές ακμές, μετά η **μακρύτερη**.
 * 🔒 **Φύλακες — το πραγματικό σχήμα μένει**: (1) χωρίς λοξή ακμή τίποτα (κολόνες, κόγχες, Γ-σχήματα είναι ορθογώνια) · (2) λοξή
 *   ακμή μακρύτερη από `reach` = λοξός **τοίχος** (σαλόνι-έρκερ) ⇒ τίποτα · (3) τοίχος που μπαίνει **μέσα** στον χώρο (παραστάδα,
 *   μεντεσές) πριν την πρώτη ή μετά την τελευταία λοξή ακμή ⇒ η αλυσίδα σταματά πριν από αυτόν · (4) αυτοτομή ή μεταβολή εμβαδού
 *   > `reach²` ⇒ τίποτα. Και πάντα **πρόταση** — ο άνθρωπος εγκρίνει (Δ8.1).
 */

import { axisDeviation } from '@/lib/geometry/orthogonal-snap';
import {
  distanceToRing, distanceToSegment, intersectLines, isPolygonSelfIntersecting, pointInPolygon, polygonArea, type PlanarPoint,
} from '@/lib/geometry/planar-polygon';

/** Τα όρια, στις μονάδες του δακτυλίου. */
export interface DoorSymbolLimits {
  /** Κυρίαρχος άξονας της κάτοψης (rad) — `dominantAxis`. */
  readonly axisRad: number;
  /** Απόκλιση (rad) μέχρι την οποία μια ακμή θεωρείται «σε άξονα» — η ίδια με την ορθογώνια έλξη. */
  readonly toleranceRad: number;
  /**
   * Θόρυβος θέσης κορυφής (η ανοχή του Douglas–Peucker): σε **κοντή** ακμή η γωνία δεν μετριέται καλύτερα από `atan(noise/len)`
   * — μετρήθηκε κάτω παρειά λεπτού τοίχου 13 cm στις 16°, ενώ είναι σε άξονα.
   */
  readonly noise: number;
  /** Ελάχιστο μήκος ακμής-τοίχου (άγκυρας). */
  readonly anchorMin: number;
  /** Πόσο μακριά απλώνεται ένα σύμβολο πόρτας: πλάτος πόρτας + βάθος παρειάς. */
  readonly reach: number;
  /** Μέγιστη μετατόπιση δύο παράλληλων τοίχων εκατέρωθεν ενός ανοίγματος. */
  readonly revealMax: number;
}

interface Edge {
  readonly a: PlanarPoint;
  readonly b: PlanarPoint;
  readonly len: number;
  readonly dir: PlanarPoint;
  /** Σε άξονα με την ανοχή της ορθογώνιας έλξης — ό,τι ΔΕΝ είναι, μετρά ως «λοξό» (τόξο, άκρο φύλλου). */
  readonly onAxis: boolean;
  /** Τοίχος-άγκυρα: μακρύς ΚΑΙ σε άξονα με τη ΣΤΕΝΗ ανοχή. */
  readonly anchor: boolean;
}

interface Candidate {
  readonly ring: PlanarPoint[];
  readonly offAxis: number;
  readonly span: number;
}

const COS_45 = Math.SQRT1_2;
/**
 * Ελάχιστες λοξές ακμές σε σύμβολο πόρτας: το τόξο (και το άκρο του φύλλου) δίνουν **πάντα** ≥ 2 μετά το DP· μία μόνη λοξή
 * ακμή ανάμεσα σε δύο τοίχους είναι **λοξός τοίχος** (έρκερ, λοξοτμημένη γωνία) — μετρήθηκε: με πόρτα 2 m το έρκερ «ίσιωνε».
 */
const MIN_SYMBOL_OFF_AXIS = 2;
/**
 * Στενή ανοχή (rad) για **άγκυρα**: οι τοίχοι της πραγματικής κάτοψης μετρήθηκαν ≤ 3° από τον άξονα, ενώ η ακραία ακμή ενός τόξου
 * μετά το DP απέχει ≥ ~10° (μισή η γωνία ενός τμήματος). Με την ανοχή της έλξης (12°) η ακραία ακμή καμπύλου τοίχου ακτίνας 2 m
 * γινόταν «τοίχος» και η καμπύλη ίσιωνε (άγκυρα-test).
 */
const ANCHOR_TOLERANCE_RAD = (6 * Math.PI) / 180;

function edgeOf(a: PlanarPoint, b: PlanarPoint, lim: DoorSymbolLimits): Edge {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const dir = len === 0 ? { x: 0, y: 0 } : { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
  const noise = Math.atan2(lim.noise, len);
  const deviation = len > 0 ? axisDeviation(Math.atan2(dir.y, dir.x), lim.axisRad) : Number.POSITIVE_INFINITY;
  const onAxis = deviation <= Math.max(lim.toleranceRad, noise);
  const anchor = len >= lim.anchorMin && deviation <= Math.max(ANCHOR_TOLERANCE_RAD, noise);
  return { a, b, len, dir, onAxis, anchor };
}

const dot = (p: PlanarPoint, q: PlanarPoint): number => p.x * q.x + p.y * q.y;
const minus = (p: PlanarPoint, q: PlanarPoint): PlanarPoint => ({ x: p.x - q.x, y: p.y - q.y });

/** Ο δακτύλιος μετά την αντικατάσταση + ο «καθαρός» δρόμος (τμήμα· σημείο για γωνία) που πήρε τη θέση της αλυσίδας. */
interface Clean {
  readonly ring: PlanarPoint[];
  readonly from: PlanarPoint;
  readonly to: PlanarPoint;
}

/**
 * Ο «καθαρός» δρόμος από τον τοίχο A στον τοίχο B (ο δακτύλιος είναι στραμμένος ώστε A = `rot[0]→rot[1]`, B = `rot[k]→rot[k+1]`):
 * κάθετοι ⇒ η γωνία τους · ίδια φορά και ≤ `revealMax` ⇒ η συνέχεια · αλλιώς `null`.
 */
function cleanRing(rot: readonly PlanarPoint[], k: number, A: Edge, B: Edge, lim: DoorSymbolLimits): Clean | null {
  const along = dot(A.dir, B.dir);
  if (Math.abs(along) < COS_45) {
    const corner = intersectLines(A.a, A.dir, B.a, B.dir);
    // Ο τοίχος μπορεί να «περισσεύει» μέσα στο άνοιγμα ως μία παρειά (κόβεται στη γωνία) — όχι περισσότερο.
    const overshoot = lim.revealMax;
    if (corner === null || dot(minus(corner, A.b), A.dir) < -overshoot || dot(minus(B.a, corner), B.dir) < -overshoot) return null;
    return { ring: [rot[0], corner, ...rot.slice(k + 1)], from: corner, to: corner };
  }
  if (along <= 0 || k < 3) return null;
  // Άνοιγμα πόρτας: μπροστά στη φορά, το πολύ `reach` πλάτος (αλλιώς έρκερ), το πολύ μία παρειά μετατόπιση.
  const gap = minus(B.a, A.b);
  const width = dot(gap, A.dir);
  if (width <= 0 || width > lim.reach || Math.abs(gap.x * A.dir.y - gap.y * A.dir.x) > lim.revealMax) return null;
  return { ring: [rot[0], rot[1], ...rot.slice(k)], from: A.b, to: B.a };
}

/** Η αλυσίδα `rot[1..k]` χωρά μέσα στο `reach` του καθαρού δρόμου; */
function withinReach(rot: readonly PlanarPoint[], k: number, clean: Clean, lim: DoorSymbolLimits): boolean {
  for (let j = 1; j <= k; j++) if (distanceToSegment(rot[j], clean.from, clean.to) > lim.reach) return false;
  return true;
}

/**
 * **Π σε άξονες που μπαίνει ΜΕΣΑ** στον χώρο (παραστάδα, κολόνα, κοντός τοίχος): τρεις διαδοχικές ακμές σε άξονα, κάθετες ανά
 * δύο, η πρώτη και η τρίτη αντίρροπες, με τη μεσαία μέσα στον νέο δακτύλιο. Είναι **τοίχος** — δεν απορροφάται. Το φύλλο της
 * πόρτας δεν σχηματίζει ποτέ Π (το ένα του άκρο είναι το λοξό τόξο) — γι' αυτό ο φύλακας είναι σχήμα και όχι «ακμή μέσα».
 */
function swallowsInwardWall(edges: readonly Edge[], clean: readonly PlanarPoint[], lim: DoorSymbolLimits): boolean {
  const solid = (e: Edge) => e.onAxis && e.len >= lim.anchorMin / 2;
  for (let i = 0; i + 2 < edges.length; i++) {
    const [e1, e2, e3] = [edges[i], edges[i + 1], edges[i + 2]];
    if (!solid(e1) || !solid(e2) || !solid(e3)) continue;
    if (Math.abs(dot(e1.dir, e2.dir)) >= COS_45 || Math.abs(dot(e2.dir, e3.dir)) >= COS_45 || dot(e1.dir, e3.dir) >= 0) continue;
    const mid = { x: (e2.a.x + e2.b.x) / 2, y: (e2.a.y + e2.b.y) / 2 };
    if (pointInPolygon(mid, clean) && distanceToRing(mid, clean) > lim.anchorMin / 4) return true;
  }
  return false;
}

/** Μία υποψήφια αντικατάσταση για τους τοίχους A = e₀ και B = e_k του στραμμένου δακτυλίου — ή `null`. */
function candidateAt(rot: readonly PlanarPoint[], k: number, lim: DoorSymbolLimits): Candidate | null {
  const n = rot.length;
  const edge = (i: number) => edgeOf(rot[i % n], rot[(i + 1) % n], lim);
  const A = edge(0);
  const B = edge(k);
  const chain = Array.from({ length: k - 1 }, (_, j) => edge(j + 1));
  const offAxis = chain.filter((e) => !e.onAxis && e.len > 0).length;
  if (offAxis < MIN_SYMBOL_OFF_AXIS || chain.some((e) => e.len > lim.reach)) return null;
  const clean = cleanRing(rot, k, A, B, lim);
  if (clean === null || clean.ring.length < 3 || !withinReach(rot, k, clean, lim)) return null;
  if (swallowsInwardWall([A, ...chain, B], clean.ring, lim) || isPolygonSelfIntersecting(clean.ring)) return null;
  if (Math.abs(polygonArea(clean.ring) - polygonArea(rot)) > lim.reach * lim.reach) return null;
  return { ring: clean.ring, offAxis, span: k };
}

const better = (c: Candidate, best: Candidate | null): boolean =>
  best === null || c.offAxis > best.offAxis || (c.offAxis === best.offAxis && c.span > best.span);

/** Η καλύτερη απορρόφηση σε όλο τον δακτύλιο — ή `null` όταν δεν μένει σύμβολο. */
function absorbOnce(ring: readonly PlanarPoint[], lim: DoorSymbolLimits): PlanarPoint[] | null {
  const n = ring.length;
  let best: Candidate | null = null;
  for (let a = 0; a < n; a++) {
    const rot = [...ring.slice(a), ...ring.slice(0, a)];
    if (!edgeOf(rot[0], rot[1], lim).anchor) continue;
    for (let k = 2; k <= n - 2; k++) {
      if (Math.hypot(rot[k].x - rot[1].x, rot[k].y - rot[1].y) > 2 * lim.reach) break;
      if (!edgeOf(rot[k], rot[(k + 1) % n], lim).anchor) continue;
      const c = candidateAt(rot, k, lim);
      if (c !== null && better(c, best)) best = c;
    }
  }
  return best?.ring ?? null;
}

/**
 * Απορροφά κάθε σύμβολο πόρτας από κλειστό δακτύλιο (χωρίς επανάληψη της πρώτης κορυφής). Ιδεμποτές: δακτύλιος χωρίς σύμβολο
 * επιστρέφεται **ίδιος** (ίδια αναφορά).
 */
export function absorbDoorSymbols(ring: readonly PlanarPoint[], lim: DoorSymbolLimits): readonly PlanarPoint[] {
  let current: readonly PlanarPoint[] = ring;
  for (let guard = ring.length; guard > 0; guard--) {
    const next = absorbOnce(current, lim);
    if (next === null) break;
    current = next;
  }
  return current;
}
