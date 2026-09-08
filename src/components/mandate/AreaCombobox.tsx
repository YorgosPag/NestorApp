'use client';

/**
 * @fileoverview **ΤΟ ΧΕΙΡΙΣΤΗΡΙΟ ΤΗΣ ΠΕΡΙΟΧΗΣ** — ένα, για δύο ερωτήσεις.
 * @related ADR-846 · ADR-772 (η ιεραρχία) · ADR-841 §7 Α19 (το ίδιο ιδίωμα)
 * @module components/mandate/AreaCombobox
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΔΥΟ ΕΡΩΤΗΣΕΙΣ, ΕΝΑ ΧΕΙΡΙΣΤΗΡΙΟ — ίδιο σχήμα με το `OccupationSelect`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Ποιος | Πού | Τι ρωτά |
 * |---|---|---|
 * | `AgencyDirectoryFilters` | `/pro` | *«πού ψάχνω;»* — **ερώτημα** |
 * | `CoverageAreaPicker` | η φόρμα της βιτρίνας | *«πού δουλεύω;»* — **δήλωση** |
 *
 * Και οι δύο διαλέγουν από το **ίδιο** κλειστό λεξιλόγιο *(20.721 οντότητες ΕΛΣΤΑΤ)*.
 * Δύο αντίγραφα θα σήμαιναν ότι ο επαγγελματίας μπορεί να δηλώσει περιοχή που ο
 * επισκέπτης δεν μπορεί να ζητήσει — δηλαδή δήλωση που **κανείς δεν βρίσκει ποτέ**.
 *
 * ⚠️ **ΔΕΝ είναι ο `AdministrativeAddressPicker`, και δεν γίνεται να είναι.** Εκείνος
 * γεμίζει **οκτώ βαθμίδες ταυτόχρονα** ως **μία διεύθυνση** *(«αυτό το κτίριο είναι στην
 * κοινότητα Χ, του δήμου Ψ, της ΠΕ Ζ…»)*. Εδώ ζητιέται **ένα** όνομα ως **όριο**
 * *(«δουλεύω στη Χαλκιδική»)*, και το επίπεδο το διαλέγει ο άνθρωπος. Ίδια δεδομένα,
 * αντίθετο σχήμα αλληλεπίδρασης.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΠΟΙΑ ΕΠΙΠΕΔΑ ΠΡΟΣΦΕΡΟΝΤΑΙ — 3 ΕΩΣ 7, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Περιφέρεια · Περιφερειακή Ενότητα · Δήμος · Δημοτική Ενότητα · Κοινότητα.
 *
 * • **Έξω τα 1–2** *(Γεωγραφική Ενότητα · Αποκεντρωμένη Διοίκηση)*: **κανείς δεν λέει**
 *   *«δουλεύω στην Αποκεντρωμένη Διοίκηση Μακεδονίας-Θράκης»*. Είναι διοικητικές
 *   αφαιρέσεις χωρίς λαϊκό αντίστοιχο, και το «όλη η Ελλάδα» καλύπτει την πρόθεση που
 *   θα τα ζητούσε.
 * • **Έξω το 8** *(Οικισμός, **13.272** εγγραφές)*: θα **έπνιγε** την αναζήτηση σε
 *   θόρυβο — και «περιοχή δραστηριότητας ενός οικισμού» δεν είναι ερώτηση που κάνει
 *   κανείς. Ο κριτής τα δέχεται *(η γενεαλογία τα περιλαμβάνει)*· απλώς δεν
 *   **προσφέρονται**.
 */

import React from 'react';

import { SearchableCombobox } from '@/components/ui/searchable-combobox';
import type { ComboboxOption } from '@/components/ui/searchable-combobox';
import {
  ADMIN_LEVELS,
  ADMIN_LEVEL_LABELS,
  useAdministrativeHierarchy,
  type AdminLevel,
} from '@/hooks/useAdministrativeHierarchy';

/**
 * **Από το ευρύ προς το στενό** — και η σειρά **είναι** η σειρά των αποτελεσμάτων.
 *
 * 🔑 Όποιος γράφει *«Θεσσαλονίκη»* βλέπει πρώτα την **Περιφερειακή Ενότητα** και μετά
 * τον **Δήμο**. Η αντίστροφη σειρά θα πρότεινε πρώτα το **στενότερο** — δηλαδή θα
 * έσπρωχνε συστηματικά προς **υποδήλωση**, που είναι το ίδιο είδος σιωπηλής επιρροής
 * με την υπερδήλωση, απλώς προς την άλλη κατεύθυνση.
 */
