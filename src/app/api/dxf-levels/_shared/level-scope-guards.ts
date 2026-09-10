/**
 * 🛡️ **ADR-845 §7.15 (Ο-18)** — SERVER-SIDE φρουρός εμβέλειας κτηρίου για τα
 * `dxf_viewer_levels`.
 *
 * ## Η ερώτηση
 *
 * *«Δηλώνει αυτό το επίπεδο κτήριο που **δεν περιέχει** τον όροφό του;»*
 *
 * ## Γιατί εδώ, και όχι μόνο στον πελάτη
 *
 * Ο εισαγωγέας δεν μπορεί πλέον να γράψει «μισή» εμβέλεια — ο τύπος
 * `LevelScopeAssignment` το κάνει αδύνατο *(§7.14)*. Αλλά **ο πελάτης δεν είναι
 * έμπιστος**: αρκεί ένας νέος καλών, ένα regression ή ένα απευθείας `PATCH` για
 * να ξαναγραφτεί ασυνεπές ζευγάρι. Αυτή είναι η μόνη γραμμή που δεν παρακάμπτεται
 * — **ίδιο δόγμα με το `assertSceneFileBelongsToFloor` (ADR-714)**, στο ίδιο
 * αρχείο, με τον ίδιο pure κανόνα εκτελεσμένο και στις δύο πλευρές.
 *
 * 🔎 **Και είναι το σημείο όπου ξεπερνάμε τους μεγάλους**: το Revit λύνει το
 * πολυ-κτηριακό με *«χώρισε τα αρχεία»* και, όταν δεν γίνεται, με scope boxes που
 * **ομολογημένα διαρρέουν** *(χώροι άλλου κτηρίου φεύγουν στο IFC export)*. Ένας
 * φρουρός στη **γραφή** σημαίνει ότι η ασυνέπεια δεν γεννιέται καν — δεν
 * φιλτράρεται εκ των υστέρων.
 *
 * ## Συντηρητικός εξ ορισμού
 *
 * - Τρέχει **μόνο** όταν το αίτημα **αγγίζει** την εμβέλεια. *«Δεν σε κατηγορώ
 *   για ό,τι βρήκα, σε σταματώ όταν το γράφεις»* — αλλιώς κάθε άσχετο `PATCH`
 *   *(π.χ. `bimRenderSettings`)* πάνω στα **3 υπάρχοντα** ασυνεπή έγγραφα θα
 *   γινόταν 409 και ο μηχανικός θα κλειδωνόταν έξω από τη δουλειά του *(Ο-31)*.
 * - **Άγνοια δεν είναι ενοχή**: όροφος που δεν βρίσκεται ή δεν δηλώνει κτήριο ⇒
 *   σιωπή, όχι άρνηση.
 * - Το **ξε-δέσιμο** (`null`) επιτρέπεται πάντα — είναι η θεραπεία.
 *
 * @module app/api/dxf-levels/_shared/level-scope-guards
 * @see subapps/dxf-viewer/systems/levels/level-building-scope — ο pure κανόνας
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { ApiError } from '@/lib/api/ApiErrorHandler';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
// 🛡️ Ο ΙΔΙΟΣ pure κανόνας που ρωτά ο πελάτης. Dependency-free (μηδέν imports),
// άρα ασφαλής για server bundle — ίδια απόφαση με το `cross-floor-link`.
import { checkLevelBuildingScope } from '@/subapps/dxf-viewer/systems/levels/level-building-scope';

/** Το ζευγάρι εμβέλειας **όπως θα είναι μετά** την εγγραφή. */
export interface EffectiveLevelScope {
  readonly floorId: unknown;
  readonly buildingId: unknown;
}

/**
 * Υπολογίζει το ζευγάρι **όπως θα είναι μετά το PATCH**: ό,τι στέλνει το αίτημα
 * υπερισχύει, ό,τι σιωπά κρατά την αποθηκευμένη τιμή.
 *
 * ⚠️ Η διάκριση `undefined` *(«μην αγγίξεις»)* από `null` *(«καθάρισε»)* είναι
 * **η καρδιά του Ο-19** και ζει **εδώ**, όχι διάσπαρτη στους καλούντες.
 */
export function resolveEffectiveScope(
  body: { floorId?: string | null; buildingId?: string | null },
  stored: Record<string, unknown>,
): EffectiveLevelScope {
  return {
    floorId: body.floorId !== undefined ? body.floorId : stored.floorId,
    buildingId: body.buildingId !== undefined ? body.buildingId : stored.buildingId,
  };
}

/** True όταν το αίτημα **αγγίζει** την εμβέλεια — αλλιώς ο φρουρός δεν τρέχει καν. */
export function touchesScope(body: { floorId?: string | null; buildingId?: string | null }): boolean {
  return body.floorId !== undefined || body.buildingId !== undefined;
}

/**
 * Πετά **409** όταν το επίπεδο θα κατέληγε να δηλώνει κτήριο που δεν περιέχει
 * τον όροφό του. Σιωπά σε κάθε άλλη περίπτωση.
 */
export async function assertLevelBuildingScope(scope: EffectiveLevelScope): Promise<void> {
  const floorId = scope.floorId;
  const buildingId = scope.buildingId;
  if (typeof floorId !== 'string' || !floorId) return;
  if (typeof buildingId !== 'string' || !buildingId) return;

  const db = getAdminFirestore();
  const floorDoc = await db.collection(COLLECTIONS.FLOORS).doc(floorId).get();
  // ⚠️ Άγνωστος όροφος ⇒ σιωπή. Ένα 404 εδώ θα έκανε κάθε κρεμάμενη αναφορά
  // (Ο-33) αδύνατη να θεραπευτεί μέσω της κανονικής πόρτας.
  if (!floorDoc.exists) return;

  const floorBuildingId = (floorDoc.data() ?? {}).buildingId;
  const verdict = checkLevelBuildingScope(
    { floorId, buildingId },
    typeof floorBuildingId === 'string' ? floorBuildingId : null,
  );
  if (verdict.status !== 'foreign-building') return;

  throw new ApiError(
    409,
    `Level scope conflict: floor ${floorId} belongs to building ${verdict.actualBuildingId}, not ${verdict.declaredBuildingId} (ADR-845 Ο-18)`,
  );
}
