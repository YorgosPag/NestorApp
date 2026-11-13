/**
 * @jest-environment node
 *
 * ADR-ACC-030 §5.8 #6 — ο ΕΝΑΣ ορισμός της διάγνωσης μιας έναρξης στον πάροχο: ωμές τιμές χρόνου, διάρκεια ζωής
 * με το ρολόι του παρόχου, απόκλιση από το δικό μας ρολόι. Κλείνει το «35′ ή 15′ / ζώνη ώρας;».
 */

import { startedCheckoutDiagnostics, type StartedCheckout } from '../payment-provider';

const started = (createdAt: string | null, expiresAt: string | null): StartedCheckout => ({
  providerReference: null,
  launch: { kind: 'redirect', url: 'https://pay.test/x' },
  providerExpiresAt: null,
  providerClock: { createdAt, expiresAt },
});

describe('startedCheckoutDiagnostics', () => {
  it('διάρκεια ζωής από τις δύο ωμές τιμές του παρόχου· οι ωμές τιμές περνούν αυτούσιες', () => {
    const diagnostics = startedCheckoutDiagnostics(
      started('2025-10-02T16:05:32+0200', '2025-10-02T16:20:32+0200'), '2025-10-02T14:05:31.400Z',
    );
    expect(diagnostics).toMatchObject({
      providerCreatedAtRaw: '2025-10-02T16:05:32+0200',
      providerExpiresAtRaw: '2025-10-02T16:20:32+0200',
      providerLifetimeSeconds: 900,
      providerClockSkewSeconds: 1,
    });
  });

  it('λάθος ζώνη ώρας στον πάροχο ⇒ απόκλιση ακέραιων ωρών, η διάρκεια ζωής μένει σωστή', () => {
    const diagnostics = startedCheckoutDiagnostics(
      started('2025-10-02T16:05:32+0000', '2025-10-02T16:40:32+0000'), '2025-10-02T14:05:32.000Z',
    );
    expect(diagnostics).toMatchObject({ providerLifetimeSeconds: 2100, providerClockSkewSeconds: 7200 });
  });

  it('χωρίς τιμές από τον πάροχο ⇒ null, ποτέ NaN', () => {
    expect(startedCheckoutDiagnostics(started(null, null), '2025-10-02T14:05:32.000Z')).toMatchObject({
      providerLifetimeSeconds: null, providerClockSkewSeconds: null,
    });
  });
});
