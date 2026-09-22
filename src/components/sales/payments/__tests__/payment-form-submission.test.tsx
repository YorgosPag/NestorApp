/**
 * @file ADR-598 «(θ)» — κύμα 2α: οι διάλογοι πληρωμών πάνω στο SSoT `useFormSubmission` +
 * `FormActions`. Ελέγχει ΣΥΜΠΕΡΙΦΟΡΑ, όχι δομή:
 *
 * - Π1: καταγραφή πληρωμής — δύο Enter στο ίδιο tick ⇒ ΜΙΑ κλήση· επιτυχία ⇒ κλείσιμο.
 * - Π2: `onRecord` ΠΕΤΑ ⇒ ορατό σφάλμα και το κουμπί ΔΕΝ μένει κολλημένο (πριν: μόνιμο «υποβάλλεται»).
 * - Π3: ποσό 0 ⇒ μήνυμα εγκυρότητας ΜΕΣΑ στον διάλογο, καμία κλήση.
 * - Π4: `{ success:false, error }` ⇒ ο λόγος αυτούσιος ως alert (§3.1 αμετάβλητη).
 * - Δ1: δόση (ενεργό πλάνο, μόνο σημειώσεις) — Enter ⇒ ΜΙΑ ενημέρωση· `onUpdate` πετά ⇒ ξεκλείδωτο.
 * - Ο1: οδηγός — Enter στο βήμα προτύπου ΠΡΟΧΩΡΑ (δεν δημιουργεί)· Enter στο τελευταίο ⇒ ΜΙΑ δημιουργία.
 * - Ο2: οδηγός — `onCreate` πετά ⇒ ορατό σφάλμα, ξεκλείδωτο (πριν: μόνιμο «υποβάλλεται»).
 * - Λ1: δάνειο — χωρίς τράπεζα δεν υποβάλλεται· με τράπεζα ⇒ ΜΙΑ κλήση, χωρίς ωμό `'Error'`.
 * - Λ2: εκταμίευση — Enter ⇒ ΜΙΑ κλήση· αποτυχία ⇒ alert με το fallback.
 * - Μ1/Μ2: μοντέλα — δόσεις από πρότυπο αθροίζουν στο σύνολο · κανόνες εγκυρότητας δόσης.
 */

import * as React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { pressEnterToSubmit } from '@/test-utils/implicit-submission';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () =>
    jest
      .requireActual<typeof import('@/test-utils/i18n-mock')>('@/test-utils/i18n-mock')
      .keyEchoTranslation(),
}));
const notify = { success: jest.fn(), error: jest.fn() };
jest.mock('@/providers/NotificationProvider', () => ({ useNotifications: () => notify }));
jest.mock('@/components/banking/BankSelector', () => ({
  ...jest.requireActual<typeof import('@/components/banking/BankSelector')>('@/components/banking/BankSelector'),
  BankSelector: ({ value, onChange }: { value: string; onChange: (code: string, bank?: { name: string }) => void }) => (
    <input aria-label="bank" value={value} onChange={(e) => onChange(e.target.value, e.target.value ? { name: e.target.value } : undefined)} />
  ),
}));

import { RecordPaymentDialog } from '../RecordPaymentDialog';
import { EditInstallmentDialog } from '../EditInstallmentDialog';
import { CreatePaymentPlanWizard } from '../CreatePaymentPlanWizard';
import { AddLoanDialog } from '../AddLoanDialog';
import { LoanDisbursementsTab } from '../LoanActivityTabs';
import { computeInstallments, installmentsMatchTotal } from '../payment-plan-wizard-model';
import { validateInstallment, initialInstallmentFields } from '../edit-installment-model';
import { PAYMENT_PLAN_TEMPLATES } from '@/config/payment-plan-templates';
import type { ActionResult } from '@/lib/mutations/gateway-action';
import type { Installment } from '@/types/payment-plan';
import type { LoanTracking } from '@/types/loan-tracking';

const echo = (key: string) => key;

