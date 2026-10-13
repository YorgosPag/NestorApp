/**
 * @fileoverview **Οι κρίκοι 11–20 της αλυσίδας μεταναστεύσεων.** Παγωμένη δεκάδα.
 * @module lib/listings/public-listing-migrations-11-20
 * @related ./public-listing-schema.ts
 */

import { readPriceReduction } from '@/lib/listings/price-history';
import { readListingObjectiveValueDeclarations } from '@/lib/objective-value/objective-value-declarations';
import { readStoredLevelAreas } from '@/lib/properties/level-areas';
import { isFloorKind } from '@/utils/floor-naming';
import {
  videosArray,
  floorPlatesArray,
  tourPresenceValue,
  storedExchangeOf,
  storedStayWithPets,
} from './public-listing-shape-judges';
import type { ListingMigration } from './public-listing-schema-types';

/** Οι κρίκοι `to: 11` … `to: 20`, με τη σειρά που συνέβησαν. Παγωμένοι — δες την κεφαλίδα του `public-listing-schema.ts`. */
export const LISTING_MIGRATIONS_11_20: readonly ListingMigration[] = [
  {
    to: 11,
    adr: 'ADR-777 §8.69',
    adds: ['priceReduction'],
    /**
     * 🔴 **Η ΑΓΓΕΛΙΑ ΑΠΕΚΤΗΣΕ «ΗΤΑΝ» — ΚΑΙ ΤΑ ΠΑΛΙΑ ΕΓΓΡΑΦΑ ΔΕΝ ΤΟ ΕΧΟΥΝ.**
     *
     * 🔑 **`null` ΕΙΝΑΙ Η ΑΛΗΘΕΙΑ, ΟΧΙ ΒΟΛΙΚΗ ΠΡΟΕΠΙΛΟΓΗ** — ίδιο επιχείρημα με το
     * `'predates-record'` του κρίκου 9: σε αυτά τα έγγραφα **κανείς δεν κατέγραφε**
     * τιμές, άρα δεν υπάρχει ιστορικό από το οποίο να προκύπτει μείωση. Ένα έγγραφο
     * χωρίς ιστορικό **δεν επιτρέπεται** να πει *«ήταν X €»*.
     *
     * ⛔ **ΚΑΙ ΡΗΤΑ ΔΕΝ ΜΑΝΤΕΥΕΙ ΑΠΟ ΤΟ `commercial`.** Μια αγγελία με `finalPrice <
     * askingPrice` **δεν** είναι μειωμένη — είναι **πουλημένη** κάτω από τη ζητούμενη.
     * Κρίκος που θα έβγαζε «↓» από εκεί θα ήταν **ψεύτικη μείωση σε δημόσια αγγελία**.
     *
     * 🔑 **Ιδιοδύναμο (Κ3)**: ο κριτής είναι ο **ίδιος** με της ανάγνωσης
     * (`readPriceReduction`) — έγκυρη μείωση περνά **αυτούσια**, σκουπίδι γίνεται `null`.
     */
    apply: (doc) => ({ ...doc, priceReduction: readPriceReduction(doc.priceReduction) }),
  },
  {
    to: 12,
    adr: 'ADR-777 §8.60.17',
    adds: ['exchange'],
    /**
     * 🔴 **ΤΟ ΠΟΣΟΣΤΟ ΤΗΣ ΑΝΤΙΠΑΡΟΧΗΣ ΑΠΕΚΤΗΣΕ ΚΟΥΤΙ — ΚΑΙ ΤΑ ΠΑΛΙΑ ΕΓΓΡΑΦΑ ΔΕΝ ΤΟ ΕΧΟΥΝ.**
     *
     * 🔑 **Η ΑΛΗΘΕΙΑ ΤΟΥ ΠΑΛΙΟΥ ΕΓΓΡΑΦΟΥ ΕΙΝΑΙ «ΔΕΝ ΠΡΟΒΛΗΘΗΚΕ», ΟΧΙ «ΔΕΝ ΥΠΑΡΧΕΙ»**: ως σήμερα το
     * ποσοστό ήταν δηλωμένη απώλεια της προβολής — ο ιδιοκτήτης **ίσως** το έχει γράψει στη
     * διάθεσή του. Άρα αγγελία **με** αντιπαροχή παίρνει `{ landownerShare: null }` («προς
     * συζήτηση» — ό,τι πράγματι ξέρει το έγγραφο), και **χωρίς** αντιπαροχή `null`. Η επόμενη
     * αποθήκευση του ακινήτου ξαναπροβάλλει με το πραγματικό ποσοστό.
     *
     * ⛔ **Και ρητά δεν διαβάζει τη διάθεση**: οι κρίκοι είναι καθαρές συναρτήσεις πάνω σε **ένα**
     * έγγραφο (κρίκος 3) — δεν ανοίγουν το `owner_properties`.
     *
     * 🔑 **Ιδιοδύναμο (Κ3)**: έγκυρο κουτί περνά αυτούσιο (κανονικοποιημένο).
     */
    apply: (doc) => ({ ...doc, exchange: storedExchangeOf(doc) }),
  },
  {
    to: 13,
    adr: 'ADR-777 §8.60.21',
    adds: ['stay.pets'],
    /**
     * 🔴 **Η ΔΙΑΜΟΝΗ ΑΠΕΚΤΗΣΕ ΠΟΛΙΤΙΚΗ ΚΑΤΟΙΚΙΔΙΩΝ — ΚΑΙ ΤΑ ΠΑΛΙΑ ΕΓΓΡΑΦΑ ΔΕΝ ΤΗΝ ΕΧΟΥΝ.**
     *
     * 🔑 **Η ΑΛΗΘΕΙΑ ΤΟΥ ΠΑΛΙΟΥ ΕΓΓΡΑΦΟΥ ΕΙΝΑΙ «ΔΕΝ ΔΗΛΩΘΗΚΕ»** (`pets: null`), ποτέ «όχι»: ως
     * σήμερα η ερώτηση **δεν υπήρχε**. Ένα «όχι» εδώ θα κατηγορούσε κάθε κάτοχο για απάντηση που
     * δεν έδωσε, και θα έδιωχνε επισκέπτες από καταλύματα που ίσως τους δέχονται.
     *
     * ⛔ **Δεν διαβάζει τη διάθεση** (καθαρή συνάρτηση πάνω σε **ένα** έγγραφο, κρίκος 3).
     * 🔑 **Ιδιοδύναμο (Κ3)**: έγκυρη πολιτική περνά αυτούσια· αγγελία χωρίς `stay` μένει `null`.
     */
    apply: (doc) => ({ ...doc, stay: storedStayWithPets(doc) }),
  },
  {
    to: 14,
    adr: 'ADR-890 Φ0',
    adds: ['constructionYear', 'adminArea'],
    /**
     * 🔴 **Η ΑΓΓΕΛΙΑ ΑΠΕΚΤΗΣΕ ΕΤΟΣ ΚΑΤΑΣΚΕΥΗΣ ΚΑΙ ΔΙΟΙΚΗΤΙΚΗ ΠΕΡΙΟΧΗ — ΤΑ ΠΑΛΙΑ ΕΓΓΡΑΦΑ ΔΕΝ ΤΑ ΕΧΟΥΝ.**
     *
     * 🔑 **Η ΑΛΗΘΕΙΑ ΤΟΥ ΠΑΛΙΟΥ ΕΓΓΡΑΦΟΥ ΕΙΝΑΙ «ΔΕΝ ΛΥΘΗΚΕ»** (`null`), ποτέ μαντεψιά: ο κρίκος είναι
     * καθαρή συνάρτηση πάνω σε **ένα** έγγραφο (κρίκος 3) — δεν ανοίγει όρια ούτε το κτίριο. Την αλήθεια
     * τη γράφει η **επαναπροβολή** (`rebuild-public-listings`), που περνά από τον ένα γραφέα.
     *
     * 🔑 **Ιδιοδύναμο (Κ3)**: ό,τι έγραψε ήδη ο γραφέας μένει αυτούσιο.
     */
    apply: (doc) => ({
      ...doc,
      constructionYear: doc.constructionYear ?? null,
      adminArea: doc.adminArea ?? null,
    }),
  },
  {
    to: 15,
    adr: 'ADR-898 Φ3β',
    adds: [
      'frontage',
      'objectiveValueDeclarations.display',
      'objectiveValueDeclarations.declared.zoneFront',
      'objectiveValueDeclarations.declared.areaIncludesCommon',
      'objectiveValueDeclarations.declared.permitDate',
      'objectiveValueDeclarations.declared.hasCentralHeating',
      'objectiveValueDeclarations.declared.hasElevator',
    ],
    /**
     * 🔴 **Η ΑΓΓΕΛΙΑ ΑΠΕΚΤΗΣΕ ΤΙΣ ΔΗΛΩΣΕΙΣ ΤΟΥ ΑΓΓΕΛΙΟΔΟΤΗ ΓΙΑ ΤΗΝ ΑΝΤΙΚΕΙΜΕΝΙΚΗ — ΤΑ ΠΑΛΙΑ ΕΓΓΡΑΦΑ ΔΕΝ ΤΙΣ ΕΧΟΥΝ.**
     *
     * 🔑 **Η ΑΛΗΘΕΙΑ ΤΟΥ ΠΑΛΙΟΥ ΕΓΓΡΑΦΟΥ ΕΙΝΑΙ «ΔΕΝ ΔΗΛΩΘΗΚΕ ΤΙΠΟΤΑ, ΕΜΦΑΝΙΣΗ ΕΞ ΟΡΙΣΜΟΥ»** — ακριβώς η συμπεριφορά
     * της Φ3α. Ποτέ «κρυμμένη»: η απόκρυψη είναι **επιλογή** του αγγελιοδότη, όχι απουσία.
     *
     * 🔑 **Περνά από τον ΕΝΑ αναγνώστη** (`readListingObjectiveValueDeclarations`), όπως ο κρίκος 13 από το
     * `readStayPetPolicy`: απουσία ή μισό κουτί ⇒ «τίποτα δηλωμένο», άκυρη τιμή ⇒ `null`, ποτέ μαντεψιά.
     *
     * 🔑 **Ιδιοδύναμο (Κ3)**: ό,τι έγραψε ήδη ο γραφέας μένει αυτούσιο.
     */
    apply: (doc) => ({
      ...doc,
      frontage: doc.frontage ?? null,
      objectiveValueDeclarations: readListingObjectiveValueDeclarations(doc.objectiveValueDeclarations),
    }),
  },
  {
    to: 16,
    adr: 'ADR-898 Φ3β-3β',
    adds: ['levelAreas'],
    /**
     * 🔴 **Η ΑΓΓΕΛΙΑ ΑΠΕΚΤΗΣΕ ΤΟ ΜΙΚΤΟ ΑΝΑ ΟΡΟΦΟ ΠΟΛΥΕΠΙΠΕΔΗΣ ΚΑΤΟΙΚΙΑΣ — ΤΑ ΠΑΛΙΑ ΕΓΓΡΑΦΑ ΔΕΝ ΤΟ ΕΧΟΥΝ.**
     *
     * 🔑 **Η ΑΛΗΘΕΙΑ ΤΟΥ ΠΑΛΙΟΥ ΕΓΓΡΑΦΟΥ ΕΙΝΑΙ «ΔΕΝ ΔΗΜΟΣΙΕΥΤΗΚΕ»** (`null`), ποτέ κατανομή του συνόλου σε ορόφους:
     * ο υπολογισμός λέει «τι λείπει» ώσπου η **επαναπροβολή** (`needsRebuild`) να γράψει την αλήθεια από το ακίνητο.
     *
     * 🔑 **Περνά από τον ΕΝΑ αυστηρό αναγνώστη** (`readStoredLevelAreas`): άκυρη ή μισή λίστα ⇒ `null`.
     * 🔑 **Ιδιοδύναμο (Κ3)**: ό,τι έγραψε ήδη ο γραφέας μένει αυτούσιο.
     */
    apply: (doc) => ({ ...doc, levelAreas: readStoredLevelAreas(doc.levelAreas) }),
  },
  {
    to: 17,
    adr: 'ADR-900 §8 #2 (2β.2)',
    adds: ['floorKind'],
    /**
     * 🔴 **Η ΑΓΓΕΛΙΑ ΑΠΕΚΤΗΣΕ ΤΟ ΕΙΔΟΣ ΤΗΣ ΣΤΑΘΜΗΣ — ΤΑ ΠΑΛΙΑ ΕΓΓΡΑΦΑ ΔΕΝ ΤΟ ΕΧΟΥΝ.**
     *
     * 🔑 **Η ΑΛΗΘΕΙΑ ΤΟΥ ΠΑΛΙΟΥ ΕΓΓΡΑΦΟΥ ΕΙΝΑΙ «ΣΥΝΑΓΕΤΑΙ ΑΠΟ ΤΟΝ ΑΡΙΘΜΟ»** (`null`) — ακριβώς ό,τι έδειχνε ως
     * σήμερα. Την πυλωτή τη γράφει η **επαναπροβολή** από το ακίνητο (`floorPairOf`), ποτέ μαντεψιά εδώ.
     * Είδος χωρίς αριθμό ή εκτός λεξιλογίου ⇒ `null` (ADR-903: ποτέ ορφανό είδος).
     * 🔑 **Ιδιοδύναμο (Κ3)**: ό,τι έγραψε ήδη ο γραφέας μένει αυτούσιο.
     */
    apply: (doc) => ({
      ...doc,
      floorKind: typeof doc.floor === 'number' && isFloorKind(doc.floorKind) ? doc.floorKind : null,
    }),
  },
  {
    to: 18,
    adr: 'ADR-907 §10',
    adds: ['videos'],
    /**
     * **Το κουτί του βίντεο** — κενό σε κάθε παλιό έγγραφο, ώστε `doc.videos.map(…)` να μη συναντήσει ποτέ
     * `undefined`. Ιδιοδύναμο (Κ3): το `.catch([])` κάνει τη δεύτερη εφαρμογή ίδια με την πρώτη.
     */
    apply: (doc) => ({ ...doc, videos: videosArray.parse(doc.videos) }),
  },
  {
    to: 19,
    adr: 'ADR-907 §11',
    adds: ['floorPlates'],
    /**
     * **Το κουτί της κάτοψης ορόφου** — κενό σε κάθε παλιό έγγραφο. Κενό = «δεν δημοσιεύτηκε», ποτέ «δεν υπάρχει».
     * Ιδιοδύναμο (Κ3) μέσω του `.catch([])`.
     */
    apply: (doc) => ({ ...doc, floorPlates: floorPlatesArray.parse(doc.floorPlates) }),
  },
  {
    to: 20,
    adr: 'ADR-884 · ADR-777 §8.88',
    adds: ['tour'],
    /**
     * **Η περιήγηση 360° που φαίνεται στην αγγελία.** Η αλήθεια του παλιού εγγράφου είναι «δεν ρωτήθηκε» ⇒ `null`:
     * η κάρτα δεν δείχνει σήμα — **ποτέ ψευδές «έχει»**. Την πραγματική απάντηση τη γράφει μόνο η επαναπροβολή
     * (`withPublicationFacts` ← `readTourPresence`), ποτέ μαντεψιά εδώ. Ιδιοδύναμο (Κ3) μέσω του `.catch(null)`.
     */
    apply: (doc) => ({ ...doc, tour: tourPresenceValue.parse(doc.tour) }),
  },
];
