/**
 * @jest-environment jsdom
 */

/**
 * Οι δημόσιες οθόνες (ADR-923 §5.13 Σ4). Καμία εικόνα browser: διάταξη και αντίθεση τα κρίνουν οι πύλες με Chromium.
 */

import { render, screen } from '@testing-library/react';

import { PUBLIC_CATALOG_SCHEMA_VERSION, type PublicCatalogModel } from '@/subapps/catalog/public/public-catalog-schema';

import { PublicModelView } from '../PublicModelView';
import { SupplierCatalogView, type SupplierCatalogViewProps } from '../SupplierCatalogView';

jest.mock('../public-catalog-text', () => ({
  usePublicCatalogText: () => ({
    t: (key: string) => key,
    text: (labels: { readonly el?: string } | undefined) => labels?.el ?? '',
    language: 'el',
  }),
}));
jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children }: { readonly href: string; readonly children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

const variant = (id: string, label: string) => ({ variantId: id, code: id, label, attributes: [], media: [] });

const MODEL: PublicCatalogModel = {
  schemaVersion: PUBLIC_CATALOG_SCHEMA_VERSION,
  companyId: 'comp_a',
  modelId: 'cpmod_1',
  kind: 'productModel',
  code: 'MFP',
  familyId: 'fam',
  familyLabels: { el: 'Κλιματιστικά' },
  listingKind: 'product',
  categoryIds: [],
  categoryLabels: {},
  locales: ['el'],
  attributes: [],
  media: [],
  variants: [variant('v1', 'Ένα'), variant('v2', 'Δύο')],
};

const CATALOG: SupplierCatalogViewProps = {
  segment: 'aries',
  legalName: 'ΑΛΦΑ ΑΕ',
  cards: [{ modelId: 'cpmod_1', title: 'Κλιματιστικό', code: 'MFP', familyLabels: { el: 'Κλιματιστικά' }, listingKind: 'product', image: null, variantCount: 2 }],
  categories: { cat_1: { el: 'Ψύξη' } },
  activeCategoryId: null,
  nextHref: null,
};

const description = (html: string) => ({
  ...MODEL,
  attributes: [{ attributeId: 'd', labels: { el: 'Περιγραφή' }, values: { el: { type: 'richText' as const, html } } }],
});

describe('SupplierCatalogView', () => {
  it('όνομα, ένδειξη επιβεβαίωσης, κάρτα με σύνδεσμο και «Κατόπιν προσφοράς»', () => {
    render(<SupplierCatalogView {...CATALOG} />);
    expect(screen.getByRole('heading', { level: 1, name: 'ΑΛΦΑ ΑΕ' })).toBeTruthy();
    expect(screen.getByText('supplier.verified')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Κλιματιστικό' }).getAttribute('href')).toBe('/suppliers/aries/p/klimatistiko-cpmod_1');
    expect(screen.getByText('model.priceOnRequest')).toBeTruthy();
  });

  it('κατηγορίες με σύνδεσμο · χωρίς κατηγορίες καμία πλοήγηση', () => {
    const { unmount } = render(<SupplierCatalogView {...CATALOG} />);
    expect(screen.getByRole('link', { name: 'Ψύξη' }).getAttribute('href')).toBe('/suppliers/aries/c/psyxi-cat_1');
    unmount();
    render(<SupplierCatalogView {...CATALOG} categories={{}} />);
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('χωρίς κάρτες ⇒ μήνυμα · με δρομέα ⇒ σύνδεσμος επόμενης σελίδας', () => {
    const { unmount } = render(<SupplierCatalogView {...CATALOG} cards={[]} />);
    expect(screen.getByText('supplier.empty')).toBeTruthy();
    unmount();
    render(<SupplierCatalogView {...CATALOG} nextHref="/suppliers/aries?after=x_1" />);
    expect(screen.getByRole('link', { name: 'supplier.next' }).getAttribute('href')).toBe('/suppliers/aries?after=x_1');
  });

  it('το προφίλ: λογότυπο, περιοχή και ιστοσελίδα', () => {
    const logo = { url: 'https://s/l.webp', width: 200, height: 100, altKey: 'k', sources: [{ url: 'https://s/l.webp', width: 200 }] };
    render(<SupplierCatalogView {...CATALOG} provider={{ logo, website: 'https://aries.gr', area: { kind: 'areas', names: ['ΔΗΜΟΣ Α', 'ΔΗΜΟΣ Β'] } }} />);
    expect(screen.getByRole('img', { name: 'supplier.logoAlt' }).getAttribute('src')).toBe(logo.url);
    expect(screen.getByText('ΔΗΜΟΣ Α · ΔΗΜΟΣ Β')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'https://aries.gr' }).getAttribute('rel')).toBe('noopener noreferrer');
  });

  it.each([
    [{ kind: 'nationwide' } as const, 'supplier.areaNationwide'],
    [{ kind: 'radius', radiusKm: 30 } as const, 'supplier.areaRadius'],
    [{ kind: 'outline', km2: 12 } as const, 'supplier.areaOutline'],
  ])('περιοχή %j', (area, key) => {
    render(<SupplierCatalogView {...CATALOG} provider={{ logo: null, website: null, area }} />);
    expect(screen.getByText(key)).toBeTruthy();
  });

  it('περιγραφή και έργα: εξώφυλλο, μικρογραφία, έτος · η εναλλακτική εικόνας πέφτει στον τίτλο', () => {
    const image = (assetId: string) => ({ assetId, url: `https://s/${assetId}.webp`, labels: {} });
    const projects = [{ projectId: 'p1', title: { el: 'Κατοικία' }, description: { el: 'Ανακαίνιση' }, year: 2024, images: [image('a'), image('b')] }];
    render(<SupplierCatalogView {...CATALOG} profile={{ schemaVersion: 1, companyId: 'c', description: { el: 'Εταιρεία' }, projects }} />);
    expect(screen.getByRole('heading', { level: 2, name: 'supplier.about' })).toBeTruthy();
    expect(screen.getByText('Εταιρεία')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: 'Κατοικία' })).toBeTruthy();
    expect(screen.getByText('2024')).toBeTruthy();
    expect(screen.getAllByRole('img', { name: 'Κατοικία' })).toHaveLength(2);
  });

  it('κενό προφίλ: καμία κενή ενότητα · έργο χωρίς έτος ή περιγραφή', () => {
    const image = { assetId: 'a', url: 'https://s/a.webp', labels: {} };
    const { unmount } = render(<SupplierCatalogView {...CATALOG} profile={{ schemaVersion: 1, companyId: 'c', description: {}, projects: [] }} />);
    expect(screen.queryByText('supplier.about')).toBeNull();
    expect(screen.queryByText('supplier.portfolio')).toBeNull();
    unmount();
    render(<SupplierCatalogView {...CATALOG} profile={{ schemaVersion: 1, companyId: 'c', description: {}, projects: [{ projectId: 'p', title: { el: 'Έργο' }, description: {}, year: null, images: [image] }] }} />);
    expect(screen.getByRole('heading', { level: 2, name: 'supplier.portfolio' })).toBeTruthy();
    expect(screen.getAllByRole('img')).toHaveLength(1);
  });

  it('μάρκες με τη σχέση τους · χωρίς μάρκες καμία λίστα', () => {
    const { unmount } = render(<SupplierCatalogView {...CATALOG} brands={[{ brandName: 'Toshiba', relation: 'authorized-representative' }]} />);
    expect(screen.getByRole('list', { name: 'supplier.brands' }).textContent).toBe('Toshiba · supplier.brandRepresentative');
    unmount();
    render(<SupplierCatalogView {...CATALOG} brands={[]} />);
    expect(screen.queryByRole('list', { name: 'supplier.brands' })).toBeNull();
  });

  it('χωρίς στοιχεία καμία κενή λίστα ορισμών', () => {
    const { container } = render(<SupplierCatalogView {...CATALOG} provider={{ logo: null, website: null, area: null }} />);
    expect(container.querySelector('dl')).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
  });
});

