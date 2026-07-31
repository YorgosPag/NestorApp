/**
 * Το σύνορο αποκάλυψης της παλιάς οικογένειας `api/rfqs/[id]/**` — ADR-742 Ομάδα 2
 *
 * 🔴 Ο πυρήνας είναι ο ίδιος ισχυρισμός με το `procurement-error-outcome`, αλλά
 * σε **άλλο σχήμα σύρματος**: αν η μεταμφίεση αντέγραφε το σχήμα της άλλης
 * οικογένειας, **το σχήμα και μόνο** θα πρόδιδε τη διαφορά (ADR-742 §7.1).
 * Γι' αυτό η σύγκριση γίνεται σε ολόκληρο το σώμα **και** τον κωδικό, με
 * `toEqual` — όχι «μοιάζει».
 */

// Ίδιο σκεπτικό με τις αδελφές σουίτες `adr603-*.route.test.ts`: το
// `next/server` απαιτεί Web APIs που δεν υπάρχουν στο περιβάλλον node του jest.
jest.mock('next/server', () => {
  class MockNextResponse {
    static json(body: unknown, init?: { status?: number }) {
      return { status: init?.status ?? 200, json: async () => body };
    }
  }
  return { NextResponse: MockNextResponse, NextRequest: class {} };
});

import { rfqErrorResponse, rfqNotFoundResponse } from '../rfq-error-response';
import {
  PROCUREMENT_RESOURCE,
  ProcurementCrossTenantError,
  procurementNotFound,
} from '@/subapps/procurement/services/procurement-ownership';

const SUBJECT = { resource: PROCUREMENT_RESOURCE.RFQ, resourceId: 'rfq_42' } as const;
const BYPASS_ROLE = 'super_admin';
const NORMAL_ROLE = 'company_admin';

const crossTenant = () =>
  new ProcurementCrossTenantError({
    ...SUBJECT,
    expectedCompanyId: 'co1',
    actualCompanyId: 'co2',
  });

/** Ό,τι φεύγει στο σύρμα: κωδικός **και** ολόκληρο το σώμα. */
async function wire(res: Response) {
  return { status: res.status, body: await res.json() };
}

// ============================================================================
// 🔴 Ο ΠΥΡΗΝΑΣ
// ============================================================================

describe('η ταυτότητα γνήσιου και μεταμφιεσμένου', () => {
  it('🔴 κανονικός χρήστης: «ανήκει αλλού» είναι ΙΣΟ με «δεν υπάρχει»', async () => {
    const genuine = await wire(
      rfqErrorResponse(procurementNotFound(SUBJECT), { callerGlobalRole: NORMAL_ROLE }),
    );
    const disguised = await wire(
      rfqErrorResponse(crossTenant(), { callerGlobalRole: NORMAL_ROLE }),
    );

    expect(disguised).toEqual(genuine);
    expect(disguised).toEqual({
      status: 404,
      body: { success: false, error: 'RFQ rfq_42 not found' },
    });
  });

  it('η μεταμφίεση ακολουθεί ΤΟ ΣΧΗΜΑ ΑΥΤΗΣ της οικογένειας', async () => {
    const { body } = await wire(rfqErrorResponse(crossTenant(), { callerGlobalRole: NORMAL_ROLE }));
    // `{ success, error }` — όχι το `httpError` σχήμα του `api/procurement/**`.
    expect(Object.keys(body).sort()).toEqual(['error', 'success']);
  });

  it('η λέξη «Forbidden» δεν φεύγει ποτέ σε κανονικό χρήστη', async () => {
    const { body } = await wire(rfqErrorResponse(crossTenant(), { callerGlobalRole: NORMAL_ROLE }));
    expect(JSON.stringify(body)).not.toContain('Forbidden');
  });
});

// ============================================================================
// Ο ΚΑΝΟΝΑΣ ΑΠΟΚΑΛΥΨΗΣ
// ============================================================================

describe('ο κανόνας αποκάλυψης', () => {
  it('bypass ρόλος: ειλικρινές 403', async () => {
    expect(await wire(rfqErrorResponse(crossTenant(), { callerGlobalRole: BYPASS_ROLE }))).toEqual({
      status: 403,
      body: { success: false, error: 'Forbidden' },
    });
  });

  it.each(['company_admin', 'project_manager', 'viewer', '', 'unknown_role'])(
    'μη-bypass ρόλος «%s» δεν παίρνει ποτέ 403',
    async (role) => {
      const { status } = await wire(rfqErrorResponse(crossTenant(), { callerGlobalRole: role }));
      expect(status).toBe(404);
    },
  );
});

// ============================================================================
// ΤΙ ΔΕΝ ΜΕΤΑΜΦΙΕΖΕΤΑΙ
// ============================================================================

describe('όσα ο χρήστης δικαιούται να μάθει μένουν ανέπαφα', () => {
  it('🔴 PO_EXISTS: μαρτυρά ότι ο πόρος υπάρχει ΚΑΙ σου ανήκει — 409, χωρίς μεταμφίεση', async () => {
    const err = Object.assign(new Error('PO_EXISTS'), { code: 'PO_EXISTS' });
    expect(
      await wire(rfqErrorResponse(err, { callerGlobalRole: NORMAL_ROLE, exposeCode: true })),
    ).toEqual({
      status: 409,
      body: { success: false, error: 'PO_EXISTS', code: 'PO_EXISTS' },
    });
  });

  it('σφάλμα μετάβασης κατάστασης μένει 400 με το μήνυμά του', async () => {
    const { status, body } = await wire(
      rfqErrorResponse(new Error("Cannot cancel RFQ in status closed"), {
        callerGlobalRole: NORMAL_ROLE,
      }),
    );
    expect(status).toBe(400);
    expect(body.error).toBe('Cannot cancel RFQ in status closed');
  });

  it('χωρίς `exposeCode` δεν διαρρέει πεδίο `code`', async () => {
    const err = Object.assign(new Error('boom'), { code: 'SOMETHING' });
    const { body } = await wire(rfqErrorResponse(err, { callerGlobalRole: NORMAL_ROLE }));
    expect(body).not.toHaveProperty('code');
  });
});

describe('rfqNotFoundResponse — το γνήσιο της GET', () => {
  it('χωρίς όρισμα δίνει το ιστορικό σώμα της διαδρομής', async () => {
    expect(await wire(rfqNotFoundResponse())).toEqual({
      status: 404,
      body: { success: false, error: 'Not found' },
    });
  });
});
