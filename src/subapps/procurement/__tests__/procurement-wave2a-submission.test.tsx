/**
 * @file ADR-598 «(θ)» — κύμα 2α, υπόλοιπα του procurement πάνω στο SSoT υποβολής:
 *
 * - Α1: αίτημα ανανέωσης — αποτυχία αποστολής ⇒ ΟΡΑΤΗ (πριν: `try/finally` χωρίς `catch` = αθόρυβη).
 * - Α2: Enter στο «Θέμα» ΔΕΝ στέλνει — πάει στο κείμενο· Ctrl+Enter στο κείμενο στέλνει ΜΙΑ φορά.
 * - Γ1: νέα γραμμή RFQ — Enter ⇒ ΜΙΑ προσθήκη με ποσότητα-αριθμό· το κουμπί λέει «Προσθήκη Γραμμής».
 * - Γ2: διαγραφή γραμμής — κουμπί ΜΕ όνομα· αποτυχία ⇒ ορατό toast (πριν: αθόρυβη).
 * - Π1: προσκλήσεις — μερική αποτυχία ⇒ μένουν επιλεγμένοι ΜΟΝΟ όσοι απέτυχαν· η επανάληψη
 *       στέλνει ΜΟΝΟ σε αυτούς (πριν: `Promise.all` ⇒ διπλές προσκλήσεις στους επιτυχημένους).
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
const toastError = jest.fn();
jest.mock('sonner', () => ({ toast: { error: (...a: unknown[]) => toastError(...a), success: jest.fn() } }));
jest.mock('@/subapps/procurement/components/TradeSelector', () => ({
  TradeSelector: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input aria-label="trade" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

import { QuoteRenewalRequestDialog } from '../components/QuoteRenewalRequestDialog';
import { RfqLinesPanel } from '../components/RfqLinesPanel';
import { VendorInviteDialog } from '../components/VendorInviteDialog';
import type { RfqLine } from '../types/rfq-line';
import type { CreateInviteInput, CreateInviteOutput, VendorContactOption } from '../hooks/useVendorInvites';

beforeEach(() => toastError.mockReset());

describe('QuoteRenewalRequestDialog', () => {
  const render_ = (onSend: jest.Mock) =>
    render(
      <QuoteRenewalRequestDialog
        open
        vendorEmail="v@x.gr"
        vendorName="V"
        rfqTitle="R"
        quoteNumber="Q-1"
        validUntilDate="1/1"
        total="100"
        senderName="S"
        onSend={onSend}
        onCancel={jest.fn()}
      />,
    );

  it('Α1: αποτυχία αποστολής ⇒ ορατό σφάλμα, κουμπί ξεκλείδωτο', async () => {
    render_(jest.fn(async () => { throw new Error('SMTP 550'); }));
    fireEvent.click(screen.getByRole('button', { name: 'rfqs.expiry.renewal.sendButton' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('SMTP 550');
    expect(screen.getByRole('button', { name: 'rfqs.expiry.renewal.sendButton' })).toBeEnabled();
  });

  it('Α2: Enter στο θέμα ΔΕΝ στέλνει (εστίαση στο κείμενο)· Ctrl+Enter στο κείμενο ⇒ ΜΙΑ αποστολή', async () => {
    const onSend = jest.fn(async () => undefined);
    render_(onSend);
    const subject = screen.getByLabelText('rfqs.expiry.renewal.subjectLabel');
    const body = screen.getByLabelText('rfqs.expiry.renewal.bodyLabel');
    fireEvent.keyDown(subject, { key: 'Enter' });
    expect(onSend).not.toHaveBeenCalled();
    expect(body).toHaveFocus();

    act(() => {
      fireEvent.keyDown(body, { key: 'Enter', ctrlKey: true });
      fireEvent.keyDown(body, { key: 'Enter', ctrlKey: true });
    });
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
    expect(onSend).toHaveBeenCalledWith('v@x.gr', 'rfqs.expiry.renewal.subjectDefault', 'rfqs.expiry.renewal.bodyDefault');
  });
});

describe('RfqLinesPanel', () => {
  const LINE = { id: 'l1', description: 'Σκυρόδεμα', trade: 'concrete', quantity: 10, unit: 'm3' } as unknown as RfqLine;

  it('Γ1: Enter ⇒ ΜΙΑ προσθήκη· ποσότητα αριθμός· κουμπί «Προσθήκη Γραμμής»', async () => {
    const onAdd = jest.fn(async () => LINE);
    render(<RfqLinesPanel rfqId="r1" lines={[]} loading={false} onAdd={onAdd} onDelete={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'rfqs.addLine' }));
    expect(screen.queryByRole('button', { name: 'rfqs.submit' })).not.toBeInTheDocument();

    const description = screen.getByLabelText('rfqs.lineDescription') as HTMLInputElement;
    fireEvent.change(description, { target: { value: ' Οπλισμός ' } });
    const quantity = screen.getByLabelText('rfqs.lineQuantity');
    fireEvent.change(quantity, { target: { value: '2.5' } });
    fireEvent.blur(quantity);
    act(() => { pressEnterToSubmit(description); pressEnterToSubmit(description); });
    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ description: 'Οπλισμός', quantity: 2.5, source: 'ad_hoc' }));
  });

  it('Γ2: διαγραφή — κουμπί με όνομα· αποτυχία ⇒ ορατό toast', async () => {
    const onDelete = jest.fn(async () => { throw new Error('permission-denied'); });
    render(<RfqLinesPanel rfqId="r1" lines={[LINE]} loading={false} onAdd={jest.fn()} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole('button', { name: 'rfqs.deleteLine' }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('permission-denied'));
    expect(screen.getByRole('button', { name: 'rfqs.deleteLine' })).toBeEnabled();
  });
});

describe('VendorInviteDialog', () => {
  const CONTACTS = [
    { id: 'a', displayName: 'Άλφα', email: 'a@x.gr' },
    { id: 'b', displayName: 'Βήτα', email: 'b@x.gr' },
  ] as unknown as VendorContactOption[];

  it('Π1: μερική αποτυχία ⇒ η επανάληψη στέλνει ΜΟΝΟ στους αποτυχημένους', async () => {
    let firstRound = true;
    const onCreate = jest.fn(async (dto: CreateInviteInput): Promise<CreateInviteOutput> => {
      if (firstRound && dto.vendorContactId === 'b') throw new Error('bounce');
      return { inviteId: 'i', portalUrl: '', delivery: { success: true, errorReason: null } };
    });
    const onOpenChange = jest.fn();
    render(
      <VendorInviteDialog
        rfqId="r1"
        rfq={null}
        open
        onOpenChange={onOpenChange}
        vendorContacts={CONTACTS}
        contactsLoading={false}
        alreadyInvitedIds={new Set()}
        onCreate={onCreate}
      />,
    );
    fireEvent.click(screen.getByRole('checkbox', { name: /Άλφα/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Βήτα/ }));
    fireEvent.click(screen.getByRole('button', { name: 'rfqs.invite.sendButton' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('rfqs.invite.errors.partialFailed');
    expect(onCreate).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('checkbox', { name: /Άλφα/ })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Βήτα/ })).toBeChecked();

    firstRound = false;
    fireEvent.click(screen.getByRole('button', { name: 'rfqs.invite.sendButton' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onCreate).toHaveBeenCalledTimes(3);
    expect(onCreate).toHaveBeenLastCalledWith(expect.objectContaining({ vendorContactId: 'b' }));
  });
});
