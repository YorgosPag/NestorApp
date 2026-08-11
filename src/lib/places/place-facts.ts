/**
 * @fileoverview **ΧΕΙΡΟΝΟΜΙΑ + ΠΗΓΗ → ΤΑ ΠΕΔΙΑ ΤΟΥ ΕΠΙΠΕΔΟΥ Α** — και ο κανόνας συγχώνευσης.
 * @related ADR-777 · SPEC-777A §13.3 · §13.4 (ODbL) · §14.3 (ιεραρχία) · §14.4
 * @module lib/places/place-facts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΕΔΩ ΖΕΙ Η **ΠΡΑΞΗ** ΤΗΣ ΣΥΓΧΩΝΕΥΣΗΣ — ο κανόνας υπήρχε και δεν τον καλούσε κανείς
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `location-provenance.ts` έγραψε τον κανόνα του §14.3 (`outranksForLocation` /
 * `outranksForFact`) και το SPEC-777A §13.7 τον κατέγραψε ως *«ο **κανόνας** γράφτηκε·
 * η **πράξη** όχι»* — **κανένας καλών**. Ένας κανόνας χωρίς καλούντα είναι σχόλιο (το
 * ίδιο σχήμα με το CHECK 3.36). Αυτό το αρχείο είναι ο καλών.
 *
 * 🔴 **ΠΟΤΕ `locationKnowledgeStep` ΩΣ ΚΡΙΤΗΡΙΟ ΝΙΚΗΣ** (Π1 του handoff). Η σκάλα του
 * §21.4 **δεν είναι σειρά αξιοπιστίας**: το σκαλοπάτι **5** (`document-only`) σημαίνει
 * *«έγγραφο ναι, **θέση όχι**»* ενώ το **4** (`osm`) δίνει σχήμα. Όποιος συγκρίνει
 * σκαλοπάτια αφήνει **ανύπαρκτη** θέση να σβήσει **υπαρκτή** — για **όλους** τους
 * χρήστες ταυτόχρονα. Εδώ δεν χρειάζεται να το θυμάται κανείς: το `document-only`
 * **δεν είναι χειρονομία** ({@link PlaceClaim}), άρα δεν υπάρχει τιμή να συγκριθεί.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔶 ΓΙΑΤΙ ΤΟ `displayAddress` ΕΡΧΕΤΑΙ **ΜΟΝΟ** ΑΠΟ ΕΤΙΚΕΤΕΣ OSM — μετρημένη απόφαση
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μετρήθηκε (Overpass, 2026-08-11, κέντρο Θεσσαλονίκης, 143 κτίρια): **66 (46 %)**
 * έχουν `addr:street` **και** `addr:housenumber`. Δηλαδή **54 % των κτιρίων θα
 * εμφανίζονται χωρίς διεύθυνση** — και ο πειρασμός ήταν να καλυφθεί το κενό με
 * **αντίστροφη γεωκωδικοποίηση** του κέντρου τους.
 *
 * **Απορρίφθηκε, και ο λόγος δεν είναι κόπος — είναι προέλευση.** Η αντίστροφη
 * γεωκωδικοποίηση σε ένα σημείο επιστρέφει την **πλησιέστερη** διεύθυνση, που μπορεί
 * να ανήκει σε **άλλο κτίριο**. Γράφοντάς την ως τη διεύθυνση **αυτού** του κτιρίου
 * στο **κοινό** επίπεδο Α, φτιάχνουμε ισχυρισμό που **κανείς δεν έκανε** — και το
 * §14.4 ανοίγει ακριβώς με αυτό: *«ένα λάθος εκεί είναι λάθος για **όλους**
 * ταυτόχρονα»*. Το πεδίο είναι εξάλλου `string | null` **χωρίς** προέλευση, σε
 * αντίθεση με κάθε άλλο γεγονός του επιπέδου Α που φοράει {@link Attested} — άρα δεν
 * υπάρχει καν τρόπος να σημανθεί ως «κατά προσέγγιση».
 *
 * `null` σημαίνει *«δεν έχει λυθεί»*, το λέει ο ίδιος ο τύπος, και είναι **ειλικρινές**.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις. Καμία εξάρτηση από δίκτυο ή Firestore.
 */

