/**
 * @fileoverview Οι **καθαροί κανόνες** του γραφέα θέσης — ποτέ δίκτυο, ποτέ Firestore.
 * @module lib/geocoding/address-position-rules
 *
 * Εξήχθησαν από το `address-position.ts` (N.7.1) — ADR-332 D27 Βήμα Β. Η **απόφαση**
 * (`resolveAddressPosition`) μένει εκεί· εδώ ζουν οι ερωτήσεις από τις οποίες συντίθεται.
 */

import { distanceMeters } from '@/lib/geo/geo-distance';
import { focusPresentation } from '@/lib/geo/geocoding-focus';
import { DEFAULT_STORED_COUNTRY_CODE, toStoredCountryCode } from '@/utils/address/country-codes';
import { HUMAN_PIN_DRIFT_FLOOR_METRES } from './geocoding-thresholds';
import {
  ADDRESS_IDENTITY_FIELDS,
  type AddressIdentityField,
  type AddressLike,
  type AddressPosition,
  type AddressPositionResolution,
  type GeocodeHit,
  type GeocoderQuery,
  type PositionDrift,
  type PositionTextVerdict,
} from './address-position-types';

type Point = { readonly lat: number; readonly lng: number };

/** Έγκυρο ζεύγος συντεταγμένων. `0` είναι **υπαρκτή τιμή** — μόνο η απουσία είναι απουσία. */
export function readPoint(address: AddressLike): Point | null {
  const lat = address.coordinates?.lat;
  const lng = address.coordinates?.lng;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/**
 * Κανονικοποιημένη τιμή πεδίου ταυτότητας.
 *
 * ⚠️ Το `''`, το `null` και το `undefined` είναι **η ίδια απουσία**. Χωρίς αυτό, μια
 * φόρμα που στέλνει `number: ''` εκεί που η βάση έχει `number: undefined` θα φαινόταν
 * **αλλαγή** και θα ξεκινούσε γεωκωδικοποίηση σε κάθε αποθήκευση — δηλαδή θα έσπαγε την
 * πολιτική **1 αίτημα/δευτερόλεπτο** του Nominatim για μηδέν κέρδος.
 */
function identityValue(address: AddressLike, field: AddressIdentityField): string {
  const raw = address[field];
  return typeof raw === 'string' ? raw.trim() : '';
}

/**
 * **Η ΚΑΝΟΝΙΚΗ ΜΟΡΦΗ ενός πεδίου ταυτότητας** — *τι σημαίνει* η τιμή, όχι *τι γράφτηκε*
 * (ADR-332 D27 **Ζ8**).
 *
 * 🔑 **Η δηλωμένη σημασία της ΑΠΟΥΣΙΑΣ είναι μέρος της ταυτότητας.** Για τη χώρα, το έργο
 * το έχει **ήδη αποφασίσει** σε δύο ανεξάρτητα σημεία, πολύ πριν από αυτόν τον πίνακα:
 * - `utils/address/country-codes.ts` `isGreekAddressCountry` — *«Η κενή χώρα μετράει ως ελληνική»*·
 * - `app/api/geocoding/geocoding-engine.ts` — `if (!params.country || cc === 'gr')`, δηλαδή **η ίδια
 *   η μηχανή** διακλαδώνει με «απόν ≡ gr».
 *
 * Ο κριτής απλώς **δεν το ήξερε**. Εδώ δεν εισάγεται σημασιολογία· ευθυγραμμίζεται με αυτή που
 * ήδη ισχύει — αλλιώς η ίδια διεύθυνση παίρνει **δύο ετυμηγορίες** ανάλογα με το ποιο κάτοπτρο
 * τη ρώτησε (μετρημένο ζωντανά στην ALFA, 2026-09-13).
 *
 * ⚠️ **ΔΕΝ είναι «αγνόησε τα κενά».** Το `isConflict` του `diffAddressFields` (Β9) το κάνει αυτό,
 * και **σωστά** για τον δικό του σκοπό (άνθρωπος vs μηχανή). Εδώ θα ήταν **λάθος**: αν ο άνθρωπος
 * **προσθέσει** Τ.Κ. που δεν υπήρχε, αυτό **είναι** αλλαγή και πρέπει να ξαναλυθεί. Απουσία
 * χώρας ⇒ `'GR'` επειδή αυτό **δηλώνεται**· απουσία Τ.Κ. παραμένει απουσία.
 */
const IDENTITY_CANONICAL: Partial<Record<AddressIdentityField, (raw: string) => string>> = {
  country: (raw) => toStoredCountryCode(raw) ?? DEFAULT_STORED_COUNTRY_CODE,
};

/**
 * Η τιμή **όπως συγκρίνεται**. Ξεχωριστή από το {@link identityValue}, και η διαφορά είναι σκόπιμη:
 *
 * | | τι δίνει | ποιος τη θέλει |
 * |---|---|---|
 * | `identityValue` | **ό,τι είπε ο άνθρωπος** (trim) | `toQuery` (το ερώτημα), `withTrimmedIdentity` (η εγγραφή) |
 * | `identityForComparison` | **τι σημαίνει** (κανονική) | `addressIdentityChanged` (η κρίση) |
 *
 * 🔴 **ΜΗΝ τις ενοποιήσεις.** Αν το `toQuery` άρχιζε να στέλνει κανονικοποιημένη χώρα, κάθε επαφή
 * χωρίς ρητή χώρα θα άρχιζε να στέλνει `countrycodes=gr` στον Nominatim (`geocoding-engine.ts`
 * γράφει την παράμετρο **μόνο** `if (countryCode)`) — δηλαδή **αλλαγή πραγματικής αναζήτησης**,
 * όχι κοσμητική. Το ερώτημα καταγράφει τι ρωτήθηκε· η σύγκριση κρίνει τι σημαίνει.
 */
function identityForComparison(address: AddressLike, field: AddressIdentityField): string {
  const raw = identityValue(address, field);
  const canonical = IDENTITY_CANONICAL[field];
  return canonical ? canonical(raw) : raw;
}

/** Άλλαξε η **γεωγραφική ταυτότητα**; (Το `label`, ο τύπος και η σειρά δεν μετρούν.) */
export function addressIdentityChanged(a: AddressLike | null, b: AddressLike): boolean {
  if (a === null) return true;
  return ADDRESS_IDENTITY_FIELDS.some(
    (f) => identityForComparison(a, f) !== identityForComparison(b, f),
  );
}

/** Άλλαξε το **σημείο**; (Δύο απόντα σημεία δεν είναι αλλαγή.) */
export function pointChanged(a: AddressLike | null, b: AddressLike): boolean {
  const pa = a === null ? null : readPoint(a);
  const pb = readPoint(b);
  if (pa === null && pb === null) return false;
  if (pa === null || pb === null) return true;
  return pa.lat !== pb.lat || pa.lng !== pb.lng;
}

/**
 * Τα πεδία ταυτότητας **χωρίς κενά στα άκρα** — στο ΕΝΑ σύνορο εγγραφής τόπου (ADR-332 D27, Β7).
 *
 * 🔴 Η οδός του ERGO TEST είχε αποθηκευτεί ως «Σαμοθράκης » ⇒ η κάρτα έγραφε «Σαμοθράκης , 16».
 * Η **σύγκριση** ταυτότητας αγνοούσε ήδη τα κενά (`identityValue`)· η **γραφή** όχι.
 */
export function withTrimmedIdentity<T extends AddressLike>(address: T): T {
  const next: Record<string, unknown> = { ...address };
  for (const field of ADDRESS_IDENTITY_FIELDS) {
    const value = address[field];
    if (typeof value === 'string' && value !== value.trim()) next[field] = value.trim();
  }
  return next as T;
}

/** Το ερώτημα προς τη μηχανή — **μόνο** πεδία με περιεχόμενο. */
export function toQuery(address: AddressLike): GeocoderQuery {
  const query: Record<string, string> = {};
  for (const field of ADDRESS_IDENTITY_FIELDS) {
    const value = identityValue(address, field);
    if (value) query[field] = value;
  }
  return query as GeocoderQuery;
}

/** Καμία θέση — η ρητή κενή τιμή, γραμμένη μία φορά. */
export const NO_POSITION: AddressPosition = {
  coordinates: null,
  geocodingMetadata: null,
  source: null,
  verifiedAt: null,
};

/**
 * Η αποθηκευμένη θέση, **αυτούσια** — για τις καταστάσεις που δεν αλλάζουν τίποτα.
 *
 * 🔴 **Αυτούσια σημαίνει ΚΑΙ η φρεσκάδα.** Ως τις 2026-09-10 εδώ γραφόταν `verifiedAt: null`, και
 * το `applyAddressPosition` αφαιρεί το κλειδί όταν είναι `null` ⇒ **κάθε** αποθήκευση που δεν
 * άγγιζε τη θέση (ετικέτα, σειρά, διακοπή δικτύου) **έσβηνε** την ημερομηνία επιβεβαίωσης
 * (άγκυρα Ζ, `address-position-lifecycle.test.ts`).
 */
export function keepStored(stored: AddressLike | null): AddressPosition {
  if (stored === null) return NO_POSITION;
  const point = readPoint(stored);
  if (point === null) return NO_POSITION;
  return {
    coordinates: point,
    geocodingMetadata: stored.geocodingMetadata ?? null,
    // ⚠️ Η προέλευση **συνάγεται από τα ίδια τα δεδομένα**, ίδιο κριτήριο με το
    // `addressToPositionCandidate`: μεταδεδομένα ⇒ μηχανή, σκέτο σημείο ⇒ άνθρωπος.
    // Δεύτερο κριτήριο εδώ θα ήταν δεύτερη αλήθεια για την ίδια ερώτηση (ADR-749).
    source: stored.geocodingMetadata ? 'geocoded' : 'dragged',
    verifiedAt: typeof stored.verifiedAt === 'number' ? stored.verifiedAt : null,
  };
}

/**
 * Το σημείο που είχε τοποθετήσει **άνθρωπος** — `null` αν η θέση ήταν της μηχανής ή δεν υπήρχε.
 *
 * 🔑 **Το ίδιο κριτήριο με το `keepStored`**: σκέτο σημείο ⇒ άνθρωπος, μεταδεδομένα ⇒ μηχανή.
 * Ένα κριτήριο για μία ερώτηση, όχι δύο που θα απέκλιναν (ADR-749).
 */
export function storedHumanPoint(stored: AddressLike | null): Point | null {
  if (stored === null || stored.geocodingMetadata) return null;
  return readPoint(stored);
}

/** «Το σημείο το έβαλε άνθρωπος» — καμία κλίμακα ακρίβειας, φρέσκια επιβεβαίωση. */
export function humanPinned(point: Point, now: number): AddressPositionResolution {
  return {
    outcome: 'human-pinned',
    position: { coordinates: point, geocodingMetadata: null, source: 'dragged', verifiedAt: now },
  };
}

/**
 * Η απάντηση της μηχανής, **ολόκληρη** — σημείο, ακρίβεια **και η ερώτηση που τέθηκε**.
 *
 * 🔑 **Το `query` δεν είναι διακοσμητικό: είναι η ΑΠΟΔΕΙΞΗ** (ADR-332 D27 Ζ6). Χωρίς αυτό, η
 * αποθηκευμένη ακρίβεια ήταν ισχυρισμός **χωρίς αντικείμενο** — κανείς δεν μπορούσε να πει
 * *για ποιο κείμενο* ισχύει. Παράμετρος και όχι επανυπολογισμός από το `incoming`: αυτό που
 * **ρωτήθηκε** είναι το μόνο που δικαιολογεί την απάντηση, και είναι ήδη φτιαγμένο (`toQuery`).
 */
export function geocodedPosition(
  hit: GeocodeHit,
  now: number,
  query: GeocoderQuery,
): AddressPosition {
  return {
    coordinates: { lat: hit.lat, lng: hit.lng },
    geocodingMetadata: {
      confidence: hit.confidence,
      accuracy: hit.accuracy,
      variantUsed: hit.variantUsed ?? 0,
      ...(hit.osmType ? { osmType: hit.osmType } : {}),
      resolvedFor: query,
      // Μόνο η **επιφύλαξη** γράφεται· η απουσία σημαίνει «ταίριαξαν όλα».
      ...(hit.partialMatch === true ? { partialMatch: true } : {}),
    },
    source: 'geocoded',
    verifiedAt: now,
  };
}

/**
 * **ΙΣΧΥΕΙ Η ΑΠΟΘΗΚΕΥΜΕΝΗ ΘΕΣΗ ΓΙΑ ΤΟ ΚΕΙΜΕΝΟ ΠΟΥ ΣΥΝΟΔΕΥΕΙ;** — ADR-332 D27 Ζ6.
 *
 * 🔑 **Καμία νέα σύγκριση.** Ρωτά τον **ίδιο** κριτή που κρίνει κάθε αλλαγή ταυτότητας
 * ({@link addressIdentityChanged}) — το `resolvedFor` **είναι** δομικά ένα `AddressLike`. Ένας
 * δεύτερος κανόνας εδώ θα απέκλινε σιωπηλά από τον πρώτο, και η απόκλιση θα εκδηλωνόταν ως
 * ειδοποίηση που εμφανίζεται ή εξαφανίζεται **χωρίς να αλλάξει τίποτα** (το μάθημα του Β10).
 *
 * ⚠️ **Καθαρή και χωρίς δίκτυο**: τρέχει και στον διακομιστή και στον περιηγητή πάνω στα
 * **ίδια** αποθηκευμένα δεδομένα, άρα και οι δύο πλευρές απαντούν κατ' ανάγκη το ίδιο.
 */
export function positionTextVerdict(address: AddressLike): PositionTextVerdict {
  const metadata = address.geocodingMetadata;
  // Χωρίς ισχυρισμό ακρίβειας δεν υπάρχει τίποτα να ελεγχθεί: πινέζα ανθρώπου ή καμία θέση.
  if (!metadata) return 'not-geocoded';
  const resolvedFor = metadata.resolvedFor;
  // Ισχυρισμός χωρίς απόδειξη ⇒ **άγνοια**. Κάθε εγγραφή πριν το Ζ6 περνά από εδώ, και
  // μια «differs» εδώ θα κατήγγελλε ολόκληρη τη βάση για κάτι που κανείς δεν μέτρησε.
  if (!resolvedFor) return 'unverifiable';
  return addressIdentityChanged(resolvedFor, address) ? 'differs' : 'matches';
}

/**
 * **Πόσο αποκλίνει** η πινέζα του ανθρώπου από τη θέση που δίνει η μηχανή για το **νέο** κείμενο.
 *
 * 🔑 Το όριο είναι `max(αβεβαιότητα της μηχανής, κατώφλι κτιρίου)`: μια πινέζα **μέσα** στον δρόμο
 * που μόνο αυτόν ξέρει η μηχανή (`interpolated`, ~150 μ. ή η μετρημένη έκταση) **δεν** αντιφάσκει
 * με τίποτα. Η αβεβαιότητα έρχεται από τον **έναν** SSoT (`focusPresentation`), όχι από δεύτερο πίνακα.
 */
export function measureDrift(human: Point, hit: GeocodeHit): PositionDrift | null {
  const machine = { lat: hit.lat, lng: hit.lng };
  const { uncertaintyMetres } = focusPresentation({
    point: machine,
    accuracy: hit.accuracy,
    ...(hit.extent ? { extent: hit.extent } : {}),
  });
  const toleranceMetres = Math.max(uncertaintyMetres ?? 0, HUMAN_PIN_DRIFT_FLOOR_METRES);
  const distanceMetres = distanceMeters(human, machine);
  return distanceMetres > toleranceMetres ? { distanceMetres, toleranceMetres } : null;
}
