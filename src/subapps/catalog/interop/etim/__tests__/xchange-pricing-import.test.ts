/**
 * Εισαγωγή `Pricing` από ETIM xChange (ADR-923 §23.2 K4γ): ποιο ποσό, ποια εγγραφή, ποια μονάδα — και ότι ό,τι δεν μπαίνει μετριέται.
 * Η αλυσίδα ελέγχεται ως το τέλος της καθαρής πλευράς: προσαρμογέας ⇒ `buildPriceRows` (ο ίδιος δρόμος με το αρχείο).
 */

import { buildPriceRows, type PriceProposalContext } from '../../../import/build-price-proposal';
import type { ExtractedCell } from '../../../types/catalog-import';
import { shiftCanonicalAmount } from '../../../values/decimal-amount';
import { readXChangeDocument, type XChangeProduct } from '../xchange-document';
import { exactPriceUnit, extractPriceGroupsFromXChange, type XChangePriceImportContext } from '../xchange-pricing-to-groups';

type Entry = Record<string, unknown>;

const productOf = (code: string, pricing: readonly Entry[], tradeItems = 1): Entry => ({
  ProductIdentification: { ManufacturerProductNumber: `M-${code}` },
  TradeItem: Array.from({ length: tradeItems }, () => ({ ItemIdentification: { SupplierItemNumber: code }, Pricing: pricing })),
});

const documentOf = (products: readonly Entry[], currency?: string): string =>
  JSON.stringify({ CatalogueId: 'c1', ...(currency === undefined ? {} : { CurrencyCode: currency }), Supplier: [{ Product: products }] });

function productsOf(products: readonly Entry[], currency?: string): readonly XChangeProduct[] {
  const view = readXChangeDocument(documentOf(products, currency));
  if (view === null) throw new Error('not an xChange document');
  return view.products;
}

const listContext: XChangePriceImportContext = { priceType: 'net_list', validFrom: '2026-07-01T00:00:00.000Z', currencyAssumed: false };

const price = (overrides: Entry = {}): Entry => ({ PriceUnit: 'C62', PriceQuantity: '1', GrossListPrice: '120.50', NetPrice: '96.40', PriceValidityDate: '2026-01-01', ...overrides });

function cellsOf(products: readonly Entry[], context = listContext) {
  const { groups, report } = extractPriceGroupsFromXChange(productsOf(products), context);
  const rows = groups.flatMap((group) => group.rows);
  const field = (row: number, name: string): string | null | undefined =>
    rows[row]?.cells.find((cell: ExtractedCell) => cell.target.kind === 'price' && cell.target.field === name)?.text;
  return { groups, rows, report, field };
}

describe('ανάγνωση εγγράφου', () => {
  it('κρατά νόμισμα και εγγραφές τιμής· απόν νόμισμα ⇒ null, όχι «ευρώ»', () => {
    expect(readXChangeDocument(documentOf([productOf('A', [price()])], 'EUR'))?.currency).toBe('EUR');
    expect(readXChangeDocument(documentOf([productOf('A', [price()])]))?.currency).toBeNull();
    expect(productsOf([productOf('A', [price()])])[0].TradeItem[0].Pricing[0]).toMatchObject({ GrossListPrice: '120.50', AllowanceSurcharge: [] });
  });

  it('ελλιπής τιμή δεν ρίχνει το έγγραφο (η εισαγωγή ιδιοτήτων δεν πρέπει να σπάει από τις τιμές)', () => {
    expect(readXChangeDocument(documentOf([productOf('A', [{ NetPrice: '1' }])]))).not.toBeNull();
  });
});

describe('ποιο ποσό: ο τύπος της λίστας', () => {
  it('net_list ⇒ GrossListPrice · net_customer ⇒ NetPrice', () => {
    expect(cellsOf([productOf('A', [price()])]).field(0, 'netPrice')).toBe('120.50');
    expect(cellsOf([productOf('A', [price()])], { ...listContext, priceType: 'net_customer' }).field(0, 'netPrice')).toBe('96.40');
  });

  it('λείπει το σωστό ποσό ⇒ καμία γραμμή, μετρημένο· το άλλο ποσό ΠΟΤΕ στη θέση του', () => {
    const { rows, report } = cellsOf([productOf('A', [price({ GrossListPrice: undefined })])]);
    expect(rows).toEqual([]);
    expect(report).toMatchObject({ purpose: 'priceLines', products: 1, imported: 0, amountMissing: 1 });
  });

  it('PriceOnRequest ⇒ καμία γραμμή, μετρημένο', () => {
    const { rows, report } = cellsOf([productOf('A', [price({ PriceOnRequest: true })])]);
    expect(rows).toEqual([]);
    expect(report.onRequest).toBe(1);
  });

  it('χωρίς PriceUnit ή PriceQuantity ⇒ καμία γραμμή, μετρημένο', () => {
    expect(cellsOf([productOf('A', [price({ PriceUnit: undefined })])]).report.entryIncomplete).toBe(1);
    expect(cellsOf([productOf('A', [price({ PriceQuantity: undefined })])]).report.entryIncomplete).toBe(1);
  });
});

