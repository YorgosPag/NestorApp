/**
 * @fileoverview Άγκυρα του ενός προοιμίου τηλεμετρίας BIM (ADR-366 §C.7.Q3 · ADR-225 Phase 2 · CHECK 3.28).
 *   Η εισαγωγή και η διαγραφή GDPR απορρίπτουν με 400 ΠΡΙΝ αγγίξουν Firestore — αυτό το κρίνει ΕΝΑ σημείο.
 */

import { NextRequest } from 'next/server';

import { readSessionRequest, SESSION_HEADER, sessionIdOf, sessionRateLimitKey } from '../_session-request';

const VALID_SESSION = 'a'.repeat(64);

function post(body: string, session: string | null): NextRequest {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (session !== null) headers.set(SESSION_HEADER, session);
  return new NextRequest('http://localhost/api/telemetry/bim-performance', { method: 'POST', headers, body });
}

describe('bim telemetry — session preamble', () => {
  it('δέχεται έγκυρη συνεδρία και επιστρέφει το ακατέργαστο σώμα', async () => {
    const result = await readSessionRequest(post('{"x":1}', VALID_SESSION));
    expect(result).toEqual({ ok: true, sessionId: VALID_SESSION, raw: { x: 1 } });
  });

  it.each([
    ['χωρίς κεφαλίδα', null],
    ['κεφαλαία hex', 'A'.repeat(64)],
    ['λάθος μήκος', 'a'.repeat(63)],
  ])('απορρίπτει με 400 συνεδρία %s — χωρίς να διαβάσει σώμα', async (_label, session) => {
    const result = await readSessionRequest(post('not json', session));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      await expect(result.response.json()).resolves.toEqual({ error: 'Missing or malformed session id' });
    }
  });

  it('απορρίπτει με 400 σώμα που δεν είναι JSON', async () => {
    const result = await readSessionRequest(post('not json', VALID_SESSION));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      await expect(result.response.json()).resolves.toEqual({ error: 'Invalid JSON body' });
    }
  });

  it('το κλειδί του rate limiter είναι ανά συνεδρία και null χωρίς έγκυρη', () => {
    expect(sessionRateLimitKey('telemetry')(post('{}', VALID_SESSION))).toBe(`telemetry:${VALID_SESSION}`);
    expect(sessionRateLimitKey('telemetry-erase')(post('{}', 'bad'))).toBeNull();
    expect(sessionIdOf(post('{}', null))).toBeNull();
  });
});
