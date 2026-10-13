/**
 * @fileoverview **Οι κρίκοι 21–30 της αλυσίδας μεταναστεύσεων.** Η ανοιχτή δεκάδα.
 * @module lib/listings/public-listing-migrations-21-30
 * @related ./public-listing-schema.ts
 */

import { listedCommonChargesOf } from '@/lib/common-charges/common-charges';
import { relistedEnergyCertificateOf } from '@/lib/energy-certificate/energy-certificate';
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
];
