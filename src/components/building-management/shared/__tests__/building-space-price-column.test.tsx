/**
 * Άγκυρες — ADR-777 §8.60.14.14 (Φάση 4): **η στήλη «Τιμή» των καρτελών κτιρίου.**
 *
 * Πριν: κελί `formatCurrencyWhole(priceSortKey(x))` («60 €» για θέση που νοικιάζεται 60 €/μήνα)
 * και σειρά `sortValue: priceSortKey` — 60 €/μήνα και 12.000 € σε **έναν** άξονα.
 * Τώρα: κελί **με μονάδα**, σειρά **σε ομάδες** (`<tbody>` + `<th scope="rowgroup">` ανά μονάδα).
 *
 * Ο `t` είναι **καταγραφέας** (`κλειδί|παράμετροι`): κρίνεται το **κλειδί**, όχι η μορφή του locale.
 */

import { render, screen, fireEvent, within } from '@testing-library/react';
import { BuildingSpaceTable } from '../BuildingSpaceTable';
import { buildPriceColumn } from '../buildingSpacePriceColumn';
import { buildPriceField } from '../buildingSpaceCardFields';
import type { SpaceColumn } from '../types';
import type { PricedPropertyLike } from '@/lib/properties/price-resolver';
import { PRICE_AMOUNT_KEY, PRICE_SECTION_KEY } from '@/lib/listings/listing-price-keys';
import type { PriceLabelT } from '@/lib/listings/listing-price-label';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/hooks/useIconSizes', () => ({
  useIconSizes: () => ({ xs: 'h-3 w-3', sm: 'h-4 w-4', md: 'h-5 w-5' }),
}));

interface Spot extends PricedPropertyLike {
  readonly id: string;
  readonly number: string;
}

const t: PriceLabelT = (key, options) => {
  const { price, ...rest } = options ?? {};
  const params = price === undefined ? rest : { ...rest, price: '#' };
  return Object.keys(params).length > 0 ? `${key}|${JSON.stringify(params)}` : key;
};

const sale = (number: string, askingPrice: number): Spot =>
  ({ id: number, number, commercialStatus: 'for-sale', commercial: { askingPrice } });
const rent = (number: string, rentPrice: number): Spot =>
  ({ id: number, number, commercialStatus: 'for-rent', commercial: { rentPrice } });
const unpriced = (number: string): Spot => ({ id: number, number, commercialStatus: 'for-sale' });

const COLUMNS: SpaceColumn<Spot>[] = [
  { key: 'number', label: 'number', sortValue: (s) => s.number, render: (s) => <span>{s.number}</span> },
  buildPriceColumn<Spot>('price', t, (s) => s.number),
];

const MIXED = [sale('P3', 18_000), rent('P1', 60), unpriced('P4'), sale('P2', 12_000), rent('P5', 90)];

function draw(items: Spot[]) {
  render(<BuildingSpaceTable items={items} columns={COLUMNS} getKey={(s) => s.id} />);
}

/** Κάθε `<tbody>`: η επιγραφή του (αν έχει) και οι αριθμοί των γραμμών του, με τη σειρά. */
function groups(): Array<{ heading: string | null; rows: string[] }> {
  return Array.from(document.querySelectorAll('tbody')).map((body) => ({
    heading: body.querySelector('th[scope="rowgroup"]')?.textContent ?? null,
    rows: Array.from(body.querySelectorAll('tr'))
      .map((tr) => tr.querySelector('td')?.textContent ?? null)
      .filter((cell): cell is string => cell !== null),
  }));
}

const headingKey = (text: string | null) => (text === null ? null : text.split('|')[0]);

