/**
 * ADR-923 §5.10.4 Β4 — ο γεννήτορας παραλλαγών: διαδοχικές επιλογές **δεν** σβήνουν η μία την άλλη.
 *
 * Ζωντανά, επτά κλικ στα μεγέθη MFP άφηναν επιλεγμένο **μόνο** το τελευταίο: η εναλλαγή αντικαθιστούσε την κατάσταση με
 * το στιγμιότυπο του render αντί να πράττει πάνω στην τρέχουσα (functional updater).
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';

import type { AttributeRecord } from '@/services/catalog/catalog-api.client';
import { MFP_ATTRIBUTE_MAP } from '@/subapps/catalog/__tests__/fixtures/mfp-fan-coil.fixture';
import { PLATFORM_MEASUREMENT_REGISTRY } from '@/subapps/catalog/measurement/measurement-registry';

import type { ValueEditorEnv } from '../../../values/value-editor-types';
import { VariantGeneratorDialog } from '../VariantGeneratorDialog';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params && 'count' in params ? `${key}:${String(params.count)}` : key),
    i18n: { language: 'el' },
  }),
}));

const meta = { companyId: 'c', revision: 1, isDeleted: false, createdAt: '', createdBy: '', updatedAt: '', updatedBy: '', deletedAt: null, deletedBy: null };
const attributeById = new Map([...MFP_ATTRIBUTE_MAP].map(([id, a]) => [id, { ...meta, ...a, id, measurementFamilyCodes: [] } as AttributeRecord]));
const size = attributeById.get('size') as AttributeRecord;

const env: ValueEditorEnv = {
  codec: { registry: PLATFORM_MEASUREMENT_REGISTRY, language: 'el', assetIdByCode: new Map(), assetCodeById: new Map(), yes: 'Ναι', no: 'Όχι' },
  assets: [], assetById: new Map(), files: new Map(),
  text: (value, fallback) => value?.el ?? fallback ?? '',
  references: { resolve: async () => null, describe: (target) => target.id },
};

function renderDialog(onGenerate = jest.fn()) {
  render(
    <VariantGeneratorDialog open onOpenChange={jest.fn()} axes={[size]} existing={[]} descendantCount={0}
      attributeById={attributeById} registry={PLATFORM_MEASUREMENT_REGISTRY} env={env} onGenerate={onGenerate} />,
  );
  return onGenerate;
}

const sizeButtons = () => screen.getAllByRole('button').filter((button) => /^MFP-/.test(button.textContent ?? ''));

describe('VariantGeneratorDialog', () => {
  it('🔴 επτά κλικ στο ΙΔΙΟ batch ⇒ επτά επιλογές (όχι μόνο η τελευταία)', () => {
    const onGenerate = renderDialog();
    act(() => { sizeButtons().forEach((button) => fireEvent.click(button)); });
    expect(sizeButtons().every((button) => button.getAttribute('aria-pressed') === 'true')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'variants.generator.add:7' }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(onGenerate.mock.calls[0][0]).toHaveLength(7);
  });

  it('δεύτερο κλικ αφαιρεί την επιλογή', () => {
    renderDialog();
    const [first] = sizeButtons();
    act(() => { fireEvent.click(first); fireEvent.click(first); });
    expect(first.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'variants.generator.add:0' })).toHaveProperty('disabled', true);
  });
});
