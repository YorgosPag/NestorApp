/**
 * @file ADR-598 «(η)» — κύμα 1: οι χειρόγραφες υποβολές του procurement πάνω στο SSoT
 * `useFormSubmission` + `FormActions`. Ελέγχει ΣΥΜΠΕΡΙΦΟΡΑ, όχι δομή:
 *
 * - Μ1: Enter δύο φορές στο ίδιο tick ⇒ ΕΝΑ αίτημα· επιτυχία ⇒ κλείσιμο + πλοήγηση.
 * - Μ2: σφάλμα server ⇒ το μήνυμα του server (όχι ωμό σώμα) ορατό ως `alert`, κουμπί ξεκλείδωτο.
 * - Ρ1: ακύρωση RFQ (draft) ⇒ σωστό payload.
 * - Ρ2: αποτυχία ⇒ ορατό σφάλμα και ο διάλογος ΔΕΝ κολλάει σε «υποβάλλεται».
 * - Α1: κατακύρωση χωρίς κατηγορία ⇒ ούτε η υποβολή της φόρμας (δρόμος χωρίς κουμπί) περνά.
 * - Σ1: σχόλιο — δύο Ctrl+Enter ⇒ ΕΝΑ σχόλιο· το πεδίο αδειάζει.
 * - Σ2: αποτυχία σχολίου ⇒ ορατή (πριν: απόρριψη χωρίς χειρισμό), το κείμενο μένει.
 * - Κ1: σάρωση — επιτυχία ⇒ πλοήγηση ΚΑΙ το κουμπί μένει κλειδωμένο (`keepLockedOnSuccess`).
 * - Κ2: σάρωση — σφάλμα server ⇒ μήνυμα του server, κουμπί ξεκλείδωτο.
 */

import * as React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { pressEnterToSubmit } from '@/test-utils/implicit-submission';

