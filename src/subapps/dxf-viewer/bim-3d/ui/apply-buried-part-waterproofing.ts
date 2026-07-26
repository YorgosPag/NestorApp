/**
 * apply-buried-part-waterproofing — ο writer του «Τμήματος» (κοντόστυλο), ADR-715 §3.1.
 *
 * Δύο εξαγόμενα, γιατί υπάρχουν **δύο διαφορετικά ερωτήματα** και μόνο το ένα επιμετράται:
 *
 *   1. {@link applyBuriedWaterproofing} — γράφει `ColumnParams.buriedWaterproofing`
 *      (διακόπτης + υλικό). **ΤΟ SSoT**: οδηγεί ΚΑΙ το render ΚΑΙ τα m² της επιμέτρησης.
 *   2. {@link applyBuriedPartAppearance} — ο δρόμος του swatch, που **δρομολογεί μόνος του**
 *      ανάλογα με το τι είναι το υλικό (βλ. §Η δρομολόγηση).
 *
 * ### Γιατί ο writer είναι `UpdateColumnParamsCommand` και όχι κάτι νέο
 * Το κοντόστυλο **δεν είναι οντότητα** (ADR-715 §3): η πρόθεση στεγάνωσης ζει στα params της
 * host κολώνας. Άρα γράφεται με το ΙΔΙΟ undoable command που γράφει κάθε άλλη παράμετρο
 * κολώνας — ίδιο command history, ίδιο geometry/validation recompute, **ΕΝΑ** undo. Κανένα νέο
 * pipeline, κανένα migration, καμία δεύτερη διαδρομή αποθήκευσης.
 *
 * ### Η δρομολόγηση του swatch — και γιατί ξεπερνά το Revit
 * Στο Revit ο μηχανικός πρέπει να **θυμάται** τη διαφορά: αλλαγή type material (μπαίνει στα
 * schedules) ή «Paint» (δεν μπαίνει). Λάθος επιλογή = σιωπηλό σφάλμα επιμέτρησης. Εδώ η
 * διάκριση προκύπτει από την **ταυτότητα του υλικού** ({@link isBuriedWaterproofingMaterial}):
 *
 *   | ο χρήστης διαλέγει | τι γράφεται | render | BOQ m² |
 *   |---|---|---|---|
 *   | ασφαλτικό / τσιμεντοειδές / μεμβράνη … (ο κατάλογος των 8) | `params.buriedWaterproofing.materialId` | ✅ | ✅ |
 *   | οτιδήποτε άλλο (τούβλο, σκέτο χρώμα, εισαγόμενο υλικό) | `faceAppearance['buried:i']` σε ΟΛΕΣ τις θαμμένες όψεις | ✅ | ❌ |
 *
 * Δηλαδή «διάλεξα στεγανωτικό» σημαίνει πάντα «στεγάνωσε **και** χρέωσε», ενώ «διάλεξα τούβλο
 * στη θαμμένη ζώνη» παραμένει εφικτό ως ρητό cosmetic override — αλλά **δηλωμένο** ως τέτοιο
 * (`resolveBuriedPaintDivergence` → το panel το εμφανίζει). Καμία σιωπηλή απόκλιση τιμής.
 *
 * @see ../../bim/parts/buried-part.ts — τα δύο pure κριτήρια (ταυτότητα υλικού + απόκλιση)
 * @see ./apply-face-appearance.ts — ο cosmetic δρόμος (batch = ΕΝΑ undo)
 * @see ./apply-stair-sub-element-appearance.ts — το ανάλογο της σκάλας
 * @see docs/centralized-systems/reference/adrs/ADR-715-buried-part-independent-selection-and-waterproofing-catalog.md
 */

import type { LevelsHookReturn } from '../../systems/levels/useLevels';
import { currentLevelAdapter } from './current-level-adapter';
import { getGlobalCommandHistory } from '../../core/commands';
import { UpdateColumnParamsCommand } from '../../core/commands/entity-commands/UpdateColumnParamsCommand';
import { applyFaceAppearanceToFaces } from './apply-face-appearance';
import { buriedFaceTargets, isBuriedWaterproofingMaterial } from '../../bim/parts/buried-part';
import type { BuriedWaterproofingSpec } from '../../bim/finishes/buried-waterproofing';
import type { ColumnEntity } from '../../bim/types/column-types';
import type { FaceAppearance } from '../../bim/types/face-appearance-types';

