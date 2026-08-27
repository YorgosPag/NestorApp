/**
 * @fileoverview **ΑΝΑΓΝΩΣΗ ΤΟΥ ΕΠΙΠΕΔΟΥ Α ΑΠΟ ΤΟΝ ΔΙΑΚΟΜΙΣΤΗ** — και η μία ερώτηση που τη χρειάζεται.
 * @related ADR-777 · SPEC-777A §13.4 (ODbL) · CHECK 3.35
 * @module services/places/public-place-read.service
 *
 * 🔑 **Ο πελάτης ΔΕΝ περνά από εδώ.** Οι δύο συλλογές είναι `read: if true`, οπότε η
 * οθόνη τις διαβάζει **απευθείας** (ίδιο σχήμα με το `usePublicListings`). Αυτό το
 * αρχείο υπάρχει για τη **μία** ερώτηση που ο πελάτης δεν μπορεί να απαντήσει μόνος
 * του: *«ποιο είναι το ζωντανό περίγραμμα αυτού του τόπου;»* — γιατί η απάντηση
 * απαιτεί κλήση προς το Overpass, και **αυτή** οφείλει να γίνει από τον διακομιστή
 * (ένα κλειδί χρήστη προς δημόσιο API θα ήταν ανοιχτός ενισχυτής).
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { ENTERPRISE_ID_PREFIXES } from '@/services/enterprise-id-prefixes';
import { enterpriseIdType, isValidEnterpriseId } from '@/services/enterprise-id-parse';
import type { OsmReference, PlaceRef, PublicBuilding, PublicLand } from '@/types/geo/public-place';

/**
 * Το **πρόθεμα της ταυτότητας ΕΙΝΑΙ ο διαχωριστής τύπου.**
 *
 * 🔑 Δεν χρειάζεται δεύτερη παράμετρος «τι είδους τόπος είναι αυτό;» στη διαδρομή: το
 * `land_*` και το `pbld_*` **το λένε ήδη**, και το λένε από το **ίδιο μητρώο** που
 * παρήγαγε την ταυτότητα (N.6) — όχι από regex γραμμένο εδώ.
 */
export type PlaceKind = 'land' | 'building';

export function placeKindOf(placeId: string): PlaceKind | null {
  if (!isValidEnterpriseId(placeId)) return null;

  const type = enterpriseIdType(placeId);
  if (type === ENTERPRISE_ID_PREFIXES.PUBLIC_LAND) return 'land';
  if (type === ENTERPRISE_ID_PREFIXES.PUBLIC_BUILDING) return 'building';
  return null;
}

/**
 * Η αναφορά OSM αυτού του τόπου, όταν από εκεί ήρθε η θέση του.
 *
 * ⚠️ `null` σημαίνει **τρία διαφορετικά πράγματα** και εδώ σκόπιμα δεν ξεχωρίζονται:
 * δεν υπάρχει τέτοιος τόπος · υπάρχει αλλά η θέση του δεν ήρθε από OSM · η θέση είναι
 * άγνωστη. Ο **μόνος** καταναλωτής ρωτά *«έχω περίγραμμα να ζωγραφίσω;»*, και η
 * απάντηση «όχι» είναι η ίδια και στις τρεις — μια διάκριση εδώ θα ήταν λεξιλόγιο που
 * κανείς δεν διαβάζει (ADR-749 §5: φρουρός χωρίς απόδειξη ζωής).
 */
export async function readPlaceOsmRef(
  adminDb: AdminFirestore,
  placeId: string,
): Promise<OsmReference | null> {
  const kind = placeKindOf(placeId);
  if (kind === null) return null;

  if (kind === 'land') {
    const land = (
      await adminDb.collection(COLLECTIONS.PUBLIC_LANDS).doc(placeId).get()
    ).data() as PublicLand | undefined;

    return land?.position.kind === 'known' && land.position.provenance === 'osm'
      ? land.position.osmRef
      : null;
  }

  const building = (
    await adminDb.collection(COLLECTIONS.PUBLIC_BUILDINGS).doc(placeId).get()
  ).data() as PublicBuilding | undefined;

  return building?.footprint.kind === 'known' && building.footprint.provenance === 'osm'
    ? building.footprint.osmRef
    : null;
}

