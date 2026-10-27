/**
 * ADR-923 §5.10.4 Β3/Β4 — φρουρός: ο ΟΛΟΚΛΗΡΟΣ επεξεργαστής μοντέλου αποδίδεται πάνω στο MFP × 7 χωρίς βρόχο
 * renders (ζωντανά ο renderer «πάγωνε» στο άνοιγμα μοντέλου). Mock μόνο στα όρια I/O.
 */
import React, { Profiler } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';

import { TooltipProvider } from '@/components/ui/tooltip';
import type { AttributeGroupRecord, AttributeRecord, FamilyRecord } from '@/services/catalog/catalog-api.client';
import { MFP_ATTRIBUTE_MAP, MFP_FAMILY } from '@/subapps/catalog/__tests__/fixtures/mfp-fan-coil.fixture';
import { MFP_MODEL, MFP_MODEL_ID, MFP_SETTINGS, MFP_VARIANTS, mfpVariantId } from '@/subapps/catalog/__tests__/fixtures/mfp-fan-coil-products.fixture';
import { PLATFORM_MEASUREMENT_REGISTRY } from '@/subapps/catalog/measurement/measurement-registry';

import type { ProductCatalogContext } from '../../use-product-catalog-context';
import { ProductEditorView } from '../ProductEditorView';

const meta = { companyId: 'c', revision: 1, isDeleted: false, createdAt: '', createdBy: '', updatedAt: '2026-10-26T10:00:00.000Z', updatedBy: '', deletedAt: null, deletedBy: null };
const derived = { sortKey: 'k', summary: null, descendants: {}, identifier: null, label: null, completenessHash: null } as never;
const members = [
  { kind: 'productModel' as const, record: { ...meta, ...MFP_MODEL, id: MFP_MODEL_ID, derived } },
  ...MFP_VARIANTS.map((variant, index) => ({ kind: 'product' as const, record: { ...meta, ...variant, id: mfpVariantId(index), derived } })),
];

jest.mock('@/hooks/catalog/useCatalogAggregateRecords', () => ({
  useCatalogAggregateRecords: () => ({ state: 'ready', target: members[0].record, rootId: MFP_MODEL_ID, members }),
}));
jest.mock('@/auth/hooks/useCapability', () => ({ useCapability: () => ({ pending: false, verdict: 'granted-by-role' }) }));
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));
jest.mock('@/providers/NotificationProvider', () => ({ useNotifications: () => ({ error: jest.fn(), warning: jest.fn() }) }));
jest.mock('@/hooks/useCompanyId', () => ({ useCompanyId: () => ({ companyId: 'c' }) }));
jest.mock('@/services/firestore/firestore-query.service', () => ({ firestoreQueryService: { getById: jest.fn(async () => null) } }));

const attributeById = new Map([...MFP_ATTRIBUTE_MAP].map(([id, a]) => [id, { ...meta, ...a, id, measurementFamilyCodes: [] } as AttributeRecord]));
const groups = [...new Set([...MFP_ATTRIBUTE_MAP.values()].map((a) => a.groupId))].map((id, i) => ({ ...meta, id, code: id, labels: { el: id }, orderKey: `a${i}` }) as AttributeGroupRecord);
const family = { ...meta, ...MFP_FAMILY, id: 'fan_coil', attributeIds: [] } as FamilyRecord;

function context(): ProductCatalogContext {
  return {
    state: 'ready',
    library: { state: 'ready', attributes: [...attributeById.values()], groups, measurementFamilies: [], attributeById, registry: PLATFORM_MEASUREMENT_REGISTRY, ops: {} as never },
    families: [family],
    familyById: new Map([['fan_coil', family]]),
    settings: { state: 'ready', definition: MFP_SETTINGS, revision: 1, record: null, records: [] },
    assets: [], assetById: new Map(), categories: [], files: { ready: true, byId: new Map(), byAsset: new Map() },
  };
}

/** Όπως ζωντανά: το `ctx` είναι ΝΕΟ σε κάθε render (βιβλιοθήκη/αρχεία χωρίς σταθερή ταυτότητα). */
function FreshContext() {
  return (
    <ProductEditorView id={MFP_MODEL_ID} ctx={context()} canManage scope={{ channel: 'print', locale: 'el' }} onScope={() => undefined} onOpen={() => undefined} onBack={() => undefined} reportDirty={() => undefined} />
  );
}

