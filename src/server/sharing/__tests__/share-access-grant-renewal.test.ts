/**
 * @jest-environment node
 *
 * @fileoverview Η **ανανέωση** της επίσκεψης κοινοποίησης στο σύρμα (ADR-315 Α6, 2026-11-13).
 * @related server/sharing/share-access-grant.ts
 *
 * Ζωντανό εύρημα που το γέννησε: η σελίδα πληρωμής πέθαινε στο 16′ (`visit-expired`) ενώ ο σύνδεσμος ζούσε, επειδή
 * το κουπόνι εκδιδόταν μία φορά και δεν ανανεωνόταν ποτέ. Εδώ φυλάσσεται ότι το cookie **ξαναγράφεται** με ζωντανό
 * κουπόνι του ίδιου συνδέσμου, ότι χωρίς έγκυρο κουπόνι **δεν** γράφεται τίποτα, και ότι το σβήσιμο σβήνει.
 */

jest.mock('server-only', () => ({}));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

import { NextRequest, NextResponse } from 'next/server';

import {
  clearShareAccessGrant,
  isShareAccessGrantValid,
  issueShareAccessGrant,
  renewShareAccessGrant,
  SHARE_VISIT_CEILING_SECONDS,
  shareAccessCookieName,
} from '../share-access-grant';

const SECRET_ENV = 'SHARE_ACCESS_SECRET';

function requestWith(cookie: string | null): NextRequest {
  const headers: Record<string, string> = cookie === null ? {} : { cookie };
  return new NextRequest('https://nestor.test/api/shares/share_1/invoice-payment', { headers });
}

beforeEach(() => {
  process.env[SECRET_ENV] = 'test-secret-with-enough-entropy-0123456789abcdef';
});

afterAll(() => {
  delete process.env[SECRET_ENV];
});

describe('renewShareAccessGrant', () => {
  it('ζωντανό κουπόνι ⇒ το cookie ξαναγράφεται με έγκυρο κουπόνι του ΙΔΙΟΥ συνδέσμου', () => {
    const grant = issueShareAccessGrant('share_1')!;
    const response = NextResponse.json({});
    renewShareAccessGrant(requestWith(`${shareAccessCookieName('share_1')}=${grant}`), response, 'share_1');
    const written = response.cookies.get(shareAccessCookieName('share_1'));
    expect(written?.value).toBeDefined();
    expect(isShareAccessGrantValid(written!.value, 'share_1')).toBe(true);
    expect(written?.httpOnly).toBe(true);
    expect(written?.path).toBe('/api');
  });

  it('χωρίς cookie ⇒ τίποτα', () => {
    const response = NextResponse.json({});
    renewShareAccessGrant(requestWith(null), response, 'share_1');
    expect(response.cookies.get(shareAccessCookieName('share_1'))).toBeUndefined();
  });

  it('κουπόνι ΑΛΛΟΥ συνδέσμου ⇒ τίποτα (καμία μεταφορά επίσκεψης)', () => {
    const foreign = issueShareAccessGrant('share_2')!;
    const response = NextResponse.json({});
    renewShareAccessGrant(requestWith(`${shareAccessCookieName('share_1')}=${foreign}`), response, 'share_1');
    expect(response.cookies.get(shareAccessCookieName('share_1'))).toBeUndefined();
  });

  it('κουπόνι που έφτασε την απόλυτη λήξη ⇒ τίποτα', () => {
    const old = issueShareAccessGrant('share_1', Date.now() - SHARE_VISIT_CEILING_SECONDS * 1000)!;
    const response = NextResponse.json({});
    renewShareAccessGrant(requestWith(`${shareAccessCookieName('share_1')}=${old}`), response, 'share_1');
    expect(response.cookies.get(shareAccessCookieName('share_1'))).toBeUndefined();
  });
});

describe('clearShareAccessGrant', () => {
  it('σβήνει το cookie στο ΙΔΙΟ path με την εγγραφή', () => {
    const response = NextResponse.json({});
    clearShareAccessGrant(response, 'share_1');
    const cleared = response.cookies.get(shareAccessCookieName('share_1'));
    expect(cleared?.value).toBe('');
    expect(cleared?.maxAge).toBe(0);
    expect(cleared?.path).toBe('/api');
  });
});