import { formatContactAddressLine } from '@/utils/address/address-line';
import { geoOutlineAreaSqm } from '@/lib/geo/geo-ring';
import {
  outranksForFact,
  outranksForLocation,
  type Attested,
  type LocationProvenance,
  type PlaceFactSource,
} from '@/lib/location/location-provenance';
import type { GeoOutline, GeoPoint } from '@/types/geo/coordinates';
import {
  positionProvenance,
  type OsmReference,
  type PlacePosition,
  type PublicBuilding,
  type PublicLand,
} from '@/types/geo/public-place';
import type { GeocodingAccuracy } from '@/lib/geocoding/geocoding-types';

// =============================================================================
// 1. ΤΙ ΜΑΘΑΜΕ — το αποτέλεσμα ΤΗΣ ΕΠΑΛΗΘΕΥΣΗΣ, όχι ό,τι είπε ο πελάτης
// =============================================================================

/**
 * Ό,τι ο **διακομιστής** έμαθε για έναν τόπο, αφού επαλήθευσε την πηγή.
 *
 * 🔑 **Δεν προέρχεται από το σώμα του αιτήματος.** Το σημείο ενός κτιρίου OSM το
 * έδωσε το Overpass· το σημείο μιας διεύθυνσης το έδωσε ο geocoder· μόνο η πινέζα και
 * το περίγραμμα είναι **αυτούσια η χειρονομία** — και αυτά είναι, εξ ορισμού, «ό,τι
 * δήλωσε ο άνθρωπος» (§14.3: *«ο χρήστης δεν αλλάζει το κοινό, **προτείνει**»*).
 */
export interface ResolvedPlaceFacts {
  readonly provenance: LocationProvenance;
  readonly point: GeoPoint;
  /**
   * ⛔ **Μένει `null` όταν η προέλευση είναι `osm`** — ODbL, §13.4. Ο τύπος
   * {@link PlacePosition} το κάνει ήδη αδύνατο· εδώ είναι το σημείο όπου κάποιος θα
   * μπορούσε να το **γεμίσει** κατά λάθος από τη ζωντανή άντληση.
   */
  readonly outline: GeoOutline | null;
  readonly osmRef: OsmReference | null;
  /** Μόνο για `geocoded` — η ακρίβεια είναι ιδιότητα **συμπεράσματος μηχανής**. */
  readonly accuracy: GeocodingAccuracy | null;
  readonly displayAddress: string | null;
  readonly floorsAboveGround: number | null;
  readonly constructionYear: number | null;
}

/**
 * Μέρη διεύθυνσης → **μία** γραμμή για το επίπεδο Α, ή `null`.
 *
 * 🔑 **Μία μορφοποίηση για ΚΑΙ ΤΙΣ ΔΥΟ πηγές διεύθυνσης** — τις ετικέτες OSM
 * (`addr:street`/`addr:housenumber`/…) και τα `resolvedFields` του geocoder, που
 * τυχαίνει να έχουν **ταυτόσημο σχήμα**. Δύο συνθέσεις θα έδιναν την ίδια διεύθυνση
 * γραμμένη **δύο τρόπους**, ανάλογα με το ποια χειρονομία γέννησε τον τόπο — και θα
 * φαινόταν σε λίστα, δίπλα-δίπλα.
 *
 * ⚠️ **Χωρίς οδό, καμία διεύθυνση.** Ένα σκέτο «Θεσσαλονίκη» ως `displayAddress` είναι
 * **χειρότερο** από `null`, γιατί *μοιάζει* με απάντηση: το `null` λέει «δεν έχει
 * λυθεί», ενώ η πόλη λέει «αυτή είναι η διεύθυνση» και είναι ψέμα.
 */
export function placeAddressLine(parts: {
  readonly street: string | null | undefined;
  readonly houseNumber: string | null | undefined;
  readonly city: string | null | undefined;
  readonly postalCode: string | null | undefined;
}): string | null {
  if (parts.street === null || parts.street === undefined || parts.street.trim() === '') {
    return null;
  }

  const line = formatContactAddressLine({
    street: parts.street,
    number: parts.houseNumber ?? undefined,
    city: parts.city ?? undefined,
    postalCode: parts.postalCode ?? undefined,
    // Ο SSoT μορφοποιεί τον Τ.Κ. κατά ΕΛΤΑ **μόνο** για ελληνική διεύθυνση, και η
    // περιοχή εξυπηρέτησης είναι δηλωμένη (`place-claim-validation.ts`).
    country: 'GR',
  });

  return line === '' ? null : line;
}

