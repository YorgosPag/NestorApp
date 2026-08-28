/**
 * @fileoverview **ADR-824 Φάση 4 — Η ΑΝΑΓΝΩΣΗ ΕΧΕΙ ΤΟΝ ΙΔΙΟ ΦΡΟΥΡΟ ΜΕ ΤΗ ΓΡΑΦΗ.**
 * @related ADR-824 §8 Κ8 · app/api/owner-properties/brokered/route.ts
 *
 * 🔴 **ΑΥΤΟ ΕΙΝΑΙ ΑΣΦΑΛΕΙΑ, ΣΕ ΑΝΤΙΘΕΣΗ ΜΕ ΤΙΣ ΑΓΚΥΡΕΣ ΤΗΣ ΟΘΟΝΗΣ.** Μέχρι τις
 * 2026-08-28 το `GET` ήταν σκέτο `withAuth`: **οποιοδήποτε** μέλος **οποιουδήποτε**
 * γραφείου έπαιρνε `200`. Το κρύψιμο του μενού δεν κλείνει τίποτα — όποιος
 * πληκτρολογούσε τη διεύθυνση, ή έστελνε ένα αίτημα, έπαιρνε τον κατάλογο.
 *
 * 🔑 **Ο κριτής είναι ΠΡΑΓΜΑΤΙΚΟΣ εδώ** (`requireBrokerageCapability` δεν είναι mock):
 * μια δοκιμή που μιμείται και τον κριτή θα επιβεβαίωνε **τον εαυτό της**. Ψεύτικος
 * είναι μόνο ο **αναγνώστης της βάσης**.
 */

jest.mock('next/server', () => {
  class MockNextResponse {
    readonly status: number;
    private readonly body: unknown;
    constructor(body: unknown, init?: { status?: number }) {
      this.body = body;
      this.status = init?.status ?? 200;
    }
    async json(): Promise<unknown> {
      return this.body;
    }
    static json(body: unknown, init?: { status?: number }): MockNextResponse {
      return new MockNextResponse(body, init);
    }
  }
  return { NextResponse: MockNextResponse, NextRequest: class {} };
});

jest.mock('@/lib/middleware/with-rate-limit', () => ({
  withStandardRateLimit: <T>(h: T) => h,
}));

const authContext = { uid: 'user_1', companyId: 'comp_alfa', isAuthenticated: true as const };

jest.mock('@/lib/auth/middleware', () => ({
  withAuth:
    (callback: (...args: unknown[]) => Promise<unknown>) =>
    async (request: unknown) =>
      callback(request, authContext),
}));

jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => ({}) }));

const readCapabilities = jest.fn();
jest.mock('@/services/company/company-capabilities.reader', () => ({
  readCompanyCapabilities: (...args: unknown[]) => readCapabilities(...args),
}));

const readCatalog = jest.fn(async () => ({ rows: [], tally: {}, truncated: false }));
jest.mock('@/services/mandate/mandate-catalog.service', () => ({
  readMandateCatalog: (...args: unknown[]) => readCatalog(...args),
}));

jest.mock('@/services/mandate/brokered-listing.service', () => ({
  createBrokeredListing: jest.fn(),
  agencyAttestation: jest.fn(),
  OWNER_CONSENT_PROOF: {},
}));

jest.mock('@/services/company/company-public-name.reader', () => ({
  readCompanyPublicName: jest.fn(async () => 'Γραφείο'),
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

import { GET } from '../route';
import type { CapabilityStatus } from '@/types/organization-capability';

/** Το έγγραφο της εταιρείας, όπως το επιστρέφει ο στενός αναγνώστης. */
function capabilitiesWith(status: CapabilityStatus): Record<string, unknown> {
  return { brokerage_listings: { status } };
}

interface Answer {
  readonly status: number;
  readonly body: { error?: string; capabilityStatus?: string; rows?: unknown[] };
}

async function callGet(): Promise<Answer> {
  const response = (await (GET as (r: unknown) => Promise<unknown>)({})) as {
    status: number;
    json: () => Promise<Answer['body']>;
  };
  return { status: response.status, body: await response.json() };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Κ8 — GET /api/owner-properties/brokered', () => {
  /**
   * ⛔ ΜΕΤΑΛΛΑΞΗ: σβήσε τις δύο γραμμές του φρουρού από τον `catalogHandler`
   *    (επιστροφή στο σκέτο `withAuth`) ⇒ κόκκινο και στις τρεις καταστάσεις.
   */
  it.each([['unrequested'], ['pending'], ['revoked']] as const)(
    'Κ8.1 — «%s» ⇒ 403, και ο κατάλογος ΔΕΝ διαβάζεται καν',
    async (status) => {
      readCapabilities.mockResolvedValue(capabilitiesWith(status));

      const answer = await callGet();

      expect(answer.status).toBe(403);
      expect(answer.body.error).toBe('BROKERAGE_NOT_ALLOWED');
      expect(answer.body.capabilityStatus).toBe(status);
      // 🔑 Η άρνηση είναι και **φθηνή**: καμία ανάγνωση της συλλογής.
      expect(readCatalog).not.toHaveBeenCalled();
    },
  );

  /**
   * ⛔ ΜΕΤΑΛΛΑΞΗ: κάνε την **απουσία** ικανοτήτων να διαβάζεται ως άδεια
   *    (π.χ. `readCompanyCapabilities` επιστρέφει `{}` ⇒ πέρασε) ⇒ κόκκινο.
   */
  it('Κ8.2 — γραφείο ΧΩΡΙΣ καμία εγγραφή ικανότητας ⇒ 403 «unrequested»', async () => {
    readCapabilities.mockResolvedValue(undefined);

    const answer = await callGet();

    expect(answer.status).toBe(403);
    expect(answer.body.capabilityStatus).toBe('unrequested');
  });

  /**
   * 🔴 **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ** — χωρίς αυτόν, ένας φρουρός που απαντά **πάντα** 403 περνά,
   * και το γραφείο με άδεια θα έχανε τον κατάλογό του χωρίς κανείς να το δει.
   */
  it('Κ8.3 — «active» ⇒ 200 και ο κατάλογος διαβάζεται κανονικά', async () => {
    readCapabilities.mockResolvedValue(capabilitiesWith('active'));

    const answer = await callGet();

    expect(answer.status).toBe(200);
    expect(answer.body.rows).toEqual([]);
    expect(readCatalog).toHaveBeenCalledTimes(1);
  });

  /**
   * ⚠️ **Η ΕΜΒΕΛΕΙΑ ΔΕΝ ΕΡΧΕΤΑΙ ΠΟΤΕ ΑΠΟ ΤΟ ΔΙΚΤΥΟ.** Κανένα `?companyId=` δεν
   * υπάρχει· η μόνη πηγή είναι το `ctx.companyId` του `withAuth`.
   *
   * ⛔ ΜΕΤΑΛΛΑΞΗ: πέρασε στο `readMandateCatalog` οτιδήποτε άλλο ⇒ κόκκινο.
   */
  it('Κ8.4 — η εμβέλεια είναι το γραφείο του συνδεδεμένου, πάντα', async () => {
    readCapabilities.mockResolvedValue(capabilitiesWith('active'));

    await callGet();

    expect(readCatalog).toHaveBeenCalledWith(expect.anything(), 'comp_alfa', expect.any(String));
  });
});
