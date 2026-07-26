/**
 * ADR-713 — Στεγάνωση θαμμένης ζώνης: τι φοράει το τμήμα που είναι μέσα στο χώμα.
 *
 * Το ADR-449 απαντά «τι φοράει η **εκτεθειμένη** όψη» (σοβάς/θερμοπρόσοψη). Εδώ ζει η
 * αδελφή ερώτηση για ό,τι βρίσκεται **κάτω από τη στάθμη τελειωμένου εδάφους**: δεν
 * επενδύεται με τούβλο, δεν σοβατίζεται — **στεγανώνεται**, και η στεγάνωση είναι
 * πραγματική εργασία που επιμετράται σε m² με δικό της άρθρο.
 *
 * ### Γιατί ΔΕΝ είναι δεύτερος μηχανισμός (N.0.2)
 * Η επάλειψη είναι, δομικά, ό,τι και ο σοβάς: «ποιες παρειές, πόσο εκτεθειμένες, τι υλικό»
 * → m². Άρα **δεν** γράφεται νέα γεωμετρία ή νέο BOQ pipeline: φτιάχνουμε ένα
 * {@link StructuralFinishSpec} με το υλικό στεγάνωσης και το περνάμε στον ΥΠΑΡΧΟΝΤΑ
 * resolver (`computeColumnFinishFaces`). Το BOQ του ADR-449 ομαδοποιεί **ανά υλικό** και
 * λύνει το άρθρο μέσω `resolveMaterialAtoeMapping` → η γραμμή στεγάνωσης εμφανίζεται
 * **μόνη της**, σωστά τιμολογημένη. Μηδέν νέος μηχανισμός, μηδέν διπλότυπο.
 *
 * ### Γιατί μηδενικού πάχους (και γιατί αυτό είναι σωστό)
 * Η επάλειψη είναι βαφή, όχι στρώση: εφαρμόζεται **πάνω** στην παρειά του σκυροδέματος,
 * δεν την παχαίνει. Γι' αυτό στο 3Δ αποδίδεται ως **υλικό όψης** του ίδιου του πυρήνα
 * (material group της θαμμένης υπο-όψης), όχι ως additive δέρμα όπως ο σοβάς. Το
 * {@link BURIED_COATING_NOMINAL_THICKNESS_MM} υπάρχει **μόνο** για να περάσει το
 * `isFinishActive` gate του resolver — δεν συμμετέχει σε κανέναν υπολογισμό εμβαδού
 * (εμβαδό = μήκος × ύψος).
 *
 * ### Ενεργό by default (απόφαση Giorgio 2026-07-26)
 * «Ό,τι θάβεται, στεγανώνεται» — ελληνική πρακτική. Απόν spec → ΕΝΕΡΓΟ με ασφαλτική
 * επάλειψη. Ο μηχανικός το κλείνει ρητά (`enabled: false`), οπότε η θαμμένη ζώνη δείχνει
 * γυμνό σκυρόδεμα — που παραμένει σωστό (και εξακολουθεί να ΜΗΝ παίρνει την επένδυση όψης).
 *
 * @see ./structural-finish-types — ο αδελφός μηχανισμός (εκτεθειμένη όψη)
 * @see ../geometry/column-exposure-zone — πού κόβεται η ζώνη
 * @see ../config/material-to-atoe-mapping — τα τρία άρθρα m²
 * @see docs/centralized-systems/reference/adrs/ADR-713-buried-column-segment-exposure-zone.md
 */

import { buriedFaceKey, type FaceAppearanceMap } from '../types/face-appearance-types';
import type { StructuralFinishSpec } from './structural-finish-types';