describe('PublicModelView', () => {
  it('πολλά SKU ⇒ λίστα παραλλαγών, καθεμία με «Κατόπιν προσφοράς»', () => {
    render(<PublicModelView segment="aries" model={MODEL} />);
    expect(screen.getByRole('heading', { level: 2, name: 'model.variants' })).toBeTruthy();
    expect(screen.getAllByText('model.priceOnRequest')).toHaveLength(3);
  });

  it('ένα SKU ⇒ χωρίς λίστα παραλλαγών, με τις ιδιότητές του στον πίνακα', () => {
    const attribute = { attributeId: 'p', labels: { el: 'Ισχύς' }, values: { el: { type: 'measurement' as const, value: '12', unitCode: 'kW' } } };
    render(<PublicModelView segment="aries" model={{ ...MODEL, variants: [{ ...variant('v1', 'Ένα'), attributes: [attribute] }] }} />);
    expect(screen.queryByText('model.variants')).toBeNull();
    expect(screen.getByText('12 kW')).toBeTruthy();
  });

  it('ναι και όχι περνούν από το i18n', () => {
    const flag = { attributeId: 'f', labels: { el: 'Inverter' }, values: { el: { type: 'boolean' as const, value: true } } };
    render(<PublicModelView segment="aries" model={{ ...MODEL, attributes: [flag] }} />);
    expect(screen.getByText('model.yes')).toBeTruthy();
  });

  it('έγκυρο richText αποδίδεται ως μορφοποίηση', () => {
    const { container } = render(<PublicModelView segment="aries" model={description('<p>Ήσυχο <strong>μοντέλο</strong></p>')} />);
    expect(container.querySelector('strong')?.textContent).toBe('μοντέλο');
  });

  it('🔒 richText εκτός γραμματικής δεν γίνεται ποτέ DOM', () => {
    const payload = '<img src=x onerror=alert(1)><script>alert(2)</script>';
    const { container } = render(<PublicModelView segment="aries" model={description(payload)} />);
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('dd img')).toBeNull();
    expect(screen.getByText(payload)).toBeTruthy();
  });
});
