/**
 * @jest-environment jsdom
 */

/**
 * Οι τιμές στις δημόσιες οθόνες (ADR-923 §5.13 Σ6). Η άγκυρα του διακόπτη: κλειστός ⇒ η οθόνη είναι **ακριβώς** όπως πριν,
 * χωρίς επιφάνεια τιμής και χωρίς νησίδα. Ανοιχτός ⇒ η τιμή αντικαθιστά το «Κατόπιν προσφοράς» μόνο όπου υπάρχει.
 */

import { render, screen } from '@testing-library/react';

import { PUBLIC_CATALOG_SCHEMA_VERSION, type PublicCatalogModel } from '@/subapps/catalog/public/public-catalog-schema';
import type { ShowcaseConsumerPrice } from '@/subapps/catalog/public/showcase-price';

import { PublicModelView } from '../PublicModelView';
import { PublicPrice } from '../ShowcasePriceView';
import { SupplierCatalogView } from '../SupplierCatalogView';

let mockPricesOn = false;
jest.mock('@/config/feature-flags', () => ({ isAppFeatureEnabled: () => mockPricesOn }));
jest.mock('../public-catalog-text', () => ({
  usePublicCatalogText: () => ({
    t: (key: string, values?: Record<string, unknown>) => (values ? `${key}:${JSON.stringify(values)}` : key),
    text: (labels: { readonly el?: string } | undefined) => labels?.el ?? '',
    language: 'el',
  }),
}));
jest.mock('@/hooks/useUomLabel', () => ({ useUomLabel: () => (code: string) => `u:${code}` }));
jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children }: { readonly href: string; readonly children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
jest.mock('@/auth/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('../public-catalog-surfaces', () => ({
  PublicPriceSlot: ({ price }: { readonly price: { readonly gross: number } }) => <output>public-price:{price.gross}</output>,
  PublicFromPriceSlot: ({ price }: { readonly price: { readonly gross: number } }) => <output>from-price:{price.gross}</output>,
  BuyerPriceIslandSlot: () => <output>buyer-island</output>,
}));

const PRICED: ShowcaseConsumerPrice = { kind: 'priced', audience: 'anonymous', currency: 'EUR', unitCode: 'm', priceQuantity: 100, net: null, gross: 10416, vatRate: 24, unitNet: null, unitGross: 104 };
const variant = (id: string) => ({ variantId: id, code: id, label: id, attributes: [], media: [] });
const MODEL: PublicCatalogModel = {
  schemaVersion: PUBLIC_CATALOG_SCHEMA_VERSION, companyId: 'comp_a', modelId: 'cpmod_1', kind: 'productModel', code: 'MFP', familyId: 'fam',
  familyLabels: { el: 'Κλιματιστικά' }, listingKind: 'product', categoryIds: [], categoryLabels: {}, locales: ['el'], attributes: [], media: [],
  variants: [variant('v1'), variant('v2')],
};
const CARD = { modelId: 'cpmod_1', title: 'Κλιματιστικό', code: 'MFP', familyLabels: {}, listingKind: 'product' as const, image: null, variantCount: 2 };

beforeEach(() => {
  mockPricesOn = false;
});

describe('κλειστός διακόπτης ⇒ η οθόνη όπως πριν το Σ6', () => {
  it('μοντέλο: «Κατόπιν προσφοράς» στην κεφαλίδα και σε κάθε παραλλαγή · καμία επιφάνεια, καμία νησίδα', () => {
    render(<PublicModelView segment="aries" model={MODEL} acceptsQuoteRequests={false} prices={null} />);
    expect(screen.getAllByText('model.priceOnRequest')).toHaveLength(3);
    expect(screen.queryByText(/public-price|buyer-island/)).toBeNull();
  });

  it('κάρτα: «Κατόπιν προσφοράς»', () => {
    render(<SupplierCatalogView segment="aries" legalName="Α" cards={[CARD]} categories={{}} activeCategoryId={null} nextHref={null} cardPrices={null} />);
    expect(screen.getByText('model.priceOnRequest')).toBeTruthy();
    expect(screen.queryByText(/from-price/)).toBeNull();
  });
});

describe('ανοιχτός διακόπτης', () => {
  beforeEach(() => {
    mockPricesOn = true;
  });

  it('η τιμή μόνο εκεί που υπάρχει · η κεφαλίδα σωπαίνει όταν κάποια παραλλαγή έχει τιμή · η νησίδα υπάρχει', () => {
    render(<PublicModelView segment="aries" model={MODEL} acceptsQuoteRequests={false} prices={{ v1: PRICED, v2: { kind: 'onRequest' } }} />);
    expect(screen.getByText('public-price:10416')).toBeTruthy();
    expect(screen.getAllByText('model.priceOnRequest')).toHaveLength(1);
    expect(screen.getByText('buyer-island')).toBeTruthy();
  });

  it('κάρτα με τιμή «από»', () => {
    render(<SupplierCatalogView segment="aries" legalName="Α" cards={[CARD]} categories={{}} activeCategoryId={null} nextHref={null} cardPrices={{ cpmod_1: PRICED }} />);
    expect(screen.getByText('from-price:10416')).toBeTruthy();
    expect(screen.queryByText('model.priceOnRequest')).toBeNull();
  });
});

describe('PublicPrice — τελική πρώτη, ο συντελεστής, η τιμή μονάδας (Οδηγία 98/6 άρθ. 2α · 3)', () => {
  it('ανά 100 μ: τελική, ΦΠΑ, και τιμή για ένα μέτρο · κανένα καθαρό ποσό, καμία «έκπτωση»', () => {
    const { container } = render(<PublicPrice price={PRICED} />);
    const text = container.textContent ?? '';
    expect(text).toContain('price.amountPer:');
    expect(text).toContain('"quantity":100');
    expect(text).toContain('price.vatIncluded:{"rate":24}');
    expect(text).toContain('price.unitPrice:');
    expect(text).not.toContain('84,00');
  });
});
