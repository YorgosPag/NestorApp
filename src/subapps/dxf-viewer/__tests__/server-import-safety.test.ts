/**
 * SERVER IMPORT-SAFETY GUARD — DXF processing route must stay React-free.
 *
 * `/api/floorplans/process` runs server-side (Next.js `app-route` / RSC bundle,
 * see route.ts) and dynamically imports the DXF parse pipeline
 * (`dxf-scene-builder` → `DxfSceneBuilder.buildSceneWithDiagnostics`). In that
 * bundle React is the *vendored RSC* build, which does NOT expose
 * `createContext`. So if any module transitively pulled into the parse graph
 * imports a library that calls `React.createContext` at module-eval time —
 * notably **react-i18next** (via the `formatting` barrel's `useFormatter` hook) —
 * the whole route crashes with «createContext is not a function» (500).
 *
 * 2026-07-11 incident: a pure config util (`config/display-length-format.ts`) and
 * a shared render util (`distance-label-utils.ts`) imported `FormatterRegistry`
 * from the `../formatting` **barrel** (`formatting/index.ts`), which re-exports the
 * React `useFormatter` hook → react-i18next → createContext → server crash. Fix
 * (ADR-373): deep-import the non-React registry from `formatting/FormatterRegistry`
 * instead of the barrel.
 *
 * This test statically walks the runtime import graph from the server DXF entry
 * points and fails if any reachable module imports a known React-context library.
 * It reads source (no bundling) so it is fast and environment-independent.
 */

import fs from 'fs';
import path from 'path';

// src root = .../src (this file lives at src/subapps/dxf-viewer/__tests__/).
const SRC = path.resolve(__dirname, '../../..');
const ROOT = path.resolve(SRC, '..');

/** Entry points the server `/api/floorplans/process` route pulls into its bundle. */
const ENTRY_POINTS = [
  'src/subapps/dxf-viewer/utils/dxf-scene-builder.ts',
  'src/subapps/dxf-viewer/utils/dxf-import-diagnostics.ts',
  'src/subapps/dxf-viewer/io/encoding-service.ts',
  'src/subapps/dxf-viewer/config/display-length-format.ts',
];

/** Bare packages that call React.createContext at import-time → crash the RSC route. */
const FORBIDDEN_PACKAGES = ['react-i18next'];

const EXTS = ['.ts', '.tsx', '.js', '.jsx'];
const norm = (p: string) => p.split(path.sep).join('/');

function resolveFile(base: string): string | null {
  for (const e of EXTS) if (fs.existsSync(path.join(ROOT, base + e))) return norm(base + e);
  for (const e of EXTS) if (fs.existsSync(path.join(ROOT, base, 'index' + e))) return norm(path.join(base, 'index' + e));
  const abs = path.join(ROOT, base);
  if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return norm(base);
  return null;
}

const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** Runtime specifiers only — `import type` / `export type` are erased, so skipped. */
function getRuntimeSpecs(file: string): string[] {
  let txt: string;
  try {
    txt = fs.readFileSync(path.join(ROOT, file), 'utf8');
  } catch {
    return [];
  }
  const src = stripComments(txt);
  const specs: string[] = [];
  const staticRe = /(^|\n)\s*(import|export)\b([\s\S]*?)from\s*['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = staticRe.exec(src))) {
    if (/^\s+type\b/.test(m[3])) continue; // type-only import/export — erased at runtime
    specs.push(m[4]);
  }
  const dynRe = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m = dynRe.exec(src))) specs.push(m[1]);
  return specs;
}

function resolveSpec(fromFile: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = path.join('src', spec.slice(2));
  else if (spec.startsWith('.')) base = norm(path.join(path.dirname(fromFile), spec));
  else return null; // bare node package — handled separately
  return resolveFile(base);
}

/** BFS the runtime import graph; return { visited, offenders } where an offender is a
 *  reachable file importing a FORBIDDEN_PACKAGES specifier, with its chain to an entry. */
function walkGraph() {
  const visited = new Set<string>(ENTRY_POINTS);
  const parent = new Map<string, string>();
  const queue = [...ENTRY_POINTS];
  const offenders: { file: string; pkg: string; chain: string[] }[] = [];

  while (queue.length) {
    const file = queue.shift() as string;
    const specs = getRuntimeSpecs(file);
    for (const spec of specs) {
      if (FORBIDDEN_PACKAGES.includes(spec)) {
        const chain = [file];
        let c = file;
        while (parent.has(c)) {
          c = parent.get(c) as string;
          chain.push(c);
        }
        offenders.push({ file, pkg: spec, chain: chain.reverse() });
      }
      const r = resolveSpec(file, spec);
      if (r && !visited.has(r)) {
        visited.add(r);
        parent.set(r, file);
        queue.push(r);
      }
    }
  }
  return { visited, offenders };
}

describe('DXF server import-safety (RSC route must not pull React-context libs)', () => {
  it('entry points exist on disk (guard against a stale path)', () => {
    for (const ep of ENTRY_POINTS) {
      expect(fs.existsSync(path.join(ROOT, ep))).toBe(true);
    }
  });

  it('no react-i18next (createContext) reachable from the DXF parse graph', () => {
    const { visited, offenders } = walkGraph();
    // Sanity: the walk actually traversed a real graph, not zero files.
    expect(visited.size).toBeGreaterThan(50);

    if (offenders.length > 0) {
      const report = offenders
        .map((o) => `  • ${o.pkg} via:\n      ${o.chain.join('\n      → ')}`)
        .join('\n');
      throw new Error(
        `Forbidden React-context import reachable from the server DXF route ` +
          `(would crash /api/floorplans/process with "createContext is not a function"):\n${report}\n\n` +
          `Fix: deep-import the non-React symbol from its real module instead of the ` +
          `'formatting' barrel (ADR-373 server-safe imports).`,
      );
    }
    expect(offenders).toHaveLength(0);
  });
});
