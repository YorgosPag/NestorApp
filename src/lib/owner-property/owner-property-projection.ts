/**
 * @fileoverview **ΠΡΟΣΦΟΡΑ ΙΔΙΩΤΗ → Η ΙΔΙΑ ΜΗΧΑΝΗ ΠΡΟΒΟΛΗΣ** — καμία δεύτερη έξοδος.
 * @related ADR-777 §7 (Α1 · Α3 · Α5 · Α14 · Α20) · services/listings/public-listing-projection.ts
 * @module lib/owner-property/owner-property-projection
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΟΛΟ ΝΟΗΜΑ ΑΥΤΟΥ ΤΟΥ ΑΡΧΕΙΟΥ ΕΙΝΑΙ ΝΑ ΜΗΝ ΥΠΑΡΞΕΙ ΔΕΥΤΕΡΗ ΜΗΧΑΝΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο ιδιώτης γράφει σε **άλλη συλλογή** από τον επαγγελματία (`owner_properties` vs
 * `properties`, με άλλο πεδίο απομόνωσης και άλλους κανόνες). Θα ήταν **εύκολο** —
 * και θα ήταν το σχήμα του **ADR-749** — να αποκτήσει και **δεύτερο** γραφέα δημόσιας
 * αγγελίας, με δικό του κριτήριο δημοσίευσης και δική του λύση θέσης.
 *
 * Δεν αποκτά. Αυτό το αρχείο κάνει **μία** πράξη: μεταφράζει την
 * {@link OwnerProperty} στα **δύο ορίσματα** που ζητά ήδη το `buildPublicListing` —
 * τη δομική όψη του ακινήτου και τη γνώση του τόπου. Από εκεί και πέρα ο **ίδιος**
 * κώδικας αποφασίζει *«δημοσιεύεται;»* (`isPubliclyListed`), *«ποια θέση νικά;»*
 * (`resolveListingPosition` → `outranksForLocation`) και *«τι φεύγει στον κόσμο;»*
 * (το κλειστό σχήμα `PublicListing`).
 *
 * 🔑 **Και ήταν δυνατό επειδή ο τύπος το προέβλεψε**: το `ProjectableProperty` είναι
 * **δομικό** και το `PlaceKnowledge` λύνεται **από τον καλούντα** — γραμμένο ρητά ως
 * *«η θέση ΔΕΝ ανήκει στο ακίνητο (Α1)· το ακίνητο προσθέτει **όροφο**»*. Ο
 * επαγγελματίας ανεβαίνει την αλυσίδα **ακίνητο → κτίριο → έργο**· ο ιδιώτης **δεν
 * έχει αλυσίδα** — έχει τη δική του δήλωση. Η διαφορά είναι **ακριβώς μία
 * παράμετρος**, και γι' αυτό χωράει σε ένα αρχείο μετάφρασης αντί για δεύτερο αγωγό.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις. Καμία εξάρτηση από Firestore ή React.
 */

import {
  deriveCommercialAmounts,
  deriveCommercialStatus,
  deriveOfferKinds,
} from '@/lib/offers/derive-commercial-status';
import {
  addressToPositionCandidate,
  type PlaceKnowledge,
  type ProjectableProperty,
} from '@/services/listings/public-listing-projection';
import { isOwnerPropertyOnTheMarket, type OwnerProperty } from '@/types/owner-property';

/**
 * **Το ακίνητο του ιδιώτη, όπως το βλέπει η προβολή.**
 *
 * ⚠️ **Τα τρία παραγόμενα πεδία δεν γράφονται στο έγγραφο** — παράγονται **εδώ, τη
 * στιγμή της προβολής**, από τις διαθέσεις. Η **Α20** το ορίζει: το
 * `commercialStatus` *«παύει να είναι **δήλωση** και γίνεται **ΠΑΡΑΓΟΜΕΝΟ**»*, και
 * δύο εγγράψιμα πεδία για το ίδιο γεγονός είναι **δύο αλήθειες**. Στο `properties` το
 * επιβάλλει ο `property-mutation-gateway` (πετά αν ο καλών τα στείλει)· εδώ το
 * επιβάλλει ο **τύπος**: η {@link OwnerProperty} απλώς **δεν τα έχει**.
 *
 * 🔑 **Το `layout.bedrooms` και το `areas.gross` είναι το παλιό σχήμα, όχι επιλογή
 * ύφους**: το `buildPublicListing` διαβάζει `property.areas?.gross` και
 * `property.layout?.bedrooms`. Η μετάφραση γίνεται **εδώ, μία φορά**, ώστε το μοντέλο
 * του ιδιώτη να μένει επίπεδο (`areaSqm` · `bedrooms`) — που είναι και τα ονόματα του
 * §25.6 και του `PublicListing`. Ο ιδιώτης **δεν πληρώνει** την ιστορία του
 * `properties`.
 */