/** Το entity της κολώνας από το ενεργό επίπεδο, ή `null` (λείπει επίπεδο / δεν είναι κολώνα). */
function resolveColumn(
  levels: LevelsHookReturn | null,
  columnId: string,
): { readonly column: ColumnEntity; readonly adapter: NonNullable<ReturnType<typeof currentLevelAdapter>> } | null {
  const adapter = currentLevelAdapter(levels);
  if (!adapter) return null;
  const entity = adapter.getEntity(columnId) as ColumnEntity | undefined;
  // Fail-closed (ADR-715): το Τμήμα είναι σήμερα column-only (`baseDropMm`, ADR-489 §6.1). Άλλος
  // τύπος → no-op ΑΝΤΙ για γραφή params που θα ήταν αγνοήσιμη ή, χειρότερα, καταστροφική.
  if (!entity || entity.type !== 'column') return null;
  return { column: entity, adapter };
}

/**
 * Γράφει (merge) το `buriedWaterproofing` spec της κολώνας μέσω `UpdateColumnParamsCommand`
 * (ΕΝΑ undo + geometry/validation recompute). `patch` είναι **μερικό**: ό,τι δεν δίνεται μένει
 * ως έχει, ώστε «άλλαξε υλικό» να μη σβήνει τον διακόπτη και αντίστροφα.
 *
 * No-op όταν λείπει επίπεδο ή το entity δεν είναι κολώνα (fail-safe, mirror σκάλας).
 */
export function applyBuriedWaterproofing(
  levels: LevelsHookReturn | null,
  columnId: string,
  patch: BuriedWaterproofingSpec,
): void {
  const resolved = resolveColumn(levels, columnId);
  if (!resolved) return;
  const { column, adapter } = resolved;
  const prev = column.params;
  getGlobalCommandHistory().execute(
    new UpdateColumnParamsCommand(
      columnId,
      { ...prev, buriedWaterproofing: { ...prev.buriedWaterproofing, ...patch } },
      prev,
      adapter,
      false,
    ),
  );
}

/**
 * Ο δρόμος του swatch/βιβλιοθήκης όταν είναι επιλεγμένο **Τμήμα** — δρομολογεί κατά την
 * ταυτότητα του υλικού (βλ. §Η δρομολόγηση στο header).
 *
 * - Υλικό του καταλόγου στεγάνωσης → Part-level SSoT (render **και** επιμέτρηση).
 * - Οτιδήποτε άλλο → cosmetic per-face σε **ΟΛΕΣ** τις θαμμένες όψεις, ΕΝΑ undo. Όλες και όχι
 *   μία: ο χρήστης έχει επιλεγμένο το Τμήμα ως ΕΝΑ αντικείμενο (και το βλέπει φωτισμένο
 *   περιμετρικά) — βάφοντας μία παρειά, το αποτέλεσμα δεν θα αντιστοιχούσε στην επιλογή.
 * - `value = null` («καθάρισε») → cosmetic clear των θαμμένων όψεων, ΟΧΙ σβήσιμο της
 *   στεγάνωσης. Το «καθάρισε εμφάνιση» δεν είναι «κατάργησε εργασία»: το κλείσιμο της
 *   στεγάνωσης είναι ρητή απόφαση με δικό της διακόπτη ({@link applyBuriedWaterproofing}),
 *   γιατί αφαιρεί **γραμμή επιμέτρησης**. Ένα undo δεν πρέπει να χρειάζεται για να προστατέψει
 *   τον προϋπολογισμό.
 *
 * `meshFaceKeys` = η αρίθμηση όψεων του ζωντανού mesh (SSoT της γεωμετρίας που ζωγραφίστηκε).
 */
export function applyBuriedPartAppearance(
  levels: LevelsHookReturn | null,
  columnId: string,
  meshFaceKeys: readonly string[] | undefined,
  value: FaceAppearance | null,
): void {
  if (value && isBuriedWaterproofingMaterial(value.materialId)) {
    applyBuriedWaterproofing(levels, columnId, { enabled: true, materialId: value.materialId });
    return;
  }
  applyFaceAppearanceToFaces(levels, buriedFaceTargets(columnId, meshFaceKeys), value);
}
