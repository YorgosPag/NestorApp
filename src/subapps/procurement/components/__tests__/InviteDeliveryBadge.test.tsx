/**
 * **Η κατάσταση παράδοσης στον πίνακα του αγοραστή** (ADR-923 §5.13 Τ5): κάθε κατάσταση του καθολικού έχει **δικό της**
 * κείμενο (μη χρωματικό κανάλι, WCAG 1.4.1), τα κλειδιά υπάρχουν σε el **και** en, και ο παραλήπτης δεν εμφανίζεται ποτέ.
 */

import { render, screen } from '@testing-library/react';

jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

/* eslint-disable import/first -- τα mocks πρέπει να δηλωθούν πριν φορτωθούν οι μονάδες */
import el from '@/i18n/locales/el/quotes.json';
import en from '@/i18n/locales/en/quotes.json';

import {
  INVITE_UNDELIVERABLE_REASONS,
  claimedInviteDelivery,
  deferredInviteDelivery,
  deliveredInviteDelivery,
  pendingInviteDelivery,
  rejectedInviteDelivery,
  undeliverableInviteDelivery,
  unknownInviteDelivery,
  type VendorInviteDelivery,
} from '../../types/vendor-invite-delivery';
import { INVITE_DELIVERY_DISPLAY_STATUSES, inviteDeliveryDisplay } from '../../utils/invite-delivery-display';
import { InviteDeliveryBadge } from '../InviteDeliveryBadge';
/* eslint-enable import/first */

const NOW = Date.parse('2026-11-04T10:00:00.000Z');
const pending = pendingInviteDelivery(NOW);
const claimed = claimedInviteDelivery(pending, NOW);

const CASES: ReadonlyArray<readonly [string, VendorInviteDelivery, string]> = [
  ['νέα, δεν δοκιμάστηκε', pending, 'queued'],
  ['πρώτη απόπειρα σε εξέλιξη', claimed, 'queued'],
  ['ο πάροχος αρνήθηκε, νέα απόπειρα αργότερα', rejectedInviteDelivery(claimed, 'provider_rejected', NOW), 'retrying'],
  ['δεύτερη απόπειρα σε εξέλιξη', claimedInviteDelivery({ ...pending, attempts: 1 }, NOW), 'retrying'],
  ['παραδόθηκε', deliveredInviteDelivery(claimed, 'platform', NOW), 'sent'],
  ['γεμάτο ημερήσιο όριο ⇒ αναβολή ως αύριο', deferredInviteDelivery(claimed, NOW), 'deferred'],
  ['εξαντλήθηκαν οι απόπειρες', { ...claimed, state: 'failed', attempts: 5 }, 'failed'],
  ['δεν θα σταλεί ποτέ', undeliverableInviteDelivery(claimed, 'recipient_quota', NOW), 'notSent'],
  ['η διεργασία πέθανε στη μέση', unknownInviteDelivery(claimed, NOW), 'unknown'],
];

type Delivery = { statuses: Record<string, string>; reasons: Record<string, string> };
const deliveryTexts = (bundle: unknown): Delivery => (bundle as { invites: { delivery: Delivery } }).invites.delivery;

describe('inviteDeliveryDisplay — η κατάσταση του καθολικού με όνομα', () => {
  it.each(CASES)('%s ⇒ %s', (_label, delivery, expected) => {
    expect(inviteDeliveryDisplay(delivery)?.status).toBe(expected);
  });

  it('χειρόγραφη ή παλιά πρόσκληση (χωρίς καθολικό) ⇒ τίποτα', () => {
    expect(inviteDeliveryDisplay(undefined)).toBeNull();
  });

  it('μόνο το «δεν στάλθηκε» φέρει λόγο', () => {
    expect(inviteDeliveryDisplay(undeliverableInviteDelivery(claimed, 'rfq_closed', NOW))).toEqual({ status: 'notSent', reason: 'rfq_closed' });
    expect(inviteDeliveryDisplay(rejectedInviteDelivery(claimed, 'provider_rejected', NOW))?.reason).toBeNull();
  });
});

describe('InviteDeliveryBadge', () => {
  it.each(CASES)('%s ⇒ δικό του κείμενο και εικονίδιο', (_label, delivery, expected) => {
    const { container } = render(<InviteDeliveryBadge delivery={delivery} />);
    expect(screen.getByText(`invites.delivery.statuses.${expected}`)).toBeTruthy();
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('καμία κατάσταση δεν μοιράζεται κείμενο με άλλη, σε καμία γλώσσα (WCAG 1.4.1)', () => {
    for (const bundle of [el, en]) {
      const texts = INVITE_DELIVERY_DISPLAY_STATUSES.map((status) => deliveryTexts(bundle).statuses[status]);
      expect(texts.every((text) => typeof text === 'string' && text !== '')).toBe(true);
      expect(new Set(texts).size).toBe(texts.length);
      for (const reason of INVITE_UNDELIVERABLE_REASONS) expect(deliveryTexts(bundle).reasons[reason]).toBeTruthy();
    }
  });

  it('«δεν στάλθηκε» δείχνει τον λόγο', () => {
    render(<InviteDeliveryBadge delivery={undeliverableInviteDelivery(claimed, 'no_recipient', NOW)} />);
    expect(screen.getByText('invites.delivery.reasons.no_recipient')).toBeTruthy();
  });

  it('🔒 δεν δείχνει ποτέ διεύθυνση, ούτε αν κάποιο πεδίο τη φέρει', () => {
    const tainted = { ...deliveredInviteDelivery(claimed, 'platform', NOW), recipient: 'quotes@aries.gr' } as VendorInviteDelivery;
    const { container } = render(<InviteDeliveryBadge delivery={tainted} />);
    expect(container.textContent).not.toContain('@');
  });

  it('χωρίς καθολικό δεν αποδίδει τίποτα', () => {
    const { container } = render(<InviteDeliveryBadge delivery={undefined} />);
    expect(container.innerHTML).toBe('');
  });
});
