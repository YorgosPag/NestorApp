/**
 * ADR-923 §5.6.1 — οι δύο επιλογείς **αποδίδονται**: το λογότυπο προσφέρει μόνο ό,τι δέχεται ο γραφέας, και η χειροκίνητη επιλογή
 * γράφει στο εύρος ό,τι πατά ο άνθρωπος, στη λίστα ή με το άλμα σε κωδικό.
 */
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';

import type { AssetRecord } from '@/services/catalog/catalog-api.client';
import type { PublicationRecipeDefinition } from '@/subapps/catalog/types/publication';
import { emptyRecipe, toggleSelectionEntry } from '../publication-draft';
import { PublicationFilterField } from '../PublicationFilterField';
import { PublicationLogoField } from '../PublicationLogoField';
import { PublicationSelectionField } from '../PublicationSelectionField';

jest.setTimeout(60_000);

const mockAssets: { items: readonly Partial<AssetRecord>[] } = { items: [] };
const mockFamilies: { items: readonly unknown[] } = { items: [] };
const mockLibrary: { attributeById: ReadonlyMap<string, unknown> } = { attributeById: new Map() };
const mockFound = { kind: 'product', id: 'p_code' } as const;

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));
jest.mock('@/providers/NotificationProvider', () => ({
  useNotifications: () => ({ success: jest.fn(), error: jest.fn(), warning: jest.fn() }),
}));
jest.mock('@/hooks/catalog/useCatalogCollection', () => ({
  useCatalogCollection: (key: string) => ({ state: 'ready', items: key === 'CATALOG_ASSETS' ? mockAssets.items : key === 'CATALOG_FAMILIES' ? mockFamilies.items : [] }),
}));
jest.mock('@/hooks/catalog/useCatalogAssetFiles', () => ({
  useCatalogAssetFiles: () => ({
    ready: true,
    byId: new Map([
      ['f_png', { id: 'f_png', ext: 'png', contentType: 'image/png' }],
      ['f_svg', { id: 'f_svg', ext: 'svg', contentType: 'image/svg+xml' }],
    ]),
    byAsset: new Map(),
  }),
}));
jest.mock('@/hooks/catalog/useCatalogReferenceLookup', () => ({
  useCatalogReferenceLookup: () => ({ lookup: new Map(), describe: (target: { readonly id: string }) => `name:${target.id}` }),
}));
jest.mock('@/hooks/catalog/useCatalogLibrary', () => ({
  useCatalogLibrary: () => ({ attributes: [], attributeById: mockLibrary.attributeById }),
}));
jest.mock('@/hooks/catalog/useCatalogSettings', () => ({ useCatalogSettings: () => ({ definition: { channelLocales: {} } }) }));
jest.mock('@/components/shared/files/FileThumbnail', () => ({ FileThumbnail: () => null }));
jest.mock('../../products/use-product-list', () => ({
  useProductList: (inputs: unknown) => mockUseProductList(inputs),
}));
jest.mock('@/hooks/catalog/useCatalogLiveWindow', () => ({
  useCatalogLiveWindow: (_key: string, plan: unknown) => mockLiveWindow(plan),
}));
jest.mock('../../products/CodeJumpField', () => ({
  CodeJumpField: ({ onFound }: { readonly onFound: (target: typeof mockFound) => void }) => <button type="button" onClick={() => onFound(mockFound)}>jump</button>,
}));

const mockLiveWindow = jest.fn((plan: unknown) => ({
  state: 'ready',
  complete: true,
  grow: jest.fn(),
  items: plan === null ? [] : [
    { id: 'v1', familyId: 'fam', derived: { identifier: 'V-1', label: 'Fan coil 34', searchText: 'v-1 fan coil 34' } },
    { id: 'v2', familyId: 'fam', derived: { identifier: 'V-2', label: 'Fan φίλτρο', searchText: 'v-2 fan φιλτρο' } },
  ],
}));
const mockGrow = jest.fn();
const mockUseProductList = jest.fn((_inputs: unknown) => ({
  state: 'ready',
  hasMore: true,
  grow: mockGrow,
  staleCount: 0,
  rows: [
    { kind: 'model', id: 'm1', record: { code: 'MFP', derived: { label: 'Fan coil' } } },
    { kind: 'product', id: 'p1', record: { derived: { identifier: 'SKU-1', label: null } } },
  ],
}));

