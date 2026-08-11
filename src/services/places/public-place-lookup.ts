/**
 * @fileoverview **ΥΠΑΡΧΕΙ ΗΔΗ ΤΑΥΤΟΤΗΤΑ ΓΙ' ΑΥΤΟΝ ΤΟΝ ΤΟΠΟ;** — η ερώτηση πριν κάθε γέννηση.
 * @related ADR-777 · SPEC-777A §13.2 · §13.3 · §13.5 · §14.5 · CHECK 3.35
 * @module services/places/public-place-lookup
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΔΥΟ ΤΡΟΠΟΙ ΝΑ ΡΩΤΗΣΕΙΣ «ΤΟ ΕΧΟΥΜΕ ΗΔΗ;» — ΚΑΙ ΚΑΝΕΝΑΣ ΔΕΝ ΕΙΝΑΙ ΕΓΓΥΤΗΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το §14.5 βάζει πρώτο κριτήριο *«**μία** ταυτότητα ανά φυσικό κτίριο»*, και το §13.3
 * λέει ρητά ότι η συγχώνευση πρέπει να είναι *«σχεδιασμένη πράξη με ρητή κατάσταση,
 * **όχι εικασία εγγύτητας**»*. Άρα το «πόσο κοντά είναι;» **απαγορεύεται** ως απάντηση.
 *
 * Απομένουν δύο ερωτήσεις που **δεν** είναι εικασίες:
 *
 * | Ερώτηση | Πότε | Γιατί δεν είναι εικασία |
 * |---|---|---|
 * | *«ίδιο **στοιχείο OSM**;»* | χειρονομία `picked-osm-building` | **φυσικό κλειδί** — δύο άνθρωποι που πάτησαν το ίδιο way πάτησαν **το ίδιο πράγμα** |
 * | *«πέφτει **μέσα** σε γνωστό περίγραμμα;»* | κάθε άλλη χειρονομία | **περιεκτικότητα** — το σημείο είναι **κυριολεκτικά** μέσα σε εκείνο το οικόπεδο |
 *
 * 🔑 **Και η δεύτερη ΔΕΝ αποφασίζει — ΡΩΤΑΕΙ.** Επιστρέφει υποψήφιο, και ο γραφέας τον
 * γυρίζει στον άνθρωπο ως ερώτημα (`duplicate-candidate`). Η εγγύτητα δεν επιτρέπεται
 * να **απαντήσει**· η περιεκτικότητα επιτρέπεται να **ρωτήσει**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔶 ΤΟ ΟΡΙΟ ΚΛΙΜΑΚΑΣ, ΜΕ ΑΡΙΘΜΟ ΚΑΙ ΜΕ **ΡΗΤΗ ΚΑΤΑΣΤΑΣΗ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το Firestore **δεν έχει γεωχωρικά ερωτήματα**. Η περιεκτικότητα απαντιέται με
 * **ζώνη γεωγραφικού πλάτους** (εύρος σε **ένα** πεδίο — αυτό το Firestore το κάνει)
 * και φιλτράρισμα στη μνήμη.
 *
 * ⚠️ Μια ζώνη πλάτους διατρέχει **όλο** το εύρος μηκών της χώρας. Σήμερα οι δύο
 * συλλογές είναι **άδειες** και μεγαλώνουν **κατ' απαίτηση** (§13.5), οπότε το κόστος
 * είναι μηδενικό· σε κλίμακα δεκάδων χιλιάδων τόπων ανά ζώνη, η σωστή λύση είναι
 * **geohash** (πεδίο-ευρετήριο + 9 γειτονικά κελιά).
 *
 * 🔴 **Και γι' αυτό υπάρχει το `indeterminate`.** Αν το όριο ανάγνωσης εξαντληθεί, η
 * ειλικρινής απάντηση **δεν είναι «δεν βρέθηκε»** — είναι «δεν κοίταξα όλα». Ένα
 * σιωπηλό «όχι» εκεί θα γεννούσε διπλή ταυτότητα **ακριβώς** όταν η βάση μεγαλώνει,
 * δηλαδή όταν πονάει περισσότερο.
 */

import 'server-only';

import type { Firestore as AdminFirestore, Query } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { isPointInGeoOutline } from '@/lib/geo/geo-ring';
import type { GeoPoint } from '@/types/geo/coordinates';
import type { OsmElementType, PublicBuilding, PublicLand } from '@/types/geo/public-place';