// =============================================================================
// 2. ΓΕΓΟΝΟΤΑ → ΘΕΣΗ (η διακριτή ένωση του §13.4)
// =============================================================================

/**
 * Τα γεγονότα ως {@link PlacePosition}.
 *
 * ⚠️ **Κάθε κλάδος γράφεται ρητά, χωρίς `default`** — μια νέα προέλευση **δεν
 * μεταγλωττίζεται** μέχρι κάποιος να αποφασίσει αν επιτρέπεται να κουβαλά σχήμα. Αυτό
 * είναι το νομικό όριο του ODbL σε μορφή που ο μεταγλωττιστής επιβάλλει.
 */
export function positionFrom(facts: ResolvedPlaceFacts, locatedAt: string): PlacePosition {
  const base = { kind: 'known', point: facts.point, locatedAt } as const;

  switch (facts.provenance) {
    case 'osm':
      // ⛔ Καμία διαδρομή για `outline` — ούτε αν το `facts.outline` είναι γεμάτο.
      return facts.osmRef === null
        ? { kind: 'unknown' }
        : { ...base, provenance: 'osm', osmRef: facts.osmRef };

    case 'geocoded':
      return facts.accuracy === null
        ? { kind: 'unknown' }
        : { ...base, provenance: 'geocoded', accuracy: facts.accuracy };

    case 'manual':
      return { ...base, provenance: 'manual' };

    case 'drawn':
    case 'survey':
    case 'bim':
      return facts.outline === null
        ? { ...base, provenance: facts.provenance }
        : { ...base, provenance: facts.provenance, outline: facts.outline };
  }
}

/** Γεγονός με προέλευση, ή `null` όταν δεν το ξέρουμε. */
function attest<T>(value: T | null, source: PlaceFactSource, at: string): Attested<T> | null {
  return value === null ? null : { value, source, attestedAt: at };
}

/**
 * Το **εμβαδόν** της γης, όταν η χειρονομία το παρήγαγε.
 *
 * 🔑 **Δεν ζητιέται από τον άνθρωπο.** Αν ζωγράφισε το οικόπεδο, το σχήμα **ξέρει ήδη**
 * πόσο είναι — και ένα ξεχωριστό πεδίο θα ήταν δεύτερη αλήθεια που μια μέρα θα
 * διαφωνούσε με το σχήμα.
 */
function areaFrom(facts: ResolvedPlaceFacts, at: string): Attested<number> | null {
  if (facts.outline === null) return null;
  const sqm = geoOutlineAreaSqm(facts.outline);
  return sqm <= 0 ? null : { value: Math.round(sqm), source: facts.provenance, attestedAt: at };
}

// =============================================================================
// 3. ΓΕΝΝΗΣΗ
// =============================================================================

export function newPublicLand(
  id: string,
  facts: ResolvedPlaceFacts,
  at: string,
): PublicLand {
  return {
    id,
    position: positionFrom(facts, at),
    displayAddress: facts.displayAddress,
    areaSqm: areaFrom(facts, at),
    createdAt: at,
    updatedAt: at,
  };
}

export function newPublicBuilding(
  id: string,
  landId: string,
  facts: ResolvedPlaceFacts,
  at: string,
): PublicBuilding {
  return {
    id,
    landId,
    footprint: positionFrom(facts, at),
    floorsAboveGround: attest(facts.floorsAboveGround, facts.provenance, at),
    constructionYear: attest(facts.constructionYear, facts.provenance, at),
    // 🔶 Δες την επικεφαλίδα του `osm-building.ts`: η **χρήση** χρειάζεται
    // χαρτογράφηση προς κλειστό δικό μας λεξιλόγιο (N.11), που είναι απόφαση τομέα.
    useCode: null,
    createdAt: at,
    updatedAt: at,
  };
}

// =============================================================================
// 4. Η ΣΥΓΧΩΝΕΥΣΗ — §14.3, πεδίο προς πεδίο
// =============================================================================