/** Ασφαλτική επάλειψη ψυχρής εφαρμογής — το συνηθέστερο, ΑΤΟΕ OIK-10.20. Το default. */
export const WATERPROOF_BITUMEN_MATERIAL = 'mat-waterproof-bitumen';
/** Τσιμεντοειδές στεγανωτικό κονίαμα (άκαμπτο) — ΑΤΟΕ OIK-10.21. */
export const WATERPROOF_CEMENTITIOUS_MATERIAL = 'mat-waterproof-cementitious';
/** Ασφαλτόπανο / ασφαλτική μεμβράνη — ΑΤΟΕ OIK-10.22. */
export const WATERPROOF_MEMBRANE_MATERIAL = 'mat-waterproof-membrane';
/** Ελαστομερές ασφαλτικό γαλάκτωμα δύο συστατικών — ΑΤΟΕ OIK-10.23. */
export const WATERPROOF_BITUMEN_EMULSION_MATERIAL = 'mat-waterproof-bitumen-emulsion';
/** Ελαστικό τσιμεντοειδές δύο συστατικών (γεφυρώνει ρωγμές) — ΑΤΟΕ OIK-10.24. */
export const WATERPROOF_CEMENTITIOUS_FLEX_MATERIAL = 'mat-waterproof-cementitious-flex';
/** Κρυσταλλικό στεγανωτικό επάλειψης (διεισδυτικό) — ΑΤΟΕ OIK-10.25. */
export const WATERPROOF_CRYSTALLINE_MATERIAL = 'mat-waterproof-crystalline';
/** Πολυουρεθανική στεγανωτική επάλειψη (υγρή μεμβράνη) — ΑΤΟΕ OIK-10.26. */
export const WATERPROOF_POLYURETHANE_MATERIAL = 'mat-waterproof-polyurethane';
/** Μπεντονιτική μεμβράνη (blind-side, έναντι εδάφους) — ΑΤΟΕ OIK-10.27. */
export const WATERPROOF_BENTONITE_MATERIAL = 'mat-waterproof-bentonite';

/**
 * Ο τρόπος εφαρμογής — οδηγεί την ΟΜΑΔΟΠΟΙΗΣΗ στο UI, γιατί ο μηχανικός δεν διαλέγει από 8
 * ισότιμα ονόματα: πρώτα αποφασίζει «επάλειψη ή μεμβράνη;» και μετά υλικό. Είναι επίσης
 * πραγματική τεχνική διάκριση — η επάλειψη είναι **βαφή** (μηδενικό πάχος, βλ. §Γιατί
 * μηδενικού πάχους), η μεμβράνη προκατασκευασμένο **φύλλο** που κολλιέται/θερμοκολλιέται.
 */
export type BuriedWaterproofingKind = 'coating' | 'membrane';

/** Μία επιλογή στεγάνωσης θαμμένης ζώνης. Η ετικέτα βγαίνει από `constructionMaterialLabelKey`. */
export interface BuriedWaterproofingOption {
  readonly id: string;
  readonly kind: BuriedWaterproofingKind;
}