const OFFERED_LEVELS: readonly AdminLevel[] = [
  ADMIN_LEVELS.REGION,
  ADMIN_LEVELS.REGIONAL_UNIT,
  ADMIN_LEVELS.MUNICIPALITY,
  ADMIN_LEVELS.MUNICIPAL_UNIT,
  ADMIN_LEVELS.COMMUNITY,
];

interface AreaComboboxProps {
  /** Η επιλεγμένη ταυτότητα, ή `''` για καμία. */
  readonly value: string;
  /** `''` = καθαρίστηκε. **Πάντα** ταυτότητα του λεξιλογίου — ποτέ ελεύθερο κείμενο. */
  readonly onValueChange: (adminId: string) => void;
  readonly placeholder: string;
  readonly emptyMessage: string;
  readonly disabled?: boolean;
}

/**
 * 🔒 **`allowFreeText` μένει `false`** — ίδια εγγύηση με το `OccupationSelect`: η μόνη
 * τιμή που φεύγει είναι `option.value` ή `''`. Πληκτρολογημένο κείμενο **δεν έχει
 * διαδρομή** προς την κατάσταση, άρα δεν μπορεί να γίνει «περιοχή» που δεν υπάρχει.
 */
export function AreaCombobox({
  value,
  onValueChange,
  placeholder,
  emptyMessage,
  disabled = false,
}: AreaComboboxProps): React.ReactElement {
  const { isLoading, levelOptions } = useAdministrativeHierarchy();

  /**
   * ⚠️ **Δίνονται ΟΛΕΣ (~7.400) και φιλτράρει το combobox** — δεν είναι παράλειψη, είναι
   * το **υπάρχον** ιδίωμα: ο `AdministrativeAddressPicker` δίνει ήδη **6.064** κοινότητες
   * σε ένα πεδίο. Το `SearchableCombobox` φιλτράρει εσωτερικά *(`filterOptions`)* με
   * `maxDisplayed`, οπότε ένα δεύτερο, δικό μας μονοπάτι αναζήτησης θα ήταν **δεύτερος
   * κριτής** για το *«ποια επιλογή εννοεί ο άνθρωπος;»* — ακριβώς ο κλώνος που το N.18
   * ονομάζει, και θα απέκλινε στην πρώτη αλλαγή της αντιστοίχισης.
   *
   * 🔴 **ΤΟ `[levelOptions]` ΕΙΝΑΙ ΑΡΚΕΤΟ — ΚΑΙ ΔΕΝ ΗΤΑΝ ΠΑΝΤΑ** *(ζωντανό περπάτημα
   * 2026-09-08)*: όσο το `useAdministrativeHierarchy` επέστρεφε `useCallback(…, [])`
   * πάνω σε μεταβλητές module, αυτό το `useMemo` **δεν ξαναϋπολογιζόταν ποτέ** μετά τη
   * φόρτωση — και ο επιλογέας έμενε **άδειος** σε πρώτο φόρτωμα, λέγοντας *«καμία
   * περιοχή δεν ταιριάζει»*. Πλέον η ταυτότητα του `levelOptions` κρέμεται από το
   * στιγμιότυπο των δεδομένων, οπότε η εξάρτηση είναι **αληθινή**.
   * ⛔ **Άγκυρα**: `__tests__/area-combobox-cold-load.test.tsx`.
   */
  const options = React.useMemo(
    (): readonly ComboboxOption[] =>
      OFFERED_LEVELS.flatMap((level) =>
        levelOptions(level).map((option) => ({
          ...option,
          // 🔑 **Το ΕΙΔΟΣ μπροστά, πάντα.** Χωρίς αυτό το «Θεσσαλονίκης» εμφανίζεται
          //    τρεις φορές ταυτόσημα, και τα τρία σημαίνουν **πολύ** διαφορετική
          //    εμβέλεια — ο άνθρωπος δεν θα ήξερε τι διάλεξε.
          secondaryLabel: [ADMIN_LEVEL_LABELS[level], option.secondaryLabel]
            .filter((part): part is string => part !== undefined && part !== '')
            .join(' · '),
        })),
      ),
    [levelOptions],
  );

  return (
    <SearchableCombobox
      value={value}
      onValueChange={onValueChange}
      options={options}
      placeholder={placeholder}
      emptyMessage={emptyMessage}
      isLoading={isLoading}
      disabled={disabled}
    />
  );
}
