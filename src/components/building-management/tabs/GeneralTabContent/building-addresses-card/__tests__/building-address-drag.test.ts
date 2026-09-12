/**
 * @fileoverview 🔴 **Η ΤΕΤΑΡΤΗ ΔΙΑΔΡΟΜΗ ΣΥΡΣΙΜΑΤΟΣ, ΠΟΥ ΚΑΝΕΝΑ TEST ΔΕΝ ΕΚΤΕΛΟΥΣΕ.**
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * **ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ** — ADR-332 D27 Φάση Β′
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Η λογική ζούσε μέσα στο `handleDragApplied` του `BuildingAddressesEditor.tsx`, και το
 * **μόνο** test που αναφέρει εκείνο το component **το αντικαθιστά με κατάσκοπο**
 * *(`jest.mock('../building-addresses-card/BuildingAddressesEditor')`)*.
 *
 * ⚠️ **Μετρημένο**: άλλαξα εκείνη τη συνάρτηση, έτρεξα **790 πράσινα tests**, και **κανένα**
 * δεν την άγγιξε — ούτε καν τη **μεταγλώττισε**. Είναι το σχήμα «πράσινο που δεν αποδεικνύει
 * εγγραφή»: οι άλλες τρεις διαδρομές ήταν καθαρές συναρτήσεις με άγκυρες, αυτή ήταν η μόνη
 * με λογική **μέσα** σε component — και γι' αυτό η μόνη ανεπαλήθευτη.
 *
 * 🔴 **Το ελάττωμα που φυλάει**: εδώ μηδενιζόταν **ΟΛΟ** το σετ ΕΛΣΤΑΤ *(εννέα πεδία με το
 * χέρι)* σε **κάθε** σύρσιμο, και **η χώρα χανόταν** — ο τύπος την κουβαλούσε, η μεταφορά όχι.
 */

import { buildingHierarchyAfterDrag } from '../building-address-drag';
import type { AddressWithHierarchyValue } from '@/components/shared/addresses/AddressWithHierarchy';
import type { ResolvedAddressFields } from '@/lib/geocoding/geocoding-types';

/** Ό,τι είχε η φόρμα **πριν** — με ταυτότητες που ανήκουν σε **άλλη** διεύθυνση. */
const PREVIOUS: Partial<AddressWithHierarchyValue> = {
  street: 'Μοναστηρίου',
  number: '10',
  country: 'GR',
  settlementName: 'Εύοσμος',
  settlementId: 'settlement:0708010101',
  municipalityName: 'ΔΗΜΟΣ ΚΟΡΔΕΛΙΟΥ - ΕΥΟΣΜΟΥ',
  municipalityId: 'municipality:0708',
  regionName: 'ΠΕΡΙΦΕΡΕΙΑ ΚΕΝΤΡΙΚΗΣ ΜΑΚΕΔΟΝΙΑΣ',
  regionId: 'region:112',
};

/** Το κείμενο της μηχανής για τη **νέα** θέση. */
const RESOLVED: ResolvedAddressFields = {
  street: 'Εγνατία',
  number: '102',
  postalCode: '54625',
  city: 'Θεσσαλονίκη',
  neighborhood: 'Λαδάδικα',
  region: 'Περιφέρεια Κεντρικής Μακεδονίας',
  country: 'GR',
};

// =============================================================================
// Κ1 — ΚΑΜΙΑ ΑΠΟΔΕΙΞΗ ⇒ ΚΑΜΙΑ ΚΛΗΡΟΝΟΜΙΑ ΤΑΥΤΟΤΗΤΑΣ
// =============================================================================

describe('Κ1 · χωρίς αποδείξεις: οι ταυτότητες καθαρίζουν, το κείμενο μένει', () => {
  it('🔴 ο δήμος της ΠΡΟΗΓΟΥΜΕΝΗΣ διεύθυνσης ΔΕΝ επιβιώνει δίπλα σε νέα οδό (ADR-277)', () => {
    const out = buildingHierarchyAfterDrag(PREVIOUS, RESOLVED);

    expect(out.street).toBe('Εγνατία');
    expect(out.municipalityId).toBeNull();
    expect(out.settlementId).toBeNull();
    expect(out.municipalityName).toBe('');
  });

  it('το κείμενο της μηχανής ΜΕΝΕΙ — άγνοια σβήνει ταυτότητα, ποτέ κείμενο', () => {
    const out = buildingHierarchyAfterDrag(PREVIOUS, RESOLVED);

    // Το λεξιλόγιο **φόρμας** δεν έχει ελεύθερο πεδίο: αν τα σβήναμε, θα χάνονταν εντελώς.
    expect(out.settlementName).toBe('Θεσσαλονίκη');
    expect(out.communityName).toBe('Λαδάδικα');
    expect(out.regionName).toBe('Περιφέρεια Κεντρικής Μακεδονίας');
  });

  it('🔴 Η ΧΩΡΑ ΔΕΝ ΧΑΝΕΤΑΙ — έλειπε εντελώς από τον γραφέα (ADR-332 D27 Β9)', () => {
    expect(buildingHierarchyAfterDrag(PREVIOUS, RESOLVED).country).toBe('GR');
    // Και όταν η μηχανή δεν τη λέει, κρατιέται ό,τι είχε η φόρμα.
    expect(
      buildingHierarchyAfterDrag(PREVIOUS, { ...RESOLVED, country: undefined }).country,
    ).toBe('GR');
  });
});

