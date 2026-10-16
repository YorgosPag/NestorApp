/**
 * ⚓ ADR-915 §16 — το πάνελ ερωτήσεων δείχνει την ΙΔΙΑ τιμή με τον κατάλογο (`resolveFacts`) και κλειδώνει ό,τι
 * επιβάλλει ο νόμος: για νομικό πρόσωπο η ερώτηση «υπόχρεος ασφαλιστικών εισφορών;» είναι «Ναι», χωρίς επιλογή.
 */

import { render, screen, within } from '@testing-library/react';
import React from 'react';
import { getChecklistItem } from '@/config/conveyance-checklist/catalog';
import type { ChecklistRow, ConveyanceFactAnswer } from '@/types/conveyance-case';
import { ConveyanceFactsPanel } from '../ConveyanceFactsPanel';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function rowOf(itemId: string): ChecklistRow {
  const item = getChecklistItem(itemId);
  if (item === undefined) throw new Error(itemId);
  return {
    itemId, item, section: item.section, provider: item.provider, status: 'missing', files: [], sealed: null,
    review: null, notApplicable: null, notApplicableBy: null, pendingFact: null,
    expiresOn: null, expiryIsFloor: false, validOnSigning: null, issueFrom: null,
  };
}

const ROWS = [rowOf('seller_identity'), rowOf('seller_insurance_clearance')];
const answer = (value: boolean): ConveyanceFactAnswer => ({ value, answeredBy: 'u1', answeredAt: '2026-10-16T10:00:00Z' });

function liableRow() {
  const question = screen.getByText('facts.seller_insurance_liable.question');
  const row = question.closest('li');
  if (row === null) throw new Error('no row');
  return within(row);
}

describe('ConveyanceFactsPanel — συνεπαγωγή νόμου (ADR-915 §16)', () => {
  it('απαντημένο νομικό πρόσωπο ⇒ «Ναι» κλειδωμένο, με ένδειξη «Από τον νόμο»', () => {
    render(<ConveyanceFactsPanel answers={{ seller_is_legal_entity: answer(true) }} rows={ROWS} derivedFacts={{}} canEdit onAnswer={jest.fn()} />);
    const row = liableRow();
    expect(row.getByText('facts.entailed')).toBeInTheDocument();
    expect(row.getByRole('button', { name: 'facts.yes' })).toBeDisabled();
    expect(row.getByRole('button', { name: 'facts.yes' })).toHaveAttribute('aria-pressed', 'true');
    expect(row.getByRole('button', { name: 'facts.no' })).toBeDisabled();
  });

  it('φυσικό πρόσωπο ⇒ η ερώτηση είναι ανοιχτή και απαντιέται', () => {
    render(<ConveyanceFactsPanel answers={{ seller_is_legal_entity: answer(false) }} rows={ROWS} derivedFacts={{}} canEdit onAnswer={jest.fn()} />);
    const row = liableRow();
    expect(row.queryByText('facts.entailed')).toBeNull();
    expect(row.getByRole('button', { name: 'facts.yes' })).toBeEnabled();
    expect(row.getByRole('button', { name: 'facts.no' })).toBeEnabled();
  });
});