export function projectableFromOwnerProperty(
  property: OwnerProperty,
  atISO: string,
): ProjectableProperty {
  /**
   * 🔴 **Η ΑΠΟΣΥΡΣΗ ΕΚΦΡΑΖΕΤΑΙ ΩΣ «ΚΑΜΙΑ ΔΙΑΘΕΣΗ», ΟΧΙ ΩΣ ΔΕΥΤΕΡΟ ΚΡΙΤΗΡΙΟ.**
   *
   * Ο πειρασμός ήταν ένα `if (!isLiveOwnerProperty) return null` κάπου στον γραφέα —
   * δηλαδή **δεύτερο** κριτήριο δημοσίευσης δίπλα στο `isPubliclyListed`, που το
   * `public-listing-projection.ts` δηλώνει ρητά ότι *«γράφεται **ΜΙΑ** φορά, εδώ»*.
   * Δύο τόποι που απαντούν «είναι δημόσιο;» θα διαφωνούσαν — και το αρχείο εκείνο
   * προειδοποιεί ότι θα διαφωνούσαν **ακριβώς στην αντιπαροχή**.
   *
   * Αντ' αυτού λέγεται η **αλήθεια στη γλώσσα της Α20**: μια αποσυρμένη καταχώρηση
   * **δεν έχει καμία ζωντανή διάθεση στην αγορά**. Από εκεί και πέρα το υπάρχον
   * κριτήριο βγάζει μόνο του `unavailable` + `[]` ⇒ `buildPublicListing` → `null` ⇒
   * ο γραφέας **σβήνει** την προβολή. Η απόσυρση **συμβαίνει**, χωρίς να μάθει
   * κανένας νέος κανόνας τι είναι το `owner_properties`.
   *
   * 🔑 **§8.33 — Η ΕΝΤΟΛΗ ΤΟΥ ΜΕΣΙΤΗ ΜΠΗΚΕ ΣΤΗΝ ΙΔΙΑ ΠΡΟΤΑΣΗ, ΟΧΙ ΔΙΠΛΑ ΤΗΣ.** Μια
   * αγγελία γραφείου με εντολή **σε αναμονή** ή **ληγμένη** δεν έχει, ομοίως, καμία
   * διάθεση στην αγορά. Και οι δύο ερωτήσεις ζουν πλέον σε **έναν** κριτή
   * ({@link isOwnerPropertyOnTheMarket}) — αν είχαν γραφτεί ως δεύτερο `if` εδώ, θα
   * ήταν ακριβώς το «δεύτερο κριτήριο δημοσίευσης» που η παραπάνω παράγραφος
   * απαγορεύει, και θα διαφωνούσε με το `isPubliclyListed` στην πρώτη αλλαγή.
   *
   * ⚠️ Γι' αυτό η **λήξη δεν χρειάστηκε δικό της μηχανισμό εξαφάνισης**: την επόμενη
   * φορά που η αγγελία συντίθεται, φεύγει μόνη της.
   */
  const marketOffers = isOwnerPropertyOnTheMarket(property, atISO) ? property.offers : [];

  return {
    id: property.id,
    name: property.title,
    type: property.type,

    // ── Α20: τα τρία παραγόμενα, από τη ΜΙΑ αλήθεια ──────────────────────────
    commercialStatus: deriveCommercialStatus(marketOffers),
    offerKinds: deriveOfferKinds(marketOffers),
    commercial: deriveCommercialAmounts(marketOffers),

    // ── §25.6: είδος + εμβαδόν, όροφος, υπνοδωμάτια ──────────────────────────
    areas: { gross: property.areaSqm },
    floor: property.floor,
    layout: { bedrooms: property.bedrooms },

    /**
     * 🔴 **ΕΔΩ ΓΡΑΦΕΤΑΙ ΤΟ ΠΕΔΙΟ ΠΟΥ «ΚΑΝΕΝΑΣ ΓΡΑΦΕΑΣ ΔΕΝ ΕΙΧΕ».**
     *
     * Το `ProjectableProperty.locationDisclosure` τεκμηριώνει ότι *«κανένας γραφέας
     * δεν υπάρχει σήμερα … το πεδίο θα το γράψει η **φόρμα του κατόχου**, όταν
     * υλοποιηθεί το “υποχρεωτικό ΕΡΩΤΗΜΑ, όχι υποχρεωτική ΑΠΑΝΤΗΣΗ”»*. Αυτή είναι η
     * φόρμα, και αυτό είναι το σημείο: από εδώ και πέρα η διάκριση `never-asked`
     * (**δικό μας** χρέος) ⇄ `owner-declined` (**επιλογή** του ανθρώπου) παύει να
     * είναι πρόθεση και γίνεται **δεδομένο**.
     */
    locationDisclosure: property.place.kind === 'declined' ? 'declined' : null,
  };
}

