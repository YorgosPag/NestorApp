/**
 * imported-mesh-boq — ADR-683 **Φ3.1** (§10.2). Η γέφυρα «μετρημένο πλέγμα → ποσότητα προμέτρησης».
 *
 * Δύο ευθύνες, και οι δύο καθαρές:
 *   1. **Ποιες μονάδες επιτρέπονται** για αυτό το συγκεκριμένο πλέγμα (`supportedBoqUnits`).
 *   2. **Η μοναδική μετατροπή** από τα αποθηκευμένα μεγέθη στο σχήμα που περιμένει το BOQ bridge
 *      (`importedMeshBoqGeometry`). Ζει σε **ένα** σημείο: τα params είναι σε **mm**, το
 *      `deriveAtoeQuantity` δουλεύει σε **m/m²/m³**, και μια δεύτερη μετατροπή κάπου αλλού θα
 *      σήμαινε προμέτρηση σε λάθος τάξη μεγέθους — χίλιες φορές μεγαλύτερη, χωρίς κανένα σφάλμα.
 *
 * ## Γιατί το gating δεν είναι προαιρετικό
 *
 * Το ίδιο κουτί 10×1×0,05 m περιέχει είτε κάγκελο (~0,02 m³) είτε διακοσμητικό τοίχο (~0,5 m³).
 * Ο όγκος μετριέται στην εισαγωγή από τα τρίγωνα και είναι `null` όταν το κέλυφος δεν είναι
 * κλειστό (`io/mesh3d-roundtrip/mesh-solid-measure`). Όταν είναι `null`, οι μονάδες m³/kg **δεν
 * προσφέρονται καν** — ίδια γραμμή με το Revit, που αφήνει την παράμετρο Volume κενή σε εισαγόμενο
 * DirectShape που δεν είναι έγκυρο στερεό. Ποτέ αριθμός που ο χρήστης θα εμπιστευόταν λανθασμένα.
 *
 * @see ./imported-mesh-types — `ImportedMeshBoqIdentity`, `ImportedMeshBoqUnit`
 * @see ../../config/bim-to-atoe-mapping — `deriveAtoeQuantity` (ο SSoT κανόνας μονάδα→ποσότητα)
 * @see docs/centralized-systems/reference/adrs/ADR-683-bim-collaboration-roundtrip.md §10.2
 */

import { getAllowedUnits } from '@/config/boq-categories';
import { findSubCategory } from '@/config/boq-subcategories';
import type { BimEntityForBoq } from '../../services/BimToBoqBridge';
import {
  isImportedMeshBoqUnit,
  type ImportedMeshBoqIdentity,
  type ImportedMeshBoqUnit,
  type ImportedMeshEntity,
  type ImportedMeshParams,
} from './imported-mesh-types';

const MM_TO_M = 1 / 1000;

/** Μονάδες που στηρίζονται μόνο σε bbox/επιφάνεια — πάντα διαθέσιμες. */
const ALWAYS_SUPPORTED_UNITS: readonly ImportedMeshBoqUnit[] = ['pcs', 'm', 'm2'];

/** Μονάδες που απαιτούν **μετρήσιμο όγκο**, άρα κλειστό κέλυφος. */
const SOLID_ONLY_UNITS: readonly ImportedMeshBoqUnit[] = ['m3', 'kg'];

/**
 * Οι μονάδες που αυτό το πλέγμα μπορεί να στηρίξει **τίμια**. Ο dialog ανάθεσης προσφέρει
 * ακριβώς αυτές — ό,τι λείπει, λείπει επειδή η γεωμετρία δεν το ξέρει, όχι επειδή ξεχάστηκε.
 */
export function supportedBoqUnits(params: ImportedMeshParams): readonly ImportedMeshBoqUnit[] {
  return params.measuredVolumeM3 === null
    ? ALWAYS_SUPPORTED_UNITS
    : [...ALWAYS_SUPPORTED_UNITS, ...SOLID_ONLY_UNITS];
}

/** Μπορεί η ανάθεση αυτής της μονάδας να παραγάγει πραγματικό νούμερο; */
export function isBoqUnitSupported(params: ImportedMeshParams, unit: ImportedMeshBoqUnit): boolean {
  return supportedBoqUnits(params).includes(unit);
}

