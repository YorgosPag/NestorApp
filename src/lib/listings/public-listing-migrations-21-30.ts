/**
 * @fileoverview **Οι κρίκοι 21–30 της αλυσίδας μεταναστεύσεων.** Η ανοιχτή δεκάδα.
 * @module lib/listings/public-listing-migrations-21-30
 * @related ./public-listing-schema.ts
 */

import { listedCommonChargesOf } from '@/lib/common-charges/common-charges';
import { relistedEnergyCertificateOf, relistedFinalEnergyOf } from '@/lib/energy-certificate/energy-certificate';
import type { ListingMigration } from './public-listing-schema-types';

/** Οι κρίκοι `to: 21` … `to: 30`, με τη σειρά που συνέβησαν. Παγωμένοι — δες την κεφαλίδα του `public-listing-schema.ts`. */
export const LISTING_MIGRATIONS_21_30: readonly ListingMigration[] = [
  {
    to: 21,
    adr: 'ADR-777 §8.93',
    adds: ['commonCharges'],
    /**
     * 🔴 **Η ΑΓΓΕΛΙΑ ΑΠΕΚΤΗΣΕ ΚΟΙΝΟΧΡΗΣΤΑ — ΤΑ ΠΑΛΙΑ ΕΓΓΡΑΦΑ ΔΕΝ ΤΑ ΕΧΟΥΝ.**
     *
     * 🔑 **Η ΑΛΗΘΕΙΑ ΤΟΥ ΠΑΛΙΟΥ ΕΓΓΡΑΦΟΥ ΕΙΝΑΙ «ΔΕΝ ΔΗΛΩΘΗΚΑΝ»**, ποτέ ποσό και ποτέ `0`: κανείς δεν είχε πού να τα
     * δηλώσει. Το `0` εδώ θα έλεγε **«χωρίς κοινόχρηστα»** για κάθε διαμέρισμα της βάσης — ψευδής δήλωση σε δημόσια
     * αγγελία, με τη σφραγίδα του αγγελιοδότη από κάτω.
     *
     * 🔑 **Το ΚΟΥΤΙ όμως κρίνεται, δεν μπαίνει παντού**: `null` όπου η ερώτηση δεν τίθεται (γη · μόνο βραχυχρόνια ·
     * μόνο αντιπαροχή), με τον **ίδιο** κριτή που ρωτά ο προβολέας (`listedCommonChargesOf`) πάνω στα `type` και
     * `offerKinds` που το έγγραφο **ήδη** κουβαλά. Ίδιο σχήμα με τον κρίκο 12 (`exchange`): παλιό και νέο έγγραφο
     * απαντούν το ίδιο στο «υπάρχει γραμμή;», αλλιώς ένα οικόπεδο θα έγραφε «Δεν έχουν δηλωθεί» ώσπου να ξαναπροβληθεί.
     *
     * 🔑 **Ιδιοδύναμο (Κ3)**: περνά από τον **ένα** αναγνώστη — ό,τι έγραψε ήδη ο γραφέας μένει αυτούσιο.
     */
    apply: (doc) => ({
      ...doc,
      commonCharges: listedCommonChargesOf(
        { type: doc.type, offerKinds: Array.isArray(doc.offerKinds) ? doc.offerKinds : [] },
        doc.commonCharges,
      ),
    }),
  },
  {
    to: 22,
    adr: 'ADR-777 §8.94',
    adds: ['energyCertificate'],
    /**
     * 🔴 **Η ΑΓΓΕΛΙΑ ΑΠΕΚΤΗΣΕ ΤΟΥΣ ΑΡΙΘΜΟΥΣ ΤΟΥ ΠΕΑ — ΤΑ ΠΑΛΙΑ ΕΓΓΡΑΦΑ ΕΧΟΥΝ ΜΟΝΟ ΤΗΝ ΚΛΑΣΗ.**
     *
     * 🔑 **Η ΑΛΗΘΕΙΑ ΤΟΥ ΠΑΛΙΟΥ ΕΓΓΡΑΦΟΥ ΕΙΝΑΙ «ΔΕΝ ΔΗΛΩΘΗΚΑΝ»**: κανείς δεν είχε πού να γράψει kWh ή CO₂, ούτε πού
     * να πει «υπό έκδοση». Αριθμός εδώ θα ήταν επινόηση σε δημόσια αγγελία· το `energyClass` μένει **ανέγγιχτο**.
     *
     * 🔑 **Το ΚΟΥΤΙ κρίνεται με τον ΙΔΙΟ κριτή που ρωτά ο προβολέας** (`raisesEnergyCertificateQuestion`, πάνω στα
     * `type` και `offerKinds` που το έγγραφο **ήδη** κουβαλά) — ίδιο σχήμα με τον κρίκο 21: ένα οικόπεδο δεν γράφει
     * «Δεν έχει δηλωθεί» ώσπου να ξαναπροβληθεί.
     *
     * 🔑 **Ιδιοδύναμο (Κ3)**: ό,τι έγραψε ήδη ο γραφέας στο κουτί διαβάζεται πεδίο-πεδίο και μένει αυτούσιο.
     */
    apply: (doc) => ({
      ...doc,
      energyCertificate: relistedEnergyCertificateOf(
        { type: doc.type, offerKinds: Array.isArray(doc.offerKinds) ? doc.offerKinds : [] },
        doc.energyCertificate,
      ),
    }),
  },
  {
    to: 23,
    adr: 'ADR-777 §8.95',
    adds: ['energyCertificate.usefulArea', 'energyCertificate.finalEnergy'],
    /**
     * 🔴 **ΤΟ ΚΟΥΤΙ ΤΟΥ ΠΕΑ ΑΠΕΚΤΗΣΕ ΩΦΕΛΙΜΗ ΕΠΙΦΑΝΕΙΑ ΚΑΙ ΤΕΛΙΚΗ ΕΝΕΡΓΕΙΑ ΑΝΑ ΠΗΓΗ — ΤΑ ΠΑΛΙΑ ΕΓΓΡΑΦΑ ΔΕΝ ΤΑ ΕΧΟΥΝ.**
     *
     * 🔑 **Η ΑΛΗΘΕΙΑ ΤΟΥ ΠΑΛΙΟΥ ΕΓΓΡΑΦΟΥ ΕΙΝΑΙ «ΔΕΝ ΔΗΛΩΘΗΚΑΝ»** (`null` · `null`), άρα **καμία εκτίμηση κόστους**:
     * το ποσό δεν αποθηκεύεται ποτέ — υπολογίζεται στην ανάγνωση από αυτά τα δύο πεδία και τις τιμές αναφοράς. Ένας
     * πίνακας «συμπερασμένος» από το `heatingFuel` θα ήταν εκτίμηση σε ευρώ χωρίς πιστοποιητικό από πίσω της.
     *
     * 🔑 **Ό,τι έδινε ο κρίκος 22 μένει αυτούσιο** (ίδιος κριτής, ίδια ανάγνωση πεδίο-πεδίο)· εδώ προστίθενται μόνο
     * τα δύο νέα πεδία. **Ιδιοδύναμο (Κ3)**: ό,τι έγραψε ήδη ο γραφέας διαβάζεται και μένει.
     */
    apply: (doc) => ({
      ...doc,
      energyCertificate: relistedFinalEnergyOf(
        { type: doc.type, offerKinds: Array.isArray(doc.offerKinds) ? doc.offerKinds : [] },
        doc.energyCertificate,
      ),
    }),
  },
];