describe('ProductEditorView — φρουρός βρόχου', () => {
  it('🔴 ctx ΝΕΟ σε κάθε render (όπως ζωντανά) ⇒ τα renders σταματούν', async () => {
    let commits = 0;
    render(<TooltipProvider><Profiler id="fresh" onRender={() => { commits += 1; }}><FreshContext /></Profiler></TooltipProvider>);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
    const settled = commits;
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 200)); });
    expect(commits).toBe(settled);
    expect(commits).toBeLessThan(20);
  });

  it('🔴 μοντέλο MFP: αποδίδεται, καρτέλες Ιδιότητες/Παραλλαγές, και τα renders ΣΤΑΜΑΤΟΥΝ', async () => {
    let commits = 0;
    const ctx = context();
    render(
      <TooltipProvider>
        <Profiler id="editor" onRender={() => { commits += 1; }}>
          <ProductEditorView id={MFP_MODEL_ID} ctx={ctx} canManage scope={{ channel: 'print', locale: 'el' }} onScope={jest.fn()} onOpen={jest.fn()} onBack={jest.fn()} reportDirty={jest.fn()} />
        </Profiler>
      </TooltipProvider>,
    );
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
    const settled = commits;
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 200)); });
    expect(commits).toBe(settled);
    expect(commits).toBeLessThan(20);
    expect(screen.getByRole('tab', { name: 'products.editor.variantsTab' })).toBeTruthy();
  });

  it('🔴 το πλέγμα παραλλαγών μένει MOUNTED όσο είναι ενεργή η καρτέλα Ιδιότητες (αλλαγή καρτέλας ≠ απόρριψη προχείρου)', async () => {
    render(<TooltipProvider><FreshContext /></TooltipProvider>);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
    expect(screen.getByRole('tab', { name: 'products.editor.attributesTab' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('grid', { hidden: true, name: 'variants.gridLabel' })).toBeTruthy();
  });

  it('🔴 επικόλληση στο πλέγμα παραλλαγών ⇒ ο επεξεργαστής δηλώνει «μη αποθηκευμένο» στη σελίδα', async () => {
    const reportDirty = jest.fn();
    render(
      <TooltipProvider>
        <ProductEditorView id={MFP_MODEL_ID} ctx={context()} canManage scope={{ channel: 'print', locale: 'el' }} onScope={jest.fn()} onOpen={jest.fn()} onBack={jest.fn()} reportDirty={reportDirty} />
      </TooltipProvider>,
    );
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
    expect(reportDirty).toHaveBeenLastCalledWith(false);
    const grid = screen.getByRole('grid', { hidden: true, name: 'variants.gridLabel' });
    fireEvent.keyDown(grid, { key: 'ArrowRight', code: 'ArrowRight' }); // άξονας → κωδικός
    const data = new Map([['text/plain', '099-01-099']]);
    fireEvent.paste(grid, { clipboardData: { getData: (type: string) => data.get(type) ?? '' } });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    expect(reportDirty).toHaveBeenLastCalledWith(true);

    // Δύο πρόχειρα, ΔΥΟ μέρη: ιδιότητα αλλάζει και απορρίπτεται ⇒ η σελίδα μένει «βρώμικη» (οι παραλλαγές δεν σώθηκαν).
    const field = document.getElementById('value-power_supply') as HTMLInputElement;
    fireEvent.change(field, { target: { value: '400V-50Hz-3Ph' } });
    fireEvent.blur(field); // ο επεξεργαστής κειμένου δεσμεύει στο blur
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    const discard = screen.getAllByRole('button', { name: 'common.discard' }).find((button) => !button.closest('[aria-labelledby="variants-title"]'));
    fireEvent.click(discard as HTMLElement);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    expect(field.value).not.toBe('400V-50Hz-3Ph');
    expect(reportDirty).toHaveBeenLastCalledWith(true);
  });
});

describe('ProductEditorView — ρητή απουσία (Δ5)', () => {
  it('🔴 ζωντανό (ADR-923 §5.10.5): «Άγνωστο» → ξανά «Άγνωστο» ⇒ η ΑΠΟΘΗΚΕΥΜΕΝΗ τιμή επιστρέφει, ο επεξεργαστής ξαναείναι καθαρός', async () => {
    const reportDirty = jest.fn();
    render(
      <TooltipProvider>
        <ProductEditorView id={MFP_MODEL_ID} ctx={context()} canManage scope={{ channel: 'print', locale: 'el' }} onScope={jest.fn()} onOpen={jest.fn()} onBack={jest.fn()} reportDirty={reportDirty} />
      </TooltipProvider>,
    );
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
    const section = (document.getElementById('value-power_supply') as HTMLInputElement).closest('section') as HTMLElement;
    fireEvent.click(within(section).getByRole('button', { name: 'values.noValue.unknown' }));
    expect(document.getElementById('value-power_supply')).toBeNull();
    fireEvent.click(within(section).getByRole('button', { name: 'values.noValue.unknown' }));
    expect((document.getElementById('value-power_supply') as HTMLInputElement).value).toBe('230V-50Hz-1Ph');
    expect(reportDirty).toHaveBeenLastCalledWith(false);
  });
});