/**
 * Τι άλλαξε σε μια συγχώνευση. **Κενός πίνακας = τίποτα δεν νίκησε**, και αυτό είναι
 * **επιτυχία**, όχι αποτυχία: σημαίνει ότι η υπάρχουσα γνώση ήταν ήδη ισχυρότερη.
 */
export const PLACE_MERGE_FIELDS = [
  'position',
  'displayAddress',
  'areaSqm',
  'floorsAboveGround',
  'constructionYear',
] as const;

export type PlaceMergeField = (typeof PLACE_MERGE_FIELDS)[number];

/**
 * **Επιτρέπεται σε αυτά τα γεγονότα να αντικαταστήσουν τη γη;**
 *
 * 🔴 Ο κανόνας είναι **ένας** και ζει στο `location-provenance.ts`:
 * *μετρημένο > δημόσιος χάρτης > δηλωμένο*, και **ισοβαθμία ⇒ ΟΧΙ**. Δύο πηγές ίδιας
 * βαθμίδας που διαφωνούν είναι **σύγκρουση προς επίλυση από άνθρωπο** — και σε
 * **κοινό** επίπεδο, το «το τελευταίο νικά» σημαίνει ότι ο τελευταίος που πάτησε
 * αποθήκευση ξαναγράφει την πραγματικότητα για **όλους**.
 *
 * ⚠️ **Η διεύθυνση ακολουθεί τη ΘΕΣΗ, όχι δική της κατάταξη.** Δεν είναι παράλειψη:
 * το `displayAddress` **δεν κουβαλά προέλευση** (δες την επικεφαλίδα), οπότε μια
 * ανεξάρτητη σύγκριση δεν έχει με τι να γίνει. Δένεται στη θέση επειδή από εκεί
 * ήρθε — και μόνο όταν εκείνη νικά.
 */
export function mergeIntoLand(
  existing: PublicLand,
  facts: ResolvedPlaceFacts,
  at: string,
): { readonly land: PublicLand; readonly changed: readonly PlaceMergeField[] } {
  const changed: PlaceMergeField[] = [];
  let land = existing;

  const positionWins = outranksForLocation(facts.provenance, positionProvenance(existing.position));
  if (positionWins) {
    land = { ...land, position: positionFrom(facts, at) };
    changed.push('position');

    // ⚠️ Η νέα διεύθυνση αντικαθιστά **μόνο αν υπάρχει**: μια ισχυρότερη πηγή θέσης
    // που δεν ξέρει διεύθυνση δεν πρέπει να **σβήσει** μια γνωστή.
    if (facts.displayAddress !== null && facts.displayAddress !== land.displayAddress) {
      land = { ...land, displayAddress: facts.displayAddress };
      changed.push('displayAddress');
    }
  }

  const area = areaFrom(facts, at);
  if (area !== null && outranksForFact(area.source, existing.areaSqm?.source ?? null)) {
    land = { ...land, areaSqm: area };
    changed.push('areaSqm');
  }

  return {
    land: changed.length === 0 ? existing : { ...land, updatedAt: at },
    changed,
  };
}

/** Ό,τι και το {@link mergeIntoLand}, για το κτίριο. */
export function mergeIntoBuilding(
  existing: PublicBuilding,
  facts: ResolvedPlaceFacts,
  at: string,
): { readonly building: PublicBuilding; readonly changed: readonly PlaceMergeField[] } {
  const changed: PlaceMergeField[] = [];
  let building = existing;

  if (outranksForLocation(facts.provenance, positionProvenance(existing.footprint))) {
    building = { ...building, footprint: positionFrom(facts, at) };
    changed.push('position');
  }

  const floors = attest(facts.floorsAboveGround, facts.provenance, at);
  if (floors !== null && outranksForFact(floors.source, existing.floorsAboveGround?.source ?? null)) {
    building = { ...building, floorsAboveGround: floors };
    changed.push('floorsAboveGround');
  }

  const year = attest(facts.constructionYear, facts.provenance, at);
  if (year !== null && outranksForFact(year.source, existing.constructionYear?.source ?? null)) {
    building = { ...building, constructionYear: year };
    changed.push('constructionYear');
  }

  return {
    building: changed.length === 0 ? existing : { ...building, updatedAt: at },
    changed,
  };
}
