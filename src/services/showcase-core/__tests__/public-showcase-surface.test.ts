/**
 * Public showcase token surface (ADR-698) — payload contract, filename, media
 * mapping and route↔surface exhaustiveness. (Share lookup: see
 * `public-share-lookup.test.ts`.)
 *
 * The payload key-set test is the load-bearing one: the hand-written routes
 * listed their payload keys explicitly, so TypeScript rejected a stray snapshot
 * field. The factory derives the payload with a spread instead, and this suite
 * is what stops a new snapshot key from reaching an anonymous public response.
 */

import fs from 'fs';
import path from 'path';

import { assembleUnifiedShowcasePayload } from '../unified-showcase-payload';
import { sanitizeShowcaseFilenameStem } from '../showcase-filename';

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

// The share lookup moved onto the one share gate (ADR-884 Φ0.12) and is pinned
// in `public-share-lookup.test.ts` (node environment — it hashes with Web Crypto).

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
