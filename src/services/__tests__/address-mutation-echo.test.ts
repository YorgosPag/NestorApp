/**
 * Άγκυρες της **απήχησης** μιας μετάλλαξης διευθύνσεων — `services/address-mutation-echo`.
 * ADR-332 D27 Βήμα Β (Β5 · Φ2β).
 *
 * 🔑 Τη χρησιμοποιούν **και οι δύο** clients (έργα · κτίρια). Ό,τι φυλάγεται εδώ φυλάγεται για
 * τους δύο — γι' αυτό υπάρχει ως ένα module και όχι ως δύο δίδυμα (CHECK 3.28).
 */

import type { ProjectAddress } from '@/types/project/addresses';
import { realtimeUpdateFields, serverAddressEcho, settleEntityUpdate } from '../address-mutation-echo';

const WRITTEN: ProjectAddress[] = [{
  id: 'addr-16',
  street: 'Σαμοθράκης',
  number: '16',
  city: 'Ελευθέριο Κορδελιό',
  postalCode: '56334',
  country: 'Greece',
  type: 'site',
  isPrimary: true,
  coordinates: { lat: 40.6642462, lng: 22.8975146 },
  source: 'dragged',
}];

/** Αυτό που ΕΣΤΕΙΛΕ ο πελάτης: με το μπαγιάτικο `geocodingMetadata` που ο διακομιστής έσβησε. */
const SENT: ProjectAddress[] = [{
  ...WRITTEN[0],
  geocodingMetadata: { confidence: 0.6, accuracy: 'interpolated', variantUsed: 1 },
}];

describe('realtimeUpdateFields — τι μαθαίνουν οι ΑΛΛΕΣ σελίδες', () => {
  it('το αίτημα `relocateAddressIds` και η έκδοση `_v` ΔΕΝ διαδίδονται — δεν είναι πεδία', () => {
    expect(realtimeUpdateFields({ _v: 3, relocateAddressIds: ['addr-16'], name: 'Έργο' }, {}))
      .toEqual({ name: 'Έργο' });
  });

  it('Β5 — οι διευθύνσεις είναι του ΔΙΑΚΟΜΙΣΤΗ, όχι του αιτήματος', () => {
    const fields = realtimeUpdateFields({ addresses: SENT }, { addresses: WRITTEN });
    expect(fields.addresses).toBe(WRITTEN);
  });

  it('ΠΑΡΟΝΟΜΑΣΤΗΣ: χωρίς απήχηση (ο διακομιστής δεν έγραψε διευθύνσεις) μένουν του αιτήματος', () => {
    expect(realtimeUpdateFields({ addresses: SENT }, {}).addresses).toBe(SENT);
  });

  it('μόνο ΟΡΙΣΜΕΝΕΣ τιμές — ένα `undefined` θα έσβηνε πεδίο στον ακροατή', () => {
    expect(realtimeUpdateFields({ name: undefined, city: 'Θεσσαλονίκη' }, {})).toEqual({ city: 'Θεσσαλονίκη' });
  });
});

describe('serverAddressEcho — ΜΟΝΟ ό,τι έστειλε ο διακομιστής', () => {
  it('διευθύνσεις και συμβουλές περνούν αυτούσιες', () => {
    const advisory = { addressId: 'addr-16', distanceMetres: 4_600, toleranceMetres: 50 };
    expect(serverAddressEcho({ addresses: WRITTEN, positionAdvisories: [advisory] }))
      .toEqual({ addresses: WRITTEN, positionAdvisories: [advisory] });
  });

  it('καμία απάντηση ⇒ κανένα κλειδί (ώστε ο πελάτης να πέσει στο δικό του, ρητά)', () => {
    expect(serverAddressEcho(undefined)).toEqual({});
  });
});

describe('settleEntityUpdate — ΕΝΑ κλείσιμο για κάθε επιτυχημένη μετάλλαξη (έργα ΚΑΙ κτίρια)', () => {
  it('διαδίδει τα πεδία του ΔΙΑΚΟΜΙΣΤΗ (χωρίς το αίτημα) και επιστρέφει έκδοση + απήχηση', () => {
    const dispatch = jest.fn();

    const result = settleEntityUpdate(
      { _v: 7, addresses: WRITTEN },
      { addresses: SENT, relocateAddressIds: ['addr-16'] },
      dispatch,
    );

    expect(dispatch).toHaveBeenCalledWith({ addresses: WRITTEN });
    expect(result).toEqual({ success: true, _v: 7, addresses: WRITTEN });
  });
});