describe('ποια εγγραφή: η περίοδος ισχύος', () => {
  const old = price({ GrossListPrice: '100.00', PriceValidityDate: '2026-01-01', PriceExpiryDate: '2026-06-30' });
  const current = price({ GrossListPrice: '110.00', PriceValidityDate: '2026-07-01' });
  const future = price({ GrossListPrice: '125.00', PriceValidityDate: '2027-01-01' });

  it('η εγγραφή που καλύπτει την έναρξη ισχύος της έκδοσης, σε οποιαδήποτε σειρά', () => {
    expect(cellsOf([productOf('A', [future, old, current])]).field(0, 'netPrice')).toBe('110.00');
  });

  it('η λήξη μετρά: την ημέρα μετά τη λήξη η παλιά εγγραφή δεν καλύπτει', () => {
    const { rows, report } = cellsOf([productOf('A', [old])]);
    expect(rows).toEqual([]);
    expect(report.validityUncovered).toEqual(['A']);
  });

  it('επικάλυψη ⇒ η νεότερη έναρξη (SAP)', () => {
    const open = price({ GrossListPrice: '90.00', PriceValidityDate: '2025-01-01' });
    expect(cellsOf([productOf('A', [current, open])]).field(0, 'netPrice')).toBe('110.00');
  });

  it('έκδοση χωρίς έναρξη: μία εγγραφή ⇒ αυτή· πολλές ⇒ καμία γραμμή, μετρημένο (όχι «σήμερα»)', () => {
    const draft = { ...listContext, validFrom: null };
    expect(cellsOf([productOf('A', [current])], draft).field(0, 'netPrice')).toBe('110.00');
    const many = cellsOf([productOf('A', [old, current])], draft);
    expect(many.rows).toEqual([]);
    expect(many.report.validityAmbiguous).toEqual(['A']);
  });

  it('κλιμάκια (AllowanceSurcharge) μετριούνται· η γραμμή μπαίνει με τη βασική τιμή', () => {
    const { rows, report } = cellsOf([productOf('A', [price({ AllowanceSurcharge: [{ AllowanceSurchargeMinimumQuantity: '100' }] })])]);
    expect(rows).toHaveLength(1);
    expect(report.allowanceSurcharges).toBe(1);
  });

  it('πολλά εμπορεύσιμα είδη ⇒ το πρώτο, μετρημένο', () => {
    expect(cellsOf([productOf('A', [price()], 2)]).report.extraTradeItems).toBe(1);
  });
});

describe('ακρίβεια: ποτέ σιωπηλή στρογγύλευση', () => {
  it('shiftCanonicalAmount μετακινεί την υποδιαστολή ακριβώς', () => {
    expect(shiftCanonicalAmount('0.0125', 2)).toBe('1.25');
    expect(shiftCanonicalAmount('3', 2)).toBe('300');
    expect(shiftCanonicalAmount('0.5', 0)).toBe('0.5');
    expect(shiftCanonicalAmount('1,5', 1)).toBeNull();
  });

  it('0,0125/1 ⇒ 1,25/100 · 0,0125/10 ⇒ 1,25/1000 · δύο δεκαδικά μένουν ως έχουν', () => {
    expect(exactPriceUnit('0.0125', '1')).toEqual({ amount: '1.25', quantity: '100' });
    expect(exactPriceUnit('0.0125', '10')).toEqual({ amount: '1.25', quantity: '1000' });
    expect(exactPriceUnit('12.50', '1')).toEqual({ amount: '12.50', quantity: '1' });
  });

  it('δεν χωρά ακριβώς ⇒ περνά ως έχει, και ο parser το κάνει εύρημα', () => {
    expect(exactPriceUnit('0.00001', '1000')).toEqual({ amount: '0.00001', quantity: '1000' });
  });
});

describe('μονάδα: διάλεκτος ETIM ⇒ κωδικός του μητρώου μας', () => {
  it('το προσαρμοσμένο κείμενο μεταφράζεται (BG ⇒ XBG)· ο parser κάνει τον κωδικό του μητρώου', () => {
    expect(cellsOf([productOf('A', [price({ PriceUnit: 'BG' })])]).field(0, 'unitCode')).toBe('XBG');
    expect(cellsOf([productOf('A', [price({ PriceUnit: 'MTR' })])]).field(0, 'unitCode')).toBe('MTR');
  });
});

describe('ο ίδιος δρόμος με το αρχείο: buildPriceRows', () => {
  const context: PriceProposalContext = { variantIdByRow: new Map([['p1', 'v1']]), liveLines: new Map(), baseLines: new Map(), discountGroupIdByCode: new Map() };

  it('νέα γραμμή: λεπτά, ποσότητα και μονάδα του μητρώου, χωρίς ευρήματα', () => {
    const { groups } = cellsOf([productOf('A', [price({ GrossListPrice: '0.0125', PriceUnit: 'MTR' })])]);
    const [row] = buildPriceRows(groups[0], context);
    expect(row).toMatchObject({ action: 'create', holderId: 'v1', label: 'A', issues: [] });
    expect(row.fields.map((field) => field.incoming)).toEqual([
      { type: 'money', minor: 125 },
      { type: 'priceQuantity', quantity: 100 },
      { type: 'unit', unitCode: 'm' },
    ]);
  });

  it('C62 και BG καταλήγουν σε pcs και bag', () => {
    const units = ['C62', 'BG'].map((unit) => {
      const [row] = buildPriceRows(cellsOf([productOf('A', [price({ PriceUnit: unit })])]).groups[0], context);
      return row.fields.find((field) => field.incoming?.type === 'unit')?.incoming;
    });
    expect(units).toEqual([{ type: 'unit', unitCode: 'pcs' }, { type: 'unit', unitCode: 'bag' }]);
  });
});
