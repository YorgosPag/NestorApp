/**
 * @fileoverview **Η ΕΠΑΛΗΘΕΥΣΗ ΠΗΓΗΣ** — ο §14.4 κανόνας 2, εκτελεσμένος.
 * @related ADR-777 · SPEC-777A §13.4 · §14.3 · §14.4 · lib/places/place-claim.ts
 * @module services/places/place-source-verification
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΣΗΜΑΙΝΕΙ «ΕΠΑΛΗΘΕΥΣΗ ΠΗΓΗΣ» ΓΙΑ ΚΑΘΕ ΧΕΙΡΟΝΟΜΙΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Χειρονομία | Ποιος είναι η **πηγή** | Τι κάνει ο διακομιστής |
 * |---|---|---|
 * | `picked-osm-building` | το **OpenStreetMap** | **ξαναρωτά το Overpass**: υπάρχει; είναι κτίριο; και παίρνει **από εκεί** σημείο/διεύθυνση/ορόφους |
 * | `typed-address` | ο **geocoder** | **γεωκωδικοποιεί ο ίδιος** — ποτέ δεν δέχεται σημείο από τον πελάτη |
 * | `dropped-pin` | ο **άνθρωπος** | η χειρονομία **είναι** η πηγή· ελέγχεται μόνο δομικά |
 * | `drew-outline` | ο **άνθρωπος** | το ίδιο — και το **εμβαδόν** προκύπτει από το σχήμα |
 *
 * 🔑 **Οι δύο τελευταίες δεν είναι «ανεπαλήθευτες» — είναι ΑΥΤΟΑΠΟΔΕΙΚΤΕΣ.** Το §14.3
 * λέει ότι το επίπεδο Α *«δέχεται **πηγές**»*, και ένας συνδεδεμένος άνθρωπος που
 * δείχνει σημείο **είναι** πηγή, της βαθμίδας «δηλωμένο». Η κατάταξη — όχι η άρνηση —
 * είναι ο μηχανισμός που τον κρατά στη θέση του: το `manual`/`drawn` **δεν μπορεί** να
 * σβήσει `osm` ή `survey`.
 *
 * ⚠️ **Ο πελάτης ΔΕΝ στέλνει ποτέ σημείο για τις δύο πρώτες.** Αν το έκανε, η
 * «επαλήθευση» θα ήταν διακοσμητική: θα ρωτούσαμε το Overpass αν υπάρχει το κτίριο και
 * μετά θα γράφαμε τις **συντεταγμένες του πελάτη**.
 *
 * 🔶 **Δηλωμένο χρέος στρωμάτωσης**: το `geocode()` ζει σε
 * `app/api/geocoding/geocoding-engine.ts` — δηλαδή μια **βιβλιοθήκη κάτω από φάκελο
 * διαδρομών**. Η εισαγωγή από `services/` είναι αντιστροφή στρώματος και **δηλώνεται
 * αντί να «λυθεί»**: η εναλλακτική θα ήταν **δεύτερος geocoder**, που είναι ασύγκριτα
 * χειρότερο (ADR-749). Η μετακόμιση του engine σε `lib/` είναι ξεχωριστή δουλειά.
 */

import 'server-only';

import { geocode } from '@/app/api/geocoding/geocoding-engine';
import { addressLineToQuery } from '@/lib/geocoding/address-line-query';
import { vertexCentroid } from '@/lib/geo/geo-ring';
import {
  findOsmBuildingAt,
  verifyOsmBuilding,
  type OsmBuildingFact,
  type OsmBuildingPick,
} from '@/lib/geo/osm/osm-building';
import {
  placeClaimDefect,
  type PlaceClaimDefect,
} from '@/lib/places/place-claim-validation';
import { provenanceOfClaim, type PlaceClaim } from '@/lib/places/place-claim';
import { placeAddressLine, type ResolvedPlaceFacts } from '@/lib/places/place-facts';
import { createModuleLogger } from '@/lib/telemetry';
import type { GeoPoint } from '@/types/geo/coordinates';

const logger = createModuleLogger('place-source-verification');

// =============================================================================
// 1. ΤΟ ΑΠΟΤΕΛΕΣΜΑ — κλειστό σύνολο, καμία σιωπηλή σύμπτυξη
// =============================================================================

