/**
 * @jest-environment node
 *
 * Άγκυρα — **ΤΟ ΣΥΜΒΟΛΑΙΟ ΤΗΣ ΣΥΝΔΡΟΜΗΣ** (ADR-848): τίποτα δεν γράφεται που δεν ελέγχθηκε,
 * και ο πελάτης δεν πιστεύει ποτέ ένα σώμα επειδή «έτυχε να έχει `ok`».
 */

import {
  emailsAreOn,
  parseEmailSubscriptionChange,
  parseSubscriptionResponse,
  parseSubscriptionState,
} from '@/lib/notifications/email-subscription-contract';

describe('Α — αλλαγές: κλειστό σύνολο', () => {
  it.each(['unsubscribe', 'daily'] as const)('δέχεται %s', (kind) => {
    expect(parseEmailSubscriptionChange({ kind })).toEqual({ kind });
  });

  it('δέχεται restore ΜΟΝΟ με έγκυρη κατάσταση', () => {
    const state = { emailEnabled: true, emailFrequency: 'weekly' };
    expect(parseEmailSubscriptionChange({ kind: 'restore', state })).toEqual({ kind: 'restore', state });
    expect(parseEmailSubscriptionChange({ kind: 'restore', state: { emailEnabled: true, emailFrequency: 'hourly' } })).toBeNull();
    expect(parseEmailSubscriptionChange({ kind: 'restore' })).toBeNull();
  });

  it.each([null, 'unsubscribe', {}, { kind: 'delete' }, { kind: 'restore', state: 'x' }])(
    'απορρίπτει %p',
    (raw) => {
      expect(parseEmailSubscriptionChange(raw)).toBeNull();
    },
  );

  it('🔴 ΠΕΤΑ ό,τι επιπλέον έστειλε ο αιτών — γράφεται μόνο ό,τι ελέγχθηκε', () => {
    const parsed = parseEmailSubscriptionChange({
      kind: 'restore',
      state: { emailEnabled: true, emailFrequency: 'daily', globalEnabled: false },
    });
    expect(parsed).toEqual({ kind: 'restore', state: { emailEnabled: true, emailFrequency: 'daily' } });
  });
});

describe('Β — κατάσταση', () => {
  it('το `disabled` σημαίνει «κλειστά», όποιο κι αν είναι το emailEnabled', () => {
    expect(emailsAreOn({ emailEnabled: true, emailFrequency: 'disabled' })).toBe(false);
    expect(emailsAreOn({ emailEnabled: false, emailFrequency: 'daily' })).toBe(false);
    expect(emailsAreOn({ emailEnabled: true, emailFrequency: 'realtime' })).toBe(true);
  });

  it('απορρίπτει άγνωστη συχνότητα και μη-boolean', () => {
    expect(parseSubscriptionState({ emailEnabled: 'yes', emailFrequency: 'daily' })).toBeNull();
    expect(parseSubscriptionState({ emailEnabled: true, emailFrequency: 'monthly' })).toBeNull();
  });
});

describe('📧 Τ — ADR-849: η αλλαγή `type`', () => {
  it('Τ1 — δέχεται γνωστούς, μη υποχρεωτικούς τύπους με γνωστή κατάσταση', () => {
    expect(
      parseEmailSubscriptionChange({ kind: 'type', settings: ['properties.demandListingMatch'], mode: 'off' }),
    ).toEqual({ kind: 'type', settings: ['properties.demandListingMatch'], mode: 'off' });
  });

  it.each([
    ['υποχρεωτικό', { kind: 'type', settings: ['security.newDeviceLogin'], mode: 'off' }],
    ['άγνωστο κλειδί', { kind: 'type', settings: ['properties.ghost'], mode: 'off' }],
    ['prototype', { kind: 'type', settings: ['properties.__proto__'], mode: 'off' }],
    ['κενή λίστα', { kind: 'type', settings: [], mode: 'off' }],
    ['άγνωστη κατάσταση', { kind: 'type', settings: ['properties.demandListingMatch'], mode: 'maybe' }],
    ['όχι λίστα', { kind: 'type', settings: 'properties.demandListingMatch', mode: 'off' }],
  ])('🔴 απορρίπτει %s', (_label, raw) => {
    expect(parseEmailSubscriptionChange(raw)).toBeNull();
  });

  it('Τ2 — η κατάσταση ΧΩΡΙΣ `mutedTypes` δεν είναι πλήρης κατάσταση', () => {
    expect(parseSubscriptionState({ emailEnabled: true, emailFrequency: 'daily' })).toBeNull();
    expect(
      parseSubscriptionState({ emailEnabled: true, emailFrequency: 'daily', mutedTypes: ['properties.demandListingMatch'] }),
    ).toEqual({ emailEnabled: true, emailFrequency: 'daily', mutedTypes: ['properties.demandListingMatch'] });
  });
});

describe('Γ — η απάντηση όπως τη διαβάζει ο πελάτης', () => {
  const state = { emailEnabled: false, emailFrequency: 'daily', mutedTypes: [] };

  it('επιτυχία μόνο με ΔΥΟ έγκυρες καταστάσεις', () => {
    expect(parseSubscriptionResponse({ ok: true, previous: state, current: state })).toEqual({
      ok: true,
      previous: state,
      current: state,
    });
    expect(parseSubscriptionResponse({ ok: true, previous: state })).toEqual({ ok: false, reason: 'write-failed' });
  });

  it('γνωστός κωδικός αποτυχίας περνά αυτούσιος· άγνωστος γίνεται write-failed', () => {
    expect(parseSubscriptionResponse({ ok: false, reason: 'link-invalid' })).toEqual({ ok: false, reason: 'link-invalid' });
    expect(parseSubscriptionResponse({ ok: false, reason: 'teapot' })).toEqual({ ok: false, reason: 'write-failed' });
    expect(parseSubscriptionResponse('<html>502</html>')).toEqual({ ok: false, reason: 'write-failed' });
  });
});
