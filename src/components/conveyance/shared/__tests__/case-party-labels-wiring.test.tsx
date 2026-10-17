/**
 * ⚓ ADR-915 §23.10 — οι **καταναλωτές** ρωτούν το SSoT ετικέτας: η γραμμή του καταλόγου (τίτλος + μενού) και το ίχνος
 * του επαγγελματία λένε «έγγραφο · πρόσωπο». Χωρίς αυτή την άγκυρα, μια επιστροφή στο `t(row.item.labelKey)` σε ένα
 * από τα σημεία θα ξανάφερνε δύο ίδιες γραμμές «ΕΝΦΙΑ» χωρίς κανένα κόκκινο τεστ. Συνθετικά ονόματα.
 */

import { render, screen } from '@testing-library/react';
import React from 'react';
import { getChecklistItem } from '@/config/conveyance-checklist/catalog';
import { rowKeyOf } from '@/config/conveyance-checklist/row-key';
import { sellerParty } from '@/lib/conveyance/case-parties';
import type { CaseActivityItem, ChecklistRow } from '@/types/conveyance-case';
import { ConveyanceChecklistRow } from '@/components/sales/conveyance/ConveyanceChecklistRow';
import { EngagedCaseActivity } from '@/components/conveyance/my-cases/EngagedCaseActivity';
import { CasePartyLabelsProvider } from '../CasePartyLabels';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) =>
      (params === undefined ? key : `${key}{${Object.entries(params).map(([name, value]) => `${name}=${value}`).join(',')}}`),
  }),
}));

const mockActivity = jest.fn(async (): Promise<{ items: readonly CaseActivityItem[] }> => ({ items: [] }));
jest.mock('@/services/conveyance/conveyance-engagement-gateway', () => ({
  fetchEngagedCaseActivity: () => mockActivity(),
}));

const party = sellerParty('cont_lo', 'person', 'landowner');
const labels = [{ key: 'cont_co', ordinal: 1, name: '' }, { key: 'cont_lo', ordinal: 2, name: 'Test Landowner' }];
const ROW_KEY = rowKeyOf('seller_tax_clearance', party.key);

function taxRow(): ChecklistRow {
  const item = getChecklistItem('seller_tax_clearance');
  if (item === undefined) throw new Error('catalog');
  return {
    itemId: ROW_KEY, item, party, section: item.section, provider: item.provider, status: 'missing', files: [], sealed: null,
    review: null, notApplicable: null, notApplicableBy: null, pendingFact: null,
    expiresOn: null, expiryIsFloor: false, validOnSigning: null, issueFrom: null,
  };
}

const LABEL = `parties.rowLabel{item=${getChecklistItem('seller_tax_clearance')?.labelKey},party=Test Landowner}`;

it('η γραμμή του καταλόγου: τίτλος ΚΑΙ ετικέτα του μενού ενεργειών με το πρόσωπο', () => {
  render(
    <CasePartyLabelsProvider labels={labels}>
      <ConveyanceChecklistRow row={taxRow()} canEdit onOpenDialog={jest.fn()} onClear={jest.fn()} />
    </CasePartyLabelsProvider>,
  );
  expect(screen.getByRole('heading', { name: LABEL })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: `actions.menu{item=${LABEL}}` })).toBeInTheDocument();
});

it('το ίχνος του επαγγελματία: αίτημα σε γραμμή προσώπου ⇒ το έγγραφο ΜΕ το πρόσωπο', async () => {
  mockActivity.mockResolvedValueOnce({ items: [{
    id: 'a1', at: '2026-10-16T10:00:00.000Z', kind: 'requested', documentName: null, itemId: ROW_KEY, byViewer: true, actorRole: 'notary',
  }] });
  render(<CasePartyLabelsProvider labels={labels}><EngagedCaseActivity engagementId="eng_1" /></CasePartyLabelsProvider>);
  expect(await screen.findByText(new RegExp(`name=${LABEL.replace(/[{}]/g, '\\$&')}`))).toBeInTheDocument();
});
