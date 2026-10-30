/**
 * @fileoverview Άγκυρα του κατασκευαστή handler διαγνωστικού (ADR-225 Phase 2 · CHECK 3.28).
 *   Ο γραφέας (`PATCH …/[id]`, `PUT …/[id]/notes`) τρέχει ΜΟΝΟ με επικυρωμένα δεδομένα· κάθε απόρριψη του
 *   προοιμίου επιστρέφεται αυτούσια και ο γραφέας ΔΕΝ καλείται.
 */

import { NextRequest, NextResponse } from 'next/server';

import type { AuthContext, PermissionCache } from '@/lib/auth';
import { diagnosticHandler, type BodyVerdict } from '../_request-preamble';

const ctx = { uid: 'u1' } as AuthContext;
const cache = {} as PermissionCache;

function validate(raw: unknown): BodyVerdict<{ note: string }> {
  const note = (raw as { note?: unknown } | null)?.note;
  return typeof note === 'string' ? { ok: true, body: { note } } : { ok: false, reason: 'note must be string' };
}

function put(body: string): NextRequest {
  return new NextRequest('http://localhost/api/admin/bim-diagnostics/d1/notes', { method: 'PUT', body });
}

const route = (id: string) => ({ params: Promise.resolve({ id }) });

describe('diagnosticHandler', () => {
  it('καλεί τον γραφέα με diagId, επικυρωμένο σώμα και ctx', async () => {
    const write = jest.fn(async () => NextResponse.json({ saved: true }));
    const response = await diagnosticHandler(validate, write)(put('{"note":"hi"}'), ctx, cache, route('d1'));
    expect(write).toHaveBeenCalledWith({ diagId: 'd1', body: { note: 'hi' }, ctx });
    await expect(response.json()).resolves.toEqual({ saved: true });
  });

  it.each([
    ['χωρίς id', '{"note":"hi"}', '', 'Missing diagnostic id'],
    ['σώμα όχι JSON', 'nope', 'd1', 'Invalid JSON body'],
    ['σώμα που δεν επικυρώνεται', '{"note":1}', 'd1', 'note must be string'],
  ])('%s ⇒ 400 και ο γραφέας ΔΕΝ καλείται', async (_label, body, id, error) => {
    const write = jest.fn(async () => NextResponse.json({ saved: true }));
    const response = await diagnosticHandler(validate, write)(put(body), ctx, cache, route(id));
    expect(write).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error });
  });
});