/**
 * Το ημιπλάτος της ζώνης αναζήτησης, σε μοίρες πλάτους (**≈ 1,1 km**).
 *
 * ⚠️ **Δεν είναι κατώφλι απόφασης — είναι όριο άντλησης.** Την απόφαση τη δίνει η
 * **περιεκτικότητα**· η ζώνη υπάρχει μόνο ώστε να μη διαβαστεί ολόκληρη η συλλογή.
 * Οποιοδήποτε ελληνικό οικόπεδο ή κτίριο χωρά άνετα μέσα της.
 */
const CANDIDATE_BAND_DEGREES = 0.01;

/**
 * Πόσους υποψήφιους δεχόμαστε να διαβάσουμε πριν παραδεχτούμε ότι δεν κοιτάξαμε όλους.
 *
 * ⚠️ Το όριο **δεν** σιωπά: όταν αγγιχτεί, η απάντηση γίνεται `indeterminate`.
 */
const CANDIDATE_READ_LIMIT = 500;

// =============================================================================
// 1. ΦΥΣΙΚΟ ΚΛΕΙΔΙ OSM
// =============================================================================

/**
 * Το ερώτημα φυσικού κλειδιού, μοιρασμένο από τις δύο συλλογές.
 *
 * ⚠️ **Ισότητα ΜΟΝΟ στο `elementId`, και ο τύπος ελέγχεται στη μνήμη.** Δύο ισότητες
 * θα απαιτούσαν **σύνθετο ευρετήριο** (CHECK 3.15) για μηδενικό κέρδος: το OSM id
 * είναι ήδη εξαιρετικά επιλεκτικό — η πιθανότητα να υπάρχει `node/123` **και**
 * `way/123` στις δικές μας συλλογές είναι πρακτικά μηδενική, και ακόμη κι έτσι
 * μιλάμε για δύο έγγραφα.
 */
function osmKeyQuery(
  adminDb: AdminFirestore,
  collection: string,
  field: string,
  elementId: string,
): Query {
  // ⚠️ **Ερώτημα ΧΩΡΙΣ πεδίο απομόνωσης, και η CHECK 3.35 το εγκρίνει χωρίς εξαίρεση.**
  //
  // Μετρήθηκε (2026-08-11): ο σαρωτής ταξινομεί εδώ `not-tenant-scoped`, με αιτιολογία
  // `tenant-config: mode=none` (`_shared/firestore-tenant-scope-scan.js:586`). Δηλαδή
  // η **αυθεντία** είναι η δήλωση `unscopedCategory: 'public-world'` στο
  // `services/firestore/tenant-config.ts` — όχι σχόλιο σε αυτό το αρχείο.
  //
  // 🔑 Γι' αυτό **ΔΕΝ** μπαίνει εδώ δήλωση εξαίρεσης της 3.35: επαληθεύτηκε με
  // μετάλλαξη ότι η πύλη μένει πράσινη **και χωρίς** αυτήν, άρα θα ήταν διακοσμητική —
  // *(και ο ίδιος ο δείκτης δεν γράφεται ούτε ως **παράδειγμα** σε σχόλιο: οι πύλες
  // τον ψάχνουν με regex, και μια αναφορά θα διαβαζόταν ως δήλωση — το ακριβές σχήμα
  // που γέννησε φάντασμα namespace στο CHECK 3.44)* —
  // και ένα διακοσμητικό `exempt` γίνεται **ενεργή έξοδος διαφυγής** τη μέρα που
  // κάποιος αλλάξει το `tenant-config.ts`, σιωπώντας μια πραγματική παραβίαση που
  // κανείς δεν θα είχε αποφασίσει να σιωπήσει.
  //
  // Ουσιαστικά: δεν υπάρχει `companyId` να φιλτραριστεί — η οντότητα **υπάρχει πριν**
  // τη διεκδικήσει οποιοσδήποτε (§13.1). Ένα φίλτρο μισθωτή θα επέστρεφε **πάντα
  // κενό**, δηλαδή θα γεννούσε νέα ταυτότητα σε κάθε κλήση — ακριβώς το αντίθετο του
  // §14.5 («μία ταυτότητα ανά φυσικό κτίριο»).
  return adminDb.collection(collection).where(`${field}.osmRef.elementId`, '==', elementId).limit(4);
}

