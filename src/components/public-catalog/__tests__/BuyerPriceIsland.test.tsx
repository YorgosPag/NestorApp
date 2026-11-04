/**
 * @jest-environment jsdom
 */

/**
 * **Η νησίδα «η τιμή σας»** (ADR-923 §5.13 Σ6 · Δ2, ανασκόπηση Μ-2), εκτελεσμένη. Ο διακομιστής κρίνει το κοινό· η νησίδα
 * εγγυάται τρία πράγματα που κανένα άλλο test δεν βλέπει:
 * - ανώνυμος ⇒ **καμία** κλήση (η σελίδα ISR δεν ρωτά ποτέ για λογαριασμό κανενός)·
 * - απάντηση που φτάνει **μετά** από αλλαγή χρήστη ή μοντέλου πετιέται: ποτέ τιμή άλλου λογαριασμού στην οθόνη·
 * - κάθε αποτυχία (403, δίκτυο) ⇒ τίποτα· η δημόσια τιμή μένει όπως είναι.
 * Mock: ο πελάτης δικτύου (`fetchBuyerShowcasePrices`), η σύνδεση (για να αλλάζει χρήστης) και τα κείμενα/μονάδες (όπως στο
 * `showcase-price-views.test`). Η λογική της νησίδας τρέχει αληθινή.
 */

import { act, render, screen } from '@testing-library/react';

import { PUBLIC_CATALOG_SCHEMA_VERSION, type PublicCatalogModel } from '@/subapps/catalog/public/public-catalog-schema';
import type { ShowcaseBuyerPrice, ShowcaseConsumerPrice, ShowcaseModelPrices } from '@/subapps/catalog/public/showcase-price';
import type { BuyerShowcasePricesWire } from '@/services/public-catalog/public-catalog-prices.client';

import { BuyerPriceIsland } from '../BuyerPriceIsland';

let mockUser: { readonly uid: string } | null = null;
const mockFetch = jest.fn<Promise<BuyerShowcasePricesWire>, [string, string]>();

