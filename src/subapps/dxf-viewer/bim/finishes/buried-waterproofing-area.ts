/**
 * ADR-713 — τα m² της στεγανωτικής επάλειψης στη **θαμμένη** ζώνη μιας κολώνας.
 *
 * Καμία νέα γεωμετρία και κανένα νέο BOQ pipeline: το ερώτημα «ποιες παρειές × τι ύψος × τι
 * υλικό» είναι **το ίδιο** με του σοβά, οπότε τρέχει στον ΥΠΑΡΧΟΝΤΑ resolver του ADR-449 με
 * ένα spec που φέρει το υλικό στεγάνωσης. Το αποτέλεσμα είναι ένα `FinishMaterialBucket` —
 * ό,τι ακριβώς καταναλώνει ήδη το `structural-finish-boq` (group-by-material) → η γραμμή
 * επιμέτρησης εμφανίζεται μόνη της, με το δικό της άρθρο m².
 *
 * ### Γιατί ΚΑΝΕΝΑ obstacle (και γιατί αυτό είναι σωστό, όχι απλοποίηση)
 * Ο σοβάς αφαιρεί τις παρειές που καλύπτονται από τοίχους. Στη θαμμένη ζώνη **δεν υπάρχει
 * τοίχος**: η κατακόρυφη προέκταση προς το πέδιλο (ADR-489 §6.1 `baseDropMm`) είναι
 * αποκλειστικά συμπεριφορά **κολώνας** — οι τοίχοι του ορόφου ξεκινούν στο FFL, πάνω από τη
 * ζώνη. Περνώντας τους ως obstacles θα αφαιρούσαμε επιφάνεια που στην πραγματικότητα ακουμπά
 * χώμα → **υπο-επιμέτρηση στεγάνωσης**. Άρα: όλες οι παρειές, περιμετρικά.
 *
 * Ξεχωριστό module από το `buried-waterproofing.ts` **σκόπιμα**: εκείνο το εισάγει το
 * `column-types.ts` (για τον τύπο του spec)· αν έφερνε runtime import του
 * `structural-finish-scene` (που με τη σειρά του διαβάζει column types) θα έκλεινε κύκλος.
 *
 * @see ./buried-waterproofing — το spec + τα defaults
 * @see ./structural-finish-scene — ο κοινός resolver όψεων
 * @see docs/centralized-systems/reference/adrs/ADR-713-buried-column-segment-exposure-zone.md
 */

import type { ColumnEntity } from '../types/column-types';
import { computeColumnFinishFaces, MM_TO_M } from './structural-finish-scene';
import { finishAreasByMaterial, type FinishMaterialBucket } from './structural-finish-area';
import { buriedWaterproofingFinishSpec, resolveBuriedWaterproofing } from './buried-waterproofing';

/**
 * Τα buckets στεγάνωσης της θαμμένης ζώνης — κενός πίνακας όταν δεν υπάρχει ζώνη, η
 * στεγάνωση είναι κλειστή, ή το footprint είναι εκφυλισμένο.
 *
 * @param footprint      το ΙΔΙΟ footprint με την επιμέτρηση όγκου (profile-aware geometry),
 *                       ώστε στεγάνωση και σκυρόδεμα να μη μπορούν να αποκλίνουν σε διατομή.
 * @param buriedHeightMm ύψος θαμμένης ζώνης από το `resolveColumnExposureZones`.
 */
export function buriedWaterproofingBuckets(
  column: ColumnEntity,
  footprint: readonly { readonly x: number; readonly y: number }[],
  buriedHeightMm: number,
): FinishMaterialBucket[] {
  if (!(buriedHeightMm > 0) || footprint.length < 3) return [];
  const waterproofing = resolveBuriedWaterproofing(column.params.buriedWaterproofing);
  if (!waterproofing.enabled) return [];

  const source = {
    params: {
      finish: buriedWaterproofingFinishSpec(waterproofing.materialId),
      sceneUnits: column.params.sceneUnits,
      envelopeFunction: column.params.envelopeFunction,
    },
  };
  // Καμία obstacle λίστα — βλ. header: κάτω από τη στάθμη δεν υπάρχει τοίχος να καλύψει παρειά.
  const faces = computeColumnFinishFaces(source, footprint, buriedHeightMm, []);
  if (!faces) return [];
  return finishAreasByMaterial([{ segments: faces.segments, heightM: buriedHeightMm * MM_TO_M }]);
}
