/**
 * ADR-923 §5.10.4 Β3 — αλλαγές φορέα: θέσεις κανάλι × γλώσσα, και τιμή/λόγος απουσίας ΠΟΤΕ μαζί (Δ5).
 */
import { MFP_VARIANTS } from '../../__tests__/fixtures/mfp-fan-coil-products.fixture';
import type { CatalogValueHolder } from '../../types/product';
import { writeHolderValue, writeNoValueReason } from '../holder-edit';
import { readSlot } from '../value-shape';

const plain = { scopable: false, localizable: false };
const localized = { scopable: false, localizable: true };
const scoped = { scopable: true, localizable: true };
const empty: CatalogValueHolder = { values: {}, noValueReasons: {}, categoryIds: [] };

describe('writeHolderValue', () => {
  it('μη localizable/scopable ⇒ θέση * / * ανεξάρτητα από κανάλι και γλώσσα', () => {
    const next = writeHolderValue(empty, 'a', plain, 'storefront', 'en', { type: 'text', text: 'x' });
    expect(next.values).toEqual({ a: { '*': { '*': { type: 'text', text: 'x' } } } });
  });

  it('localizable ⇒ θέση γλώσσας · δεύτερη γλώσσα δεν σβήνει την πρώτη', () => {
    const el = writeHolderValue(empty, 'd', localized, 'print', 'el', { type: 'text', text: 'α' });
    const both = writeHolderValue(el, 'd', localized, 'print', 'en', { type: 'text', text: 'a' });
    expect(readSlot(both.values.d, localized, 'storefront', 'el')).toEqual({ type: 'text', text: 'α' });
    expect(readSlot(both.values.d, localized, 'storefront', 'en')).toEqual({ type: 'text', text: 'a' });
  });

  it('scopable+localizable ⇒ κανάλι × γλώσσα · σβήσιμο της τελευταίας θέσης ⇒ καμία κενή δομή', () => {
    const one = writeHolderValue(empty, 's', scoped, 'print', 'el', { type: 'text', text: 'τ' });
    expect(one.values).toEqual({ s: { print: { el: { type: 'text', text: 'τ' } } } });
    expect(writeHolderValue(one, 's', scoped, 'print', 'el', null).values).toEqual({});
  });

  it('🔴 τιμή σβήνει τον λόγο απουσίας · λόγος σβήνει ΟΛΕΣ τις τιμές (ποτέ noValueConflict)', () => {
    const withValue = writeHolderValue(empty, 'd', localized, 'print', 'el', { type: 'text', text: 'α' });
    const notApplicable = writeNoValueReason(withValue, 'd', 'notApplicable');
    expect(notApplicable.values).toEqual({});
    expect(notApplicable.noValueReasons).toEqual({ d: 'notApplicable' });
    const back = writeHolderValue(notApplicable, 'd', localized, 'print', 'el', { type: 'text', text: 'β' });
    expect(back.noValueReasons).toEqual({});
    expect(writeNoValueReason(back, 'd', null)).toEqual(back);
  });

  it('δεν αγγίζει τίποτα άλλο του φορέα (MFP παραλλαγή)', () => {
    const variant = MFP_VARIANTS[0];
    const next = writeHolderValue(variant, 'cooling_h', plain, 'print', 'el', { type: 'measurement', amount: '9.9', unitCode: 'kW' });
    expect({ ...next, values: { ...next.values, cooling_h: variant.values.cooling_h } }).toEqual(variant);
  });
});