/**
 * **Ο ΚΑΤΑΛΟΓΟΣ** στεγάνωσης θαμμένων επιφανειών, σε σειρά εμφάνισης στο UI (συχνότερο πρώτα).
 *
 * ### Τι μπαίνει εδώ και τι ΟΧΙ (Giorgio 2026-07-26: «βρες εσύ τα υλικά»)
 * Μπαίνει ό,τι είναι **επιφανειακή στεγάνωση κατακόρυφης παρειάς σε επαφή με χώμα**, δηλαδή
 * επιμετράται σε **m² όψης**. Δεν μπαίνουν:
 *   - **Στεγανωτικά μάζας σκυροδέματος** (πρόσμικτα): δεν είναι επίστρωση όψης — επιμετρούνται
 *     ανά **m³ σκυροδέματος**. Θα έμπαιναν σε λάθος μονάδα και θα διπλομετρούσαν με το ADR-712.
 *   - **Αποστραγγιστική μεμβράνη HDPE («αυγουλιέρα»)**: είναι στρώση **προστασίας/αποστράγγισης**
 *     ΠΑΝΩ από τη στεγάνωση, όχι η ίδια η στεγάνωση. Ως εναλλακτική εδώ θα μοντελοποιούσε λάθος
 *     πραγματικότητα (η παρειά θα έμενε αστεγάνωτη). Ανήκει σε **πολυστρωματικό** σύστημα —
 *     δουλειά του additive skin (ADR-449), όχι του υλικού όψης.
 *
 * Οι τεχνικές πατούν στο ελληνικό τιμολόγιο: ΝΕΤ ΟΙΚ **79.03** «Επάλειψη με ελαστομερές
 * ασφαλτικό διάλυμα», **79.08** «Στεγανωτικές επιστρώσεις με τσιμεντοειδή υλικά», **79.21**
 * «Επάλειψη επιφανειών σκυροδέματος». ⚠️ Οι κωδικοί `OIK-<ομάδα>.<α/α>` του
 * `material-to-atoe-mapping.ts` είναι **εσωτερική σύμβαση του έργου**, όχι αριθμοί ΝΕΤ ΟΙΚ —
 * μην τους συγχέεις (η σύμβαση προϋπήρχε σε ΟΛΑ τα υλικά· δεν την αλλάζουμε εδώ).
 *
 * ⚠️ **Κάθε νέα εγγραφή χρειάζεται ΤΕΣΣΕΡΑ πράγματα**, αλλιώς το υλικό είναι μισό (αόρατο,
 * ανώνυμο ή ατιμολόγητο): (1) εδώ, (2) χρώμα στο `material-catalog-defs.ts`, (3) άρθρο στο
 * `material-to-atoe-mapping.ts`, (4) ετικέτα `constructionMaterials.<id>` σε **el ΚΑΙ en**.
 * Το `buried-waterproofing-catalog.test.ts` το επιβάλλει — δεν βασιζόμαστε στη μνήμη κανενός.
 */
export const BURIED_WATERPROOFING_CATALOG: readonly BuriedWaterproofingOption[] = [
  { id: WATERPROOF_BITUMEN_MATERIAL,           kind: 'coating' },
  { id: WATERPROOF_BITUMEN_EMULSION_MATERIAL,  kind: 'coating' },
  { id: WATERPROOF_CEMENTITIOUS_MATERIAL,      kind: 'coating' },
  { id: WATERPROOF_CEMENTITIOUS_FLEX_MATERIAL, kind: 'coating' },
  { id: WATERPROOF_CRYSTALLINE_MATERIAL,       kind: 'coating' },
  { id: WATERPROOF_POLYURETHANE_MATERIAL,      kind: 'coating' },
  { id: WATERPROOF_MEMBRANE_MATERIAL,          kind: 'membrane' },
  { id: WATERPROOF_BENTONITE_MATERIAL,         kind: 'membrane' },
] as const;

/** Τα ids του καταλόγου, σε σειρά UI. Παράγωγο — ΜΗΝ το ξαναγράψεις με το χέρι. */
export const BURIED_WATERPROOFING_MATERIALS: readonly string[] =
  BURIED_WATERPROOFING_CATALOG.map((o) => o.id);

/** Οι επιλογές μιας κατηγορίας εφαρμογής (UI grouping: «Επαλειφόμενα» / «Μεμβράνες»). */
export function buriedWaterproofingByKind(kind: BuriedWaterproofingKind): readonly string[] {
  return BURIED_WATERPROOFING_CATALOG.filter((o) => o.kind === kind).map((o) => o.id);
}

/** Το υλικό που παίρνει η θαμμένη ζώνη όταν ο μηχανικός δεν έχει επιλέξει άλλο. */
export const DEFAULT_BURIED_WATERPROOFING_MATERIAL = WATERPROOF_BITUMEN_MATERIAL;

/**
 * mm — ονομαστικό πάχος επάλειψης. **Δεν** παχαίνει γεωμετρία και **δεν** μπαίνει σε
 * κανένα εμβαδό· υπάρχει μόνο ώστε το κοινό `isFinishActive` gate να δεχθεί το spec.
 */
export const BURIED_COATING_NOMINAL_THICKNESS_MM = 1;