function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void } {
  let resolve: (v: T) => void = () => undefined;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

const INSTALLMENT = {
  index: 0,
  label: 'Προκαταβολή',
  type: 'down_payment',
  amount: 1000,
  paidAmount: 0,
  percentage: 10,
  dueDate: '2026-10-01T00:00:00.000Z',
  notes: null,
} as unknown as Installment;

beforeEach(() => {
  notify.success.mockReset();
  notify.error.mockReset();
});

describe('RecordPaymentDialog', () => {
  const render_ = (onRecord: jest.Mock, onOpenChange = jest.fn()) =>
    render(<RecordPaymentDialog open onOpenChange={onOpenChange} installment={INSTALLMENT} paymentPlanId="pp1" onRecord={onRecord} />);

  it('Π1: δύο Enter στο ίδιο tick ⇒ ΜΙΑ κλήση· επιτυχία ⇒ κλείσιμο', async () => {
    const gate = deferred<ActionResult>();
    const onRecord = jest.fn(() => gate.promise);
    const onOpenChange = jest.fn();
    render_(onRecord, onOpenChange);
    const field = screen.getByLabelText('labels.notes') as HTMLTextAreaElement;
    act(() => { pressEnterToSubmit(field); pressEnterToSubmit(field); });
    expect(onRecord).toHaveBeenCalledTimes(1);
    expect(onRecord).toHaveBeenCalledWith(expect.objectContaining({ paymentPlanId: 'pp1', installmentIndex: 0, amount: 1000 }));
    await act(async () => { gate.resolve({ success: true }); });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(notify.success).toHaveBeenCalledTimes(1);
  });

  it('Π2: onRecord ΠΕΤΑ ⇒ alert και το κουμπί ξεκλειδώνει', async () => {
    render_(jest.fn(async () => { throw new Error('network down'); }));
    fireEvent.click(screen.getByRole('button', { name: 'dialog.confirm' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('network down');
    expect(screen.getByRole('button', { name: 'dialog.confirm' })).toBeEnabled();
  });

  it('Π3: ποσό 0 ⇒ μήνυμα εγκυρότητας μέσα στον διάλογο, καμία κλήση', async () => {
    const onRecord = jest.fn();
    render_(onRecord);
    fireEvent.change(screen.getByLabelText('labels.amount (€)'), { target: { value: '' } });
    fireEvent.blur(screen.getByLabelText('labels.amount (€)'));
    fireEvent.click(screen.getByRole('button', { name: 'dialog.confirm' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('errors.invalidAmount');
    expect(onRecord).not.toHaveBeenCalled();
  });

  it('Π4: { success:false, error } ⇒ ο λόγος αυτούσιος· χωρίς λόγο ⇒ το fallback', async () => {
    const onRecord = jest.fn()
      .mockResolvedValueOnce({ success: false, error: 'V-PAY-002' })
      .mockResolvedValueOnce({ success: false });
    render_(onRecord);
    fireEvent.click(screen.getByRole('button', { name: 'dialog.confirm' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('V-PAY-002');
    fireEvent.click(screen.getByRole('button', { name: 'dialog.confirm' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('errors.paymentFailed'));
  });
});

describe('EditInstallmentDialog', () => {
  it('Δ1: σημειώσεις σε ενεργό πλάνο — Enter ⇒ ΜΙΑ ενημέρωση· αποτυχία ⇒ ξεκλείδωτο', async () => {
    const onUpdate = jest.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ success: true });
    const onOpenChange = jest.fn();
    render(
      <EditInstallmentDialog
        open
        onOpenChange={onOpenChange}
        mode="edit"
        planStatus="active"
        installment={INSTALLMENT}
        totalInstallments={1}
        onAdd={jest.fn()}
        onUpdate={onUpdate}
        onDelete={jest.fn()}
      />,
    );
    const notes = screen.getByLabelText('labels.notes') as HTMLTextAreaElement;
    fireEvent.change(notes, { target: { value: 'νέα σημείωση' } });
    act(() => { pressEnterToSubmit(notes); pressEnterToSubmit(notes); });
    expect(await screen.findByRole('alert')).toHaveTextContent('offline');
    expect(onUpdate).toHaveBeenCalledTimes(1);

    const submit = screen.getByRole('button', { name: 'dialog.confirm' });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onUpdate).toHaveBeenLastCalledWith(0, { notes: 'νέα σημείωση' });
  });
});

describe('CreatePaymentPlanWizard', () => {
  const render_ = (onCreate: jest.Mock) =>
    render(
      <CreatePaymentPlanWizard
        open
        onOpenChange={jest.fn()}
        propertyId="u1"
        buildingId="b1"
        projectId="p1"
        ownerContactId="c1"
        ownerName="Αγοραστής"
        suggestedAmount={100000}
        onCreate={onCreate}
      />,
    );

  it('Ο1: Enter στο βήμα προτύπου ΠΡΟΧΩΡΑ· Enter στο τελευταίο ⇒ ΜΙΑ δημιουργία', async () => {
    const onCreate = jest.fn(async () => ({ success: true }));
    render_(onCreate);
    const total = screen.getByLabelText('wizard.totalAmount') as HTMLInputElement;
    act(() => { pressEnterToSubmit(total); });
    expect(onCreate).not.toHaveBeenCalled();

    const create = await screen.findByRole('button', { name: 'wizard.reviewAndCreate' });
    const form = create.closest('[role="dialog"]')?.querySelector('form');
    const firstAmount = form?.querySelector('input') as HTMLInputElement;
    act(() => { pressEnterToSubmit(firstAmount); pressEnterToSubmit(firstAmount); });
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ totalAmount: 100000, taxRate: 24 }));
  });

  it('Ο2: onCreate ΠΕΤΑ ⇒ alert, κουμπί ξεκλείδωτο· «Πίσω» (όχι «Ακύρωση») στο 2ο βήμα', async () => {
    render_(jest.fn(async () => { throw new Error('quota'); }));
    fireEvent.click(screen.getByRole('button', { name: 'wizard.nextStep' }));
    expect(await screen.findByRole('button', { name: 'wizard.previousStep' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'wizard.reviewAndCreate' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('quota');
    expect(screen.getByRole('button', { name: 'wizard.reviewAndCreate' })).toBeEnabled();
  });
});

describe('AddLoanDialog', () => {
  it('Λ1: χωρίς τράπεζα δεν υποβάλλεται· με τράπεζα ⇒ ΜΙΑ κλήση· αποτυχία ⇒ fallback, όχι «Error»', async () => {
    const onAdd = jest.fn(async () => ({ success: false }));
    render(<AddLoanDialog open onOpenChange={jest.fn()} onAdd={onAdd} existingCount={0} />);
    const submit = screen.getByRole('button', { name: 'loanTracking.addLoan' });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText('bank'), { target: { value: 'Alpha' } });
    act(() => { fireEvent.click(submit); fireEvent.click(submit); });
    expect(await screen.findByRole('alert')).toHaveTextContent('loanTracking.errors.addFailed');
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledWith({ bankName: 'Alpha', isPrimary: true, disbursementType: 'lump_sum' });
  });
});

describe('LoanDisbursementsTab', () => {
  it('Λ2: Enter ⇒ ΜΙΑ εκταμίευση· αποτυχία ⇒ alert με το fallback', async () => {
    const onDisburse = jest.fn(async () => ({ success: false }));
    const loan = { disbursements: [], communicationLog: [] } as unknown as LoanTracking;
    render(<LoanDisbursementsTab loan={loan} onDisburse={onDisburse} onDone={jest.fn()} t={echo} />);
    const amount = screen.getByLabelText('labels.amount') as HTMLInputElement;
    fireEvent.change(amount, { target: { value: '5000' } });
    fireEvent.blur(amount);
    const milestone = screen.getByLabelText('loanTracking.milestone') as HTMLInputElement;
    fireEvent.change(milestone, { target: { value: 'Θεμελίωση' } });
    act(() => { pressEnterToSubmit(milestone); pressEnterToSubmit(milestone); });
    expect(await screen.findByRole('alert')).toHaveTextContent('loanTracking.errors.saveFailed');
    expect(onDisburse).toHaveBeenCalledTimes(1);
    expect(onDisburse).toHaveBeenCalledWith(expect.objectContaining({ amount: 5000, milestone: 'Θεμελίωση' }));
  });
});

describe('καθαρά μοντέλα', () => {
  it('Μ1: οι δόσεις από ΚΑΘΕ πρότυπο αθροίζουν ακριβώς στο σύνολο', () => {
    for (const template of PAYMENT_PLAN_TEMPLATES) {
      const installments = computeInstallments(template, 123456.78, new Date('2026-01-15T00:00:00Z'));
      expect(installments).toHaveLength(template.slots.length);
      expect(installmentsMatchTotal(installments, 123456.78)).toBe(true);
    }
  });

  it('Μ2: κανόνες εγκυρότητας δόσης — ίδιοι με πριν, ανά κλάδο', () => {
    const empty = initialInstallmentFields('add');
    expect(validateInstallment(empty, false, false, echo)).toBe('errors.invalidLabel');
    expect(validateInstallment({ ...empty, label: 'Χ' }, false, false, echo)).toBe('errors.invalidAmount');
    expect(validateInstallment({ ...empty, label: 'Χ', amount: 5 }, false, false, echo)).toBe('errors.invalidDueDate');
    expect(validateInstallment({ ...empty, amount: 0 }, true, true, echo)).toBeNull();
    expect(validateInstallment({ ...empty, amount: 0 }, true, false, echo)).toBe('errors.invalidAmount');
  });
});