/** Η **γη** που γεννήθηκε από αυτό ακριβώς το στοιχείο OSM, αν υπάρχει. */
export async function findLandByOsmRef(
  adminDb: AdminFirestore,
  elementType: OsmElementType,
  elementId: string,
): Promise<PublicLand | null> {
  const snapshot = await osmKeyQuery(adminDb, COLLECTIONS.PUBLIC_LANDS, 'position', elementId).get();

  for (const doc of snapshot.docs) {
    const land = doc.data() as PublicLand;
    if (land.position.kind === 'known' && land.position.provenance === 'osm'
      && land.position.osmRef.elementType === elementType) {
      return land;
    }
  }
  return null;
}

/** Το **κτίριο** που γεννήθηκε από αυτό ακριβώς το στοιχείο OSM, αν υπάρχει. */
export async function findBuildingByOsmRef(
  adminDb: AdminFirestore,
  elementType: OsmElementType,
  elementId: string,
): Promise<PublicBuilding | null> {
  const snapshot = await osmKeyQuery(
    adminDb,
    COLLECTIONS.PUBLIC_BUILDINGS,
    'footprint',
    elementId,
  ).get();

  for (const doc of snapshot.docs) {
    const building = doc.data() as PublicBuilding;
    if (building.footprint.kind === 'known' && building.footprint.provenance === 'osm'
      && building.footprint.osmRef.elementType === elementType) {
      return building;
    }
  }
  return null;
}

// =============================================================================
// 2. ΠΕΡΙΕΚΤΙΚΟΤΗΤΑ — «πέφτει μέσα σε γνωστό περίγραμμα;»
// =============================================================================

export type ContainingLandLookup =
  | { readonly kind: 'found'; readonly land: PublicLand }
  | { readonly kind: 'none' }
  /** 🔴 «Δεν κοίταξα όλους» — **ποτέ** δεν διαβάζεται ως «δεν υπάρχει». */
  | { readonly kind: 'indeterminate' };

/**
 * **Υπάρχει γη της οποίας το περίγραμμα περιέχει αυτό το σημείο;**
 *
 * 🔑 **Μόνο γη με ΣΧΗΜΑ μπορεί να απαντήσει.** Μια γη που ξέρουμε ως **σημείο** δεν
 * έχει «μέσα» — και το να ρωτήσουμε «πόσο κοντά είναι το σημείο της;» θα ήταν
 * ακριβώς η **εικασία εγγύτητας** που το §13.3 απαγορεύει. Οπότε δεν ρωτιέται: αυτές
 * οι γαίες απλώς δεν συμμετέχουν στην ερώτηση, και το αποτέλεσμα είναι ειλικρινές —
 * «δεν ξέρω ότι υπάρχει», όχι «δεν υπάρχει».
 */
export async function findLandContaining(
  adminDb: AdminFirestore,
  point: GeoPoint,
): Promise<ContainingLandLookup> {
  // ⚠️ Ίδιος λόγος με το `osmKeyQuery` παραπάνω — κοινό επίπεδο Α, δηλωμένο
  // `mode: 'none'` στο `tenant-config.ts`, και **καμία** δήλωση εξαίρεσης εδώ.
  const snapshot = await adminDb
    .collection(COLLECTIONS.PUBLIC_LANDS)
    .where('position.point.lat', '>=', point.lat - CANDIDATE_BAND_DEGREES)
    .where('position.point.lat', '<=', point.lat + CANDIDATE_BAND_DEGREES)
    .limit(CANDIDATE_READ_LIMIT)
    .get();

  for (const doc of snapshot.docs) {
    const land = doc.data() as PublicLand;
    if (land.position.kind !== 'known') continue;

    const outline = 'outline' in land.position ? land.position.outline : undefined;
    if (outline === undefined || outline.length < 3) continue;

    if (isPointInGeoOutline(point, outline)) return { kind: 'found', land };
  }

  // ⚠️ Ο έλεγχος ορίου έρχεται **ΜΕΤΑ** τη σάρωση, επίτηδες: αν βρέθηκε περιέχουσα
  // γη μέσα στους πρώτους 500, η απάντηση είναι **γνωστή** και το όριο άσχετο.
  return snapshot.size >= CANDIDATE_READ_LIMIT ? { kind: 'indeterminate' } : { kind: 'none' };
}