/**
 * Γιατί η **πηγή** αρνήθηκε.
 *
 * ⚠️ **Ξεχωριστό από το {@link PlaceClaimDefect}, και δεν συγχωνεύεται.** Το ένα
 * σημαίνει *«αυτό που έκανες δεν είναι σχήμα»* (ο άνθρωπος το διορθώνει αλλάζοντας τη
 * χειρονομία), το άλλο *«ο κόσμος δεν συμφωνεί»* (ο άνθρωπος το διορθώνει διαλέγοντας
 * **άλλο** πράγμα). Ένας κοινός κωδικός θα του έλεγε να ξαναζωγραφίσει κάτι που ήταν
 * σωστά ζωγραφισμένο.
 */
export const PLACE_SOURCE_REJECTIONS = [
  /** Το στοιχείο OSM δεν υπάρχει (πια) — οι εθελοντές σβήνουν (§13.2). */
  'osm-absent',
  /** Υπάρχει, αλλά δεν είναι κτίριο. */
  'osm-not-a-building',
  /** Ο geocoder δεν βρήκε τίποτα για αυτό το κείμενο. */
  'address-not-found',
] as const;

export type PlaceSourceRejection = (typeof PLACE_SOURCE_REJECTIONS)[number];

export type PlaceSourceOutcome =
  | { readonly kind: 'verified'; readonly facts: ResolvedPlaceFacts }
  | { readonly kind: 'malformed'; readonly defect: PlaceClaimDefect }
  | { readonly kind: 'rejected'; readonly reason: PlaceSourceRejection }
  /** 🔴 **ΠΟΤΕ δεν διαβάζεται ως άρνηση** — δες `runOverpassQueryStrict`. */
  | { readonly kind: 'unavailable' };

// =============================================================================
// 2. ΑΠΟ ΓΕΓΟΝΟΤΑ OSM → ΤΑ ΠΕΔΙΑ ΜΑΣ
// =============================================================================

const NOTHING = {
  outline: null,
  accuracy: null,
} as const;

function factsFromOsm(fact: OsmBuildingFact, seenAt: string): ResolvedPlaceFacts {
  return {
    ...NOTHING,
    provenance: 'osm',
    point: fact.point,
    // ⛔ **ODbL (§13.4)**: το `outline` μένει `null` ακόμη κι όταν το είδαμε ζωντανά.
    osmRef: {
      elementType: fact.elementType,
      elementId: fact.elementId,
      // ⚠️ Η στιγμή που το είδαμε **ζωντανό** — και είναι η μόνη εγγύηση που δίνει
      // αυτή η αναφορά: κάθε πεδίο της μπορεί να πάψει να ισχύει χωρίς να το μάθουμε.
      seenAt,
    },
    displayAddress: placeAddressLine(fact.address),
    floorsAboveGround: fact.floorsAboveGround,
    constructionYear: fact.constructionYear,
  };
}

// =============================================================================
// 3. Η ΕΠΑΛΗΘΕΥΣΗ
// =============================================================================

/**
 * **Χειρονομία → ό,τι ο διακομιστής μπόρεσε να επαληθεύσει.**
 *
 * ⚠️ **Η σειρά είναι συμβόλαιο**: πρώτα το **δομικό** ελάττωμα, μετά το δίκτυο. Ένας
 * εκφυλισμένος δακτύλιος δεν αξίζει κλήση προς το Overpass, και — πιο σημαντικό — ένα
 * σφάλμα δικτύου δεν πρέπει να **κρύψει** ένα ελάττωμα που ο άνθρωπος μπορεί να
 * διορθώσει μόνος του.
 *
 * @param at ISO στιγμή — **παράμετρος**, ποτέ ανάγνωση ρολογιού (CHECK 3.7 `date-local`)
 */
