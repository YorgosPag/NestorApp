/**
 * ADR-923 §5.10.5 — **η σύγκρουση είναι γεγονός, όχι παράγωγο** (ζωντανό σφάλμα της Φάσης 2ε, σενάριο 4).
 *
 * Ζωντανά, δύο καρτέλες: η Β άλλαξε το βάρος της MFP-34 και αποθήκευσε· η Α (βάρος MFP-34 + θόρυβος MFP-51) κράτησε
 * σωστά τη ζωντανή γραμμή και ανέφερε «άλλαξε από αλλού». Όμως **μετά** την επιτυχή αποθήκευση της Α η ειδοποίηση
 * «…οι υπόλοιπες αλλαγές σας μένουν» **έμενε** — το πρόχειρο κρατούσε ακόμη τη χαμένη εκδοχή και κάθε render την
 * «ξανανακάλυπτε» ως σύγκρουση· έσβηνε μόνο τυχαία, με την επόμενη επεξεργασία.
 */
import { act, renderHook, waitFor } from '@testing-library/react';

import { MFP_ATTRIBUTE_MAP, MFP_FAMILY } from '@/subapps/catalog/__tests__/fixtures/mfp-fan-coil.fixture';
import { MFP_ASSETS, MFP_MODEL, MFP_MODEL_ID, MFP_SETTINGS, MFP_VARIANTS, mfpVariantId } from '@/subapps/catalog/__tests__/fixtures/mfp-fan-coil-products.fixture';
import type { StoredMemberShape } from '@/subapps/catalog/aggregate/aggregate-members';
import { schemaSnapshotOf } from '@/subapps/catalog/aggregate/edit-aggregate';
import { PLATFORM_MEASUREMENT_REGISTRY } from '@/subapps/catalog/measurement/measurement-registry';
import type { CatalogProductDefinition } from '@/subapps/catalog/types/product';
import type { ProductModelRecord } from '@/services/catalog/catalog-api.client';

import { useVariantGrid } from '../use-variant-grid';

const saveCatalogVariants = jest.fn();
jest.mock('@/services/catalog/catalog-api.client', () => ({
  ...jest.requireActual('@/services/catalog/catalog-api.client'),
  saveCatalogVariants: (...args: unknown[]) => saveCatalogVariants(...args),
}));
jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }) }));
jest.mock('@/providers/NotificationProvider', () => ({ useNotifications: () => ({ error: jest.fn(), warning: jest.fn() }) }));

const derived = {} as never;
const root = { ...MFP_MODEL, id: MFP_MODEL_ID, revision: 1, derived, companyId: 'c' } as unknown as ProductModelRecord;
const withValue = (definition: CatalogProductDefinition, attributeId: string, amount: string, unitCode: string): CatalogProductDefinition =>
  ({ ...definition, values: { ...definition.values, [attributeId]: { '*': { '*': { type: 'measurement', amount, unitCode } } } } });
const member = (index: number, definition: CatalogProductDefinition, revision: number): StoredMemberShape =>
  ({ kind: 'product', record: { ...definition, id: mfpVariantId(index), revision, derived } });
const members = (overrides: ReadonlyMap<number, StoredMemberShape> = new Map()): StoredMemberShape[] => [
  { kind: 'productModel', record: root },
  ...MFP_VARIANTS.map((variant, index) => overrides.get(index) ?? member(index, variant, 1)),
];
const schema = schemaSnapshotOf({ family: MFP_FAMILY, attributes: MFP_ATTRIBUTE_MAP, registry: PLATFORM_MEASUREMENT_REGISTRY, settings: MFP_SETTINGS, variantSchemeCode: 'by_size' });
const refs = { assets: MFP_ASSETS, categories: new Set<string>(), references: new Map() };
const scope = { channel: 'print' as const, locale: 'el' as const };
// Σταθερή ταυτότητα εισόδου ανά λίστα (όπως τα props στην εφαρμογή) — αλλιώς κάθε render θα ήταν «νέα» είσοδος.
const inputs = new WeakMap<StoredMemberShape[], ReturnType<typeof makeInput>>();
const makeInput = (list: StoredMemberShape[]) => ({ root, parentId: MFP_MODEL_ID, rootId: MFP_MODEL_ID, members: list, schema, refs, scope });
const input = (list: StoredMemberShape[]) => { const known = inputs.get(list); if (known) return known; const made = makeInput(list); inputs.set(list, made); return made; };

describe('useVariantGrid — σύγκρουση ως γεγονός', () => {
  it('🔴 ξένη αλλαγή στη ΔΙΚΗ μας γραμμή ⇒ αναφέρεται· μετά την επιτυχή αποθήκευση των υπολοίπων ⇒ η ειδοποίηση ΣΒΗΝΕΙ', async () => {
    const { result, rerender } = renderHook(({ list }) => useVariantGrid(input(list)), { initialProps: { list: members() } });
    const mine0 = withValue(MFP_VARIANTS[0], 'weight', '15.5', 'kg');
    const mine1 = withValue(MFP_VARIANTS[1], 'sound_pressure', '38', 'dBA');
    act(() => result.current.change({ ...result.current.draft, rows: result.current.draft.rows.map((row) => (row.id === mfpVariantId(0) ? { ...row, definition: mine0 } : row.id === mfpVariantId(1) ? { ...row, definition: mine1 } : row)) }));

    const theirs0 = member(0, withValue(MFP_VARIANTS[0], 'weight', '16', 'kg'), 2);
    rerender({ list: members(new Map([[0, theirs0]])) });
    expect(result.current.conflicts).toEqual([mfpVariantId(0)]);

    saveCatalogVariants.mockResolvedValueOnce({ model: { ...root, revision: 2 } });
    act(() => result.current.save());
    await waitFor(() => expect(result.current.saving).toBe(false));
    rerender({ list: members(new Map([[0, theirs0], [1, member(1, mine1, 2)]])) });

    expect(result.current.dirty).toBe(false);
    expect(result.current.conflicts).toEqual([]);
  });
});
