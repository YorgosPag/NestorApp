/**
 * @jest-environment node
 */

/**
 * Public showcase share lookup over the one share gate (ADR-698 · ADR-884 Φ0.12).
 *
 * 🔴 The load-bearing case: before Κ4 the showcase API **never checked the
 * password** — only the `/shared` page asked — so `curl` opened a
 * "password-protected" showcase. Pinned here as a 401 without the grant cookie.
 */

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

import { NextRequest } from 'next/server';
import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { hashShareToken } from '@/lib/sharing/share-token';
import { issueShareAccessGrant, shareAccessCookieName } from '@/server/sharing/share-access-grant';
import { createMockFirestore, type MockFirestoreKit } from '@/test-utils/mock-firestore';

import { lookupPublicShowcaseShare, publicShowcaseRefusalResponse } from '../api/public-share-lookup';

const TOKEN = 'NewGenerationToken_abcdefghijklmnopqrstuvwxy';
const LEGACY_TOKEN = 'LegacyToken0123456789abcdefghijk';
const FUTURE = new Date(Date.now() + 86_400_000).toISOString();

let kit: MockFirestoreKit;
const db = (): Firestore => kit.instance as unknown as Firestore;
const request = (cookie?: string) =>
  new NextRequest('https://nestorconstruct.gr/api/building-showcase/x', cookie ? { headers: { cookie } } : undefined);

async function seedBuildingShare(extra: Record<string, unknown> = {}): Promise<void> {
  kit.seedCollection(COLLECTIONS.SHARES, {
    share_1: {
      tokenHash: await hashShareToken(TOKEN),
      isActive: true,
      entityType: 'building_showcase',
      entityId: 'bld_1',
      companyId: 'comp_1',
      expiresAt: FUTURE,
      requiresPassword: false,
      maxAccesses: 0,
      accessCount: 0,
      showcaseMeta: { pdfStoragePath: 'companies/comp_1/showcase.pdf' },
      ...extra,
    },
  });
}

const lookup = (params: { token?: string; cookie?: string; requirePdfPath?: boolean; entityType?: 'building_showcase' | 'project_showcase' | 'property_showcase' } = {}) =>
  lookupPublicShowcaseShare({
    token: params.token ?? TOKEN,
    entityType: params.entityType ?? 'building_showcase',
    adminDb: db(),
    request: request(params.cookie),
    requirePdfPath: params.requirePdfPath,
  });

beforeEach(() => {
  kit = createMockFirestore();
  process.env.SHARE_ACCESS_SECRET = 'test-secret-with-enough-entropy-0123456789';
});

describe('lookupPublicShowcaseShare', () => {
  it('resolves a live share of its own surface', async () => {
    await seedBuildingShare();

    await expect(lookup()).resolves.toMatchObject({
      ok: true,
      share: { id: 'share_1', entityId: 'bld_1', companyId: 'comp_1', pdfStoragePath: 'companies/comp_1/showcase.pdf' },
    });
  });

  it("REFUSES another surface's share — a building token cannot open a project link", async () => {
    await seedBuildingShare();

    await expect(lookup({ entityType: 'project_showcase' })).resolves.toEqual({ ok: false, refusal: 'not-found' });
  });

  it('🔴 a password-protected showcase is NOT served without the access grant', async () => {
    await seedBuildingShare({ requiresPassword: true, passwordHash: 'irrelevant' });

    await expect(lookup()).resolves.toEqual({ ok: false, refusal: 'password-required' });
  });

  it('✅ …and IS served with the grant the right password earned', async () => {
    await seedBuildingShare({ requiresPassword: true, passwordHash: 'irrelevant' });
    const grant = issueShareAccessGrant('share_1') as string;

    await expect(lookup({ cookie: `${shareAccessCookieName('share_1')}=${grant}` }))
      .resolves.toMatchObject({ ok: true });
  });

  it("a grant for ANOTHER share does not open this one", async () => {
    await seedBuildingShare({ requiresPassword: true, passwordHash: 'irrelevant' });
    const foreign = issueShareAccessGrant('share_2') as string;

    await expect(lookup({ cookie: `${shareAccessCookieName('share_1')}=${foreign}` }))
      .resolves.toEqual({ ok: false, refusal: 'password-required' });
  });

  it('answers expired for an exhausted link (410 — the link no longer serves)', async () => {
    await seedBuildingShare({ maxAccesses: 3, accessCount: 3 });

    await expect(lookup()).resolves.toEqual({ ok: false, refusal: 'expired' });
  });

  it('rejects a missing PDF path only when the PDF proxy requires one', async () => {
    await seedBuildingShare({ showcaseMeta: {} });

    await expect(lookup()).resolves.toMatchObject({ ok: true });
    await expect(lookup({ requirePdfPath: true })).resolves.toEqual({ ok: false, refusal: 'not-found' });
  });

  it('serves a legacy file_shares property showcase through the same gate', async () => {
    kit.seedCollection(COLLECTIONS.FILE_SHARES, {
      fs_1: {
        token: LEGACY_TOKEN, isActive: true, showcaseMode: true, showcasePropertyId: 'prop_1',
        companyId: 'comp_1', expiresAt: FUTURE, pdfStoragePath: 'p.pdf', note: 'https://video',
      },
    });

    await expect(lookup({ token: LEGACY_TOKEN, entityType: 'property_showcase' })).resolves.toMatchObject({
      ok: true, share: { entityId: 'prop_1', pdfStoragePath: 'p.pdf', note: 'https://video' },
    });
  });
});

describe('publicShowcaseRefusalResponse', () => {
  it.each([
    ['not-found', 404, 'Building showcase link not found or deactivated'],
    ['password-required', 401, 'Password required'],
    ['expired', 410, 'Showcase link has expired'],
    ['unavailable', 503, 'Showcase link is temporarily unavailable'],
  ] as const)('%s → %i', async (refusal, status, error) => {
    const response = publicShowcaseRefusalResponse(refusal, 'Building showcase link not found or deactivated');

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ error });
  });
});
