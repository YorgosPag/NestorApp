/**
 * Ο εκτελεστής παραδίδει τον **σωστό καλούντα** — ADR-742 §7.8
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΜΟΝΑΔΙΚΗ ΔΟΥΛΕΙΑ ΑΥΤΗΣ ΤΗΣ ΣΟΥΙΤΑΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * Όλη η απόφαση αποκάλυψης της οικογένειας `api/rfqs/[id]/**` κρέμεται από
 * **μία** μεταβλητή: το `ctx.globalRole` που ο εκτελεστής παραδίδει στη
 * χαρτογράφηση. Ένα καρφωμένο `'super_admin'` εκεί θα άνοιγε ξανά το μαντείο
 * ύπαρξης για **όλες** τις διαδρομές — και **κάθε άλλο test θα έμενε πράσινο**,
 * γιατί τα υπόλοιπα ελέγχουν τη *συνάρτηση* χαρτογράφησης, όχι ποιος της
 * δίνει τον ρόλο.
 *
 * Ίδιο σχήμα με το `domain-route-ctx.test.ts` της Φάσης Β.
 */

jest.mock('next/server', () => {
  class MockNextResponse {
    static json(body: unknown, init?: { status?: number }) {
      return { status: init?.status ?? 200, json: async () => body };
    }
  }
  return { NextResponse: MockNextResponse, NextRequest: class {} };
});

/** Ο ρόλος που θα φορέσει ο «συνδεδεμένος» χρήστης σε κάθε test. */
var currentRole = 'company_admin';

jest.mock('@/lib/auth', () => ({
  withAuth:
    (callback: (...args: unknown[]) => Promise<unknown>) =>
    async (request: unknown) =>
      callback(request, { uid: 'u1', companyId: 'co1', globalRole: currentRole }, {
        cache: true,
      }),
}));

import type { NextRequest } from 'next/server';
import { rfqIdRoute } from '../rfq-id-route';
import {
  PROCUREMENT_RESOURCE,
  ProcurementCrossTenantError,
} from '@/subapps/procurement/services/procurement-ownership';

interface Envelope {
  status: number;
  json: () => Promise<Record<string, unknown>>;
}

const seg = { params: Promise.resolve({ id: 'rfq_42' }) };
const req = {} as NextRequest;

const denial = () =>
  new ProcurementCrossTenantError({
    resource: PROCUREMENT_RESOURCE.RFQ,
    resourceId: 'rfq_42',
    expectedCompanyId: 'co1',
    actualCompanyId: 'co2',
  });

const throwingRoute = rfqIdRoute({
  run: async () => {
    throw denial();
  },
});

describe('rfqIdRoute — ο ρόλος του πραγματικού καλούντα φτάνει στη χαρτογράφηση', () => {
  it('🔴 κανονικός ρόλος → μεταμφιεσμένο 404 (ΟΧΙ καρφωμένος bypass)', async () => {
    currentRole = 'company_admin';
    const res = (await throwingRoute(req, seg)) as Envelope;
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('RFQ rfq_42 not found');
  });

  it('bypass ρόλος → ειλικρινές 403', async () => {
    currentRole = 'super_admin';
    const res = (await throwingRoute(req, seg)) as Envelope;
    expect(res.status).toBe(403);
  });

  it('🔴 ο ίδιος εκτελεστής δίνει ΔΙΑΦΟΡΕΤΙΚΟ αποτέλεσμα ανά ρόλο — άρα δεν είναι καρφωμένος', async () => {
    currentRole = 'viewer';
    const asViewer = (await throwingRoute(req, seg)) as Envelope;
    currentRole = 'super_admin';
    const asBypass = (await throwingRoute(req, seg)) as Envelope;

    expect(asViewer.status).not.toBe(asBypass.status);
  });

  it('παραδίδει το `[id]` του path στο επιχειρησιακό βήμα', async () => {
    currentRole = 'company_admin';
    const seen: string[] = [];
    const route = rfqIdRoute({
      run: async ({ id, ctx }) => {
        seen.push(id, ctx.companyId);
        return { status: 200, json: async () => ({}) } as never;
      },
    });
    await route(req, seg);
    expect(seen).toEqual(['rfq_42', 'co1']);
  });

  it('`exposeCode` περνά στη χαρτογράφηση μόνο όταν το ζητά η διαδρομή', async () => {
    currentRole = 'company_admin';
    const err = Object.assign(new Error('PO_EXISTS'), { code: 'PO_EXISTS' });
    const withCode = rfqIdRoute({ exposeCode: true, run: async () => { throw err; } });
    const without = rfqIdRoute({ run: async () => { throw err; } });

    expect(((await withCode(req, seg)) as Envelope).status).toBe(409);
    expect(((await without(req, seg)) as Envelope).status).toBe(400);
  });
});
