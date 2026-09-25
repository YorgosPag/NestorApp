/**
 * UnifiedSharingService — the client facade (ADR-315 · ADR-884 Φ0.12).
 *
 * The lifecycle runs on the server (tested in `src/server/sharing/__tests__`).
 * What is pinned here is the **wire**: which route, which body, and that the two
 * public calls go out **without** an identity token (the recipient has none) —
 * plus an anchor that the facade never regains a Firestore handle.
 */

import fs from 'fs';
import path from 'path';

const post = jest.fn();
jest.mock('@/lib/api/enterprise-api-client', () => ({ apiClient: { post: (...args: unknown[]) => post(...args) } }));

import { UnifiedSharingService } from '../unified-sharing.service';

beforeEach(() => {
  post.mockReset();
  post.mockResolvedValue({});
});

describe('UnifiedSharingService — wire contract', () => {
  it('creates through POST /api/shares — tenant and author are NOT on the wire', async () => {
    post.mockResolvedValue({ shareId: 'share_1', token: 'tok', expiresAt: '2099-01-01T00:00:00.000Z' });

    const result = await UnifiedSharingService.createShare({ entityType: 'contact', entityId: 'ct_1', contactMeta: { includedFields: ['name'] } });

    expect(post).toHaveBeenCalledWith('/api/shares', { entityType: 'contact', entityId: 'ct_1', contactMeta: { includedFields: ['name'] } });
    const body = post.mock.calls[0][1] as Record<string, unknown>;
    expect('companyId' in body || 'createdBy' in body).toBe(false);
    expect(result.token).toBe('tok');
  });

  it('revokes through POST /api/shares/{id}/revoke, id encoded', async () => {
    await UnifiedSharingService.revoke('share/../x');

    expect(post).toHaveBeenCalledWith('/api/shares/share%2F..%2Fx/revoke');
  });

  it('resolves anonymously, token in the BODY (never in the URL)', async () => {
    await UnifiedSharingService.resolve('tok_abc');

    expect(post).toHaveBeenCalledWith('/api/shares/resolve', { token: 'tok_abc' }, { skipAuth: true });
  });

  it('sends the password only when one is given', async () => {
    await UnifiedSharingService.resolve('tok_abc', 'pw');

    expect(post).toHaveBeenCalledWith('/api/shares/resolve', { token: 'tok_abc', password: 'pw' }, { skipAuth: true });
  });

  it('requests a download anonymously', async () => {
    await UnifiedSharingService.requestDownload('tok_abc');

    expect(post).toHaveBeenCalledWith('/api/shares/download', { token: 'tok_abc' }, { skipAuth: true });
  });
});

describe('UnifiedSharingService — anchor', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'src', 'services', 'sharing', 'unified-sharing.service.ts'), 'utf8',
  );

  it.each([
    [/from 'firebase\/firestore'/, 'a Firestore handle'],
    [/@\/lib\/firebase'/, 'the client SDK instance'],
    [/getRandomValues|generateShareToken/, 'token generation'],
    [/sha256|hashShare|scrypt/i, 'hashing'],
  ])('holds no %s — %s belongs to the server', (pattern) => {
    expect(source).not.toMatch(pattern);
  });
});