const asset = (id: string, role: string, fileId: string | null): Partial<AssetRecord> => ({ id, code: id, role, kind: 'image', fileId, labels: {} } as Partial<AssetRecord>);
const draft = (logoAssetId: string | null): PublicationRecipeDefinition => {
  const recipe = emptyRecipe('el');
  return { ...recipe, theme: { ...recipe.theme, logoAssetId } };
};

describe('PublicationFilterField', () => {
  const familyRecord = { id: 'fam', code: 'fam', labels: {}, attributes: [{ attributeId: 'colour' }] };
  const colour = { type: 'select', code: 'colour', labels: {}, config: { options: [{ code: 'red', labels: {} }, { code: 'blue', labels: {} }] } };

  beforeEach(() => {
    mockFamilies.items = [familyRecord];
    mockLibrary.attributeById = new Map([['colour', colour]]);
  });

  afterEach(() => {
    mockFamilies.items = [];
    mockLibrary.attributeById = new Map();
  });

  it('τα κουμπιά ιδιοτήτων γράφουν το σχήμα αποθήκευσης, κανονικά ταξινομημένο', () => {
    const onChange = jest.fn();
    const filter = { familyId: 'fam', facetGroups: [{ keys: ['colour=red'] }] };
    render(<PublicationFilterField filter={filter} disabled={false} onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'red' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'blue' }));
    expect(onChange).toHaveBeenLastCalledWith({ familyId: 'fam', facetGroups: [{ keys: ['colour=blue', 'colour=red'] }] });
  });

  it('χωρίς οικογένεια δεν ανοίγει ζωντανά παράθυρα, και ζητά οικογένεια', () => {
    mockUseProductList.mockClear();
    render(<PublicationFilterField filter={{ familyId: null, facetGroups: [] }} disabled={false} onChange={jest.fn()} />);
    expect(screen.getByText('publishing.filter.chooseFamily')).toBeInTheDocument();
    expect(mockUseProductList).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('το πλήθος έρχεται από τη λίστα, και με ανοιχτό παράθυρο δηλώνει ότι υπάρχουν κι άλλες', () => {
    const translate = jest.spyOn(jest.requireMock('@/i18n/hooks/useTranslation'), 'useTranslation').mockReturnValue({
      t: (key: string, values?: { readonly rows?: string }) => `${key}:${values?.rows ?? ''}`, i18n: { language: 'el' },
    } as never);
    const { rerender } = render(<PublicationFilterField filter={{ familyId: 'fam', facetGroups: [] }} disabled={false} onChange={jest.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('publishing.filter.matches:2+');
    mockUseProductList.mockReturnValueOnce({ ...mockUseProductList({}), hasMore: false });
    rerender(<PublicationFilterField filter={{ familyId: 'fam', facetGroups: [{ keys: ['colour=red'] }] }} disabled={false} onChange={jest.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent(/^publishing\.filter\.matches:2$/);
    translate.mockRestore();
  });

  it('το κλείδωμα της φόρμας φτάνει στα κουμπιά', () => {
    render(<PublicationFilterField filter={{ familyId: 'fam', facetGroups: [] }} disabled onChange={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'blue' })).toBeDisabled();
  });
});

describe('PublicationLogoField', () => {
  beforeEach(() => {
    mockAssets.items = [asset('logo_png', 'logo', 'f_png'), asset('logo_svg', 'logo', 'f_svg'), asset('photo', 'photo', 'f_png')];
  });

  it('προσφέρει μόνο λογότυπο που τυπώνεται, και η επιλογή γράφει στο θέμα', () => {
    const onChange = jest.fn();
    render(<PublicationLogoField draft={draft(null)} onChange={onChange} issues={[]} disabled={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'publishing.logo.choose' }));
    expect(screen.queryByRole('button', { name: 'logo_svg' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'photo' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'logo_png' }));
    expect(onChange.mock.calls[0][0].theme.logoAssetId).toBe('logo_png');
  });

  it('το αφαιρεί, και λέει όταν το μέσο δεν υπάρχει πια', () => {
    const onChange = jest.fn();
    render(<PublicationLogoField draft={draft('deleted')} onChange={onChange} issues={[]} disabled={false} />);
    expect(screen.getByRole('alert')).toHaveTextContent('publishing.logo.missing');
    fireEvent.click(screen.getByRole('button', { name: 'publishing.logo.remove' }));
    expect(onChange.mock.calls[0][0].theme.logoAssetId).toBeNull();
  });
});

describe('PublicationSelectionField', () => {
  it('toggleSelectionEntry: καμία διπλή εγγραφή και σεβασμός του είδους', () => {
    const model = { kind: 'productModel', id: 'x' } as const;
    const product = { kind: 'product', id: 'x' } as const;
    expect(toggleSelectionEntry([model], model, true)).toEqual([model]);
    expect(toggleSelectionEntry([model, product], model, false)).toEqual([product]);
  });

  it('η γραμμή μοντέλου γίνεται productModel, το απλό product, και το άλμα προσθέτει', () => {
    const onChange = jest.fn();
    render(<PublicationSelectionField entries={[]} disabled={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'publishing.selection.pick' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /MFP/ }));
    expect(onChange).toHaveBeenLastCalledWith([{ kind: 'productModel', id: 'm1' }]);
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /SKU-1/ }));
    expect(onChange).toHaveBeenLastCalledWith([{ kind: 'product', id: 'p1' }]);
    fireEvent.click(within(dialog).getByRole('button', { name: 'jump' }));
    expect(onChange).toHaveBeenLastCalledWith([mockFound]);
    fireEvent.click(within(dialog).getByRole('button', { name: 'publishing.selection.more' }));
    expect(mockGrow).toHaveBeenCalled();
  });

  it('🔴 οι λέξεις αντικαθιστούν τη λίστα με SKU, και ο πλήρης όρος κρίνεται στο παράθυρο', async () => {
    const onChange = jest.fn();
    render(<PublicationSelectionField entries={[]} disabled={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'publishing.selection.pick' }));
    const dialog = screen.getByRole('dialog');
    const field = within(dialog).getByLabelText('publishing.selection.search');
    fireEvent.change(field, { target: { value: 'fan coil' } });
    const found = await within(dialog).findByRole('checkbox', { name: /V-1/ });
    expect(mockLiveWindow).toHaveBeenLastCalledWith(expect.objectContaining({ arrayContainsAny: ['derived.searchPrefixes', ['coil']] }));
    expect(within(dialog).queryByRole('checkbox', { name: /V-2/ })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('checkbox', { name: /MFP/ })).not.toBeInTheDocument();
    fireEvent.click(found);
    expect(onChange).toHaveBeenLastCalledWith([{ kind: 'product', id: 'v1' }]);
  });

  it('🔴 όρος κάτω από τρεις χαρακτήρες δεν ανοίγει ακροατή και αφήνει τη λίστα', () => {
    render(<PublicationSelectionField entries={[]} disabled={false} onChange={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'publishing.selection.pick' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('publishing.selection.search'), { target: { value: 'fa' } });
    expect(mockLiveWindow).toHaveBeenLastCalledWith(null);
    expect(within(dialog).getByRole('checkbox', { name: /MFP/ })).toBeInTheDocument();
  });

  it('αφαιρεί μία επιλογή και ονομάζει μόνο τις πρώτες 20 ως το «Εμφάνιση όλων»', () => {
    const entries = Array.from({ length: 25 }, (_, index) => ({ kind: 'product', id: `p${index}` }) as const);
    const onChange = jest.fn();
    render(<PublicationSelectionField entries={entries} disabled={false} onChange={onChange} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(20);
    fireEvent.click(screen.getAllByRole('button', { name: 'publishing.selection.remove' })[0]);
    expect(onChange.mock.calls[0][0]).toHaveLength(24);
    fireEvent.click(screen.getByRole('button', { name: 'publishing.selection.showAll' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(25);
  });
});
