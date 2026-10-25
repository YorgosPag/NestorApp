/**
 * ΑΓΚΥΡΕΣ — **Η ΔΗΛΩΣΗ ΠΟΥ ΥΠΗΡΧΕ ΗΔΗ** (ADR-890 §21): η διεύθυνση έργου κρατά ταυτότητες ιεραρχίας, και τώρα διαβάζονται
 * — μέσα από τον πίνακα του ADR-772, δεμένες στο σημείο της ίδιας διεύθυνσης.
 */

import { addressToDeclaredAdminArea, type StoredProjectAddress } from '@/services/listings/public-listing-position';
import { deepestDeclaredAdminId } from '@/utils/address/administrative-hierarchy';

/** Μετρημένο σχήμα παραγωγής (`proj_2eb4b755…`, 2026-10-25). */
const KORDELIO: StoredProjectAddress = {
  street: 'Σαμοθράκης',
  coordinates: { lat: 40.66424742653837, lng: 22.897516207515167 },
  settlementId: 'settlement:0708020101',
  municipalUnitId: 'municipal_unit:070802',
  municipalityId: 'municipality:0708',
  regionalUnitId: 'regional_unit:07',
  regionId: 'region:112',
};

describe('deepestDeclaredAdminId — η βαθύτερη ταυτότητα, από τον πίνακα του ADR-772', () => {
  it('ο οικισμός νικά (βαθύτερος από τη Δ.Ε.)', () => {
    expect(deepestDeclaredAdminId(KORDELIO, 'projectAddress')).toBe('settlement:0708020101');
  });

  it('χωρίς οικισμό ⇒ η Δ.Ε.· κενές συμβολοσειρές και `null` προσπερνιούνται', () => {
    expect(deepestDeclaredAdminId({ ...KORDELIO, settlementId: '' }, 'projectAddress')).toBe('municipal_unit:070802');
    expect(deepestDeclaredAdminId({ ...KORDELIO, settlementId: null, municipalUnitId: null }, 'projectAddress')).toBe(
      'municipality:0708',
    );
  });

  it('η Κοινότητα των έργων ζει μόνο ως όνομα (`NOT_STORED` id) ⇒ δεν διαβάζεται ως ταυτότητα', () => {
    expect(deepestDeclaredAdminId({ neighborhood: 'Ελευθέριο-Κορδελιό' }, 'projectAddress')).toBeNull();
  });
});

describe('addressToDeclaredAdminArea — δεμένη στο σημείο της ίδιας διεύθυνσης', () => {
  it('συντεταγμένες + ταυτότητα ⇒ δήλωση στο ΙΔΙΟ σημείο με την υποψήφια θέση', () => {
    expect(addressToDeclaredAdminArea(KORDELIO)).toEqual({
      point: { lat: 40.66424742653837, lng: 22.897516207515167 },
      areaId: 'settlement:0708020101',
    });
  });

  it('χωρίς συντεταγμένες ⇒ καμία δήλωση (δεν υπάρχει θέση να συμπληρώσει)', () => {
    expect(addressToDeclaredAdminArea({ ...KORDELIO, coordinates: null })).toBeNull();
  });

  it('χωρίς ταυτότητες ιεραρχίας (τα παλιά seed έργα) ⇒ καμία δήλωση', () => {
    expect(
      addressToDeclaredAdminArea({ coordinates: KORDELIO.coordinates, municipalUnitId: null, municipalityId: null }),
    ).toBeNull();
  });
});
