import { compareOrderKeys, keyBetween } from '@/lib/ordering/fractional-index';
import { orderKeyAtEnd, orderKeyBetween } from '../catalog-ordering';

const a = keyBetween(null, null);
const b = keyBetween(a, null);
const c = keyBetween(b, null);
const items = [{ id: 'a', orderKey: a }, { id: 'b', orderKey: b }, { id: 'c', orderKey: c }];

describe('catalog-ordering — μία εγγραφή ανά μετακίνηση', () => {
  it('ανάμεσα σε γείτονες: αυστηρά ανάμεσα στα κλειδιά τους', () => {
    const key = orderKeyBetween(items, { beforeId: 'a', afterId: 'b' });
    expect(compareOrderKeys(a, key)).toBeLessThan(0);
    expect(compareOrderKeys(key, b)).toBeLessThan(0);
  });

  it('στην αρχή / στο τέλος', () => {
    expect(compareOrderKeys(orderKeyBetween(items, { beforeId: null, afterId: 'a' }), a)).toBeLessThan(0);
    expect(compareOrderKeys(c, orderKeyAtEnd(items))).toBeLessThan(0);
  });

  it('το τέλος αγνοεί τον ίδιο τον κόμβο που μετακινείται', () => {
    expect(orderKeyAtEnd(items, 'c')).toBe(keyBetween(b, null));
  });

  it('ίσα κλειδιά (εισαγμένα δεδομένα): ποτέ εξαίρεση — αμέσως μετά τον προηγούμενο', () => {
    const tied = [{ id: 'x', orderKey: a }, { id: 'y', orderKey: a }];
    expect(() => orderKeyBetween(tied, { beforeId: 'x', afterId: 'y' })).not.toThrow();
    expect(compareOrderKeys(a, orderKeyBetween(tied, { beforeId: 'x', afterId: 'y' }))).toBeLessThan(0);
  });
});
