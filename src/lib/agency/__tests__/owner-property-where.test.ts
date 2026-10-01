/**
 * ADR-896 §7.2 — «Το ακίνητό μου»: ο κύκλος αβεβαιότητας είναι ο ΙΔΙΟΣ της αγγελίας, και ο κριτής του κελιού
 * είναι ο ΙΔΙΟΣ της παρουσίας. Η γεωμετρία του κριτή έχει δικές της άγκυρες (`presence-admin-ids.test.ts`)·
 * εδώ κλειδώνεται **τι του ζητείται**.
 */

import { ownerPropertyUncertainty, ownerPropertyWhere } from '../owner-property-where';
import { deepestContainingEntity } from '../presence-admin-ids';
import { LISTING_UNCERTAINTY_KM } from '@/lib/listings/listing-map-shape';
import type { OwnerPropertyPlace } from '@/types/owner-property';

jest.mock('../presence-admin-ids', () => ({ deepestContainingEntity: jest.fn() }));
const deepest = deepestContainingEntity as jest.MockedFunction<typeof deepestContainingEntity>;

const POINT = { lat: 40.6401, lng: 22.9444 };
const declared = (accuracy: Extract<OwnerPropertyPlace, { kind: 'declared' }>['accuracy']): OwnerPropertyPlace => ({
  kind: 'declared',
  point: POINT,
  label: 'Τσιμισκή 12',
  accuracy,
  link: null,
});
const NO_FOOTPRINTS = new Map();
const lineageOf = (id: string) => [id];

describe('ownerPropertyUncertainty — ο ΕΝΑΣ πίνακας αβεβαιότητας', () => {
  it.each([
    [null, LISTING_UNCERTAINTY_KM.pin],
    ['exact', LISTING_UNCERTAINTY_KM.pin],
    ['interpolated', LISTING_UNCERTAINTY_KM['pin-with-ring']],
    ['approximate', LISTING_UNCERTAINTY_KM['shaded-circle']],
    ['center', LISTING_UNCERTAINTY_KM['shaded-city']],
  ] as const)('ακρίβεια %s ⇒ ακτίνα %s χλμ (ίδια με τον δημόσιο χάρτη)', (accuracy, radiusKm) => {
    expect(ownerPropertyUncertainty(declared(accuracy))).toEqual({ center: POINT, radiusKm });
  });

  it('θέση που δεν δηλώθηκε ⇒ null — ποτέ επινοημένη', () => {
    expect(ownerPropertyUncertainty({ kind: 'declined' })).toBeNull();
  });
});

describe('ownerPropertyWhere — μόνο ταυτότητα περιοχής, ποτέ συντεταγμένη', () => {
  beforeEach(() => deepest.mockReset());

  it('🔑 ο κριτής ρωτιέται με ΟΛΟ τον κύκλο αβεβαιότητας, και το φίλτρο είναι διοικητικό', () => {
    deepest.mockReturnValue('municipality:0501');
    const where = ownerPropertyWhere(declared('center'), NO_FOOTPRINTS, lineageOf);
    expect(deepest).toHaveBeenCalledWith({ center: POINT, radiusKm: LISTING_UNCERTAINTY_KM['shaded-city'] }, NO_FOOTPRINTS, lineageOf);
    expect(where).toEqual({ adminId: 'municipality:0501' });
    // 🔒 Ο σύνδεσμος που μοιράζεται δεν προδίδει το σπίτι.
    expect(JSON.stringify(where)).not.toContain('40.64');
  });

  it('κανένα κελί δεν τον περιέχει αποδεδειγμένα ⇒ null («δεν αποδεικνύεται»)', () => {
    deepest.mockReturnValue(null);
    expect(ownerPropertyWhere(declared('exact'), NO_FOOTPRINTS, lineageOf)).toBeNull();
  });

  it('χωρίς δηλωμένη θέση ⇒ null, χωρίς καν να ρωτηθεί ο κριτής', () => {
    expect(ownerPropertyWhere({ kind: 'declined' }, NO_FOOTPRINTS, lineageOf)).toBeNull();
    expect(deepest).not.toHaveBeenCalled();
  });
});
