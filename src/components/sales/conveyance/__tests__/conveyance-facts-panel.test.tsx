/**
 * ⚓ ADR-915 §16 — το πάνελ ερωτήσεων δείχνει την ΙΔΙΑ τιμή με τον κατάλογο (`resolveCaseFacts`) και κλειδώνει ό,τι
 * επιβάλλει ο νόμος: για νομικό πρόσωπο η ερώτηση «υπόχρεος ασφαλιστικών εισφορών;» είναι «Ναι», χωρίς επιλογή.
 *
 * ⚓ ADR-915 §22 — τα γεγονότα προσώπου ρωτώνται **ανά πωλητή**: εταιρεία + ιδιώτης στην ίδια πράξη ⇒ δύο ομάδες, ο
 * νόμος κλειδώνει μόνο της εταιρείας, και η απάντηση φεύγει με το κλειδί του **σωστού** προσώπου.
 */

import { render, screen, within } from '@testing-library/react';
import React from 'react';
import { getChecklistItem } from '@/config/conveyance-checklist/catalog';
import { rowKeyOf } from '@/config/conveyance-checklist/row-key';
import type { CasePartyLabel, ChecklistRow, ConveyanceCaseParties, ConveyancePartyKind, ConveyanceSellerParty } from '@/types/conveyance-case';
import { sellerParty } from '@/lib/conveyance/case-parties';
import { ConveyanceFactsPanel } from '../ConveyanceFactsPanel';
import { HostCasePartyLabelsProvider } from '@/components/conveyance/shared/CasePartyLabels';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string, params?: { index?: number }) => (params?.index === undefined ? key : `${key}#${params.index}`) }),
}));

function rowOf(itemId: string, party: ConveyanceSellerParty): ChecklistRow {
  const item = getChecklistItem(itemId);
  if (item === undefined) throw new Error(itemId);
  return {
    itemId: rowKeyOf(itemId, party.key), item, party, section: item.section, provider: item.provider, status: 'missing', files: [], sealed: null,
    review: null, notApplicable: null, notApplicableBy: null, pendingFact: null,
    expiresOn: null, expiryIsFloor: false, validOnSigning: null, issueFrom: null,
  };
}

const sellerRows = (party: ConveyanceSellerParty) => [rowOf('seller_identity', party), rowOf('seller_insurance_clearance', party)];

/** §23.10 — η επικεφαλίδα «ποιος» έρχεται από τον πάροχο του οικοδεσπότη (ίδιος κανόνας με τον server). */
function caseWith(sellers: readonly ConveyanceSellerParty[], labels: readonly CasePartyLabel[] = []) {
  const parties: ConveyanceCaseParties = { sellers, buyers: [] };
  const wrapper = ({ children }: { readonly children: React.ReactNode }) => (
    <HostCasePartyLabelsProvider sellers={sellers} labels={labels}>{children}</HostCasePartyLabelsProvider>
  );
  return { record: { facts: {}, partyFacts: {}, parties }, rows: sellers.flatMap(sellerRows), wrapper };
}

const seller = (contactId: string, kind: ConveyancePartyKind) => sellerParty(contactId, kind, kind === 'legal_entity' ? 'principal' : 'other');

function liableRowIn(scope: HTMLElement | Document = document) {
  const question = within(scope instanceof Document ? scope.body : scope).getByText('facts.seller_insurance_liable.question');
  const row = question.closest('li');
  if (row === null) throw new Error('no row');
  return within(row);
}

