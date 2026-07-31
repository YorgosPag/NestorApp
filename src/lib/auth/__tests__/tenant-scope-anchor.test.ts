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

import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { dirname, join } from 'path';

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

/**
 * `export { GET } from './x'` / `export * from './x'` — a local re-export.
 *
 * Built fresh per call **on purpose**: a shared `/g` regex carries `lastIndex`
 * between `.test()` and `.matchAll()`, so the second caller silently starts
 * scanning from the middle of the file and finds nothing.
 */
function reExportPattern(): RegExp {
  return /export\s*(?:\*|\{[^}]*\})\s*from\s*['"](\.[^'"]+)['"]/g;
}

/**
 * The **endpoint's** source: the route file plus everything it re-exports from
 * a sibling module, transitively.
 *
 * 🔴 WHY THIS IS NOT OVER-ENGINEERING — it caught a real false red.
 *
 * The first version of this anchor read `route.ts` and nothing else. Then
 * `buildings/route.ts` extracted its `GET` to `buildings-list.handler.ts` for
 * SRP — a **correct** refactor that kept `resolveTenantListScopeFromUrl` — and
 * this anchor went red anyway, because the string it grepped for had moved one
 * file sideways. It then sat red in CI from 2026-07-15, and by 2026-07-31 it
 * was being routinely dismissed as "pre-existing" in handoffs.
 *
 * That is the worst failure mode an anchor has: it was not wrong about the
 * doctrine, it was wrong about the ADDRESS, and the noise trained people to
 * ignore it. A guard nobody believes is worse than no guard, because it also
 * occupies the slot where a working one would go.
 *
 * A route's contract is its exported handlers, not its line count. So the
 * anchor now asks the question the ADR actually asks — *does this endpoint go
 * through the doctrine?* — and lets SRP move code around freely.
 */
function endpointSourceOf(path: string, seen = new Set<string>()): string {
  if (seen.has(path)) return '';
  seen.add(path);

  const found = API_FILES.find((file) => file.path === path);
  if (!found) throw new Error(`Anchor is stale: ${path} no longer exists`);

  const dir = dirname(join(process.cwd(), path));
  const parts = [found.source];

  for (const [, rel] of found.source.matchAll(reExportPattern())) {
    const target = [`${rel}.ts`, `${rel}/index.ts`]
      .map((candidate) => join(dir, candidate))
      .find(existsSync);

    // A re-export pointing nowhere is a stale anchor too — but it is also a
    // broken build, so leave it to the compiler rather than failing here.
    if (target !== undefined) parts.push(endpointSourceOf(relative(target), seen));
  }

  return parts.join('\n');
}

describe('ADR-702 anchor — the endpoints that carried the duplicate', () => {
  it('🔴 follows re-exports — otherwise an SRP extraction fakes a violation', () => {
    // Self-test of the follower itself. Without this, a follower that silently
    // stopped following would turn every one of the assertions below into a
    // false red (the 2026-07-15 incident), or — if it over-collected — into a
    // green that proves nothing.
    const bare = API_FILES.find((f) => f.path === 'src/app/api/buildings/route.ts')?.source ?? '';
    const followed = endpointSourceOf('src/app/api/buildings/route.ts');

    expect(bare).not.toContain('resolveTenantListScopeFromUrl');
    expect(followed).toContain('resolveTenantListScopeFromUrl');
    expect(followed.length).toBeGreaterThan(bare.length);
  });

  it('a file with no re-exports yields exactly itself — no over-collection', () => {
    // The other half of the self-test: if the follower swept in unrelated
    // files, every assertion below would pass for the wrong reason.
    //
    // The subject is chosen by PROPERTY, not by name — naming a file here would
    // make this test itself go stale the day that file grows a re-export, which
    // is the exact failure being fixed.
    const plain = API_FILES.find(({ source }) => !reExportPattern().test(source));
    if (plain === undefined) throw new Error('Anchor is stale: no re-export-free API file left');

    expect(endpointSourceOf(plain.path)).toBe(plain.source);
  });

  it.each([
    ['src/app/api/buildings/route.ts', 'resolveTenantListScopeFromUrl'],
    ['src/app/api/properties/route.ts', 'resolveTenantListScopeFromUrl'],
    ['src/app/api/floors/floors.shared.ts', 'resolveTenantListScopeFromUrl'],
  ])('%s browses through the list doctrine', (path, resolver) => {
    expect(endpointSourceOf(path)).toContain(resolver);
  });

  it.each([
    'src/app/api/admin/iso19650/costs/route.ts',
    'src/app/api/admin/iso19650/backfill/route.ts',
  ])('%s names a company deliberately, and authorises it through the strict doctrine', (path) => {
    // These take `companyId` as an argument to the operation rather than as a
    // filter. What the anchor pins is that the argument is authorised before
    // use, and that the refusal is a 403 rather than a silent retarget.
    expect(endpointSourceOf(path)).toContain('requireTenantScopeFrom');
  });

  it('pins the body-sourced backfill, which the query-string scan cannot see', () => {
    const source = endpointSourceOf('src/app/api/admin/iso19650/backfill/route.ts');

    // GET takes it from the URL, POST from the body — both must be authorised,
    // and the body path is invisible to the repo-wide scan above.
    expect(source).toContain('requireTenantScopeFromQuery');
    expect(source).toContain('requireTenantScopeFromBody');
  });
});