// ============================================================================
// ΕΠΑΛΗΘΕΥΣΗ ΔΕΣΜΟΥ — «δείχνει αυτός ο δεσμός κάπου;»
// ============================================================================

/**
 * Οι **πέντε ρητές** ετυμηγορίες για έναν δεσμό επιπέδου Β → Α.
 *
 * 🔴 **Το `unavailable` ΔΕΝ είναι υποπερίπτωση του «δεν υπάρχει», και η διάκριση έχει
 * ήδη πληρωθεί μία φορά** (SPEC-777A §13.7.2 εύρημα #5: το `fetchOsmBuildingOutline`
 * συγχώνευε *«δεν έχει σχήμα»* με *«δεν απάντησε»*, **11** άγκυρες ήταν πράσινες, και
 * το βρήκε **ζωντανή δοκιμή**). Εδώ η συνέπεια θα ήταν χειρότερη: μια στιγμιαία
 * αστοχία της βάσης θα έλεγε στον επαγγελματία *«αυτό το κτίριο δεν υπάρχει»* και θα
 * τον έστελνε να **φτιάξει δεύτερη ταυτότητα** για φυσικό πράγμα που έχει ήδη μία —
 * δηλαδή θα παρήγαγε ακριβώς το διπλότυπο που όλο το επίπεδο Α υπάρχει για να αποτρέψει.
 */
export type PlaceRefVerdict =
  | 'exists'
  /** Η ταυτότητα δεν είναι καν `land_*`/`pbld_*` — σφάλμα **πελάτη**, όχι κόσμου. */
  | 'not-a-place-id'
  | 'land-absent'
  /** Η γη υπάρχει, το **κτίριο** που δηλώθηκε όχι — ο δεσμός θα κρεμόταν στο κενό. */
  | 'building-absent'
  /** **Δεν μάθαμε.** Ούτε ναι ούτε όχι — ο καλών οφείλει να απαντήσει 503, ποτέ 422. */
  | 'unavailable';

/**
 * **Δείχνει αυτός ο δεσμός σε τόπο που υπάρχει;**
 *
 * 🔑 **Ο διακομιστής επαληθεύει ΥΠΑΡΞΗ, όχι ΑΛΗΘΕΙΑ.** Το §14.3 λέει ότι ο χρήστης
 * *«δεν αλλάζει το κοινό — **προτείνει**»*: το αν το κτίριο του πελάτη **είναι** εκείνο
 * το κτίριο είναι **ισχυρισμός** του, και κανένα ερώτημα βάσης δεν μπορεί να τον κρίνει.
 * Αυτό που **μπορεί** να κριθεί, και οφείλει, είναι αν ο δεσμός δείχνει **κάπου**.
 *
 * ⚠️ **Χωρίς αυτόν τον έλεγχο η βλάβη είναι ΑΟΡΑΤΗ**: ένας δεσμός προς ανύπαρκτη
 * ταυτότητα δεν σπάει τίποτα — ταξιδεύει στη δημόσια αγγελία, **φαίνεται** λυμένος, και
 * απλώς δεν ταιριάζει ποτέ με καμία ζήτηση. Η μηχανή θα έλεγε «καμία αντιστοιχία» και
 * θα είχε δίκιο· κανείς δεν θα ρωτούσε γιατί.
 */
export async function verifyPlaceRef(
  adminDb: AdminFirestore,
  ref: PlaceRef,
): Promise<PlaceRefVerdict> {
  if (placeKindOf(ref.landId) !== 'land') return 'not-a-place-id';
  if (ref.buildingId !== null && placeKindOf(ref.buildingId) !== 'building') {
    return 'not-a-place-id';
  }

  try {
    const land = await adminDb.collection(COLLECTIONS.PUBLIC_LANDS).doc(ref.landId).get();
    if (!land.exists) return 'land-absent';

    if (ref.buildingId === null) return 'exists';

    const building = await adminDb
      .collection(COLLECTIONS.PUBLIC_BUILDINGS)
      .doc(ref.buildingId)
      .get();

    return building.exists ? 'exists' : 'building-absent';
  } catch {
    // ⚠️ **Καταπίνεται η αιτία, ΟΧΙ η διάκριση.** Ο καλών χρειάζεται να ξέρει ότι η
    // ερώτηση **δεν απαντήθηκε** — το τι έφταιξε το καταγράφει το στρώμα του δικτύου.
    return 'unavailable';
  }
}

