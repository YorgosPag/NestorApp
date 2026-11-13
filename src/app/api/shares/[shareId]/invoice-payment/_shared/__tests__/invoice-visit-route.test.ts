/**
 * @jest-environment node
 *
 * @fileoverview Ο σκελετός επίσκεψης των διαδρομών τιμολογίου (ADR-315 Α6 · ADR-ACC-018 §16).
 * @related app/api/shares/[shareId]/invoice-payment/_shared/invoice-visit-route.ts
 *
 * Φυλάσσεται ο κανόνας «ανανέωση **μόνο** μετά από θετική κρίση συνδέσμου»: επιτυχία ⇒ ανανέωση · `link-inactive` ⇒
 * σβήσιμο · κάθε άλλη άρνηση ⇒ τίποτα (αλλιώς το όριο ανάκλησης θα παρατεινόταν χωρίς κρίση).
 */

jest.mock('server-only', () => ({}));

jest.mock('next/server', () => {
  class MockNextResponse {
    readonly status: number;
    readonly headers: Record<string, string>;
    private readonly body: unknown;
    constructor(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
      this.body = body;
      this.status = init?.status ?? 200;
      this.headers = init?.headers ?? {};
    }
    async json(): Promise<unknown> {
      return this.body;
    }
    static json(body: unknown, init?: { status?: number; headers?: Record<string, string> }): MockNextResponse {
      return new MockNextResponse(body, init);
    }
  }
  return { NextResponse: MockNextResponse, NextRequest: class {} };
});

const grantMock = jest.fn();
const renewMock = jest.fn();
const clearMock = jest.fn();
jest.mock('@/server/sharing/share-access-grant', () => ({
  requestHasShareAccessGrant: (...args: unknown[]) => grantMock(...args),
  renewShareAccessGrant: (...args: unknown[]) => renewMock(...args),
  clearShareAccessGrant: (...args: unknown[]) => clearMock(...args),
}));

import type { NextRequest } from 'next/server';

import {
  grantedInvoiceShareId,
  invoiceVisitVerdictOf,
  respondInVisit,
} from '../invoice-visit-route';

const REQUEST = {} as NextRequest;

beforeEach(() => {
  grantMock.mockReset().mockReturnValue(true);
  renewMock.mockReset();
  clearMock.mockReset();
});

describe('invoiceVisitVerdictOf', () => {
  it.each([
    [{ status: 'ok' }, 'renew'],
    [{ status: 'started' }, 'renew'],
    [{ status: 'sent' }, 'renew'],
    [{ status: 'refused', reason: 'link-inactive' }, 'clear'],
    [{ status: 'refused', reason: 'invoice-absent' }, 'keep'],
    [{ status: 'refused', reason: 'provider-unavailable' }, 'keep'],
    [{ status: 'refused', reason: 'invalid-text' }, 'keep'],
    [{ status: 'refused', reason: 'visit-expired' }, 'keep'],
  ])('%p ⇒ %s', (outcome, verdict) => {
    expect(invoiceVisitVerdictOf(outcome)).toBe(verdict);
  });
});

describe('respondInVisit', () => {
  it('επιτυχία ⇒ 200 με ιδιωτικές κεφαλίδες και ανανέωση', async () => {
    const response = respondInVisit(REQUEST, 'share_1', { status: 'ok' });
    expect(response.status).toBe(200);
    expect(response.headers).toEqual({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
    expect(await response.json()).toEqual({ status: 'ok' });
    expect(renewMock).toHaveBeenCalledWith(REQUEST, response, 'share_1');
    expect(clearMock).not.toHaveBeenCalled();
  });

  it('link-inactive ⇒ σβήσιμο, καμία ανανέωση', () => {
    const response = respondInVisit(REQUEST, 'share_1', { status: 'refused', reason: 'link-inactive' });
    expect(clearMock).toHaveBeenCalledWith(response, 'share_1');
    expect(renewMock).not.toHaveBeenCalled();
  });

  it('άλλη άρνηση ⇒ ούτε ανανέωση ούτε σβήσιμο', () => {
    respondInVisit(REQUEST, 'share_1', { status: 'refused', reason: 'not-payable' });
    expect(renewMock).not.toHaveBeenCalled();
    expect(clearMock).not.toHaveBeenCalled();
  });
});

describe('grantedInvoiceShareId', () => {
  const context = (shareId: string) => ({ params: Promise.resolve({ shareId }) });

  it('αποκωδικοποιεί και ελέγχει το κουπόνι του ΙΔΙΟΥ συνδέσμου', async () => {
    expect(await grantedInvoiceShareId(REQUEST, context('share%5F1'))).toBe('share_1');
    expect(grantMock).toHaveBeenCalledWith(REQUEST, 'share_1');
  });

  it('χωρίς κουπόνι ή χωρίς shareId ⇒ null', async () => {
    grantMock.mockReturnValue(false);
    expect(await grantedInvoiceShareId(REQUEST, context('share_1'))).toBeNull();
    expect(await grantedInvoiceShareId(REQUEST, undefined)).toBeNull();
  });
});
