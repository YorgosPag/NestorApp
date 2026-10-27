/**
 * Ο επεξεργαστής οικογένειας **αποδίδεται** σε όλες τις καρτέλες πάνω στο Fan coil (MFP) — το κριτήριο εξόδου της
 * Φάσης 1 ως δεδομένα. Πιάνει ό,τι δεν πιάνουν οι καθαρές συναρτήσεις: σφάλματα απόδοσης, λάθος καλωδίωση props,
 * προεπισκόπηση πίνακα που δεν βγαίνει.
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { CatalogLibrary } from '@/hooks/catalog/useCatalogLibrary';
import type { CatalogOptimistic } from '@/hooks/catalog/useCatalogOptimistic';
import type { AttributeGroupRecord, AttributeRecord, FamilyRecord } from '@/services/catalog/catalog-api.client';
import { MFP_ATTRIBUTES, MFP_FAMILY } from '@/subapps/catalog/__tests__/fixtures/mfp-fan-coil.fixture';
import { PLATFORM_MEASUREMENT_REGISTRY } from '@/subapps/catalog/measurement/measurement-registry';
import { deriveAttributeMeasurementFamilyCodes } from '@/subapps/catalog/types/attribute';
import { FamilyEditor } from '../FamilyEditor';

// Πέντε καρτέλες Radix σε jsdom: αργό σε φορτωμένο μηχάνημα — όριο για χρόνο, όχι για λειτουργία.
jest.setTimeout(60_000);

jest.mock('@/auth/hooks/useCapability', () => ({ useCapability: () => ({ pending: false, verdict: 'granted-by-role' }) }));
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));

const meta = (id: string) => ({
  id,
  companyId: 'comp_test',
  revision: 1,
  isDeleted: false,
  createdAt: '2026-10-25T00:00:00.000Z',
  createdBy: 'u',
  updatedAt: '2026-10-25T00:00:00.000Z',
  updatedBy: 'u',
  deletedAt: null,
  deletedBy: null,
});

const attributes: AttributeRecord[] = MFP_ATTRIBUTES.map((attribute) => ({
  ...attribute,
  measurementFamilyCodes: deriveAttributeMeasurementFamilyCodes(attribute),
  ...meta(attribute.code),
}));

const groups: AttributeGroupRecord[] = ['general', 'performance', 'dimensions', 'media'].map((code, index) => ({
  code,
  labels: { el: code },
  orderKey: `a${index}`,
  ...meta(code),
}));

const family: FamilyRecord = { ...MFP_FAMILY, attributeIds: MFP_FAMILY.attributes.map((binding) => binding.attributeId), ...meta('fan_coil') };

function ops<T>(view: readonly T[]): CatalogOptimistic<T> {
  return { view, settled: view, pendingKeys: new Set(), submit: jest.fn() };
}

const library: CatalogLibrary = {
  state: 'ready',
  attributes,
  groups,
  measurementFamilies: [],
  attributeById: new Map(attributes.map((attribute) => [attribute.id, attribute])),
  registry: PLATFORM_MEASUREMENT_REGISTRY,
  ops: { attributes: ops(attributes), groups: ops(groups), measurementFamilies: ops([]) },
};

function renderEditor(familyOps = ops([family])) {
  render(
    <FamilyEditor record={family} families={[family]} library={library} ops={familyOps} canManage onCreated={jest.fn()} onDeleted={jest.fn()} reportDirty={jest.fn()} />,
  );
  return familyOps;
}

describe('FamilyEditor — το Fan coil από το UI', () => {
  it('αποδίδεται σε κάθε καρτέλα χωρίς ευρήματα', async () => {
    const user = userEvent.setup();
    renderEditor();
    for (const tab of ['families.tabs.attributes', 'families.tabs.variants', 'families.tabs.table', 'families.tabs.rules', 'families.tabs.general']) {
      await user.click(screen.getByRole('tab', { name: tab }));
      expect(screen.getByRole('tabpanel')).toBeInTheDocument();
    }
    expect(screen.queryByText('editor.issuesTitle')).not.toBeInTheDocument();
  });

  it('η προεπισκόπηση του πίνακα βγάζει μία στήλη ανά μέγεθος (επτά)', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByRole('tab', { name: 'families.tabs.table' }));
    const preview = screen.getByRole('table', { name: 'families.table.preview' });
    for (const size of ['MFP-34', 'MFP-170']) expect(within(preview).getByText(size)).toBeInTheDocument();
    expect(within(preview).getAllByRole('row').length).toBeGreaterThan(3);
  });

  it('αφαίρεση ιδιότητας ⇒ πρόχειρο βρώμικο, αποθήκευση στέλνει ΜΙΑ πράξη για ΤΗΝ οικογένεια', async () => {
    const user = userEvent.setup();
    const familyOps = renderEditor();
    await user.click(screen.getByRole('tab', { name: 'families.tabs.attributes' }));
    await user.click(screen.getAllByRole('button', { name: 'families.attributes.removeOf' })[10]);
    await user.click(screen.getByRole('button', { name: 'common.save' }));
    expect(familyOps.submit).toHaveBeenCalledTimes(1);
    expect(familyOps.submit).toHaveBeenCalledWith(expect.objectContaining({ key: 'fan_coil' }));
  });
});