describe('Α. ΣΕΙΡΑ ΚΑΤΑ ΤΙΜΗ = ΟΜΑΔΑ (μονάδα) → ΑΡΙΘΜΟΣ', () => {
  it('🔴 Α1 — το περιστατικό: το ενοίκιο των 60 €/μήνα ΔΕΝ ανεβαίνει πάνω από τις πωλήσεις', () => {
    draw(MIXED);
    fireEvent.click(screen.getByText('price'));
    const g = groups();
    expect(g.map((x) => headingKey(x.heading))).toEqual([
      PRICE_SECTION_KEY.sale, PRICE_SECTION_KEY.rent, PRICE_SECTION_KEY.unpriced,
    ]);
    expect(g[0].rows).toEqual(['P2', 'P3']);
    expect(g[1].rows).toEqual(['P1', 'P5']);
    expect(g[2].rows).toEqual(['P4']);
  });

  it('Α2 — φθίνουσα: αντιστρέφεται ο αριθμός, ΠΟΤΕ οι ομάδες', () => {
    draw(MIXED);
    fireEvent.click(screen.getByText('price'));
    fireEvent.click(screen.getByText('price'));
    const g = groups();
    expect(g.map((x) => headingKey(x.heading))).toEqual([
      PRICE_SECTION_KEY.sale, PRICE_SECTION_KEY.rent, PRICE_SECTION_KEY.unpriced,
    ]);
    expect(g[0].rows).toEqual(['P3', 'P2']);
    expect(g[1].rows).toEqual(['P5', 'P1']);
  });

  it('Α3 — η επιγραφή μετρά την ομάδα της (λογιστική) και είναι `th scope="rowgroup"` σε όλο το πλάτος', () => {
    draw(MIXED);
    fireEvent.click(screen.getByText('price'));
    const header = document.querySelector('th[scope="rowgroup"]');
    expect(header?.textContent).toBe(`${PRICE_SECTION_KEY.sale}|{"count":2}`);
    expect(header?.getAttribute('colspan')).toBe(String(COLUMNS.length));
  });

  it('Α4 — ΜΙΑ μονάδα ⇒ ΚΑΜΙΑ γραμμή-επικεφαλίδα (ο πίνακας μένει ο σημερινός)', () => {
    draw([rent('P2', 90), rent('P1', 60)]);
    fireEvent.click(screen.getByText('price'));
    expect(document.querySelectorAll('th[scope="rowgroup"]')).toHaveLength(0);
    expect(groups()).toEqual([{ heading: null, rows: ['P1', 'P2'] }]);
  });

  it('Α5 — άλλη στήλη ⇒ ΕΝΑ σώμα, χωρίς ομάδες (οι ομάδες ανήκουν στην ερώτηση «πόσο;»)', () => {
    draw(MIXED);
    fireEvent.click(screen.getByText('number'));
    expect(groups()).toEqual([{ heading: null, rows: ['P1', 'P2', 'P3', 'P4', 'P5'] }]);
  });
});

describe('Β. ΤΟ ΚΕΛΙ ΓΡΑΦΕΙ ΤΗ ΜΟΝΑΔΑ', () => {
  it('🔴 Β1 — ενοίκιο ⇒ κλειδί ενοικίου («/μήνα»), πώληση ⇒ κλειδί πώλησης, απουσία ⇒ «—»', () => {
    draw(MIXED);
    const rowOf = (n: string) => screen.getByText(n).closest('tr') as HTMLElement;
    expect(within(rowOf('P1')).getByText(`${PRICE_AMOUNT_KEY.rent}|{"price":"#"}`)).toBeTruthy();
    expect(within(rowOf('P2')).getByText(`${PRICE_AMOUNT_KEY.sale}|{"price":"#"}`)).toBeTruthy();
    expect(within(rowOf('P4')).getByText('—')).toBeTruthy();
  });

  it('Β2 — η κάρτα (buildPriceField) γράφει την ΙΔΙΑ μονάδα με το κελί', () => {
    const field = buildPriceField<Spot>('price', t);
    expect(field.render(rent('P1', 60))).toBe(`${PRICE_AMOUNT_KEY.rent}|{"price":"#"}`);
    expect(field.render(unpriced('P4'))).toBe('—');
  });

  it('Β3 — η στήλη τιμής ΔΕΝ έχει επίπεδο κλειδί (`sortValue`): η επίπεδη σειρά δεν εκφράζεται', () => {
    const column = buildPriceColumn<Spot>('price', t, (s) => s.number);
    expect(column.sortValue).toBeUndefined();
    expect(column.sortGroups).toBeDefined();
  });
});
