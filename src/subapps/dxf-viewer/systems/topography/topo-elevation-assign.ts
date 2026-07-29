/**
 * ADR-731 — «Απόδοση υψομέτρου από την επιφάνεια»: ο **καθαρός** πυρήνας.
 *
 * Μηδέν store, μηδέν side effects, μηδέν νέα μαθηματικά. Η δειγματοληψία είναι του
 * `tin-sampler` (βαρυκεντρική) και ο ορισμός «τριγώνου-γέφυρας» του `topo-qa-topology` — εδώ
 * ζει μόνο η **πολιτική**: ποια σημεία επιτρέπεται να πάρουν υψόμετρο, τι μαθαίνει ο χρήστης
 * πριν πατήσει, και τι γράφεται.
 *
 * ── Ο απαράβατος κανόνας (ADR-720 §5) ───────────────────────────────────────────────────────
 * **ΠΟΤΕ ΑΥΤΟΜΑΤΑ.** Κανείς από τους μεγάλους δεν παρεμβάλλει Ζ στην εισαγωγή· υπάρχει **μόνο**
 * ως ξεχωριστή εντολή χρήστη (Civil 3D: `Points ▸ Edit Points ▸ Elevations from Surface`).
 * Αυτόματη παρεμβολή = **κατασκευή μέτρησης** που μετά **τιμολογεί όγκους εκσκαφής**.
 *
 * ── Τρεις κανόνες που ΔΕΝ έχουν οι μεγάλοι ──────────────────────────────────────────────────
 *
 * 1. 🔴 **Μετρημένο υψόμετρο ΔΕΝ αντικαθίσταται ΠΟΤΕ.** Υποψήφια είναι μόνο τα σημεία που δεν
 *    φέρουν μέτρηση — δισδιάστατα ή ήδη παράγωγα. Ο Civil 3D σε αφήνει να γράψεις πάνω από τη
 *    βολή του τοπογράφου με ένα κλικ και δεν σε ρωτά· εδώ είναι **δομικά αδύνατο**. Το ADR-720
 *    το θεμελιώνει: η μέτρηση είναι το μόνο που δεν ξαναφτιάχνεται. Αν ο χρήστης πράγματι θέλει
 *    να απορρίψει μια βολή, τη σβήνει **ρητά** — δεν την «ενημερώνει» κατά λάθος μαζικά.
 *
 * 2. 🔴 **Το παράγωγο υψόμετρο δεν γίνεται κορυφή του TIN** (`zSource: 'derived'` →
 *    `surfacePointsOf` το αποκλείει). Χωρίς αυτό η επιφάνεια **τρέφεται από τον εαυτό της**:
 *    το σημείο διαβάζει Ζ **από** το TIN και στο επόμενο build το **ορίζει**. Το TIN αποκτά
 *    κορυφές μηδενικής νέας πληροφορίας, φαίνεται τριπλάσια πυκνό, και ο έλεγχος κάλυψης του
 *    ADR-725 μετράει τις εικασίες ως μετρήσεις και **σιωπά για πάντα**. Ο Carlson έχει την ίδια
 *    έννοια («Non-Surface», ρητά για **γωνίες οικοπέδου**) αλλά ως **χειροκίνητο checkbox** που
 *    πρέπει να θυμηθείς· ο Civil 3D δεν σε εμποδίζει καθόλου να προσθέσεις τα παράγωγα σημεία
 *    στην επιφάνεια. Εδώ είναι αυτόματο και **αδύνατο να ξεχαστεί**.
 *
 * 3. 🔴 **Ο χρήστης μαθαίνει ΠΡΙΝ πατήσει.** Το {@link planElevationAssignment} επιστρέφει τι θα
 *    συμβεί — πόσα θα πάρουν υψόμετρο, πόσα είναι **εκτός** επιφάνειας, και πόσα πατούν σε
 *    **τρίγωνο-γέφυρα**, δηλαδή θα πάρουν **παρεμβολή μιας παρεμβολής**. Καμία από τις τρεις
 *    εφαρμογές που ερευνήθηκαν δεν το λέει αυτό. Ο έλεγχος **προειδοποιεί, δεν αρνείται**: ίδια
 *    πειθαρχία με τη μηχανή QA του ADR-725 — αναφέρει, και ο μηχανικός πιστοποιεί.
 *
 * ── Εκτός επιφάνειας ⇒ ΜΕΝΕΙ ΔΙΣΔΙΑΣΤΑΤΟ, ΠΟΤΕ 0 ───────────────────────────────────────────
 * Το `zAtMm` επιστρέφει `null` και έξω από τα bounds και έξω από κάθε τρίγωνο, οπότε το «ποτέ 0»
 * δεν χρειάζεται φρουρό εδώ — χρειάζεται μόνο να **μη μεταφραστεί** το `null` σε αριθμό. Δεν
 * μεταφράζεται: το σημείο απλώς δεν μπαίνει στις αναθέσεις, και ο χρήστης το βλέπει στο πλάνο.
 *
 * @see ./tin-sampler — `zAtMm` (βαρυκεντρική δειγματοληψία· ΜΗΝ γράψεις δεύτερο δειγματολήπτη)
 * @see ./qa/topo-qa-topology — `bridgingTrianglesOnly` (ο ΕΝΑΣ ορισμός του «γέφυρα»)
 * @see ./topo-point-elevation — `isMeasuredElevation` / `surfacePointsOf` (ο αποκλεισμός)
 * @see ../../core/commands/entity-commands/AssignTopoElevationCommand — η undoable γραφή
 * @see docs/centralized-systems/reference/adrs/ADR-731-elevation-assignment-from-surface.md
 */

