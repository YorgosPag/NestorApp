/**
 * @fileoverview Άγκυρα του κριτή «αρκεί η διεύθυνση ως τόπος;» (ADR-332 D28 Δ).
 * @related lib/places/place-claim.ts (`addressClaimAdmissible`) · components/geo/PlaceAddressOffer · services/places/public-place-write.service
 *
 * 🔑 Ο **ίδιος** κριτής αποφασίζει αν η οθόνη **προσφέρει** το κουμπί και αν ο διακομιστής **δέχεται** τη χειρονομία.
 * Ο πίνακας κλειδώνεται **ολόκληρος**: μια χαλάρωση (π.χ. `approximate` για κτίριο) πρέπει να κοκκινίσει εδώ.
 */

import { addressClaimAdmissible } from '../place-claim';
import { GEOCODING_ACCURACIES, type GeocodingAccuracy } from '@/lib/geocoding/geocoding-types';

const EXPECTED: Record<'land' | 'building', Record<GeocodingAccuracy, boolean>> = {
  land: { exact: true, interpolated: true, approximate: false, center: false },
  building: { exact: true, interpolated: false, approximate: false, center: false },
};

describe('addressClaimAdmissible — πότε μια διεύθυνση ΑΡΚΕΙ ως τόπος', () => {
  it.each(GEOCODING_ACCURACIES.flatMap((accuracy) => (['land', 'building'] as const).map((target) => [target, accuracy] as const)))(
    '%s · %s',
    (target, accuracy) => {
      expect(addressClaimAdmissible(accuracy, target)).toBe(EXPECTED[target][accuracy]);
    },
  );

  it('🔴 γειτονιά ή πόλη ΠΟΤΕ — ούτε για γη: σημείο που μοιάζει τόπος ενώ είναι κέντρο περιοχής', () => {
    expect(addressClaimAdmissible('approximate', 'land')).toBe(false);
    expect(addressClaimAdmissible('center', 'land')).toBe(false);
  });
});
