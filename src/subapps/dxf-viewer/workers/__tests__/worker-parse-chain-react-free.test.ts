/**
 * ADR-639 Στάδιο 1 — WORKER PARSE CHAIN MUST STAY react/three/DOM-FREE (regression guard).
 *
 * The DXF parse Web Worker (`workers/dxf-parser.worker.ts`) dynamically imports
 * `utils/run-dxf-parse.ts` and its whole transitive chain. Turbopack bundles that chain into
 * the worker chunk. If ANY module in the closure statically imports `react` / `react-dom` /
 * `three` (a UI/framework dependency that does not belong in a parse), the worker module load
 * FAILS under Turbopack → `worker.onerror` fires an opaque `{}` → the import silently falls
 * back to a main-thread parse that FREEZES the UI on large files.
 *
 * Root incident (2026-07-12): `stores/TextStyleStore.ts` imported `useSyncExternalStore` from
 * 'react' for an unused `useTextStyle` hook. It reached the closure via
 *   run-dxf-parse → dxf-scene-builder → dxf-block-expander → dxf-entity-converters
 *     → rendering/entities/shared/geometry-rendering-utils → hooks/useTextPreviewStyle
 *     → stores/TextStyleStore  (from 'react')
 * and poisoned 11 separate edges into `geometry-rendering-utils`. Fixed by making the vanilla
 * store react-free (createExternalStore doctrine — React binding at the consumer).
 *
 * This test walks the real import graph on disk (no bundler needed) and fails the instant a
 * framework dependency re-enters the parse chain — a cheap presubmit that would have caught the
 * original regression at author time.
 */
import fs from 'node:fs';
import path from 'node:path';

// src/ root, derived from this test's location (…/workers/__tests__/).
const SRC = path.resolve(__dirname, '../../../..');
const ENTRY = path.join(SRC, 'subapps/dxf-viewer/utils/run-dxf-parse.ts');
const WORKER = path.join(SRC, 'subapps/dxf-viewer/workers/dxf-parser.worker.ts');

const EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];

/** Packages that must NEVER appear (as value imports) in the worker parse closure. */
const FORBIDDEN = /^(react|react-dom|three|three-stdlib|@react-three\/|framer-motion|@radix-ui\/)/;

function resolveSpec(spec: string, fromFile: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(fromFile), spec);
  else return null; // bare package — resolved by name, not walked into node_modules
  for (const e of EXTS) if (fs.existsSync(base + e)) return base + e;
  if (fs.existsSync(base) && fs.statSync(base).isDirectory()) {
    for (const e of EXTS) {
      const idx = path.join(base, 'index' + e);
      if (fs.existsSync(idx)) return idx;
    }
  }
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;
  return null;
}

function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const IMPORT_RE = /(?:import|export)\s+(?:type\s+)?[^'"]*?from\s+['"]([^'"]+)['"]/g;
const DYN_IMPORT_RE = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
const TYPE_ONLY_RE = /^\s*(?:import|export)\s+type\s+/;

interface Edge {
  spec: string;
  typeOnly: boolean;
}

function readEdges(file: string): Edge[] {
  const raw = fs.readFileSync(file, 'utf8');
  const code = stripComments(raw);
  const lines = code.split('\n');

  // Collect the specifier strings that appear on a `import type`/`export type` line so
  // pure-type edges (erased by the compiler, never bundled) are not chased.
  const typeOnly = new Set<string>();
  for (const line of lines) {
    if (!TYPE_ONLY_RE.test(line)) continue;
    const m = /from\s+['"]([^'"]+)['"]/.exec(line);
    if (m) typeOnly.add(m[1]);
  }

  const edges: Edge[] = [];
  let m: RegExpExecArray | null;
  while ((m = IMPORT_RE.exec(code))) edges.push({ spec: m[1], typeOnly: typeOnly.has(m[1]) });
  IMPORT_RE.lastIndex = 0;
  while ((m = DYN_IMPORT_RE.exec(code))) edges.push({ spec: m[1], typeOnly: false });
  DYN_IMPORT_RE.lastIndex = 0;
  return edges;
}

/** Walk the value-import closure from `entry`; return visited files + any forbidden hits. */
function walkClosure(entry: string): { visited: Set<string>; violations: string[] } {
  const visited = new Set<string>();
  const violations: string[] = [];
  const parent = new Map<string, string>();

  const pathTo = (file: string): string => {
    const chain: string[] = [];
    let cur: string | undefined = file;
    while (cur) {
      chain.push(path.relative(SRC, cur).replace(/\\/g, '/'));
      cur = parent.get(cur);
      if (chain.length > 40) break;
    }
    return chain.reverse().join('\n    → ');
  };

  const stack = [entry];
  while (stack.length) {
    const file = stack.pop()!;
    if (visited.has(file)) continue;
    visited.add(file);
    for (const { spec, typeOnly } of readEdges(file)) {
      if (typeOnly) continue;
      if (FORBIDDEN.test(spec)) {
        violations.push(
          `Forbidden import "${spec}" in ${path.relative(SRC, file).replace(/\\/g, '/')}\n` +
            `  reached via:\n    → ${pathTo(file)}`,
        );
        continue;
      }
      const resolved = resolveSpec(spec, file);
      if (resolved && !visited.has(resolved)) {
        if (!parent.has(resolved)) parent.set(resolved, file);
        stack.push(resolved);
      }
    }
  }
  return { visited, violations };
}

describe('ADR-639 — DXF worker parse chain stays framework-free', () => {
  it('run-dxf-parse transitive closure imports no react / react-dom / three', () => {
    const { visited, violations } = walkClosure(ENTRY);
    // Sanity: the walk actually traversed the heavy chain (not a resolver no-op).
    expect(visited.size).toBeGreaterThan(50);
    expect(violations).toEqual([]);
  });

  it('the worker entry module has only type imports at top level (heavy chain stays dynamic)', () => {
    const code = stripComments(fs.readFileSync(WORKER, 'utf8'));
    // Every static `import … from './x'` / `import … from '../x'` in the worker entry must be
    // `import type …`; the runDxfParse SSoT is pulled with a runtime `await import(...)` inside
    // the handler so a load error surfaces as a catchable message, not an opaque worker crash.
    const staticValueImports = code
      .split('\n')
      .filter((l) => /^\s*import\s+(?!type\b)[^;]*from\s+['"]\.[^'"]+['"]/.test(l));
    expect(staticValueImports).toEqual([]);
  });
});