/**
 * **Ό,τι ξέρουμε για τον τόπο του** — από τη δική του δήλωση, όχι από αλυσίδα.
 *
 * 🔑 **Περνά από το ΥΠΑΡΧΟΝ {@link addressToPositionCandidate}, και ο λόγος είναι ο
 * κανόνας που εκείνο κουβαλά**: *υπάρχει `accuracy` ⇒ **μηχανή** το συμπέρανε από
 * κείμενο ⇒ `geocoded` με την ακρίβειά της· υπάρχουν συντεταγμένες **χωρίς**
 * μεταδεδομένα ⇒ κάποιος τις **έβαλε** ⇒ `manual`.* Γραμμένος δεύτερη φορά εδώ, θα
 * ήταν δεύτερη απόφαση **προέλευσης** — και η προέλευση **είναι** ολόκληρη η Α5.
 *
 * ⚠️ Το `verifiedAt`/`isPrimary` του `AddressLike` δεν τίθενται: η δήλωση του κατόχου
 * είναι **μία** και **μη επαληθευμένη** εξ ορισμού (SPEC-777A §14.3 — *«ο χρήστης δεν
 * αλλάζει το κοινό, **προτείνει**»*). Ένα `verifiedAt` εδώ θα ήταν ισχυρισμός που
 * κανείς δεν έκανε.
 *
 * 🔑 **ΕΔΩ ΚΛΕΙΝΕΙ Ο ΚΥΚΛΟΣ ΤΟΥ §14.5** — ο δεσμός προς το επίπεδο Α φεύγει από **αυτή**
 * τη συνάρτηση, δίπλα στη θέση, γιατί και τα δύο απαντούν *«τι ξέρουμε για τον τόπο
 * του;»*. Ο ιδιώτης **δεν έχει αλυσίδα** να ανέβει: η δήλωσή του **είναι** η γνώση.
 *
 * ⚠️ *(Β3, 2026-08-11: ήταν πεδίο του `ProjectableProperty` και μετακόμισε εδώ — όχι
 * για τάξη, αλλά επειδή ο **επαγγελματίας** δεν είχε πού να το γράψει και το πεδίο
 * έμενε σιωπηλά `null` για κάθε αγγελία εταιρείας. Δες {@link PlaceKnowledge.ref}.)*
 *
 * ⚠️ Το `declined` **δεν έχει** δεσμό — ο τύπος το κάνει αδύνατο, δες `OwnerPropertyPlace`.
 *
 * @param locatedAt — η στιγμή της προβολής, ίδια για κάθε υποψήφια του ίδιου περάσματος
 */
export function placeKnowledgeFromOwnerProperty(
  property: OwnerProperty,
  locatedAt: string,
): PlaceKnowledge {
  if (property.place.kind !== 'declared') return { candidates: [], ref: null };

  const candidate = addressToPositionCandidate(
    {
      coordinates: { lat: property.place.point.lat, lng: property.place.point.lng },
      geocodingMetadata: property.place.accuracy === null
        ? null
        : { accuracy: property.place.accuracy },
    },
    locatedAt,
  );

  return {
    candidates: candidate === null ? [] : [candidate],
    ref: property.place.link,
  };
}
