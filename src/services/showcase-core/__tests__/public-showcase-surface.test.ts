/**
 * Public showcase token surface (ADR-698) — payload contract, share lookup,
 * filename, media mapping and route↔surface exhaustiveness.
 *
 * The payload key-set test is the load-bearing one: the hand-written routes
 * listed their payload keys explicitly, so TypeScript rejected a stray snapshot
 * field. The factory derives the payload with a spread instead, and this suite
 * is what stops a new snapshot key from reaching an anonymous public response.
 */

import fs from 'fs';
import path from 'path';

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: { increment: (n: number) => ({ __increment: n }) },
}));

import { assembleUnifiedShowcasePayload } from '../unified-showcase-payload';
import {
  incrementPublicShareAccess,
  lookupPublicShowcaseShare,
} from '../api/public-share-lookup';
import { sanitizeShowcaseFilenameStem } from '../showcase-filename';
import type { Logger } from '@/lib/telemetry/Logger';

// ============================================================================
// Test doubles
// ============================================================================

function fakeLogger(): Logger & { warnings: unknown[][] } {
  const warnings: unknown[][] = [];
  const noop = () => undefined;
  return {
    warnings,
    warn: (...args: unknown[]) => { warnings.push(args); },
    info: noop, error: noop, debug: noop,
  } as unknown as Logger & { warnings: unknown[][] };
}

interface FakeShareDoc {
  id: string;
  data: Record<string, unknown>;
}

function fakeDb(docs: FakeShareDoc[]) {
  const recorded = { collection: '', filters: [] as string[], limit: 0, updates: [] as unknown[] };

  const query = {
    where(field: string, op: string, value: unknown) {
      recorded.filters.push(`${field}${op}${String(value)}`);
      return query;
    },
    limit(n: number) { recorded.limit = n; return query; },
    get: async () => ({
      empty: docs.length === 0,
      size: docs.length,
      docs: docs.map(d => ({ id: d.id, data: () => d.data })),
    }),
  };

  const db = {
    collection(name: string) {
      recorded.collection = name;
      return {
        ...query,
        doc: (_id: string) => ({
          update: async (payload: unknown) => { recorded.updates.push(payload); },
        }),
      };
    },
  } as unknown as import('firebase-admin/firestore').Firestore;

  return { db, recorded };
}

const LIVE_SHARE: Record<string, unknown> = {
  entityType: 'building_showcase',
  entityId: 'bld_1',
  companyId: 'comp_1',
  expiresAt: '2099-01-01T00:00:00.000Z',
  showcaseMeta: { pdfStoragePath: 'companies/comp_1/showcase.pdf' },
};

// ============================================================================

describe('assembleUnifiedShowcasePayload — public key set (wire contract)', () => {
  const media = {
    photos: [{ id: 'p1', url: 'https://x/p1.jpg' }],
    floorplans: [],
  };

  const facts = { pdfUrl: 'https://x/pdf', expiresAt: '2099-01-01T00:00:00.000Z' };

  it('emits exactly the keys the hand-written routes emitted', () => {
    const payload = assembleUnifiedShowcasePayload(
      { building: { id: 'bld_1' }, company: { name: 'ACME' } },
      'building',
      media,
      facts,
    );

    expect(Object.keys(payload).sort()).toEqual([
      'building', 'company', 'expiresAt', 'floorplans', 'pdfUrl', 'photos',
    ]);
  });

  it('DOES NOT LEAK an extra snapshot field into the anonymous response', () => {
    const payload = assembleUnifiedShowcasePayload(
      { building: { id: 'bld_1' }, company: { name: 'ACME' }, internalAuditTrail: ['secret'] },
      'building',
      media,
      facts,
    );

    // The whole reason this whitelists instead of spreading: a field added to a
    // snapshot type must not reach the public until a human puts it there.
    expect(Object.keys(payload)).not.toContain('internalAuditTrail');
    expect(JSON.stringify(payload)).not.toContain('secret');
  });

  it('copies the entity and its branding through untouched', () => {
    const snapshot = { building: { id: 'bld_1', name: 'Tower' }, company: { name: 'ACME' } };

    const payload = assembleUnifiedShowcasePayload(snapshot, 'building', media, facts);

    expect(payload.building).toEqual(snapshot.building);
    expect(payload.company).toEqual(snapshot.company);
  });

  it('keys the payload by the surface it was given', () => {
    const payload = assembleUnifiedShowcasePayload(
      { storage: { id: 'stor_1' }, company: {} },
      'storage',
      media,
      facts,
    );

    expect(Object.keys(payload).sort()).toEqual([
      'company', 'expiresAt', 'floorplans', 'pdfUrl', 'photos', 'storage',
    ]);
  });

  it('keeps pdfUrl present-but-undefined for surfaces that publish no PDF', () => {
    const payload = assembleUnifiedShowcasePayload({ parking: {}, company: {} }, 'parking', media, {
      pdfUrl: undefined,
      expiresAt: '2099-01-01T00:00:00.000Z',
    });

    expect(payload.pdfUrl).toBeUndefined();
    expect('pdfUrl' in payload).toBe(true);
  });

  it('carries both media buckets, including an empty one', () => {
    const payload = assembleUnifiedShowcasePayload(
      { building: {}, company: {} },
      'building',
      media,
      facts,
    );

    expect(payload.photos).toEqual(media.photos);
    expect(payload.floorplans).toEqual([]);
  });
});

