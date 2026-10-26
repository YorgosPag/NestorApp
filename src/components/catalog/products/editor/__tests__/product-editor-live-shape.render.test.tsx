/**
 * ADR-923 §5.10.4 Β3/Β4 — φρουρός βρόχου στη **ζωντανή μορφή** των δεδομένων: πραγματικό `useCatalogAggregateRecords`
 * πάνω σε ψεύτικο Firestore (μόνο το όριο I/O). Ζωντανά ο στόχος και το μέλος-ρίζα είναι **διαφορετικά** αντικείμενα
 * (δύο ακροατές), και κάθε στιγμιότυπο φέρνει νέες ταυτότητες — ό,τι το mock του hook δεν έδειχνε.
 */
import React, { Profiler } from 'react';
import { act, render, screen } from '@testing-library/react';

import { TooltipProvider } from '@/components/ui/tooltip';
import type { AttributeGroupRecord, AttributeRecord, FamilyRecord } from '@/services/catalog/catalog-api.client';
import { MFP_ATTRIBUTE_MAP, MFP_FAMILY } from '@/subapps/catalog/__tests__/fixtures/mfp-fan-coil.fixture';
import { MFP_MODEL, MFP_SETTINGS, MFP_VARIANTS } from '@/subapps/catalog/__tests__/fixtures/mfp-fan-coil-products.fixture';
import { PLATFORM_MEASUREMENT_REGISTRY } from '@/subapps/catalog/measurement/measurement-registry';

import type { ProductCatalogContext } from '../../use-product-catalog-context';
import { ProductEditorView } from '../ProductEditorView';

/** Ζωντανές ταυτότητες: το πρόθεμα ΕΙΝΑΙ το είδος (`holderKindOfId`). */
const MODEL_ID = 'cpmod_mfp';
const variantId = (index: number) => `cprod_mfp_${index}`;
const meta = { companyId: 'c', revision: 1, isDeleted: false, createdAt: '', createdBy: '', updatedAt: '2026-10-26T10:00:00.000Z', updatedBy: '', deletedAt: null, deletedBy: null };
const derived = { sortKey: 'k', summary: null, descendants: {}, identifier: null, label: null, completenessHash: null };
/** Νέο αντικείμενο σε κάθε ανάγνωση — όπως κάθε στιγμιότυπο του Firestore. */
const modelDoc = () => ({ ...meta, ...MFP_MODEL, id: MODEL_ID, parentId: null, derived: { ...derived } });
const variantDocs = () => MFP_VARIANTS.map((variant, index) => ({ ...meta, ...variant, id: variantId(index), modelId: MODEL_ID, derived: { ...derived } }));

jest.mock('@/services/firestore/firestore-query.service', () => ({
  firestoreQueryService: {
    getById: jest.fn(async () => null),
    subscribeDoc: jest.fn((_collection: string, _id: string, onDoc: (doc: unknown) => void) => {
      const timer = setTimeout(() => onDoc(modelDoc()), 0);
      return () => clearTimeout(timer);
    }),
    subscribe: jest.fn((collection: string, onResult: (result: { documents: unknown[] }) => void) => {
      const timer = setTimeout(() => onResult({ documents: collection === 'CATALOG_PRODUCTS' ? variantDocs() : [] }), 0);
      return () => clearTimeout(timer);
    }),
  },
}));
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));
jest.mock('@/providers/NotificationProvider', () => ({ useNotifications: () => ({ error: jest.fn(), warning: jest.fn() }) }));
jest.mock('@/hooks/useCompanyId', () => ({ useCompanyId: () => ({ companyId: 'c' }) }));

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

function Live() {
  return <ProductEditorView id={MODEL_ID} ctx={context()} canManage scope={{ channel: 'print', locale: 'el' }} onScope={() => undefined} onOpen={() => undefined} onBack={() => undefined} reportDirty={() => undefined} />;
}

describe('ProductEditorView — ζωντανή μορφή δεδομένων', () => {
  it('🔴 πραγματικό σύνολο από ακροατές ⇒ αποδίδεται και τα renders ΣΤΑΜΑΤΟΥΝ', async () => {
    let commits = 0;
    render(<TooltipProvider><Profiler id="live" onRender={() => { commits += 1; }}><Live /></Profiler></TooltipProvider>);
    // Περιμένουμε το ΓΕΓΟΝΟΣ (τρεις διαδοχικοί ακροατές: στόχος → δέντρο → SKU), όχι σταθερό χρόνο — μετά μετράμε.
    await screen.findByRole('tab', { name: 'products.editor.variantsTab' }, { timeout: 5000 });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 200)); });
    const settled = commits;
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 300)); });
    expect(commits).toBe(settled);
    expect(commits).toBeLessThan(30);
  });
});
