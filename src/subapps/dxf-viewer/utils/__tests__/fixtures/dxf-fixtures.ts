/**
 * 🏢 SSoT — κατασκευαστής **γενικών** DXF fixtures για τα τεστ μονάδων.
 *
 * ## Γιατί γενικός, και όχι «το αρχείο του Ευόσμου»
 *
 * Ο μηχανισμός μονάδων δεν αφορά **ένα** τοπογραφικό: αφορά κάθε σχέδιο που περνά από τον
 * importer — κατόψεις κτιρίων κοντά στο (0,0), αρχεία σε ίντσες/πόδια, σχέδια χωρίς καθόλου
 * `$EXTMIN/$EXTMAX`, τοπογραφικά εκτός Ελλάδας. Ένα fixture δεμένο σε **μία** αποτύπωση θα
 * αποδείκνυε μόνο ότι «αυτό το αρχείο δουλεύει» — που είναι ακριβώς η ψευδαίσθηση που
 * γεννά ευρετικές φτιαγμένες στα μέτρα ενός δείγματος.
 *
 * Εδώ ζει **ένας** κατασκευαστής με παραμέτρους. Το `47_ergasia.dxf` παράγεται από αυτόν ως
 * **μία περίπτωση** (`makeErgasia47Dxf`) — αποδεικνύοντας στον ίδιο τον κώδικα ότι δεν είναι
 * ειδική περίπτωση αλλά στιγμιότυπο.
 *
 * ⚠️ Το όνομα ΔΕΝ περιέχει `.test.` ⇒ δεν ταιριάζει στο `testMatch` του Jest, άρα δεν
 * εκτελείται ως σουίτα (θα έσκαγε με «must contain at least one test»).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-716-geodetic-unit-identification-dxf-import.md
 */

import type { DxfHeaderData } from '../../dxf-parser-types';
import type { SceneUnits } from '../../scene-units';

export interface Extents {
  readonly min: { readonly x: number; readonly y: number };
  readonly max: { readonly x: number; readonly y: number };
}

export interface MakeDxfOptions {
  /**
   * Κωδικός `$INSUNITS` (0 = unitless, 1 = in, 2 = ft, 4 = mm, 5 = cm, 6 = m).
   * `null` ⇒ η μεταβλητή **λείπει τελείως** από το header — άλλη περίπτωση από το `0`.
   */
  readonly insunits?: number | null;
  /** `$EXTMIN`/`$EXTMAX`. `null` ⇒ δεν γράφονται καθόλου (πολλά αρχεία δεν τα έχουν). */
  readonly extents?: Extents | null;
  /** Κωδικός `$MEASUREMENT` — γράφεται μόνο όταν δοθεί (ADR-716 §4: ΔΕΝ χρησιμοποιείται). */
  readonly measurement?: number | null;
  /**
   * `$DIMSCALE` (group **40**, δεκαδικό). `0` = AutoCAD *annotative* — «η κλίμακα δεν ορίζεται
   * εδώ». `null` ⇒ η μεταβλητή λείπει, που είναι **άλλη δήλωση** από το `0`: ο parser πρέπει να
   * ξεχωρίζει τις τρεις περιπτώσεις (απούσα / ρητό 0 / ρητός αριθμός).
   */
  readonly dimscale?: number | null;
}

/** Ο αντίστοιχος κωδικός `$INSUNITS` για κάθε μονάδα — παράγωγος, όχι μαγικός. */
export const INSUNITS_CODE: Readonly<Record<SceneUnits, number>> = {
  in: 1,
  ft: 2,
  mm: 4,
  cm: 5,
  m: 6,
};

/**
 * Ελάχιστο έγκυρο DXF: header (όσες μεταβλητές ζητήθηκαν) + **μία LINE** στη διαγώνιο των
 * extents, ώστε τα υπολογισμένα bounds να συμφωνούν με τα δηλωμένα. Έτσι κάθε τεστ μετρά
 * **αποτέλεσμα κλιμάκωσης**, όχι παρενέργειες παρσαρίσματος.
 */
export function makeDxf(options: MakeDxfOptions = {}): string {
  const { insunits = 0, extents = null, measurement = null, dimscale = null } = options;
  const header: string[] = ['0', 'SECTION', '2', 'HEADER'];
  if (insunits !== null) header.push('9', '$INSUNITS', '70', String(insunits));
  if (measurement !== null) header.push('9', '$MEASUREMENT', '70', String(measurement));
  if (dimscale !== null) header.push('9', '$DIMSCALE', '40', String(dimscale));
  if (extents) {
    header.push('9', '$EXTMIN', '10', String(extents.min.x), '20', String(extents.min.y));
    header.push('9', '$EXTMAX', '10', String(extents.max.x), '20', String(extents.max.y));
  }
  header.push('0', 'ENDSEC');

  const span = extents ?? { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } };
  return [
    ...header,
    '0', 'SECTION', '2', 'ENTITIES',
    '0', 'LINE', '8', '0',
    '10', String(span.min.x), '20', String(span.min.y),
    '11', String(span.max.x), '21', String(span.max.y),
    '0', 'ENDSEC', '0', 'EOF',
  ].join('\n');
}

/** Extents με δεδομένο πλάτος/ύψος γύρω από μια αφετηρία — «σχέδιο τάδε μεγέθους, εκεί». */
export function extentsOf(
  origin: { x: number; y: number },
  width: number,
  height: number,
): Extents {
  return { min: { ...origin }, max: { x: origin.x + width, y: origin.y + height } };
}

// ---------------------------------------------------------------------------
// ΠΕΡΙΠΤΩΣΗ 1 — το πραγματικό `47_ergasia.dxf` (ΕΓΣΑ87, μέτρα, $INSUNITS = 0)
// ---------------------------------------------------------------------------

/**
 * Ground truth διαβασμένο από το **ίδιο το αρχείο** (όχι από ADR, όχι από αφήγηση):
 *
 *   $INSUNITS    = 0                       ← unitless ⇒ η ευρετική αναλαμβάνει
 *   $MEASUREMENT = 0                       ← «English»/imperial (ΔΕΝ χρησιμοποιείται)
 *   $EXTMIN      = 407565.2907102597 , 4502055.67106188
 *   $EXTMAX      = 408152.0910632098 , 4502543.611061878
 *                  dx = 586.80 m   dy = 487.94 m   διαγώνιος = 763.17
 */
export const ERGASIA_47_EXTENTS: Extents = {
  min: { x: 407565.2907102597, y: 4502055.67106188 },
  max: { x: 408152.0910632098, y: 4502543.611061878 },
};

export const ERGASIA_47_HEADER: DxfHeaderData = {
  insunits: 0,
  measurement: 0,
  dimscale: 1.0,
  dimtxt: 0.5,
  annoScale: 1,
  pdmode: 0,
  pdsize: 0.1,
  ltscale: 1.0,
  extmin: { ...ERGASIA_47_EXTENTS.min },
  extmax: { ...ERGASIA_47_EXTENTS.max },
};

/** Πλάτος/ύψος σε μέτρα, από το αρχείο: 586.80 m × 487.94 m. */
export const ERGASIA_47_WIDTH_M = 586.8003529501;
export const ERGASIA_47_HEIGHT_M = 487.939999998;

/** Το ίδιο αρχείο, παραγόμενο από τον **γενικό** κατασκευαστή — όχι ειδική περίπτωση. */
export function makeErgasia47Dxf(): string {
  return makeDxf({ insunits: 0, measurement: 0, extents: ERGASIA_47_EXTENTS });
}