describe('lookupPublicShowcaseShare — query shape', () => {
  it('uses the INDEXED token+isActive pair, never an unindexed triple', async () => {
    const { db, recorded } = fakeDb([{ id: 'share_1', data: LIVE_SHARE }]);

    await lookupPublicShowcaseShare({
      token: 'tok_1', entityType: 'building_showcase', adminDb: db, logger: fakeLogger(),
    });

    expect(recorded.filters).toEqual(['token==tok_1', 'isActive==true']);
    expect(recorded.filters.some(f => f.startsWith('entityType'))).toBe(false);
  });

  it('fetches two documents so a duplicate token is detectable', async () => {
    const { db, recorded } = fakeDb([{ id: 'share_1', data: LIVE_SHARE }]);

    await lookupPublicShowcaseShare({
      token: 'tok_1', entityType: 'building_showcase', adminDb: db, logger: fakeLogger(),
    });

    expect(recorded.limit).toBe(2);
  });
});

describe('lookupPublicShowcaseShare — resolution', () => {
  const base = { token: 'tok_1', entityType: 'building_showcase' as const };

  it('resolves a live share', async () => {
    const { db } = fakeDb([{ id: 'share_1', data: LIVE_SHARE }]);

    const share = await lookupPublicShowcaseShare({ ...base, adminDb: db, logger: fakeLogger() });

    expect(share).toEqual({
      id: 'share_1',
      entityId: 'bld_1',
      companyId: 'comp_1',
      expiresAt: '2099-01-01T00:00:00.000Z',
      pdfStoragePath: 'companies/comp_1/showcase.pdf',
    });
  });

  it('returns null when no share matches the token', async () => {
    const { db } = fakeDb([]);

    expect(await lookupPublicShowcaseShare({ ...base, adminDb: db, logger: fakeLogger() })).toBeNull();
  });

  it("REFUSES another surface's share — a project token cannot open a building link", async () => {
    const { db } = fakeDb([
      { id: 'share_1', data: { ...LIVE_SHARE, entityType: 'project_showcase' } },
    ]);

    expect(await lookupPublicShowcaseShare({ ...base, adminDb: db, logger: fakeLogger() })).toBeNull();
  });

  it('picks the matching surface when a token resolves to two shares, and warns', async () => {
    const logger = fakeLogger();
    const { db } = fakeDb([
      { id: 'share_other', data: { ...LIVE_SHARE, entityType: 'project_showcase', entityId: 'prj_9' } },
      { id: 'share_right', data: LIVE_SHARE },
    ]);

    const share = await lookupPublicShowcaseShare({ ...base, adminDb: db, logger });

    expect(share?.id).toBe('share_right');
    expect(share?.entityId).toBe('bld_1');
    expect(logger.warnings).toHaveLength(1);
  });

  it.each(['entityId', 'companyId', 'expiresAt'])(
    'returns null when the share is missing %s',
    async (field) => {
      const data = { ...LIVE_SHARE };
      delete data[field];
      const { db } = fakeDb([{ id: 'share_1', data }]);

      expect(await lookupPublicShowcaseShare({ ...base, adminDb: db, logger: fakeLogger() })).toBeNull();
    },
  );

  it('tolerates a missing pdfStoragePath when the caller does not require one', async () => {
    const { db } = fakeDb([{ id: 'share_1', data: { ...LIVE_SHARE, showcaseMeta: {} } }]);

    const share = await lookupPublicShowcaseShare({ ...base, adminDb: db, logger: fakeLogger() });

    expect(share?.id).toBe('share_1');
    expect(share?.pdfStoragePath).toBeUndefined();
  });

  it('rejects a missing pdfStoragePath when the PDF proxy requires one', async () => {
    const { db } = fakeDb([{ id: 'share_1', data: { ...LIVE_SHARE, showcaseMeta: {} } }]);

    const share = await lookupPublicShowcaseShare({
      ...base, adminDb: db, logger: fakeLogger(), requirePdfPath: true,
    });

    expect(share).toBeNull();
  });

  it('tolerates an entirely absent showcaseMeta', async () => {
    const data = { ...LIVE_SHARE };
    delete data.showcaseMeta;
    const { db } = fakeDb([{ id: 'share_1', data }]);

    expect((await lookupPublicShowcaseShare({ ...base, adminDb: db, logger: fakeLogger() }))?.id)
      .toBe('share_1');
  });

  it('does NOT judge expiry — callers answer 410 and need the raw value', async () => {
    const { db } = fakeDb([
      { id: 'share_1', data: { ...LIVE_SHARE, expiresAt: '2000-01-01T00:00:00.000Z' } },
    ]);

    const share = await lookupPublicShowcaseShare({ ...base, adminDb: db, logger: fakeLogger() });

    expect(share?.expiresAt).toBe('2000-01-01T00:00:00.000Z');
  });
});

