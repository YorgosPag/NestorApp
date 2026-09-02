/**
 * @fileoverview **ΤΑ ΧΑΡΑΚΤΗΡΙΣΤΙΚΑ ΤΟΥ ΑΚΙΝΗΤΟΥ → ΔΗΜΟΣΙΑ** (ADR-842 Φ3).
 * @related ADR-842 §5 (Α3 · Α4) · ADR-777 §7 · ./public-listing-projection
 * @module services/listings/public-listing-attributes
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ — ΚΑΙ ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ ΑΠΛΗ ΑΝΤΙΓΡΑΦΗ ΠΕΔΙΩΝ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `public-listing-projection.ts` ήταν στις **447** γραμμές· είκοσι τρία πεδία με το
 * «γιατί» τους θα το περνούσαν κατά πολύ (N.7.1). Το προηγούμενο σπάσιμο του ίδιου
 * αρχείου (Α12.10) το τεκμηριώνει: *«η θεραπεία είναι ΕΞΑΓΩΓΗ, ποτέ ψαλίδισμα
 * σχολίων»*.
 *
 * Και υπάρχει δεύτερος, ισχυρότερος λόγος: **αυτό εδώ δεν αντιγράφει, ΚΡΙΝΕΙ.**
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΚΡΙΣΗ: «ΕΙΝΑΙ ΑΥΤΗ Η ΤΙΜΗ ΟΝΟΜΑΣΙΜΗ;» — ΚΑΙ ΓΙΑΤΙ ΟΧΙ `as`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο {@link ProjectableProperty} είναι **δομικός** και διαβάζει ωμό έγγραφο Firestore:
 * τα λεξιλογικά του πεδία είναι `string`, όχι `ConditionType`. Ο εύκολος δρόμος ήταν
 * `condition: property.condition as ConditionType` — **απορρίφθηκε**, και όχι για
 * λόγους ύφους: ένα `'Καλή'` γραμμένο από παλιά φόρμα θα ταξίδευε αυτούσιο στο κλειστό
 * σχήμα, η οθόνη θα ζητούσε `properties-enums:condition.Καλή`, και θα ζωγράφιζε **ωμό
 * κλειδί στον ανώνυμο επισκέπτη** — η ακριβής οικογένεια που το repo έχει πληρώσει
 * τέσσερις φορές (CHECK 3.34 · 3.36 · 3.51).
 *
 * ⇒ Κάθε λεξιλογική τιμή **επαληθεύεται έναντι της αυθεντίας της Φ1**
 * (`constants/property-features-enterprise.ts`). Ό,τι δεν αναγνωρίζεται γίνεται
 * `null` — δηλαδή **«δεν το ξέρουμε»**, που είναι η αλήθεια.
 *
 * 🔑 **Είναι το ίδιο ακριβώς πρότυπο με το `type`**, όπου το «δηλωμένο» σημαίνει
 * **ονομάσιμο** και όχι «μη κενό» (`isAttributeDeclared` → `normalizePropertyType`).
 * Η Φ3 απλώς το εφαρμόζει και στα υπόλοιπα δεκατρία λεξιλόγια, αντί να το αφήσει
 * μοναδική εξαίρεση.
 *
 * 🏆 **Και δίνει στη Φ1 τον πρώτο ΠΡΑΓΜΑΤΙΚΟ καταναλωτή της**: οι κατάλογοι τιμών
 * έπαψαν να είναι μόνο dropdown — είναι πλέον **το φίλτρο που στέκεται ανάμεσα στη
 * βάση και στον κόσμο**.
 */

import {
  AMENITIES,
  CONDITIONS,
  COOLING_TYPES,
  ENERGY_CLASSES,
  FLOORINGS,
  FRAMES,
  FUEL_TYPES,
  GLAZINGS,
  HEATING_TYPES,
  INTERIOR_FEATURES,
  ORIENTATIONS,
  SECURITY_FEATURES,
  WATER_HEATING_TYPES,
} from '@/constants/property-features-enterprise';
import type { ListingAttributeFields } from '@/types/public-listing';

import type { ProjectableProperty } from './public-listing-projection-types';

// ============================================================================
// ΟΙ ΔΥΟ ΚΡΙΤΕΣ — μία υλοποίηση ο καθένας, δεκατρείς χρήσεις
// ============================================================================