jest.mock('@/auth/hooks/useAuth', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('@/services/public-catalog/public-catalog-prices.client', () => ({
  fetchBuyerShowcasePrices: (supplierCompanyId: string, modelId: string) => mockFetch(supplierCompanyId, modelId),
}));
jest.mock('../public-catalog-text', () => ({
  usePublicCatalogText: () => ({
    t: (key: string, values?: Record<string, unknown>) => (values ? `${key}:${JSON.stringify(values)}` : key),
    text: (labels: { readonly el?: string } | undefined) => labels?.el ?? '',
    language: 'el',
  }),
}));
jest.mock('@/hooks/useUomLabel', () => ({ useUomLabel: () => (code: string) => `u:${code}` }));
/** Κάθε απόδοση τιμής, ακόμη και ενδιάμεση που δεν φτάνει ποτέ στο DOM του assert: το «ένα frame» του 3ου γύρου. */
const mockRenderedNets: number[] = [];
jest.mock('../ShowcasePriceView', () => {
  const actual = jest.requireActual<typeof import('../ShowcasePriceView')>('../ShowcasePriceView');
  return {
    ...actual,
    BuyerPrice: (props: Parameters<typeof actual.BuyerPrice>[0]) => {
      mockRenderedNets.push(props.price.net);
      return actual.BuyerPrice(props);
    },
  };
});

const buyerPrice = (net: number): ShowcaseBuyerPrice =>
  ({ kind: 'priced', audience: 'buyer', currency: 'EUR', unitCode: 'pcs', priceQuantity: 1, net, unitNet: null, gross: null, vatRate: null, unitGross: null });
const model = (modelId: string): PublicCatalogModel => ({
  schemaVersion: PUBLIC_CATALOG_SCHEMA_VERSION, companyId: 'comp_supplier', modelId, kind: 'productModel', code: 'MFP', familyId: 'fam',
  familyLabels: {}, listingKind: 'product', categoryIds: [], categoryLabels: {}, locales: ['el'], attributes: [], media: [],
  variants: [{ variantId: 'v1', code: 'v1', label: 'v1', attributes: [], media: [] }],
});

/** Υπόσχεση που λύνεται όταν το πει το test: η σειρά άφιξης των απαντήσεων είναι το αντικείμενο της δοκιμής. */
function deferred() {
  let resolve: (prices: ShowcaseModelPrices) => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const promise = new Promise<BuyerShowcasePricesWire>((ok, fail) => {
    resolve = (prices) => ok({ prices });
    reject = fail;
  });
  return { promise, resolve, reject };
}

const shownNets = (): string[] => screen.queryAllByText(/price\.vatExcluded/).map((node) => node.textContent ?? '');

beforeEach(() => {
  mockUser = null;
  mockFetch.mockReset();
  mockRenderedNets.length = 0;
});

describe('BuyerPriceIsland — ούτε ένα frame με τιμή άλλου λογαριασμού', () => {
  it('αλλαγή χρήστη ή μοντέλου ⇒ η παλιά τιμή δεν αποδίδεται ΚΑΘΟΛΟΥ, ούτε πριν τρέξει το effect', async () => {
    const forB = deferred();
    mockFetch.mockResolvedValueOnce({ prices: { v1: buyerPrice(1111) } }).mockReturnValueOnce(forB.promise).mockReturnValueOnce(deferred().promise);
    mockUser = { uid: 'u-a' };
    const view = render(<BuyerPriceIsland model={model('m1')} />);
    await act(async () => undefined);
    expect(mockRenderedNets).toContain(1111);
    mockRenderedNets.length = 0;
    mockUser = { uid: 'u-b' };
    view.rerender(<BuyerPriceIsland model={model('m1')} />);
    expect(mockRenderedNets).toEqual([]);
    view.rerender(<BuyerPriceIsland model={model('m2')} />);
    expect(mockRenderedNets).toEqual([]);
    expect(shownNets()).toEqual([]);
  });
});

describe('BuyerPriceIsland', () => {
  it('ανώνυμος ⇒ καμία κλήση και τίποτα στην οθόνη', () => {
    const { container } = render(<BuyerPriceIsland model={model('m1')} />);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(container.textContent).toBe('');
  });

  it('συνδεδεμένος ⇒ η τιμή του, «χωρίς ΦΠΑ»', async () => {
    mockUser = { uid: 'u-a' };
    mockFetch.mockResolvedValueOnce({ prices: { v1: buyerPrice(1234) } });
    render(<BuyerPriceIsland model={model('m1')} />);
    await act(async () => undefined);
    expect(mockFetch).toHaveBeenCalledWith('comp_supplier', 'm1');
    expect(shownNets()).toEqual([expect.stringMatching(/12[.,]34/)]);
  });

  it('η απάντηση του ΠΑΛΙΟΥ χρήστη που φτάνει μετά την αλλαγή πετιέται · μένει μόνο του νέου', async () => {
    const forA = deferred();
    const forB = deferred();
    mockFetch.mockReturnValueOnce(forA.promise).mockReturnValueOnce(forB.promise);
    mockUser = { uid: 'u-a' };
    const view = render(<BuyerPriceIsland model={model('m1')} />);
    mockUser = { uid: 'u-b' };
    view.rerender(<BuyerPriceIsland model={model('m1')} />);
    await act(async () => forA.resolve({ v1: buyerPrice(9911) }));
    expect(shownNets()).toEqual([]);
    await act(async () => forB.resolve({ v1: buyerPrice(512) }));
    expect(shownNets()).toEqual([expect.stringMatching(/5[.,]12/)]);
  });

  it('το ίδιο για αλλαγή μοντέλου · και αποσύνδεση σβήνει την τιμή αμέσως', async () => {
    const forM1 = deferred();
    mockFetch.mockReturnValueOnce(forM1.promise).mockResolvedValueOnce({ prices: { v1: buyerPrice(733) } });
    mockUser = { uid: 'u-a' };
    const view = render(<BuyerPriceIsland model={model('m1')} />);
    view.rerender(<BuyerPriceIsland model={model('m2')} />);
    await act(async () => undefined);
    await act(async () => forM1.resolve({ v1: buyerPrice(9911) }));
    expect(shownNets()).toEqual([expect.stringMatching(/7[.,]33/)]);
    mockUser = null;
    view.rerender(<BuyerPriceIsland model={model('m2')} />);
    expect(shownNets()).toEqual([]);
  });

  it('αποτυχία (403 · δίκτυο) ⇒ τίποτα · κενός πίνακας ⇒ τίποτα · τιμή καταναλωτή ⇒ ποτέ ως «η τιμή σας»', async () => {
    mockUser = { uid: 'u-a' };
    const consumer: ShowcaseConsumerPrice = { kind: 'priced', audience: 'anonymous', currency: 'EUR', unitCode: 'pcs', priceQuantity: 1, net: null, unitNet: null, gross: 124, vatRate: 24, unitGross: null };
    mockFetch
      .mockRejectedValueOnce(new Error('403 Forbidden'))
      .mockResolvedValueOnce({ prices: {} })
      .mockResolvedValueOnce({ prices: { v1: consumer } });
    for (const modelId of ['m1', 'm2', 'm3']) {
      const { container, unmount } = render(<BuyerPriceIsland model={model(modelId)} />);
      await act(async () => undefined);
      expect(container.textContent).toBe('');
      unmount();
    }
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});