describe('incrementPublicShareAccess', () => {
  it('increments atomically rather than read-then-write', async () => {
    const { db, recorded } = fakeDb([]);

    await incrementPublicShareAccess('share_1', db);

    expect(recorded.updates).toEqual([{ accessCount: { __increment: 1 } }]);
  });
});

describe('sanitizeShowcaseFilenameStem', () => {
  it.each([
    ['Tower A', 'Tower-A'],
    ['Κτίριο Άλφα', ''],
    ['Block  #3 / West', 'Block-3-West'],
    ['  padded  ', 'padded'],
    ['already-fine', 'already-fine'],
    ['', ''],
  ])('%s -> %s', (input, expected) => {
    expect(sanitizeShowcaseFilenameStem(input)).toBe(expected);
  });
});

// ============================================================================
// Exhaustiveness anchor — every public token route is a declaration
// ============================================================================

describe('public showcase routes ↔ factories (anchor)', () => {
  const API_DIR = path.join(process.cwd(), 'src', 'app', 'api');

  /** `src/app/api/{x}-showcase/[token]/**\/route.ts` files and their factory call. */
  function readTokenRoutes(): Array<{ file: string; factory: string | null }> {
    return fs
      .readdirSync(API_DIR, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && entry.name.endsWith('-showcase'))
      .flatMap(entry => [
        path.join(API_DIR, entry.name, '[token]', 'route.ts'),
        path.join(API_DIR, entry.name, '[token]', 'pdf', 'route.ts'),
      ])
      .filter(file => fs.existsSync(file))
      .map(file => {
        const source = fs.readFileSync(file, 'utf8');
        const match = source.match(/create(?:Unified)?Public\w*Showcase\w*Route/);
        return { file: path.relative(API_DIR, file), factory: match ? match[0] : null };
      });
  }

  it('finds the whole family (guards against a vacuous anchor)', () => {
    const routes = readTokenRoutes();

    // 4 payload (building/project/parking/storage) + 2 pdf (building/project)
    expect(routes).toHaveLength(6);
  });

  it('routes every `{entity}-showcase/[token]` surface through a unified factory', () => {
    for (const route of readTokenRoutes()) {
      expect(route.factory).toMatch(/^createUnifiedPublicShowcase(Payload|Pdf)Route$/);
    }
  });

  it('leaves no share query, media loader or filename sanitiser in a route file', () => {
    const forbidden = [/COLLECTIONS\.SHARES/, /listEntityMedia/, /replace\(\/\[\^\\w/];

    for (const route of readTokenRoutes()) {
      const source = fs.readFileSync(path.join(API_DIR, route.file), 'utf8');
      for (const pattern of forbidden) {
        expect(source).not.toMatch(pattern);
      }
    }
  });

  it('makes every route STATE its rate-limit posture', () => {
    for (const route of readTokenRoutes()) {
      const source = fs.readFileSync(path.join(API_DIR, route.file), 'utf8');

      expect(source).toMatch(/createPublicTokenRouteExport\(route, '(standard|none)'\)/);
    }
  });

  it('pins the current posture: PDF proxies limited, payload routes not (ADR-698 §8.2)', () => {
    const posture = Object.fromEntries(
      readTokenRoutes().map(route => {
        const source = fs.readFileSync(path.join(API_DIR, route.file), 'utf8');
        const match = source.match(/createPublicTokenRouteExport\(route, '(\w+)'\)/);
        return [route.file.replace(/\\/g, '/'), match?.[1]];
      }),
    );

    // Not an endorsement — a tripwire. Closing the gap should update this test
    // deliberately, and nothing should widen it silently.
    expect(posture).toEqual({
      'building-showcase/[token]/route.ts': 'none',
      'building-showcase/[token]/pdf/route.ts': 'standard',
      'project-showcase/[token]/route.ts': 'none',
      'project-showcase/[token]/pdf/route.ts': 'standard',
      'parking-showcase/[token]/route.ts': 'none',
      'storage-showcase/[token]/route.ts': 'none',
    });
  });
});