// =============================================================================
// Κ2 — ΜΕ ΑΠΟΔΕΙΞΕΙΣ ⇒ ΓΡΑΦΟΝΤΑΙ, ΚΑΙ ΤΟ ΟΝΟΜΑ ΕΙΝΑΙ ΤΟΥ ΜΗΤΡΩΟΥ
// =============================================================================

describe('Κ2 · με αποδείξεις: ταυτότητες ΚΑΙ ονόματα μητρώου', () => {
  const PROVED: ResolvedAddressFields = {
    ...RESOLVED,
    admin: [
      { level: 5, id: 'municipality:0701', name: 'ΔΗΜΟΣ ΘΕΣΣΑΛΟΝΙΚΗΣ' },
      { level: 3, id: 'region:112', name: 'ΠΕΡΙΦΕΡΕΙΑ ΚΕΝΤΡΙΚΗΣ ΜΑΚΕΔΟΝΙΑΣ' },
      { level: 8, id: 'settlement:0701010001', name: 'Θεσσαλονίκη' },
    ],
  };

  it('🏆 ο δήμος που απέδειξε ο διακομιστής γράφεται — ΟΧΙ ο παλιός, ΟΧΙ κενό', () => {
    const out = buildingHierarchyAfterDrag(PREVIOUS, PROVED);

    expect(out.municipalityId).toBe('municipality:0701');
    expect(out.municipalityName).toBe('ΔΗΜΟΣ ΘΕΣΣΑΛΟΝΙΚΗΣ');
    expect(out.settlementId).toBe('settlement:0701010001');
    expect(out.regionId).toBe('region:112');
  });

  it('το αποδεδειγμένο όνομα ΜΗΤΡΩΟΥ νικά την ετικέτα της μηχανής', () => {
    const out = buildingHierarchyAfterDrag(PREVIOUS, {
      ...PROVED,
      // Η μηχανή λέει «Θεσαλονίκη» (ένα σ) — το μητρώο λέει «Θεσσαλονίκη».
      city: 'Θεσαλονίκη',
    });

    expect(out.settlementName).toBe('Θεσσαλονίκη');
  });

  it('🔒 βαθμίδα που ΔΕΝ αποδείχθηκε καθαρίζει την ταυτότητά της (εδώ: δημοτική ενότητα)', () => {
    const out = buildingHierarchyAfterDrag(
      { ...PREVIOUS, municipalUnitId: 'municipal_unit:070802', municipalUnitName: 'ΠΑΛΙΑ' },
      PROVED,
    );

    expect(out.municipalUnitId).toBeNull();
    expect(out.municipalUnitName).toBe('');
  });
});

// =============================================================================
// Κ3 — ΚΑΘΑΡΗ ΦΟΡΜΑ: ΚΑΜΙΑ ΕΞΑΡΤΗΣΗ ΑΠΟ ΠΡΟΗΓΟΥΜΕΝΗ ΚΑΤΑΣΤΑΣΗ
// =============================================================================

it('Κ3 · χωρίς προηγούμενη κατάσταση ⇒ πλήρης τιμή με όλα τα πεδία παρόντα', () => {
  const out = buildingHierarchyAfterDrag(undefined, RESOLVED);

  // ⚠️ **Όλα** τα κλειδιά παρόντα: μια μερική τιμή θα άφηνε `undefined` σε πεδία που η
  //    φόρμα δένει σε controlled inputs — και το React θα τα έκανε ξαφνικά uncontrolled.
  expect(out.majorGeoId).toBeNull();
  expect(out.decentAdminName).toBe('');
  expect(out.street).toBe('Εγνατία');
  expect(out.country).toBe('GR');
});
