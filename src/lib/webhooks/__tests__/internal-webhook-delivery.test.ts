/**
 * @jest-environment node
 *
 * ADR-905 §6.4 — το λεξικό της παράδοσης: ποια απάντηση τελειώνει, ποια αρνείται, ποια λέει «ξαναέλα».
 */

import { IDEMPOTENCY_TTL_MS } from '@/lib/api/idempotency/idempotency-contract';

import {
  INTERNAL_WEBHOOK_MAX_EVENT_AGE_SECONDS,
  isInternalWebhookEventExpired,
  judgeInternalWebhookDelivery,
} from '../internal-webhook-delivery';

describe('judgeInternalWebhookDelivery', () => {
  it.each([200, 201, 204, 299])('%i ⇒ delivered', (status) => {
    expect(judgeInternalWebhookDelivery(status)).toBe('delivered');
  });

  it.each([400, 401, 403, 404, 409, 422, 499])('%i ⇒ refused (η επανάληψη δίνει την ίδια απάντηση)', (status) => {
    expect(judgeInternalWebhookDelivery(status)).toBe('refused');
  });

  it.each([408, 425, 429])('%i ⇒ retry («όχι τώρα», όχι «όχι»)', (status) => {
    expect(judgeInternalWebhookDelivery(status)).toBe('retry');
  });

  it.each([500, 502, 503, 504, 599])('%i ⇒ retry', (status) => {
    expect(judgeInternalWebhookDelivery(status)).toBe('retry');
  });

  it.each([0, 100, 302, 600])('απρόσμενο %i ⇒ retry (το άγνωστο δεν χάνει γεγονός)', (status) => {
    expect(judgeInternalWebhookDelivery(status)).toBe('retry');
  });
});

describe('isInternalWebhookEventExpired', () => {
  const published = '2026-10-05T10:00:00.000Z';
  const publishedSeconds = Date.parse(published) / 1000;

  it('ακριβώς στο όριο ⇒ ζωντανό · ένα δευτερόλεπτο μετά ⇒ ληγμένο', () => {
    expect(isInternalWebhookEventExpired(published, publishedSeconds + INTERNAL_WEBHOOK_MAX_EVENT_AGE_SECONDS)).toBe(false);
    expect(isInternalWebhookEventExpired(published, publishedSeconds + INTERNAL_WEBHOOK_MAX_EVENT_AGE_SECONDS + 1)).toBe(true);
  });

  it('ρολόι πίσω από τη δημοσίευση ⇒ ζωντανό', () => {
    expect(isInternalWebhookEventExpired(published, publishedSeconds - 60)).toBe(false);
  });

  it('μη αναγνώσιμη στιγμή ⇒ ζωντανό (δεν πετάμε γεγονός άγνωστης ηλικίας)', () => {
    expect(isInternalWebhookEventExpired('', publishedSeconds)).toBe(false);
    expect(isInternalWebhookEventExpired('not-a-date', publishedSeconds)).toBe(false);
  });

  it('ΑΓΚΥΡΑ: το ταβάνι δεν ξεπερνά το παράθυρο ιδεμποτίας του αποδέκτη', () => {
    expect(INTERNAL_WEBHOOK_MAX_EVENT_AGE_SECONDS * 1000).toBeLessThanOrEqual(IDEMPOTENCY_TTL_MS);
  });
});