import type { TinSurface, TopoPoint } from './topo-types';
import { createTinSampler, getTinSampler } from './tin-sampler';
import { bridgingTrianglesOnly } from './qa/topo-qa-topology';
import { isMeasuredElevation } from './topo-point-elevation';

/** Ένα σημείο και το υψόμετρο που θα του αποδοθεί (WORLD canonical mm). */
export interface ElevationAssignment {
  readonly pointIndex: number;
  readonly zMm: number;
  /**
   * Το υψόμετρο προέκυψε από **τρίγωνο-γέφυρα** — παρεμβολή μιας παρεμβολής. Δεν εμποδίζει την
   * ανάθεση· είναι το γεγονός που ο χρήστης δικαιούται να ξέρει πριν την εγκρίνει.
   */
  readonly overBridge: boolean;
}

/** Τι θα συμβεί αν εκτελεστεί η εντολή — υπολογισμένο **πριν**, ώστε να μη γίνει έκπληξη. */
export interface ElevationAssignmentPlan {
  /** Οι αναθέσεις που θα γραφτούν, σε σειρά δείκτη. Κενό ⇒ η εντολή δεν έχει τι να κάνει. */
  readonly assignments: readonly ElevationAssignment[];
  /** Υποψήφια που **έμειναν δισδιάστατα**: το `zAtMm` δεν είχε απάντηση εκεί. */
  readonly outsideSurfaceCount: number;
  /** Υποψήφια που **απορρίφθηκαν γιατί φέρουν μέτρηση** — ποτέ δεν αντικαθίστανται. */
  readonly measuredSkippedCount: number;
  /** Πόσες από τις {@link assignments} πατούν σε τρίγωνο-γέφυρα. Υποσύνολο, όχι άθροισμα. */
  readonly overBridgeCount: number;
}

/** Το κενό πλάνο — μία φορά γραμμένο, ώστε οι τρεις πρόωρες έξοδοι να μη διαφωνήσουν. */
const EMPTY_PLAN: ElevationAssignmentPlan = {
  assignments: [],
  outsideSurfaceCount: 0,
  measuredSkippedCount: 0,
  overBridgeCount: 0,
};

/**
 * Είναι αυτό το σημείο υποψήφιο για απόδοση υψομέτρου;
 *
 * Δισδιάστατο **ή ήδη παράγωγο**. Το δεύτερο σκόπιμα: όταν η επιφάνεια αλλάξει (νέα σημεία,
 * νέες γραμμές ασυνέχειας), ένα παλιό παράγωγο υψόμετρο είναι **μπαγιάτικο** και η επανάληψη
 * της εντολής πρέπει να το ανανεώνει. Μετρημένο υψόμετρο δεν είναι ποτέ υποψήφιο.
 */
export function isElevationAssignable(point: TopoPoint): boolean {
  return !isMeasuredElevation(point);
}