export async function verifyPlaceClaim(
  claim: PlaceClaim,
  at: string,
): Promise<PlaceSourceOutcome> {
  const defect = placeClaimDefect(claim);
  if (defect !== null) return { kind: 'malformed', defect };

  switch (claim.gesture) {
    case 'picked-osm-building': {
      const verdict = await verifyOsmBuilding(claim.elementType, claim.elementId);
      switch (verdict.kind) {
        case 'verified':
          return { kind: 'verified', facts: factsFromOsm(verdict.fact, at) };
        case 'absent':
          return { kind: 'rejected', reason: 'osm-absent' };
        case 'not-a-building':
          return { kind: 'rejected', reason: 'osm-not-a-building' };
        case 'unavailable':
          return { kind: 'unavailable' };
      }
    }

    case 'typed-address': {
      // 🔑 **Ο ΔΙΑΚΟΜΙΣΤΗΣ γεωκωδικοποιεί**, με τον **ίδιο** engine που εξυπηρετεί τη
      // φόρμα — και πλέον με τον **ίδιο μεταφραστή** κειμένου→ερωτήματος
      // (`lib/geocoding/address-line-query`). Το «ελεύθερο κείμενο → `city`» ήταν
      // γραμμένο **τρεις φορές**, με σχόλιο που το ονόμαζε «ίδιο ιδίωμα».
      const hit = await geocode(addressLineToQuery(claim.query));
      if (hit === null) return { kind: 'rejected', reason: 'address-not-found' };

      return {
        kind: 'verified',
        facts: {
          ...NOTHING,
          provenance: 'geocoded',
          point: { lat: hit.lat, lng: hit.lng },
          osmRef: null,
          // 🔴 **ΥΠΟΧΡΕΩΤΙΚΗ** — ο τύπος `PlacePosition` δεν μεταγλωττίζεται χωρίς
          // αυτήν, και ο λόγος είναι η Α5: ο geocoder γυρίζει σημείο **πάντα**, οπότε
          // «Θεσσαλονίκη» και «Εγνατίας 147» θα ήταν αλλιώς **οπτικά ταυτόσημα**.
          accuracy: hit.accuracy,
          // ⚠️ **Όχι το `displayName`**, που είναι η πολύλογη γραμμή του Nominatim
          // («147, Εγνατία, Θεσσαλονίκη, Δήμος…, Περιφερειακή Ενότητα…, Ελλάδα»).
          // Τα `resolvedFields` έχουν **ταυτόσημο σχήμα** με τις ετικέτες OSM, άρα
          // περνούν από την **ίδια** σύνθεση — και οι δύο διαδρομές γράφουν τη
          // διεύθυνση με τον ίδιο τρόπο.
          displayAddress: placeAddressLine({
            street: hit.resolvedFields.street,
            houseNumber: hit.resolvedFields.number,
            city: hit.resolvedFields.city,
            postalCode: hit.resolvedFields.postalCode,
          }),
          floorsAboveGround: null,
          constructionYear: null,
        },
      };
    }

    case 'dropped-pin':
      return {
        kind: 'verified',
        facts: {
          ...NOTHING,
          provenance: 'manual',
          point: claim.point,
          osmRef: null,
          // ⚠️ **Καμία διεύθυνση.** Ο πειρασμός ήταν αντίστροφη γεωκωδικοποίηση· δες
          // την επικεφαλίδα του `place-facts.ts`: θα έγραφε στο **κοινό** επίπεδο μια
          // διεύθυνση που ίσως ανήκει σε **άλλο** κτίριο, χωρίς πεδίο προέλευσης να
          // το πει.
          displayAddress: null,
          floorsAboveGround: null,
          constructionYear: null,
        },
      };

    case 'drew-outline':
      return {
        kind: 'verified',
        facts: {
          provenance: 'drawn',
          // Το αντιπροσωπευτικό σημείο βγαίνει από το **σχήμα** — ο άνθρωπος δεν
          // χρειάζεται να δείξει και σημείο αφού ζωγράφισε.
          point: vertexCentroid(claim.outline),
          outline: claim.outline,
          osmRef: null,
          accuracy: null,
          displayAddress: null,
          floorsAboveGround: null,
          constructionYear: null,
        },
      };
  }
}

// =============================================================================
// 4. Η ΑΝΑΖΗΤΗΣΗ ΓΙΑ ΤΟΝ ΕΠΙΛΟΓΕΑ — δεν γράφει, μόνο δείχνει
// =============================================================================

/**
 * **Ποιο κτίριο OSM είναι κάτω από αυτό το σημείο**, για την οθόνη επιλογής.
 *
 * 🔑 **Δεν είναι η επαλήθευση, και δεν την αντικαθιστά.** Εδώ ο άνθρωπος **κοιτάζει**·
 * η επαλήθευση τρέχει όταν **υποβάλλει**. Οι δύο κλήσεις μοιάζουν περιττές μαζί, και
 * δεν είναι: ανάμεσά τους ο χρήστης μπορεί να σκεφτεί για ώρα, και το OSM αλλάζει.
 * Η δεύτερη είναι εκείνη που γράφει, άρα εκείνη οφείλει να ρωτήσει.
 */
export async function lookupOsmBuildingAt(point: GeoPoint): Promise<OsmBuildingPick> {
  const pick = await findOsmBuildingAt(point);
  if (pick.kind === 'unavailable') {
    logger.warn('Η άντληση κτιρίου OSM δεν απάντησε', { data: { lat: point.lat, lng: point.lng } });
  }
  return pick;
}