/**
 * Ο **κωδικός ομάδας** ΑΤΟΕ ενός άρθρου. Η ταυτότητα μπορεί να δηλώνει είτε ομάδα (`OIK-3`) είτε
 * υποκατηγορία (`OIK-3.1`), αλλά οι επιτρεπόμενες μονάδες ορίζονται **μόνο** στην ομάδα
 * (`ATOE_MASTER_CATEGORIES`). Χωρίς αυτή τη μετάβαση, το `getAllowedUnits('OIK-3.1')` δεν βρίσκει
 * κατηγορία και πέφτει στο γενικό fallback — δηλαδή η υποκατηγορία θα χαλάρωνε σιωπηλά το gating
 * αντί να το κληρονομεί.
 */
function atoeGroupCodeOf(categoryCode: string): string {
  return findSubCategory(categoryCode)?.parentCode ?? categoryCode;
}

/**
 * Οι μονάδες που μπορούν πράγματι **να ανατεθούν** σε αυτό το πλέγμα για αυτό το άρθρο ΑΤΟΕ.
 *
 * Τομή **τριών** ανεξάρτητων περιορισμών, καθένας από τον δικό του SSoT:
 *   1. **Τι μετρά τίμια η γεωμετρία** — {@link supportedBoqUnits} (m³/kg μόνο σε κλειστό κέλυφος).
 *   2. **Τι επιτρέπει το άρθρο** — `getAllowedUnits` (`config/boq-categories`): σκυρόδεμα σε m³,
 *      χρωματισμοί σε m². Η ίδια λίστα που περιορίζει κάθε χειροκίνητη γραμμή προμέτρησης.
 *   3. **Τι μετατρέπει ο κανόνας ποσότητας** — `IMPORTED_MESH_BOQ_UNITS` (μέσω του type guard):
 *      ό,τι δεν καλύπτει το `deriveAtoeQuantity` θα έγραφε σιωπηλά μηδέν.
 *
 * **Κενή τομή είναι έγκυρη απάντηση**, όχι σφάλμα: ανοιχτό πλέγμα + άρθρο σκυροδέματος (μόνο m³/ton)
 * δεν έχει τίμια μονάδα. Ο dialog το λέει ρητά αντί να προσφέρει μια μονάδα που θα έδινε λάθος
 * νούμερο — ίδια γραμμή με το §10.2: ποτέ αριθμός που ο χρήστης θα εμπιστευόταν λανθασμένα.
 */
export function assignableBoqUnits(
  params: ImportedMeshParams,
  categoryCode: string,
): readonly ImportedMeshBoqUnit[] {
  const measurable = supportedBoqUnits(params);
  const allowedByArticle = getAllowedUnits(atoeGroupCodeOf(categoryCode));
  return measurable.filter(
    (unit) => allowedByArticle.includes(unit) && isImportedMeshBoqUnit(unit),
  );
}

/**
 * Γράφει (ή **αφαιρεί**) την ανάθεση κοστολόγησης πάνω στα params — η μία μετάλλαξη της Φ3.1β.
 *
 * ⚠️ Η αφαίρεση **σβήνει το κλειδί**, δεν το θέτει `undefined`. Δύο λόγοι, και οι δύο πραγματικοί:
 * το Firestore απορρίπτει τιμές `undefined` (το `updateImportedMesh` γράφει ολόκληρο το `params`
 * map), και ένα `undefined` κλειδί θα περνούσε τον έλεγχο `'importedMeshIdentity' in params` σε
 * κάθε μελλοντικό καταναλωτή. Το `hasBoqIdentity` ελέγχει `!== undefined`, οπότε και οι δύο μορφές
 * θα «δούλευαν» εδώ — αλλά μόνο η μία επιβιώνει του κύκλου αποθήκευσης/ανάγνωσης.
 */
export function withImportedMeshIdentity(
  params: ImportedMeshParams,
  identity: ImportedMeshBoqIdentity | undefined,
): ImportedMeshParams {
  if (identity !== undefined) return { ...params, importedMeshIdentity: identity };
  const { importedMeshIdentity: _removed, ...rest } = params;
  return rest;
}

