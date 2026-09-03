/**
 * @fileoverview Άγκυρες για το «ποιο σημείο εκπροσωπεί αυτή τη λίστα;» (ADR-332 D23).
 *
 * Η ερώτηση δεν είναι *«ποια διεύθυνση εκπροσωπεί;»* — εκείνη απαντιέται με
 * `find(isPrimary) ?? [0]` και είναι αντιγραμμένη σε τρία domains. Είναι *«ποιο
 * **σημείο**;»*, και η διαφορά φαίνεται ολόκληρη στην πρώτη άγκυρα παρακάτω.
 */

/* global describe, it, expect */

import {
  addressListCenter,
  type AddressWithOptionalPosition,
} from '../address-list-center';

const THESSALONIKI = { lat: 40.6401, lng: 22.9444 };
const LARISA = { lat: 39.6390, lng: 22.4191 };

function addr(
  isPrimary: boolean,
  coordinates?: { lat: number; lng: number } | null,
): AddressWithOptionalPosition {
  return { isPrimary, coordinates };
}

describe('addressListCenter — πού είναι αυτό το πράγμα', () => {
  it('🔴 Η ΚΥΡΙΑ ΧΩΡΙΣ ΣΥΝΤΕΤΑΓΜΕΝΕΣ ΔΕΝ ΕΙΝΑΙ ΚΕΝΤΡΟ — εδώ χωρίζει από το `find(isPrimary)`', () => {
    // Ένα `find(isPrimary) ?? [0]` θα επέστρεφε την κύρια, ο καλών θα έπαιρνε `undefined`
    // θέση, και θα συμπέραινε ότι ΚΑΜΙΑ διεύθυνση δεν έχει θέση — ενώ η δεύτερη έχει.
    const center = addressListCenter([addr(true), addr(false, THESSALONIKI)]);
    expect(center).toEqual(THESSALONIKI);
  });

  it('η κύρια ΜΕ συντεταγμένες κερδίζει, ακόμη κι αν δεν είναι πρώτη', () => {
    const center = addressListCenter([addr(false, LARISA), addr(true, THESSALONIKI)]);
    expect(center).toEqual(THESSALONIKI);
  });

  it('χωρίς καμία κύρια, κρατά την ΠΡΩΤΗ που έχει θέση', () => {
    const center = addressListCenter([addr(false), addr(false, LARISA), addr(false, THESSALONIKI)]);
    expect(center).toEqual(LARISA);
  });

  it('καμία θέση πουθενά ⇒ `undefined` — δεδομένο, όχι σφάλμα', () => {
    expect(addressListCenter([addr(true), addr(false)])).toBeUndefined();
  });

  it('κενή λίστα, `undefined` και `null` δεν πετούν', () => {
    expect(addressListCenter([])).toBeUndefined();
    expect(addressListCenter(undefined)).toBeUndefined();
    expect(addressListCenter(null)).toBeUndefined();
  });

  it('🔴 `NaN` ΔΕΝ ΕΙΝΑΙ ΣΥΝΤΕΤΑΓΜΕΝΗ — αλλιώς μολύνει σιωπηλά κάθε απόσταση', () => {
    // Κάθε σύγκριση με NaN είναι ψευδής ⇒ η κατάταξη θα κατέρρεε στη σειρά του παρόχου
    // χωρίς κανένα σφάλμα πουθενά. Η επόμενη έγκυρη διεύθυνση πρέπει να κερδίσει.
    const center = addressListCenter([
      addr(true, { lat: Number.NaN, lng: 22.9444 }),
      addr(false, THESSALONIKI),
    ]);
    expect(center).toEqual(THESSALONIKI);
  });

  it('απορρίπτει και το ±Infinity, όχι μόνο το NaN', () => {
    const center = addressListCenter([
      addr(true, { lat: Number.POSITIVE_INFINITY, lng: 0 }),
      addr(false, LARISA),
    ]);
    expect(center).toEqual(LARISA);
  });

  it('`coordinates: null` αντιμετωπίζεται σαν απών — τα έγγραφα το γράφουν και έτσι', () => {
    expect(addressListCenter([addr(true, null), addr(false, LARISA)])).toEqual(LARISA);
  });

  it('δέχεται το `0` ως έγκυρη συντεταγμένη — δεν είναι «άδειο»', () => {
    // Ο μεσημβρινός του Γκρίνουιτς και ο ισημερινός υπάρχουν· ένας έλεγχος αληθοφάνειας
    // αντί για `Number.isFinite` θα τους πετούσε.
    expect(addressListCenter([addr(true, { lat: 0, lng: 0 })])).toEqual({ lat: 0, lng: 0 });
  });

  it('επιστρέφει ΝΕΟ αντικείμενο — ο καλών δεν κρατά αναφορά στο έγγραφο', () => {
    const stored = { lat: 40.6401, lng: 22.9444 };
    const center = addressListCenter([addr(true, stored)]);
    expect(center).toEqual(stored);
    expect(center).not.toBe(stored);
  });
});
