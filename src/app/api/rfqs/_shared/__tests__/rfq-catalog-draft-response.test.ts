/**
 * @jest-environment node
 *
 * ADR-923 §5.13 Τ6 — η απόκριση του `GET /api/rfqs/from-catalog`: `private, no-store` σε ΚΑΘΕ κλάδο, άρνηση με τον κωδικό
 * της, και 500 με γενικό μήνυμα για ό,τι άλλο (ποτέ το ωμό εσωτερικό κείμενο).
 */

jest.mock('server-only', () => ({}));
const mockDraft = jest.fn();
jest.mock('@/subapps/procurement/services/rfq-catalog-draft', () => ({ draftRfqFromCatalog: (...a: unknown[]) => mockDraft(...a) }));
jest.mock('@/lib/telemetry', () => ({ createModuleLogger: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }) }));
// Ίδιο σκεπτικό με το `rfq-error-response.test.ts`: το `next/server` θέλει Web APIs που λείπουν από το node του jest.
jest.mock('next/server', () => {
  class MockNextResponse {
    static json(body: unknown, init?: { status?: number }) {
      return { status: init?.status ?? 200, json: async () => body, headers: new Headers() };
    }
  }
  return { NextResponse: MockNextResponse, NextRequest: class {} };
});

/* eslint-disable import/first -- τα mocks πρέπει να δηλωθούν πριν φορτωθούν οι μονάδες */
import type { AuthContext } from '@/lib/auth';
import { PRIVATE_NO_STORE } from '@/lib/http/cache-control';
import { RfqCreateRefusal } from '@/subapps/procurement/types/rfq-create-refusal';
import { rfqCatalogDraftResponse } from '../rfq-catalog-draft-response';
/* eslint-enable import/first */

const ctx = { uid: 'u', companyId: 'comp_buyer' } as unknown as AuthContext;
const VALID = 'comp_a.cpmod_1.v1';

beforeEach(() => mockDraft.mockReset());

describe('rfqCatalogDraftResponse', () => {
  it('επιτυχία ⇒ 200, το πρόχειρο, private no-store', async () => {
    mockDraft.mockResolvedValue({ description: 'x' });
    const res = await rfqCatalogDraftResponse(ctx, VALID);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe(PRIVATE_NO_STORE);
    expect(await res.json()).toEqual({ success: true, data: { description: 'x' } });
  });

  it('άκυρη διεύθυνση ⇒ 400 χωρίς κλήση, private no-store', async () => {
    const res = await rfqCatalogDraftResponse(ctx, 'a.b');
    expect(res.status).toBe(400);
    expect(res.headers.get('Cache-Control')).toBe(PRIVATE_NO_STORE);
    expect(mockDraft).not.toHaveBeenCalled();
  });

  it('άρνηση ⇒ ο κωδικός και η κατάστασή της, private no-store', async () => {
    mockDraft.mockRejectedValue(new RfqCreateRefusal('supplierNotAcceptingQuotes', 'comp_a'));
    const res = await rfqCatalogDraftResponse(ctx, VALID);
    expect(res.status).toBe(409);
    expect(res.headers.get('Cache-Control')).toBe(PRIVATE_NO_STORE);
    expect(await res.json()).toMatchObject({ errorCode: 'supplierNotAcceptingQuotes' });
  });

  it('🔒 οποιοδήποτε άλλο σφάλμα ⇒ 500 με γενικό μήνυμα, χωρίς το εσωτερικό κείμενο', async () => {
    mockDraft.mockRejectedValue(new Error('FAILED_PRECONDITION: index projects/secret-project/…'));
    const res = await rfqCatalogDraftResponse(ctx, VALID);
    expect(res.status).toBe(500);
    expect(res.headers.get('Cache-Control')).toBe(PRIVATE_NO_STORE);
    const body = JSON.stringify(await res.json());
    expect(body).not.toContain('secret-project');
    expect(body).not.toContain('errorCode');
  });
});