/**
 * **Το οριζόντιο άνοιγμα** σε μέτρα — η ποσότητα για τη μονάδα `m`.
 *
 * Χρησιμοποιείται η **διαγώνιος του ίχνους**, όχι η μεγαλύτερη πλευρά: ένα γραμμικό αντικείμενο
 * υπό γωνία 45° έχει bbox 7,07×7,07 ενώ είναι 10 m μακρύ — η πλευρά θα το υποτιμούσε κατά 30%.
 * Η διαγώνιος είναι **ακριβής** για κάθε ευθύγραμμο αντικείμενο σε οποιονδήποτε προσανατολισμό.
 *
 * ⚠️ **Το όριο, ρητά:** για καμπύλο ή σχήματος Γ αντικείμενο δίνει τη **χορδή**, όχι το
 * ανεπτυγμένο μήκος — υποτιμά. Δεν υπάρχει τρόπος να βγει διαδρομή από ψημένα τρίγωνα (§3), και
 * μια «έξυπνη» εκτίμηση θα ήταν ακριβώς η μαντεψιά που απαγορεύει το §10.2.
 */
function horizontalSpanM(params: ImportedMeshParams): number {
  const widthM = params.measuredWidthMm * MM_TO_M;
  const depthM = params.measuredDepthMm * MM_TO_M;
  return Math.sqrt(widthM * widthM + depthM * depthM);
}

/**
 * Τα μεγέθη στο σχήμα που καταναλώνει το `deriveAtoeQuantity` — **η μόνη μετατροπή mm → m**.
 *
 * Ο όγκος περνά `0` όταν δεν είναι μετρήσιμος. Αυτό **δεν** γίνεται ποτέ ορατό: η μονάδα `m3`
 * δεν προσφέρεται καθόλου σε τέτοιο πλέγμα (`supportedBoqUnits`), άρα το `0` είναι απλώς η
 * τιμή που δεν διαβάζεται. Το κρατάμε ρητό ώστε ο τύπος να μένει `number` για τον bridge.
 */
export function importedMeshBoqGeometry(
  params: ImportedMeshParams,
): NonNullable<BimEntityForBoq['geometry']> {
  return {
    area: params.measuredSurfaceAreaM2,
    volume: params.measuredVolumeM3 ?? 0,
    lengthM: horizontalSpanM(params),
  };
}

/**
 * Το φορτίο που στέλνεται στο BOQ bridge. Το `params` περνά ακέραιο ώστε ο resolver να βρει την
 * ανάθεση — είναι ο διαχωριστής αυτού του τύπου, όπως το `category` για τους τοίχους.
 */
export function importedMeshBoqPayload(entity: ImportedMeshEntity): BimEntityForBoq {
  return {
    id: entity.id,
    kind: entity.kind,
    params: entity.params,
    geometry: importedMeshBoqGeometry(entity.params),
  };
}

/** Έχει ανατεθεί ταυτότητα; Απόν → καμία γραμμή προμέτρησης (απόφαση Giorgio, §10.2). */
export function hasBoqIdentity(params: ImportedMeshParams): boolean {
  return params.importedMeshIdentity !== undefined;
}

/** Ελάχιστο σχήμα οντότητας σκηνής για το μέτρημα — μόνο ο τύπος και τα params. */
interface SceneEntityLike {
  readonly type: string;
  readonly params?: unknown;
}

/**
 * Πόσα εισαγόμενα πλέγματα της σκηνής **δεν** έχουν ακόμη ανατεθειμένο άρθρο (§10.2).
 *
 * Είναι ο αριθμός που κάνει την «ορατή απουσία» πραγματικά ορατή. Η απόφαση ήταν ρητή: ένα
 * ανανάθετο αντικείμενο **δεν** παράγει μηδενική γραμμή BOQ (θα έμοιαζε με μετρημένο κόστος μηδέν),
 * αλλά αν η απουσία δεν αναφέρεται πουθενά, ο χρήστης παραδίδει προϋπολογισμό με 7 αντικείμενα
 * αόρατα. Το ένα προϋποθέτει το άλλο.
 */
export function countUnassignedImportedMeshes(entities: readonly SceneEntityLike[]): number {
  return entities.reduce((count, entity) => {
    if (entity.type !== 'imported-mesh') return count;
    const params = entity.params as ImportedMeshParams | undefined;
    return params && !hasBoqIdentity(params) ? count + 1 : count;
  }, 0);
}
