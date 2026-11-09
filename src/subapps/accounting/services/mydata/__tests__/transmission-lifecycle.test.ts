/**
 * Κύκλος ζωής διαβίβασης: πίνακας μεταβάσεων + ιδεμποτία της πόρτας (μέσω του ψεύτικου καναλιού).
 */

import {
  canTransitionMyDataStatus,
  createDraftMyDataMeta,
  isMyDataTransmittable,
} from '../mydata-status-transitions';
import { buildMyDataInvoicePayload } from '../mydata-payload-builder';
import type { MyDataInvoicePayload } from '../mydata-payload.types';
import { FakeTransmissionChannel } from './fake-transmission-channel';
import { makeInvoice } from './mydata-fixtures';

function validPayload(): MyDataInvoicePayload {
  const result = buildMyDataInvoicePayload({ invoice: makeInvoice(), correlatedMarks: [] });
  if (!result.ok) throw new Error('fixture must be transmittable');
  return result.payload;
}

describe('mydata status transitions', () => {
  it('επιτρεπτές μεταβάσεις', () => {
    expect(canTransitionMyDataStatus('draft', 'sent')).toBe(true);
    expect(canTransitionMyDataStatus('sent', 'accepted')).toBe(true);
    expect(canTransitionMyDataStatus('sent', 'rejected')).toBe(true);
    expect(canTransitionMyDataStatus('rejected', 'sent')).toBe(true);
    expect(canTransitionMyDataStatus('accepted', 'cancelled')).toBe(true);
  });

  it('απαγορευμένες: κανείς δεν «γίνεται» αποδεκτός χωρίς αποστολή, κανείς δεν βγαίνει από την ακύρωση', () => {
    expect(canTransitionMyDataStatus('draft', 'accepted')).toBe(false);
    expect(canTransitionMyDataStatus('accepted', 'sent')).toBe(false);
    expect(canTransitionMyDataStatus('cancelled', 'draft')).toBe(false);
    expect(canTransitionMyDataStatus('cancelled', 'sent')).toBe(false);
  });

  it('διαβιβάσιμα: μόνο draft και rejected', () => {
    expect(isMyDataTransmittable('draft')).toBe(true);
    expect(isMyDataTransmittable('rejected')).toBe(true);
    expect(isMyDataTransmittable('sent')).toBe(false);
    expect(isMyDataTransmittable('accepted')).toBe(false);
  });

  it('η αρχική κατάσταση είναι καθαρό draft', () => {
    expect(createDraftMyDataMeta()).toEqual({
      status: 'draft', mark: null, uid: null, authCode: null, submittedAt: null, respondedAt: null, errorMessage: null,
    });
  });
});

describe('InvoiceTransmissionChannel — ιδεμποτία (ψεύτικο κανάλι)', () => {
  it('ίδιο κλειδί ⇒ ίδιος ΜΑΡΚ, μία μόνο καταχώριση', async () => {
    const channel = new FakeTransmissionChannel();
    const first = await channel.submit(validPayload(), 'key-1');
    const retry = await channel.submit(validPayload(), 'key-1');
    expect(retry).toEqual(first);
    expect(channel.registrationCount).toBe(1);
  });

  it('άλλο κλειδί ⇒ νέα καταχώριση', async () => {
    const channel = new FakeTransmissionChannel();
    const a = await channel.submit(validPayload(), 'key-a');
    const b = await channel.submit(validPayload(), 'key-b');
    expect(a.status === 'accepted' && b.status === 'accepted' && a.mark !== b.mark).toBe(true);
    expect(channel.registrationCount).toBe(2);
  });

  it('προσωρινή αποτυχία δεν δεσμεύει το κλειδί: η επανάληψη ξαναπροσπαθεί', async () => {
    let calls = 0;
    const channel = new FakeTransmissionChannel('einvoicing_provider', () => {
      calls += 1;
      return calls === 1
        ? { status: 'unavailable', retryable: true, reason: 'timeout' }
        : { status: 'accepted', mark: '400000000000009', uid: null, authenticationCode: null, qrCodeUrl: 'https://qr' };
    });
    expect((await channel.submit(validPayload(), 'key-x')).status).toBe('unavailable');
    expect((await channel.submit(validPayload(), 'key-x')).status).toBe('accepted');
    expect((await channel.submit(validPayload(), 'key-x')).status).toBe('accepted');
    expect(calls).toBe(2);
  });

  it('ακύρωση: ίδιο κλειδί ⇒ ίδιο αποτέλεσμα', async () => {
    const channel = new FakeTransmissionChannel();
    const first = await channel.cancel('400000000000001', 'cancel-1');
    expect(await channel.cancel('400000000000001', 'cancel-1')).toEqual(first);
  });
});