describe('ConveyanceFactsPanel — συνεπαγωγή νόμου (ADR-915 §16)', () => {
  it('νομικό πρόσωπο ⇒ «Ναι» κλειδωμένο, με ένδειξη «Από τον νόμο»', () => {
    const { record, rows, wrapper } = caseWith([seller('cont_co', 'legal_entity')]);
    render(<ConveyanceFactsPanel record={record} rows={rows} derivedFacts={{}} canEdit onAnswer={jest.fn()} />, { wrapper });
    const row = liableRowIn();
    expect(row.getByText('facts.entailed')).toBeInTheDocument();
    expect(row.getByRole('button', { name: 'facts.yes' })).toBeDisabled();
    expect(row.getByRole('button', { name: 'facts.yes' })).toHaveAttribute('aria-pressed', 'true');
    expect(row.getByRole('button', { name: 'facts.no' })).toBeDisabled();
  });

  it('φυσικό πρόσωπο ⇒ η ερώτηση είναι ανοιχτή και απαντιέται', () => {
    const { record, rows, wrapper } = caseWith([seller('cont_p', 'person')]);
    render(<ConveyanceFactsPanel record={record} rows={rows} derivedFacts={{}} canEdit onAnswer={jest.fn()} />, { wrapper });
    const row = liableRowIn();
    expect(row.queryByText('facts.entailed')).toBeNull();
    expect(row.getByRole('button', { name: 'facts.yes' })).toBeEnabled();
    expect(row.getByRole('button', { name: 'facts.no' })).toBeEnabled();
  });

  it('ένας πωλητής ⇒ καμία επικεφαλίδα «Πωλητής N» (η όψη όπως πριν από την §22)', () => {
    const { record, rows, wrapper } = caseWith([seller('cont_co', 'legal_entity')]);
    render(<ConveyanceFactsPanel record={record} rows={rows} derivedFacts={{}} canEdit onAnswer={jest.fn()} />, { wrapper });
    expect(screen.queryByText(/parties\.sellerOrdinal/)).toBeNull();
  });
});

describe('ConveyanceFactsPanel — ανά πωλητή (ADR-915 §22)', () => {
  const company = seller('cont_co', 'legal_entity');
  const person = seller('cont_p', 'person');

  it('εταιρεία + ιδιώτης ⇒ δύο ομάδες· ο νόμος κλειδώνει ΜΟΝΟ την εταιρεία', () => {
    const { record, rows, wrapper } = caseWith([company, person]);
    render(<ConveyanceFactsPanel record={record} rows={rows} derivedFacts={{}} canEdit onAnswer={jest.fn()} />, { wrapper });
    const first = screen.getByRole('region', { name: 'parties.sellerOrdinal#1' });
    const second = screen.getByRole('region', { name: 'parties.sellerOrdinal#2' });
    expect(liableRowIn(first).getByRole('button', { name: 'facts.yes' })).toBeDisabled();
    expect(liableRowIn(second).getByRole('button', { name: 'facts.yes' })).toBeEnabled();
  });

  it('η απάντηση φεύγει με το κλειδί του προσώπου της ομάδας', () => {
    const onAnswer = jest.fn();
    const { record, rows, wrapper } = caseWith([company, person]);
    render(<ConveyanceFactsPanel record={record} rows={rows} derivedFacts={{}} canEdit onAnswer={onAnswer} />, { wrapper });
    liableRowIn(screen.getByRole('region', { name: 'parties.sellerOrdinal#2' })).getByRole('button', { name: 'facts.no' }).click();
    expect(onAnswer).toHaveBeenCalledWith('seller_insurance_liable', false, person.key);
  });

  it('§23.10 — με όνομα από τον server ⇒ η ομάδα λέγεται με το όνομα· όνομα που λείπει ⇒ «Πωλητής N»', () => {
    const labels = [{ key: company.key, ordinal: 1, name: '' }, { key: person.key, ordinal: 2, name: 'Test Person' }];
    const { record, rows, wrapper } = caseWith([company, person], labels);
    render(<ConveyanceFactsPanel record={record} rows={rows} derivedFacts={{}} canEdit onAnswer={jest.fn()} />, { wrapper });
    expect(screen.getByRole('region', { name: 'parties.sellerOrdinal#1' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Test Person' })).toBeInTheDocument();
  });
});
