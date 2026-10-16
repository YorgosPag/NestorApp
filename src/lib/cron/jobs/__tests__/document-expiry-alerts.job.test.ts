/**
 * @jest-environment node
 *
 * ⚓ ADR-915 §17 — ο ημερήσιος φρουρός του πίνακα κεντρικών εκδόσεων ΕΝΦΙΑ.
 *
 * **Το ερώτημα**: *«μετά τον Απρίλιο, χωρίς γραμμή για το έτος, το μαθαίνει κανείς — ή κάθε πιστοποιητικό ΕΝΦΙΑ γίνεται
 * σιωπηλά "άγνωστη λήξη";»*
 *
 * 🔴 Μετάλλαξη: `enfiaTableIsMissing` → `return false` ⇒ Σ1 κόκκινο. Η σάρωση είναι mock: εδώ κρίνεται ο φρουρός.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const mockErrors: string[] = [];

jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => ({}) }));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ error: (message: string) => mockErrors.push(message), info: () => undefined, warn: () => undefined }),
}));
jest.mock('@/services/document-registry/registry-expiry-alerts.server', () => ({
  sweepRegistryExpiryAlerts: async () => ({ considered: 1, notified: 0, skipped: 1, failed: 0, incomplete: 0, truncated: false }),
}));

import { runDocumentExpiryAlerts } from '../document-expiry-alerts.job';

describe('document-expiry-alerts — φρουρός ΕΝΦΙΑ (ADR-915 §17)', () => {
  const at = (iso: string) => jest.spyOn(Date, 'now').mockReturnValue(new Date(iso).getTime());
  beforeEach(() => {
    mockErrors.length = 0;
  });
  afterEach(() => jest.restoreAllMocks());

  it('Σ1 έτος χωρίς γραμμή, μετά τον Απρίλιο ⇒ σφάλμα + μετρική, και η σάρωση τρέχει κανονικά', async () => {
    at('2023-05-02T09:00:00Z');
    const result = await runDocumentExpiryAlerts();
    expect(result.metrics?.enfiaCentralIssuanceMissing).toBe(1);
    expect(result.summary).toContain('ENFIA_CENTRAL_ISSUANCE_MISSING');
    expect(result.metrics?.considered).toBe(1);
    expect(mockErrors).toHaveLength(1);
  });

  it('Σ2 νωρίς μέσα στο έτος (αναμένεται ακόμη) ⇒ σιωπή', async () => {
    at('2023-02-01T09:00:00Z');
    const result = await runDocumentExpiryAlerts();
    expect(result.metrics?.enfiaCentralIssuanceMissing).toBe(0);
    expect(mockErrors).toEqual([]);
  });

  it('Σ3 γνωστό έτος ⇒ σιωπή', async () => {
    at('2026-10-16T09:00:00Z');
    expect((await runDocumentExpiryAlerts()).metrics?.enfiaCentralIssuanceMissing).toBe(0);
  });
});
