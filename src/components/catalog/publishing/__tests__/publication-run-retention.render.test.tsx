/**
 * ADR-923 §5.6.1 — η διατήρηση στην οθόνη: ο άνθρωπος βλέπει πότε σβήνεται το PDF, και τα κουμπιά ακολουθούν την κρίση του διακομιστή.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { deletePublicationPdf, setPublicationLegalHold } from '@/services/catalog/catalog-publishing-api.client';
import { EMPTY_PUBLICATION_RETENTION, type PublicationRetention, type PublicationRunWire } from '@/subapps/catalog/types/publication';
import { PublicationRunRetention } from '../PublicationRunRetention';

jest.setTimeout(60_000);

jest.mock('@/auth/hooks/useCapability', () => ({ useCapability: () => ({ pending: false, verdict: 'granted-by-role' }) }));
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));
jest.mock('@/providers/NotificationProvider', () => ({
  useNotifications: () => ({ success: jest.fn(), error: jest.fn(), warning: jest.fn() }),
}));
jest.mock('@/services/catalog/catalog-publishing-api.client', () => ({
  deletePublicationPdf: jest.fn(async () => ({})),
  setPublicationLegalHold: jest.fn(async () => ({})),
}));

const run = (retention: Partial<PublicationRetention>, patch: Partial<PublicationRunWire> = {}) => ({
  id: 'r1',
  status: 'ready',
  artifacts: [{ sha256: 'abcdef0123456789' }],
  dispositionDueAt: null,
  retention: { ...EMPTY_PUBLICATION_RETENTION, ...retention },
  ...patch,
}) as unknown as PublicationRunWire;

const revalidate = jest.fn(async () => undefined);

beforeEach(() => jest.clearAllMocks());

describe('PublicationRunRetention', () => {
  it('έκδοση που δεν κατέβηκε: διαγράφεται με επιβεβαίωση, και η όψη ανανεώνεται', async () => {
    render(<PublicationRunRetention run={run({})} revalidate={revalidate} />);
    fireEvent.click(screen.getByRole('button', { name: 'publishing.retention.delete' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'publishing.retention.delete' }).at(-1) as HTMLElement);
    await waitFor(() => expect(deletePublicationPdf).toHaveBeenCalledWith('r1'));
    await waitFor(() => expect(revalidate).toHaveBeenCalled());
  });

  it('έκδοση που κατέβηκε: καμία διαγραφή, και η ημερομηνία λέγεται από πριν', () => {
    render(<PublicationRunRetention run={run({ downloadCount: 1 }, { dispositionDueAt: '2031-12-31T22:00:00.000Z' })} revalidate={revalidate} />);
    expect(screen.queryByRole('button', { name: 'publishing.retention.delete' })).toBeNull();
    expect(screen.getByText('publishing.retention.scheduled')).toBeInTheDocument();
  });

  it('η δέσμευση θέλει λόγο πριν σταλεί', async () => {
    render(<PublicationRunRetention run={run({})} revalidate={revalidate} />);
    fireEvent.click(screen.getByRole('button', { name: 'publishing.retention.hold' }));
    const confirm = screen.getAllByRole('button', { name: 'publishing.retention.hold' }).at(-1) as HTMLElement;
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText('publishing.retention.holdReason'), { target: { value: ' δίκη ' } });
    fireEvent.click(confirm);
    await waitFor(() => expect(setPublicationLegalHold).toHaveBeenCalledWith('r1', { act: 'place', reason: 'δίκη' }));
  });

  it('σε δέσμευση: άρση αντί για διαγραφή', async () => {
    render(<PublicationRunRetention run={run({ legalHold: { placedBy: 'u', placedAt: 't', reason: 'δίκη' } })} revalidate={revalidate} />);
    expect(screen.queryByRole('button', { name: 'publishing.retention.delete' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'publishing.retention.release' }));
    await waitFor(() => expect(setPublicationLegalHold).toHaveBeenCalledWith('r1', { act: 'release' }));
  });

  it('μετά τη διάθεση μένει μόνο η απόδειξη, χωρίς πράξεις', () => {
    const disposal = { disposedAt: '2026-01-01T00:00:00.000Z', disposedBy: 'u', cause: 'manual', ruleId: 'r' } as const;
    render(<PublicationRunRetention run={run({ disposal })} revalidate={revalidate} />);
    expect(screen.getByText('publishing.retention.disposed')).toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('έκδοση που δεν είναι έτοιμη δεν δείχνει τίποτα', () => {
    const { container } = render(<PublicationRunRetention run={run({}, { status: 'failed' })} revalidate={revalidate} />);
    expect(container).toBeEmptyDOMElement();
  });
});