// ============================================================================
// ΤΙ ΚΑΝΕΙ Ο ΚΑΛΩΝ ΜΕ ΤΗΝ ΕΤΥΜΗΓΟΡΙΑ — μία σημασία, πολλές διαλέκτους HTTP
// ============================================================================

/**
 * **Τι οφείλει να κάνει ο καλών.** Τρεις θεραπείες, γιατί υπάρχουν τρεις **διαφορετικές**.
 *
 * | Θεραπεία | Τι λέει στον άνθρωπο | Ποιος φταίει |
 * |---|---|---|
 * | `accept` | τίποτα — προχώρα | κανείς |
 * | `reject` | *«αυτός ο δεσμός δεν δείχνει σε τόπο· άλλαξέ τον»* | ο **αιτών** |
 * | `retry` | *«ξαναδοκίμασε, **μην αλλάξεις τίποτα**»* | **εμείς** |
 *
 * 🔑 **ΓΙΑΤΙ ΖΕΙ ΕΔΩ ΚΑΙ ΟΧΙ ΣΤΙΣ ΠΟΡΤΕΣ.** Οι καταναλωτές του {@link verifyPlaceRef}
 * έχουν **διαφορετικά ιδιώματα απάντησης** — ο επαγγελματίας πετά `ApiError`, ο
 * ιδιώτης επιστρέφει **κλειστή ένωση αποτελέσματος** που μεταφράζει το `respond.ts`.
 * Η **μετάφραση** επιτρέπεται να διαφέρει· η **σημασία** όχι. Γραμμένη δύο φορές, θα
 * απέκλινε την ημέρα που θα προστεθεί έκτη ετυμηγορία — και η μία πόρτα θα έστελνε
 * 422 εκεί που η άλλη στέλνει 503, δηλαδή θα έστελνε τον έναν χρήστη να **φτιάξει
 * διπλότυπο επιπέδου Α** ενώ θα έλεγε στον άλλον να περιμένει. Σχήμα ADR-749.
 *
 * ⚠️ **`Record<PlaceRefVerdict, …>` και ΟΧΙ χάρτης μερικών κλειδιών** — ίδιο ιδίωμα με
 * το `REASON_BY_VERDICT` του κριτή εξουσιοδότησης (ADR-801): μια **έκτη** ετυμηγορία
 * **δεν μεταγλωττίζεται** μέχρι κάποιος να αποφασίσει τι σημαίνει για τον καλούντα.
 * Χωρίς αυτό, μια νέα ετυμηγορία θα έπεφτε σιωπηλά στον κλάδο «δεν το ξέρω» — και ο
 * σιωπηλός κλάδος εδώ είναι, κυριολεκτικά, *«πες του ότι το κτίριό του δεν υπάρχει»*.
 */
export type PlaceRefTreatment = 'accept' | 'reject' | 'retry';

/** Ετυμηγορία → θεραπεία. **Πλήρης**, επιβαλλόμενη από τον μεταγλωττιστή. */
export const PLACE_REF_TREATMENT: Record<PlaceRefVerdict, PlaceRefTreatment> = {
  exists: 'accept',
  'not-a-place-id': 'reject',
  'land-absent': 'reject',
  'building-absent': 'reject',
  // 🔴 **ΠΟΤΕ `reject`.** Δες την επικεφαλίδα του {@link PlaceRefVerdict}: μια
  //    στιγμιαία αστοχία της βάσης που διαβάζεται ως «δεν υπάρχει» παράγει
  //    **διπλότυπη ταυτότητα επιπέδου Α** — ακριβώς ό,τι το επίπεδο Α αποτρέπει.
  unavailable: 'retry',
};