/**
 * Τι θα γίνει, χωρίς να γίνει. Καθαρό — καμία γραφή, καμία ανάγνωση store.
 *
 * `candidateIndices` = τι διάλεξε ο χρήστης. Δείκτες εκτός ορίων αγνοούνται σιωπηλά (ο πίνακας
 * σημείων μπορεί να έχει αλλάξει ανάμεσα σε επιλογή και εκτέλεση — μια επιλογή που παλιώνει δεν
 * είναι λόγος να σκάσει η εντολή).
 */
export function planElevationAssignment(
  points: readonly TopoPoint[],
  candidateIndices: Iterable<number>,
  surface: TinSurface,
): ElevationAssignmentPlan {
  if (surface.triangles.length === 0) return EMPTY_PLAN;
  const sampler = getTinSampler(surface);
  const bridgeSampler = createTinSampler(bridgingTrianglesOnly(surface));

  const assignments: ElevationAssignment[] = [];
  let outsideSurfaceCount = 0;
  let measuredSkippedCount = 0;
  let overBridgeCount = 0;

  for (const pointIndex of dedupeSorted(candidateIndices, points.length)) {
    const point = points[pointIndex]!;
    if (!isElevationAssignable(point)) { measuredSkippedCount++; continue; }
    const zMm = sampler.zAtMm(point.x, point.y);
    if (zMm === null) { outsideSurfaceCount++; continue; }
    if (point.z === zMm && point.zSource === 'derived') continue; // idempotent: ήδη αυτό ακριβώς
    const overBridge = bridgeSampler.zAtMm(point.x, point.y) !== null;
    if (overBridge) overBridgeCount++;
    assignments.push({ pointIndex, zMm, overBridge });
  }

  return { assignments, outsideSurfaceCount, measuredSkippedCount, overBridgeCount };
}

/**
 * Τα σημεία με τις αναθέσεις εφαρμοσμένες. **Δεν μεταλλάσσει** την είσοδο, και επιστρέφει τον
 * **ΑΡΧΙΚΟ** πίνακα σε κενές αναθέσεις — σήμα no-op που ο καλών ανιχνεύει με ταυτότητα αναφοράς,
 * ώστε να μη γεννηθεί κενή εγγραφή στο ιστορικό (idempotency, N.7.2 #3· ίδια σύμβαση με το
 * `moveSurveyPoint`).
 */
export function applyElevationAssignment(
  points: readonly TopoPoint[],
  assignments: readonly ElevationAssignment[],
): readonly TopoPoint[] {
  if (assignments.length === 0) return points;
  const byIndex = new Map(assignments.map((a) => [a.pointIndex, a.zMm]));
  return points.map((point, index) => {
    const zMm = byIndex.get(index);
    return zMm === undefined ? point : { ...point, z: zMm, zSource: 'derived' as const };
  });
}

/**
 * Τα σημεία με **κάθε παράγωγο υψόμετρο αφαιρεμένο** — επιστροφή στην κατάσταση «όπως ήρθε από
 * την αποτύπωση». Το αντίστροφο της απόδοσης σε επίπεδο **δεδομένων**, όχι ιστορικού: το undo
 * αναιρεί την τελευταία εντολή, αυτό καθαρίζει ό,τι σωρεύτηκε σε πολλές συνεδρίες.
 *
 * Ο Trimble Business Center έχει ρητά το ίδιο ζευγάρι («**strip** elevations» δίπλα στο «elevate
 * to surface»): μια πράξη που κατασκευάζει δεδομένα οφείλει να έχει και τη δική της γόμα, αλλιώς
 * ο χρήστης καθαρίζει με το χέρι και ξεχνά ένα.
 *
 * Ίδια σύμβαση no-op: επιστρέφει τον ΑΡΧΙΚΟ πίνακα όταν δεν υπάρχει τίποτα παράγωγο.
 */
export function clearDerivedElevations(points: readonly TopoPoint[]): readonly TopoPoint[] {
  if (!points.some((p) => p.zSource === 'derived')) return points;
  return points.map((point) => {
    if (point.zSource !== 'derived') return point;
    const { z: _z, zSource: _zSource, ...planimetric } = point;
    return planimetric;
  });
}

/** Δείκτες εντός ορίων, χωρίς διπλότυπα, σε αύξουσα σειρά — ώστε το πλάνο να είναι ντετερμινιστικό. */
function dedupeSorted(indices: Iterable<number>, length: number): number[] {
  const unique = new Set<number>();
  for (const index of indices) {
    if (Number.isInteger(index) && index >= 0 && index < length) unique.add(index);
  }
  return [...unique].sort((a, b) => a - b);
}
