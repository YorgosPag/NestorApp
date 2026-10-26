/**
 * ADR-923 §5.10.4 Β3 — ο επεξεργαστής προϊόντος πάνω στο MFP: διάταξη ανά επίπεδο (Δ1), πεδίο τιμής με τον κοινό
 * κωδικοποιητή, ρητή απουσία (Δ5), κληρονομημένες τιμές «ορίζεται στο …».
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TooltipProvider } from '@/components/ui/tooltip';
import type { AttributeGroupRecord, AttributeRecord } from '@/services/catalog/catalog-api.client';
import { MFP_ATTRIBUTE_MAP, MFP_FAMILY } from '@/subapps/catalog/__tests__/fixtures/mfp-fan-coil.fixture';
import { MFP_MODEL, MFP_MODEL_ID, MFP_VARIANTS, mfpChain } from '@/subapps/catalog/__tests__/fixtures/mfp-fan-coil-products.fixture';
import { PLATFORM_MEASUREMENT_REGISTRY } from '@/subapps/catalog/measurement/measurement-registry';
import type { CatalogValueHolder } from '@/subapps/catalog/types/product';
import { resolveInheritedValues } from '@/subapps/catalog/values/resolve-inherited';

import type { ValueEditorEnv } from '../../../values/value-editor-types';
import { AttributeValueField } from '../AttributeValueField';
import { computeCompleteness } from '@/subapps/catalog/completeness/compute-completeness';
import { MFP_SETTINGS } from '@/subapps/catalog/__tests__/fixtures/mfp-fan-coil-products.fixture';
import { editorGroups, groupOfAttribute, levelSchema } from '../editor-layout';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key), i18n: { language: 'el' } }),
}));

const scheme = MFP_FAMILY.variantSchemes[0];
const meta = { id: '', companyId: 'c', revision: 1, isDeleted: false, createdAt: '', createdBy: '', updatedAt: '', updatedBy: '', deletedAt: null, deletedBy: null };
const record = (id: string): AttributeRecord => ({ ...meta, ...MFP_ATTRIBUTE_MAP.get(id)!, id, measurementFamilyCodes: [] }) as AttributeRecord;
const library = new Map([...MFP_ATTRIBUTE_MAP.keys()].map((id) => [id, record(id)]));
const groups: AttributeGroupRecord[] = [
  { ...meta, id: 'performance', code: 'performance', labels: { el: 'Απόδοση' }, orderKey: 'b' } as AttributeGroupRecord,
  { ...meta, id: 'general', code: 'general', labels: { el: 'Γενικά' }, orderKey: 'a' } as AttributeGroupRecord,
];

const env: ValueEditorEnv = {
  codec: { registry: PLATFORM_MEASUREMENT_REGISTRY, language: 'el', assetIdByCode: new Map(), assetCodeById: new Map(), yes: 'Ναι', no: 'Όχι' },
  assets: [], assetById: new Map(), files: new Map(), text: (value, fallback = '') => value?.el ?? fallback,
  references: { resolve: async () => null, describe: (target) => target.id },
};

describe('editorGroups — ό,τι φαίνεται σε κάθε επίπεδο (Δ1)', () => {
  it('ρίζα (βάθος 0): μόνο ιδιότητες της ρίζας · παραλλαγή (βάθος 1): όλες, οι της ρίζας κληρονομημένες', () => {
    const root = editorGroups(MFP_FAMILY, library, groups, scheme, 0).flatMap((group) => group.fields);
    const variant = editorGroups(MFP_FAMILY, library, groups, scheme, 1).flatMap((group) => group.fields);
    expect(root.every((field) => field.ownerDepth === 0)).toBe(true);
    expect(root.some((field) => field.attributeId === 'cooling_h')).toBe(false);
    expect(variant.find((field) => field.attributeId === 'cooling_h')?.ownerDepth).toBe(1);
    expect(variant.some((field) => field.ownerDepth === 0)).toBe(true);
    expect(variant.find((field) => field.attributeId === 'size')?.isAxis).toBe(true);
  });

  it('καρτέλες με τη σειρά της βιβλιοθήκης (orderKey) · «πήγαινε στο πεδίο» βρίσκει την καρτέλα', () => {
    const plan = editorGroups(MFP_FAMILY, library, groups, scheme, 1);
    expect(plan.map((group) => group.groupId).slice(0, 2)).toEqual(['general', 'performance']);
    expect(groupOfAttribute(plan, 'cooling_h')).toBe('performance');
  });
});

describe('levelSchema — η πληρότητα που έχει νόημα σε κάθε επίπεδο (σφάλμα που φάνηκε ζωντανά)', () => {
  const schema = { family: MFP_FAMILY, attributes: MFP_ATTRIBUTE_MAP, registry: PLATFORM_MEASUREMENT_REGISTRY, settings: MFP_SETTINGS, scheme };
  it('🔴 μοντέλο-ρίζα: ΔΕΝ ζητά «Κωδικό/Μέγεθος/Ψυκτική» (ανήκουν στις παραλλαγές) · SKU: όλη η οικογένεια', () => {
    const rootLevel = levelSchema(schema, true, 0);
    const missing = computeCompleteness({ ...rootLevel, resolved: resolveInheritedValues([{ id: MFP_MODEL_ID, kind: 'productModel', revision: 1, holder: { values: {}, noValueReasons: {}, categoryIds: [] } }], scheme) }).print.el?.missing.map((gap) => gap.attributeId) ?? [];
    expect(missing).not.toContain('model_code');
    expect(missing).not.toContain('cooling_h');
    expect(levelSchema(schema, false, 1)).toBe(schema);
  });
});

function renderField(holder: CatalogValueHolder, over: Partial<React.ComponentProps<typeof AttributeValueField>> = {}) {
  const onHolder = jest.fn();
  const onOpen = jest.fn();
  render(
    <TooltipProvider>
      <AttributeValueField attributeId="cooling_h" attribute={record('cooling_h')} required isAxis={false} holder={holder}
        resolved={resolveInheritedValues(mfpChain(MFP_VARIANTS[0], 0), scheme)} inheritedFrom={null}
        scope={{ channel: 'print', locale: 'el' }} env={env} issues={[]} disabled={false} onHolder={onHolder} onOpen={onOpen} {...over} />
    </TooltipProvider>,
  );
  return { onHolder, onOpen };
}

describe('AttributeValueField', () => {
  it('«2,5 kW» + Enter ⇒ μέτρηση στη θέση */* μέσω του ΚΟΙΝΟΥ κωδικοποιητή', () => {
    const { onHolder } = renderField({ values: {}, noValueReasons: {}, categoryIds: [] });
    const input = screen.getByLabelText('Ψυκτική ισχύς H');
    fireEvent.change(input, { target: { value: '2,5 kW' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onHolder).toHaveBeenCalledWith(expect.objectContaining({ values: { cooling_h: { '*': { '*': { type: 'measurement', amount: '2.5', unitCode: 'kW' } } } } }));
  });

  it('🔴 απορριπτέο κείμενο ⇒ ΚΑΜΙΑ δέσμευση, μήνυμα δίπλα, το κείμενο μένει', () => {
    const { onHolder } = renderField({ values: {}, noValueReasons: {}, categoryIds: [] });
    const input = screen.getByLabelText('Ψυκτική ισχύς H') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2,5 furlong' } });
    fireEvent.blur(input);
    expect(onHolder).not.toHaveBeenCalled();
    expect(input.value).toBe('2,5 furlong');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText(/issues\.measurementUnitUnknown/)).toBeTruthy();
  });

  it('«Δεν εφαρμόζεται» ⇒ λόγος απουσίας, η τιμή σβήνει (Δ5)', async () => {
    const { onHolder } = renderField(MFP_VARIANTS[0]);
    await userEvent.click(screen.getByRole('button', { name: 'values.noValue.notApplicable' }));
    const next = onHolder.mock.calls[0][0] as CatalogValueHolder;
    expect(next.noValueReasons).toEqual({ cooling_h: 'notApplicable' });
    expect(next.values.cooling_h).toBeUndefined();
  });

  it('κληρονομημένη: τιμή γκρι + «Ορίζεται στο …» ανοίγει τον πρόγονο · κανένα πεδίο επεξεργασίας', async () => {
    const description = record('description');
    const { onOpen } = renderField(MFP_VARIANTS[0], { attributeId: 'description', attribute: description, inheritedFrom: { id: MFP_MODEL_ID, name: MFP_MODEL.code } });
    expect(screen.queryByRole('textbox')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: new RegExp(`values.definedIn.*${MFP_MODEL.code}`) }));
    expect(onOpen).toHaveBeenCalledWith(MFP_MODEL_ID);
  });
});
