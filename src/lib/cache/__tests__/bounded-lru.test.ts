/** Άγκυρες της LRU με όριο βάρους (ADR-884 Φ2ε · §4.11). */

import { createBoundedLru } from '../bounded-lru';

const make = (maxWeight: number, evicted: string[] = []) =>
  createBoundedLru<number>({ maxWeight, weigh: (v) => v, onEvict: (_v, key) => evicted.push(key) });

describe('createBoundedLru', () => {
  it('πετά το ΛΙΓΟΤΕΡΟ πρόσφατα χρησιμοποιημένο όταν ξεπεραστεί το όριο', () => {
    const evicted: string[] = [];
    const lru = make(10, evicted);
    lru.set('a', 4);
    lru.set('b', 4);
    lru.get('a'); // το «a» γίνεται πιο πρόσφατο από το «b»
    lru.set('c', 4);
    expect(evicted).toEqual(['b']);
    expect(lru.has('a')).toBe(true);
    expect(lru.weight()).toBe(8);
  });

  it('αντικατάσταση κλειδιού: αφαιρεί το παλιό βάρος και καλεί onEvict για την παλιά τιμή', () => {
    const evicted: string[] = [];
    const lru = make(10, evicted);
    lru.set('a', 6);
    lru.set('a', 3);
    expect(lru.weight()).toBe(3);
    expect(evicted).toEqual(['a']);
    expect(lru.get('a')).toBe(3);
  });

  it('τιμή βαρύτερη από όλο το όριο δεν μπαίνει και δεν διώχνει τίποτα', () => {
    const lru = make(10);
    lru.set('a', 5);
    lru.set('huge', 11);
    expect(lru.has('huge')).toBe(false);
    expect(lru.has('a')).toBe(true);
  });

  it('clear αποδεσμεύει τα πάντα μέσω onEvict', () => {
    const evicted: string[] = [];
    const lru = make(10, evicted);
    lru.set('a', 1);
    lru.set('b', 1);
    lru.clear();
    expect(evicted.sort()).toEqual(['a', 'b']);
    expect(lru.weight()).toBe(0);
  });
  it('delete βγάζει ΕΝΑ κλειδί μέσω onEvict και ελευθερώνει το βάρος του · άγνωστο κλειδί ⇒ τίποτα', () => {
    const evicted: string[] = [];
    const lru = make(10, evicted);
    lru.set('a', 3);
    lru.set('b', 4);
    lru.delete('a');
    lru.delete('zz');
    expect(evicted).toEqual(['a']);
    expect(lru.has('a')).toBe(false);
    expect(lru.weight()).toBe(4);
  });
});
