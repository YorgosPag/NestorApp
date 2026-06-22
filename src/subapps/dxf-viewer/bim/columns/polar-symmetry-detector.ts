/**
 * ADR-398 §3.14 — **Symmetry auto-complete** detector (pure SSoT).
 *
 * Το «πιο μαγικό»: από τις γωνίες των κολωνών που **υπάρχουν ήδη** σε έναν δακτύλιο, προβλέπει την
 * περιστροφική συμμετρία (n-fold) και επιστρέφει τις θέσεις που **λείπουν** ώστε να συμπληρωθεί.
 *   · Auto-detect (Q3): gcd των γωνιακών αποστάσεων → θεμελιώδης γωνία → fold = 360/gcd·
 *   · Scroll override (Q3): ο χρήστης κυλά μεταξύ {3,4,6,8,12} (μέσω `ColumnPolarStore`).
 *
 * Pure — zero React/DOM/store. Δίνει ΜΟΝΟ γωνίες· οι θέσεις (x,y) υπολογίζονται με `pointOnCircle`
 * (γωνία→σημείο SSoT) ή `computePolarTransforms` (array SSoT) στον caller — ΜΗΔΕΝ νέα polar math εδώ.
 *
 * @see ./polar-disk-snap.ts — `pointOnCircle`-based positions (ίδιος δίσκος/κέντρο)
 * @see ../../systems/cursor/ColumnPolarStore.ts — `foldOverride` (scroll) state
 * @see docs/centralized-systems/reference/adrs/ADR-398-column-placement-snap.md §3.14
 */

/** Άνω όριο «λογικού» αυτόματου fold — πέρα από αυτό θεωρούμε ότι δεν υπάρχει καθαρή συμμετρία. */
const MAX_AUTO_FOLD = 24;
/** Ανοχή (μοίρες) ώστε μια προβλεπόμενη θέση να θεωρηθεί «ήδη κατειλημμένη» από υπάρχουσα κολώνα. */
const OCCUPIED_TOL_DEG = 1;

const normDeg = (d: number): number => ((d % 360) + 360) % 360;

/** Κυκλική απόλυτη γωνιακή διαφορά (μοίρες) στο [0,180]. */
function angularDiff(a: number, b: number): number {
  const d = Math.abs(normDeg(a) - normDeg(b)) % 360;
  return d > 180 ? 360 - d : d;
}

/** Μέγιστος κοινός διαιρέτης (μη-αρνητικοί ακέραιοι). */
function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y > 0) { [x, y] = [y, x % y]; }
  return x;
}

/**
 * Auto fold (Q3): από τις γωνίες (μοίρες) → fold = 360 / gcd(γωνιακών αποστάσεων από την 1η, 360).
 * `null` όταν < 2 κολώνες ή το fold είναι εκτός [2, MAX_AUTO_FOLD] (καμία καθαρή συμμετρία).
 */
function autoFold(anglesDeg: readonly number[]): number | null {
  if (anglesDeg.length < 2) return null;
  const base = anglesDeg[0];
  let g = 360;
  for (const a of anglesDeg) {
    const diff = Math.round(normDeg(a - base));
    if (diff > 0) g = gcd(g, diff);
  }
  if (g <= 0) return null;
  const fold = Math.round(360 / g);
  return fold >= 2 && fold <= MAX_AUTO_FOLD ? fold : null;
}

/** Αποτέλεσμα πρόβλεψης συμμετρίας: το fold + οι ΟΛΕΣ θέσεις + οι ΘΕΣΕΙΣ ΠΟΥ ΛΕΙΠΟΥΝ (ghost). */
export interface RingSymmetry {
  /** n-fold περιστροφική συμμετρία. */
  readonly fold: number;
  /** Όλες οι γωνίες του πλήρους σετ (μοίρες, [0,360), από τη φάση της 1ης υπάρχουσας). */
  readonly allAnglesDeg: readonly number[];
  /** Οι γωνίες που ΛΕΙΠΟΥΝ (ghost — προς συμπλήρωση)· κενό όταν το δαχτυλίδι είναι πλήρες. */
  readonly ghostAnglesDeg: readonly number[];
}

/**
 * Πρόβλεψη n-fold συμμετρίας στον δακτύλιο. `override` (scroll) υπερισχύει του auto-detect.
 * `null` όταν δεν υπάρχει override ΚΑΙ το auto-detect αποτυγχάνει (< 2 κολώνες / καμία καθαρή
 * συμμετρία). Η φάση = γωνία της 1ης υπάρχουσας κολώνας (ή 0 αν δίνεται μόνο override χωρίς κολώνες).
 */
export function detectRingFold(
  existingAnglesDeg: readonly number[],
  override: number | null,
): RingSymmetry | null {
  const fold = override ?? autoFold(existingAnglesDeg);
  if (!fold || fold < 2) return null;
  const base = existingAnglesDeg.length > 0 ? existingAnglesDeg[0] : 0;
  const step = 360 / fold;
  const allAnglesDeg: number[] = [];
  const ghostAnglesDeg: number[] = [];
  for (let k = 0; k < fold; k++) {
    const deg = normDeg(base + k * step);
    allAnglesDeg.push(deg);
    if (!existingAnglesDeg.some((a) => angularDiff(a, deg) <= OCCUPIED_TOL_DEG)) ghostAnglesDeg.push(deg);
  }
  return { fold, allAnglesDeg, ghostAnglesDeg };
}
