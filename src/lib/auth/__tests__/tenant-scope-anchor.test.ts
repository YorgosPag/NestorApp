/**
 * ⚓ ADR-702 anchor — no route may hand-derive its own tenant scope.
 *
 * The rule this guards is one line long, which is why it spread to a dozen route
 * files in the first place and why three copies of it had already drifted into
 * two different behaviours before anyone noticed. A unit test on the resolver
 * cannot catch that: the resolver was already correct: what was wrong was that
 * routes did not use it.
 *
 * So this test reads the actual route files off disk and asserts an invariant
 * about them, in the spirit of the ADR-697 exhaustiveness anchor:
 *
 * > A file under `src/app/api/**` may read `companyId` out of the query string
 * > **only** if it hands what it read to one of the `lib/auth/tenant-scope`
 * > resolvers in the same file.
 *
 * ## What this anchor does NOT see (stated, because a green test that looked at
 * nothing is worse than no test)
 *
 * - `companyId` arriving in a **request body** — legitimate on creation
 *   endpoints, so the pattern is not distinctive enough to assert on. The one
 *   body-sourced case that *is* a scope decision (ISO-19650 backfill POST) is
 *   pinned by name below instead.
 * - Route params (`/by-company/[companyId]`) — a different mechanism, out of
 *   scope for ADR-702.
 * - Anything outside `src/app/api`.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const API_ROOT = join(process.cwd(), 'src', 'app', 'api');

/** Reads `companyId` straight out of a URL's query string. */
const QUERY_READ = /searchParams\s*\.\s*get\(\s*['"]companyId['"]\s*\)/;

/** Any resolver from the ADR-697/702 family. */
const SSOT_RESOLVER = /resolveTenantScope|resolveTenantListScope|requireTenantScope/;

/** The hand-rolled derivation the ADR replaced, in its canonical shape. */
const HAND_DERIVATION = /isRoleBypass\s*\([^)]*\)\s*&&/;

function listTypeScriptFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return entry === '__tests__' ? [] : listTypeScriptFiles(full);
    }
    return entry.endsWith('.ts') && !entry.endsWith('.d.ts') ? [full] : [];
  });
}

function relative(file: string): string {
  return file.slice(process.cwd().length + 1).replace(/\\/g, '/');
}

const API_FILES = listTypeScriptFiles(API_ROOT).map((file) => ({
  path: relative(file),
  source: readFileSync(file, 'utf8'),
}));

describe('ADR-702 anchor — tenant scope is resolved, never re-derived', () => {
  it('finds route files to check at all (guards against a silently empty scan)', () => {
    expect(API_FILES.length).toBeGreaterThan(100);
  });

  it('still detects the pattern it polices — a regex that matches nothing proves nothing', () => {
    // Self-test, not a codebase count: after ADR-702 the API tree legitimately
    // contains zero raw reads, so counting matches would assert nothing. What
    // must stay true is that the detector would still fire if one came back.
    expect(QUERY_READ.test("const c = searchParams.get('companyId');")).toBe(true);
    expect(QUERY_READ.test('const c = req.nextUrl.searchParams.get("companyId")')).toBe(true);
    expect(QUERY_READ.test("searchParams.get('projectId')")).toBe(false);

    expect(HAND_DERIVATION.test('const id = isRoleBypass(ctx.globalRole) && requested ? requested : own;')).toBe(true);
    expect(HAND_DERIVATION.test('if (isRoleBypass(ctx.globalRole)) { … }')).toBe(false);
  });

  it('keeps the one legitimate reader in the SSoT, not in a route', () => {
    const ssot = readFileSync(join(process.cwd(), 'src', 'lib', 'api', 'tenant-scope-http.ts'), 'utf8');

    // And it reads through the shared constant rather than retyping the name —
    // which is also why the QUERY_READ literal scan does not match here.
    expect(ssot).toContain('searchParams.get(TENANT_SCOPE_QUERY_PARAM)');
    expect(QUERY_READ.test(ssot)).toBe(false);
  });

  it('lets no API file read ?companyId= without handing it to the SSoT', () => {
    const offenders = API_FILES
      .filter(({ source }) => QUERY_READ.test(source) && !SSOT_RESOLVER.test(source))
      .map(({ path }) => path);

    expect(offenders).toEqual([]);
  });

  it('lets no API file rebuild the `isRoleBypass(…) && requested` derivation by hand', () => {
    const offenders = API_FILES
      .filter(({ source }) => HAND_DERIVATION.test(source) && QUERY_READ.test(source))
      .map(({ path }) => path);

    expect(offenders).toEqual([]);
  });
});

describe('ADR-702 anchor — the endpoints that carried the duplicate', () => {
  function sourceOf(path: string): string {
    const found = API_FILES.find((file) => file.path === path);
    if (!found) throw new Error(`Anchor is stale: ${path} no longer exists`);
    return found.source;
  }

  it.each([
    ['src/app/api/buildings/route.ts', 'resolveTenantListScopeFromUrl'],
    ['src/app/api/properties/route.ts', 'resolveTenantListScopeFromUrl'],
    ['src/app/api/floors/floors.shared.ts', 'resolveTenantListScopeFromUrl'],
  ])('%s browses through the list doctrine', (path, resolver) => {
    expect(sourceOf(path)).toContain(resolver);
  });

  it.each([
    'src/app/api/admin/iso19650/costs/route.ts',
    'src/app/api/admin/iso19650/backfill/route.ts',
  ])('%s names a company deliberately, and authorises it through the strict doctrine', (path) => {
    // These take `companyId` as an argument to the operation rather than as a
    // filter. What the anchor pins is that the argument is authorised before
    // use, and that the refusal is a 403 rather than a silent retarget.
    expect(sourceOf(path)).toContain('requireTenantScopeFrom');
  });

  it('pins the body-sourced backfill, which the query-string scan cannot see', () => {
    const source = sourceOf('src/app/api/admin/iso19650/backfill/route.ts');

    // GET takes it from the URL, POST from the body — both must be authorised,
    // and the body path is invisible to the repo-wide scan above.
    expect(source).toContain('requireTenantScopeFromQuery');
    expect(source).toContain('requireTenantScopeFromBody');
  });
});