const push = jest.fn();

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () =>
    jest
      .requireActual<typeof import('@/test-utils/i18n-mock')>('@/test-utils/i18n-mock')
      .keyEchoTranslation(),
}));
jest.mock('@/lib/workspace/navigation', () => ({ useRouter: () => ({ push, back: jest.fn() }) }));
// Σταθερό αντικείμενο, όπως το Next (νέο ανά render ⇒ το effect της σελίδας ξανατρέχει ⇒ ατέρμων βρόχος).
const searchParams = new URLSearchParams();
jest.mock('next/navigation', () => ({ useSearchParams: () => searchParams }));
jest.mock('@/components/procurement/POEntitySelectors', () => ({
  POProjectSelector: ({ id, value, onSelect }: { id: string; value: string; onSelect: (v: string) => void }) => (
    <input id={id} aria-label="project" value={value} onChange={(e) => onSelect(e.target.value)} />
  ),
  POSupplierSelector: ({ id, value, onSelect }: { id: string; value: string; onSelect: (v: string) => void }) => (
    <input id={id} aria-label="vendor" value={value} onChange={(e) => onSelect(e.target.value)} />
  ),
}));
jest.mock('@/subapps/procurement/components/TradeSelector', () => ({
  TradeSelector: ({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) => (
    <input id={id} aria-label="trade" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));
jest.mock('@/components/shared/files/FileUploadButton', () => ({
  FileUploadButton: ({ onFileSelect }: { onFileSelect: (f: File) => void }) => (
    <button type="button" onClick={() => onFileSelect(new File(['x'], 'q.pdf', { type: 'application/pdf' }))}>
      pick
    </button>
  ),
}));
jest.mock('@/auth/hooks/useAuth', () => ({ useAuth: () => ({ user: { uid: 'u1', displayName: 'Γιώργος' } }) }));
jest.mock('@/hooks/useMobile', () => ({ useIsMobile: () => false }));
jest.mock('@/lib/a11y/reveal-in-scroll', () => ({ revealInScroll: jest.fn() }));
const createComment = jest.fn();
jest.mock('@/services/quote-comment.service', () => ({
  quoteCommentService: {
    listComments: jest.fn(async () => []),
    createComment: (...args: unknown[]) => createComment(...args),
    editComment: jest.fn(),
    deleteComment: jest.fn(),
  },
  formatCommentDate: () => '',
}));

import { ManualQuoteDialog } from '../components/ManualQuoteDialog';
import { RfqCancelDialog } from '../components/RfqCancelDialog';
import { AwardReasonDialog } from '../components/AwardReasonDialog';
import { QuoteCommentsDrawer } from '../components/QuoteCommentsDrawer';
import ScanQuotePage from '@/app/(app)/o/[workspace]/procurement/quotes/scan/page';
import type { QuoteComparisonEntry } from '../types/comparison';

type FetchResult = { ok: boolean; status: number; body: unknown };

function mockFetch(...results: FetchResult[]): jest.Mock {
  const queue = [...results];
  const fn = jest.fn(async () => {
    const next = queue.shift() ?? results[results.length - 1];
    return { ok: next.ok, status: next.status, json: async () => next.body } as Response;
  });
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

function deferredFetch(): { fn: jest.Mock; resolve: (r: FetchResult) => void } {
  let resolve: (r: FetchResult) => void = () => undefined;
  const pending = new Promise<FetchResult>((r) => { resolve = r; });
  const fn = jest.fn(async () => {
    const next = await pending;
    return { ok: next.ok, status: next.status, json: async () => next.body } as Response;
  });
  global.fetch = fn as unknown as typeof fetch;
  return { fn, resolve };
}

beforeEach(() => {
  push.mockReset();
  createComment.mockReset();
});

describe('ManualQuoteDialog', () => {
  function fill() {
    fireEvent.change(screen.getByLabelText('project'), { target: { value: 'p1' } });
    fireEvent.change(screen.getByLabelText('trade'), { target: { value: 'concrete' } });
  }

  it('Μ1: δύο Enter στο ίδιο tick ⇒ ΕΝΑ αίτημα· επιτυχία ⇒ κλείσιμο + πλοήγηση', async () => {
    const { fn, resolve } = deferredFetch();
    const onOpenChange = jest.fn();
    render(<ManualQuoteDialog open onOpenChange={onOpenChange} vendorContactId="v1" />);
    fill();
    const field = screen.getByLabelText('project') as HTMLInputElement;
    act(() => { pressEnterToSubmit(field); pressEnterToSubmit(field); });
    expect(fn).toHaveBeenCalledTimes(1);

    await act(async () => { resolve({ ok: true, status: 200, body: { data: { id: 'q1' } } }); });
    await waitFor(() => expect(push).toHaveBeenCalledWith('/procurement/quotes/q1/review'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('Μ2: σφάλμα server ⇒ το ΜΗΝΥΜΑ του server ως alert, κουμπί ξεκλείδωτο', async () => {
    mockFetch({ ok: false, status: 409, body: { error: 'Η προσφορά υπάρχει ήδη' } });
    render(<ManualQuoteDialog open onOpenChange={jest.fn()} vendorContactId="v1" />);
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'quotes.create' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Η προσφορά υπάρχει ήδη');
    expect(screen.getByRole('button', { name: 'quotes.create' })).toBeEnabled();
    expect(push).not.toHaveBeenCalled();
  });
});

describe('RfqCancelDialog', () => {
  it('Ρ1: draft ⇒ υποβολή με το σωστό payload', async () => {
    const onConfirm = jest.fn(async () => undefined);
    render(<RfqCancelDialog open rfqStatus="draft" hasInvitedVendors={false} onConfirm={onConfirm} onCancel={jest.fn()} />);
    fireEvent.change(screen.getByLabelText('rfqs.cancelDialog.detailLabel'), { target: { value: '  λάθος  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'rfqs.cancelDialog.confirmCancel' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith({ reason: null, detail: 'λάθος', notifyVendors: false }));
  });

  it('Ρ2: αποτυχία ⇒ ορατό σφάλμα, ο διάλογος ΔΕΝ κολλάει', async () => {
    const onConfirm = jest.fn(async () => { throw new Error('Χωρίς σύνδεση'); });
    render(<RfqCancelDialog open rfqStatus="draft" hasInvitedVendors={false} onConfirm={onConfirm} onCancel={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'rfqs.cancelDialog.confirmCancel' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Χωρίς σύνδεση');
    expect(screen.getByRole('button', { name: 'rfqs.cancelDialog.confirmCancel' })).toBeEnabled();
  });
});

describe('AwardReasonDialog', () => {
  it('Α1: χωρίς κατηγορία ⇒ ούτε η υποβολή της φόρμας περνά (δρόμος χωρίς κουμπί)', () => {
    const onConfirm = jest.fn(async () => undefined);
    const entry = { quoteId: 'q1', vendorName: 'Α', total: 10 } as QuoteComparisonEntry;
    render(<AwardReasonDialog open entry={entry} cheapestEntry={null} onConfirm={onConfirm} onCancel={jest.fn()} />);
    const submit = screen.getByRole('button', { name: 'rfqs.awardReason.confirmButton' });
    expect(submit).toBeDisabled();
    const form = document.getElementById(submit.getAttribute('form') ?? '') as HTMLFormElement;
    fireEvent.submit(form);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('QuoteCommentsDrawer — νέο σχόλιο', () => {
  const comment = { id: 'c1', text: 'γεια', authorId: 'u1', authorName: 'Γιώργος', createdAt: '2026-09-22T00:00:00Z' };

  it('Σ1: δύο Ctrl+Enter ⇒ ΕΝΑ σχόλιο· το πεδίο αδειάζει', async () => {
    let release: (v: typeof comment) => void = () => undefined;
    createComment.mockImplementation(() => new Promise((r) => { release = r; }));
    render(<QuoteCommentsDrawer quoteId="q1" open onClose={jest.fn()} />);
    const box = await screen.findByRole('textbox', { name: 'rfqs.comments.composerLabel' });
    fireEvent.change(box, { target: { value: 'γεια' } });
    act(() => {
      fireEvent.keyDown(box, { key: 'Enter', ctrlKey: true });
      fireEvent.keyDown(box, { key: 'Enter', ctrlKey: true });
    });
    expect(createComment).toHaveBeenCalledTimes(1);
    await act(async () => { release(comment); });
    await waitFor(() => expect(box).toHaveValue(''));
  });

  it('Σ2: αποτυχία ⇒ ορατό σφάλμα, το κείμενο ΜΕΝΕΙ', async () => {
    createComment.mockRejectedValue(new Error('Απορρίφθηκε'));
    render(<QuoteCommentsDrawer quoteId="q1" open onClose={jest.fn()} />);
    const box = await screen.findByRole('textbox', { name: 'rfqs.comments.composerLabel' });
    fireEvent.change(box, { target: { value: 'γεια' } });
    fireEvent.click(screen.getByRole('button', { name: 'rfqs.comments.add' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Απορρίφθηκε');
    expect(box).toHaveValue('γεια');
  });
});

describe('ScanQuotePage', () => {
  function fillAll() {
    fireEvent.click(screen.getByRole('button', { name: 'pick' }));
    fireEvent.change(screen.getByLabelText('project'), { target: { value: 'p1' } });
    fireEvent.change(screen.getByLabelText('vendor'), { target: { value: 'v1' } });
    fireEvent.change(screen.getByLabelText('trade'), { target: { value: 'concrete' } });
  }

  it('Κ1: επιτυχία ⇒ πλοήγηση ΚΑΙ το κουμπί μένει κλειδωμένο', async () => {
    const fn = mockFetch({ ok: true, status: 200, body: { data: { quoteId: 'q9' } } });
    render(<ScanQuotePage />);
    fillAll();
    const submit = screen.getByRole('button', { name: 'quotes.scan.uploadAndScan' });
    fireEvent.click(submit);
    await waitFor(() => expect(push).toHaveBeenCalledWith('/procurement/quotes/q9/review'));
    const locked = screen.getByRole('button', { name: 'quotes.scan.uploading' });
    expect(locked).toBeDisabled();
    fireEvent.click(locked);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('Κ2: σφάλμα server ⇒ μήνυμα του server, κουμπί ξεκλείδωτο', async () => {
    mockFetch({ ok: false, status: 502, body: { error: 'Η υπηρεσία AI δεν απαντά' } });
    render(<ScanQuotePage />);
    fillAll();
    fireEvent.click(screen.getByRole('button', { name: 'quotes.scan.uploadAndScan' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Η υπηρεσία AI δεν απαντά');
    expect(screen.getByRole('button', { name: 'quotes.scan.uploadAndScan' })).toBeEnabled();
  });
});
