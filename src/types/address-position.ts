/**
 * @fileoverview **Η ΑΠΟΘΗΚΕΥΜΕΝΗ ΘΕΣΗ ΜΙΑΣ ΔΙΕΥΘΥΝΣΗΣ** — ένας τύπος για κάθε οντότητα.
 * @module types/address-position
 * @enterprise ADR-332 D27 Βήμα Β-ΙΙ · Φ8 (προέλευση & φρεσκάδα)
 *
 * 🔑 **Γιατί ένας τύπος.** Τα ίδια τέσσερα πεδία ζούσαν inline στο `ProjectAddress` και
 * μισά (χωρίς `geocodingMetadata`) στο `AddressInfo`· το `CompanyAddress` δεν τα είχε
 * καθόλου — γι' αυτό η πινέζα επαφής δεν αποθηκευόταν ποτέ. Τα γράφει **ένας** γραφέας
 * (`lib/geocoding/address-position`, `applyAddressPosition`) και ταξιδεύουν **πάντα μαζί**:
 * σημείο χωρίς προέλευση και ακρίβεια δεν μπορεί να εκφραστεί σωστά.
 *
 * ⚠️ Το σχήμα Zod του συνόρου είναι το `addressPositionFieldsSchema`
 * (`types/project/address-schemas`) — νέο πεδίο εδώ μπαίνει **και** εκεί, αλλιώς το
 * PATCH το σβήνει σιωπηλά (μάθημα ADR-759 Φ3).
 */

import type { AddressIdentityField } from '@/lib/geocoding/address-position';
import type { AddressSourceType, GeocodingAccuracy } from '@/lib/geocoding/geocoding-types';

export interface StoredAddressPosition {
  /** Το σημείο στον χάρτη — της μηχανής ή του ανθρώπου (`source: 'dragged'`). */
  coordinates?: {
    lat: number;
    lng: number;
  };
  /**
   * Πώς αποκτήθηκε η θέση. Τροφοδοτεί το `<AddressSourceLabel>` και την τηλεμετρία
   * διορθώσεων. Εγγραφές πριν τη Φ8 πέφτουν σε `'unknown'` στην απόδοση.
   */
  source?: AddressSourceType;
  /**
   * Unix-ms της τελευταίας επιβεβαίωσης της θέσης. Τροφοδοτεί το
   * `<AddressFreshnessIndicator>` (never / fresh / recent / aging / stale).
   */
  verifiedAt?: number;
  /**
   * Παγωμένα μεταδεδομένα ποιότητας τη στιγμή της εγγραφής — ακρίβεια, βεβαιότητα και
   * παραλλαγή της μηχανής, χωρίς νέο ερώτημα στο Nominatim. **Απουσία** = το σημείο το
   * έβαλε άνθρωπος (δεν υπάρχει κλίμακα ακρίβειας για δήλωση).
   */
  geocodingMetadata?: {
    confidence: number;
    accuracy: GeocodingAccuracy;
    variantUsed: number;
    osmType?: string;
    /**
     * **Το κείμενο για το οποίο λύθηκε αυτή η θέση** (ADR-332 D27 Ζ6) — η απόδειξη που κάνει
     * τον ισχυρισμό ακρίβειας **ελέγξιμο**. Δες `lib/geocoding/address-position-types` για το
     * ζωντανό εύρημα («Εγνατία 102» με τη θέση της «100») και `positionTextVerdict` για την
     * ερώτηση. **Απουσία = άγνοια**, ποτέ «άλλαξε».
     */
    resolvedFor?: Partial<Record<AddressIdentityField, string>>;
    /** Ο πάροχος δήλωσε ότι **δεν ταίριαξαν όλα** τα πεδία που ζητήθηκαν (ADR-332 D27 Ζ6-Β). */
    partialMatch?: boolean;
  };
}