/**
 * Per-element πρόθεση στεγάνωσης (stored σε `ColumnParams.buriedWaterproofing`).
 * **Απόν = ενεργό με το default υλικό** — γι' αυτό όλα τα πεδία είναι optional: ένα
 * υπάρχον έργο χωρίς το πεδίο παίρνει σωστή συμπεριφορά χωρίς migration.
 */
export interface BuriedWaterproofingSpec {
  /** Master on/off. Απόν → `true` (αυτόματο). */
  readonly enabled?: boolean;
  /** Υλικό στεγάνωσης. Απόν → {@link DEFAULT_BURIED_WATERPROOFING_MATERIAL}. */
  readonly materialId?: string;
}

/** Το resolved spec — ποτέ undefined πεδία, ώστε οι consumers να μη ξανα-default-άρουν. */
export interface ResolvedBuriedWaterproofing {
  readonly enabled: boolean;
  readonly materialId: string;
}

/**
 * Το ΕΝΑ σημείο που ξέρει τα defaults της στεγάνωσης. Κάθε caller (3Δ υλικό, BOQ m², UI)
 * περνά από εδώ — αλλιώς «απόν = ενεργό» θα γραφόταν τρεις φορές και θα απέκλιναν.
 */
export function resolveBuriedWaterproofing(
  spec: BuriedWaterproofingSpec | undefined,
): ResolvedBuriedWaterproofing {
  return {
    enabled: spec?.enabled ?? true,
    materialId: spec?.materialId || DEFAULT_BURIED_WATERPROOFING_MATERIAL,
  };
}

/**
 * Το στεγανωτικό ως {@link StructuralFinishSpec}, ώστε ο ΥΠΑΡΧΩΝ resolver όψεων να
 * παράγει τα m² του χωρίς καμία νέα γεωμετρία.
 *
 * Εσωτερικό **και** εξωτερικό υλικό είναι το ΙΔΙΟ: κάτω από το έδαφος δεν υπάρχει
 * «μέσα/έξω» — όλες οι παρειές ακουμπούν χώμα, άρα ΜΙΑ γραμμή επιμέτρησης, όχι δύο.
 */
export function buriedWaterproofingFinishSpec(materialId: string): StructuralFinishSpec {
  return {
    enabled: true,
    interiorMaterialId: materialId,
    exteriorMaterialId: materialId,
    thickness: BURIED_COATING_NOMINAL_THICKNESS_MM,
    exteriorThickness: BURIED_COATING_NOMINAL_THICKNESS_MM,
  };
}

/**
 * Το per-face appearance των **θαμμένων** υπο-όψεων ενός prism με `sideCount` πλευρές.
 *
 * ⚠️ Κάθε `buried:i` δηλώνεται **ΡΗΤΑ**, ακόμη και όταν η στεγάνωση είναι κλειστή (τότε ως
 * κενό `{}`). Αυτό ΔΕΝ είναι περιττό: ο cascade του `resolveFaceMaterial` είναι
 * `appearance[faceKey] ?? appearance['*']`, οπότε ένα **απόν** κλειδί θα έπεφτε στο base
 * `'*'` — δηλαδή στο **τούβλο της όψης**, που είναι ακριβώς το σφάλμα που διορθώνει το
 * ADR-713. Το κενό `{}` είναι το «ρητά άβαφη» σήμα: υπάρχει (δεν πέφτει στο `'*'`), δεν
 * φέρει ούτε `materialId` ούτε `colorHex` → ο resolver επιστρέφει το base υλικό του
 * στερεού, δηλαδή γυμνό σκυρόδεμα.
 */
export function buriedFaceAppearance(
  sideCount: number,
  waterproofing: ResolvedBuriedWaterproofing,
): FaceAppearanceMap {
  const out: Record<string, { materialId?: string }> = {};
  const face = waterproofing.enabled ? { materialId: waterproofing.materialId } : {};
  for (let i = 0; i < sideCount; i++) out[buriedFaceKey(i)] = face;
  return out;
}
