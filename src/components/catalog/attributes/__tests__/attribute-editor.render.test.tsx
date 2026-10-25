/**
 * Ο επεξεργαστής ιδιότητας **αποδίδεται** για κάθε έναν από τους 11 τύπους (κάθε κλάδος του dispatcher), και η
 * αλλαγή τύπου δεν κουβαλά ποτέ ρύθμιση άλλου τύπου.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

import type { CatalogOptimistic } from '@/hooks/catalog/useCatalogOptimistic';
import type { AttributeGroupRecord, AttributeRecord } from '@/services/catalog/catalog-api.client';
import { PLATFORM_MEASUREMENT_REGISTRY } from '@/subapps/catalog/measurement/measurement-registry';
import { validateAttribute } from '@/subapps/catalog/schema/validate-attribute';
import { ATTRIBUTE_TYPES } from '@/subapps/catalog/vocabulary/attribute-types';
import { emptyAttributeDraft, withAttributeType } from '../attribute-draft';
import { AttributeEditor } from '../AttributeEditor';

jest.setTimeout(60_000);

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));

const group: AttributeGroupRecord = {
  code: 'general', labels: { el: 'Γενικά' }, orderKey: 'a0', id: 'g1', companyId: 'c', revision: 1, isDeleted: false,
  createdAt: '', createdBy: '', updatedAt: '', updatedBy: '', deletedAt: null, deletedBy: null,
};

const ops: CatalogOptimistic<AttributeRecord> = { view: [], settled: [], pendingKeys: new Set(), submit: jest.fn() };

describe('AttributeEditor — κάθε τύπος αποδίδεται', () => {
  it.each(ATTRIBUTE_TYPES)('%s', (type) => {
    const blank = withAttributeType(emptyAttributeDraft('g1', 'a0', PLATFORM_MEASUREMENT_REGISTRY), type, PLATFORM_MEASUREMENT_REGISTRY);
    render(
      <AttributeEditor record={null} blank={blank} groups={[group]} families={[]} registry={PLATFORM_MEASUREMENT_REGISTRY}
        ops={ops} canManage orderKeyAtEnd={() => 'a1'} onCreated={jest.fn()} />,
    );
    expect(screen.getByText('attributes.fields.settings')).toBeInTheDocument();
  });

  it('η προεπιλογή κάθε τύπου περνά τον επικυρωτή — εκτός από ό,τι ΠΡΕΠΕΙ να αποφασίσει ο άνθρωπος', () => {
    const base = { ...emptyAttributeDraft('g1', 'a0', PLATFORM_MEASUREMENT_REGISTRY), code: 'x', labels: { el: 'X' } };
    const failing = ATTRIBUTE_TYPES.filter((type) => validateAttribute(withAttributeType(base, type, PLATFORM_MEASUREMENT_REGISTRY), PLATFORM_MEASUREMENT_REGISTRY).length > 0);
    // Επιλογές (select/multiSelect) και ετικέτες στηλών πίνακα: αποφάσεις του ανθρώπου, όχι προεπιλογές.
    expect(failing.sort()).toEqual(['multiSelect', 'select', 'table']);
  });
});
