/**
 * ADR-890 §18 — **το κείμενο της ετικέτας τιμής** ακολουθεί ΑΚΡΙΒΩΣ τους κανόνες του υπομνήματος και του πίνακα:
 * δική τιμή ⇒ ο αριθμός · αναγωγή ⇒ η τιμή του γονέα με το όνομα της βαθμίδας του · λίγα ⇒ **ποτέ** αριθμός.
 */

import type { PriceMapChoice, PriceMapSelection } from '@/lib/market/price-map-view';

import { priceMapLabelOf, priceMapPriceOf } from '../price-map-words';

/** Ένα `t` που γράφει κλειδί + τιμές — αρκεί για να φανεί ΑΝ μπήκε αριθμός και ΠΟΙΟΣ. */
function echoT(key: string, values?: Record<string, unknown>): string {
  return `${key}${JSON.stringify(values ?? {})}`;
}
const t = echoT as unknown as Parameters<typeof priceMapLabelOf>[0];

const CHOICE: PriceMapChoice = { offer: 'sale', source: 'contracts', segment: 'apartment' };
const row = (resolution: PriceMapSelection['resolution']): PriceMapSelection => ({ id: 'a', name: 'a', parentName: null, resolution });
const parentLabel = (price: string) => `ΓΟΝΕΑΣ(${price})`;

describe('priceMapLabelOf', () => {
  it('δική τιμή ⇒ ο αριθμός της, όπως τον γράφει παντού ο χάρτης (`priceMapPriceOf`)', () => {
    const own = row({ kind: 'own', n: 40, median: 1544, classIndex: 3 });
    expect(priceMapLabelOf(t, CHOICE, own, parentLabel, null)).toBe(priceMapPriceOf(t, CHOICE, 1544));
  });

  it('αναγωγή ⇒ η τιμή του ΓΟΝΕΑ, με τη λέξη της βαθμίδας του — ποτέ σκέτος αριθμός που θα έμοιαζε δικός της', () => {
    const inherited = row({ kind: 'parent', n: 3, parentId: 'p', parentN: 1068, median: 1547, classIndex: 3 });
    expect(priceMapLabelOf(t, CHOICE, inherited, parentLabel, null)).toBe(`ΓΟΝΕΑΣ(${priceMapPriceOf(t, CHOICE, 1547)})`);
  });

  it('λίγα ⇒ ΠΟΤΕ αριθμός: η λέξη του καλούντος (σελίδα περιοχής) ή καμία ετικέτα (αναζήτηση)', () => {
    const few = row({ kind: 'few', n: 2 });
    expect(priceMapLabelOf(t, CHOICE, few, parentLabel, 'λίγα συμβόλαια')).toBe('λίγα συμβόλαια');
    expect(priceMapLabelOf(t, CHOICE, few, parentLabel, null)).toBeNull();
  });
});