/**
 * Η τιμή, **αν ανήκει στο λεξιλόγιο**· αλλιώς `null`.
 *
 * ⚠️ **ΓΕΝΙΚΟΣ ΕΠΙΤΗΔΕΣ.** Το ιδίωμα του repo είναι σήμερα ένας **χειρόγραφος type
 * guard ανά λεξιλόγιο** (`isX(value): value is XType`) — μετρήθηκαν **13** τέτοιοι
 * (`commercial-statuses` · `project-statuses` · `mandate-actions` · `floor-naming` …),
 * όλοι το ίδιο σώμα. Δεκατρείς ακόμη εδώ θα ήταν **δίδυμοι κλώνοι μέσα στο ίδιο
 * commit** — ακριβώς αυτό που το `jscpd:diff` (N.18) υπάρχει για να πιάσει.
 *
 * 📌 Η **κεντρικοποίηση των 13 υπαρχόντων** είναι μεγαλύτερη από αυτή την εργασία και
 * ζει στο `.claude-rules/pending-ratchet-work.md` (κανόνας N.0.2).
 */
function vocabularyValue<T extends string>(
  vocabulary: readonly T[],
  value: unknown
): T | null {
  return typeof value === 'string' && (vocabulary as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

/**
 * Ένα **σύνολο** τιμών του λεξιλογίου — με τις **τρεις** καταστάσεις άθικτες.
 *
 * | Είσοδος | Έξοδος | Σημασία |
 * |---|---|---|
 * | `undefined` / `null` / μη πίνακας | `null` | **κανείς δεν ρώτησε** |
 * | `[]` | `[]` | ρωτήθηκε, απάντηση **«καμία»** |
 * | `['tiles','wood']` | `['tiles','wood']` | ρωτήθηκε, υπάρχουν |
 *
 * 🔴 **ΚΑΙ Η ΤΕΤΑΡΤΗ ΕΙΣΟΔΟΣ ΕΙΝΑΙ Η ΕΝΔΙΑΦΕΡΟΥΣΑ**: `['ξύλο']` — μη κενή, αλλά
 * **κανένα** μέλος δεν είναι ονομάσιμο. Επιστρέφεται **`null`**, όχι `[]`, και είναι
 * απόφαση: το `[]` σημαίνει *«ο κάτοχος είπε καμία»* — ένας ισχυρισμός **για
 * λογαριασμό του** που θα ήταν **ψευδής**. Το `null` λέει *«δεν ξέρουμε»*, που είναι
 * ό,τι πραγματικά ισχύει όταν το μόνο που κρατάμε είναι μη αναγνωρίσιμο.
 *
 * ⚠️ **Μερική αναγνώριση κρατά ό,τι σώθηκε** (`['tiles','ξύλο'] → ['tiles']`): εκεί
 * υπάρχει γνώση που μπορεί να ειπωθεί, και η σιωπή θα την πετούσε.
 */
function vocabularySet<T extends string>(
  vocabulary: readonly T[],
  values: unknown
): readonly T[] | null {
  if (!Array.isArray(values)) return null;
  const known = values
    .map((value) => vocabularyValue(vocabulary, value))
    .filter((value): value is T => value !== null);

  if (known.length === 0) return values.length === 0 ? [] : null;
  return known;
}

/** Καθαρίζει αριθμό: `0` είναι **υπαρκτή τιμή**· μόνο η απουσία γίνεται `null`. */
function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

// ============================================================================
// Η ΧΑΡΤΟΓΡΑΦΗΣΗ — μία οικογένεια ανά συνάρτηση (N.7.1)
// ============================================================================

/** Ενεργειακή κλάση · κατάσταση · ανακαίνιση. */
function projectEnergyAndCondition(
  property: ProjectableProperty
): Pick<ListingAttributeFields, 'energyClass' | 'condition' | 'renovationYear'> {
  return {
    // ⛔ **ΜΟΝΟ Η ΚΛΑΣΗ.** Το `Property.energy` κουβαλά `certificateId` ·
    //    `certificateDate` · `validUntil` — ταυτότητα και ημερομηνίες **μητρώου**.
    //    Ίδιος κανόνας με το `legality` (ADR-838): φεύγει η **βαθμίδα**, ποτέ το
    //    έγγραφο.
    energyClass: vocabularyValue(ENERGY_CLASSES, property.energy?.class),
    condition: vocabularyValue(CONDITIONS, property.condition),
    renovationYear: numberOrNull(property.renovationYear),
  };
}

/** Δωμάτια και εμβαδά. */
function projectRoomsAndAreas(
  property: ProjectableProperty
): Pick<
  ListingAttributeFields,
  | 'bathrooms'
  | 'wc'
  | 'totalRooms'
  | 'levels'
  | 'balconies'
  | 'netAreaSqm'
  | 'balconyAreaSqm'
  | 'terraceAreaSqm'
  | 'gardenAreaSqm'
> {
  return {
    // 🔴 **`0` ΤΑΞΙΔΕΥΕΙ**: `wc: 0` = χωρίς ξεχωριστό WC, `balconies: 0` = χωρίς
    //    μπαλκόνι. Και τα δύο είναι **απαντήσεις**, όχι κενά — δες `numberOrNull`.
    bathrooms: numberOrNull(property.layout?.bathrooms),
    wc: numberOrNull(property.layout?.wc),
    totalRooms: numberOrNull(property.layout?.totalRooms),
    levels: numberOrNull(property.layout?.levels),
    balconies: numberOrNull(property.layout?.balconies),
    netAreaSqm: numberOrNull(property.areas?.net),
    balconyAreaSqm: numberOrNull(property.areas?.balcony),
    terraceAreaSqm: numberOrNull(property.areas?.terrace),
    gardenAreaSqm: numberOrNull(property.areas?.garden),
  };
}

/** Συστήματα, κουφώματα, υαλοπίνακες. */
function projectSystems(
  property: ProjectableProperty
): Pick<
  ListingAttributeFields,
  'heatingType' | 'heatingFuel' | 'coolingType' | 'waterHeating' | 'windowFrames' | 'glazing'
> {
  const systems = property.systemsOverride ?? null;
  const finishes = property.finishes ?? null;

  return {
    heatingType: vocabularyValue(HEATING_TYPES, systems?.heatingType),
    heatingFuel: vocabularyValue(FUEL_TYPES, systems?.heatingFuel),
    coolingType: vocabularyValue(COOLING_TYPES, systems?.coolingType),
    waterHeating: vocabularyValue(WATER_HEATING_TYPES, systems?.waterHeating),
    windowFrames: vocabularyValue(FRAMES, finishes?.windowFrames),
    glazing: vocabularyValue(GLAZINGS, finishes?.glazing),
  };
}

/** Τα **σύνολα** — δάπεδα, προσανατολισμοί, παροχές. */
function projectFeatureSets(
  property: ProjectableProperty
): Pick<
  ListingAttributeFields,
  'flooring' | 'orientations' | 'interiorFeatures' | 'securityFeatures' | 'amenities'
> {
  return {
    flooring: vocabularySet(FLOORINGS, property.finishes?.flooring),
    orientations: vocabularySet(ORIENTATIONS, property.orientations),
    interiorFeatures: vocabularySet(INTERIOR_FEATURES, property.interiorFeatures),
    securityFeatures: vocabularySet(SECURITY_FEATURES, property.securityFeatures),
    // ⚠️ **Το όνομα ΑΛΛΑΖΕΙ στο σύνορο, και είναι σωστό**: στο `Property` λέγεται
    //    `propertyAmenities` επειδή εκεί συνυπάρχει με τις παροχές του **κτιρίου**·
    //    στη δημόσια αγγελία δεν υπάρχει τίποτα να ξεχωρίσει, και το πρόθεμα θα ήταν
    //    θόρυβος από σχήμα που ο επισκέπτης δεν βλέπει.
    amenities: vocabularySet(AMENITIES, property.propertyAmenities),
  };
}

/**
 * **Το ακίνητο → τα δημόσια χαρακτηριστικά του.** Καθαρή συνάρτηση.
 *
 * ⚠️ **Καμία πύλη πολιτικής εδώ.** Η ερώτηση *«επιτρέπεται να το δει ο κόσμος;»*
 * απαντιέται **μία** φορά, στο `buildPublicListing` — ίδια διάκριση με το
 * `projectListingShape` (σχήμα) έναντι της πύλης (πολιτική).
 */
export function projectListingAttributes(
  property: ProjectableProperty
): ListingAttributeFields {
  return {
    ...projectEnergyAndCondition(property),
    ...projectRoomsAndAreas(property),
    ...projectSystems(property),
    ...projectFeatureSets(property),
  };
}
