/**
 * ADR-650 M8β — the laz-perf WASM runtime: instantiated ONCE, lazily, and never on the main thread
 * if the worker road is available.
 *
 * WHY A DEPENDENCY AT ALL (N.5 / ADR-034 App. C). LAZ is not «LAS + gzip» — it is a chunked,
 * arithmetic-coded, per-field-predicted format. Writing a decoder for it in-house is weeks of work
 * with a permanent correctness liability, for a format that already has ONE canonical, hardened
 * implementation. `laz-perf` (Hobu Inc. — the PDAL/Entwine people) is that implementation compiled
 * to WASM: **Apache-2.0** (verified in the repo's `COPYING` and in every C++ source header, not
 * merely in `package.json`), zero transitive dependencies, 214 KB of `.wasm` + 87 KB of glue.
 * It is what potree, copc.js and deck.gl use.
 *
 * WHY THE SINGLETON. Emscripten instantiation compiles the module and allocates a heap. Doing that
 * per file would re-pay both on every import; doing it at module load would pay them for engineers
 * who never touch a `.laz`. So: first `.laz`, once, and the in-flight promise is shared.
 *
 * WHY THE URL INDIRECTION. `laz-perf`'s Node build finds its `.wasm` through the filesystem (which
 * is what makes it testable under jest); its browser build fetches it relative to the executing
 * script, which a bundled Worker chunk cannot satisfy. `laz-wasm-url.ts` is a browser-only module
 * (it uses `import.meta.url`, which webpack turns into an emitted asset URL) and is therefore
 * reached by DYNAMIC import, from the browser branch only — a static import would break jest.
 */

import type { LazPerf } from 'laz-perf';
import { POINTCLOUD_MSG } from './pointcloud-read';

/** The `createLazPerf(moduleArg?)` factory. Injectable so tests can drive the reader without WASM. */
export type LazPerfFactory = (moduleArg?: { locateFile?: (path: string) => string }) => Promise<LazPerf>;

/** Shared across every `.laz` in the session — including the in-flight instantiation. */
let runtime: Promise<LazPerf> | null = null;

function isBrowserLike(): boolean {
  return typeof window !== 'undefined' || typeof self !== 'undefined';
}

/** The bundled `.wasm` asset URL — browser/Worker only (see the module note above). */
async function locateWasm(): Promise<((path: string) => string) | undefined> {
  if (!isBrowserLike()) return undefined; // Node/jest: laz-perf loads its own .wasm off disk
  const { LAZ_WASM_URL } = await import('./laz-wasm-url');
  return () => LAZ_WASM_URL;
}

async function instantiate(): Promise<LazPerf> {
  const { createLazPerf } = await import('laz-perf');
  const locateFile = await locateWasm();
  return createLazPerf(locateFile ? { locateFile } : undefined);
}

/**
 * The laz-perf module, instantiating it on first use.
 *
 * A failure here is almost always environmental (the `.wasm` asset did not ship, or the runtime
 * forbids WebAssembly) — never the engineer's file. It surfaces as `error.lazRuntimeUnavailable`
 * so the wizard can say so, and the promise is CLEARED so a retry is not poisoned by the first
 * failure.
 *
 * @throws Error(`error.lazRuntimeUnavailable`)
 */
export function loadLazPerf(factory?: LazPerfFactory): Promise<LazPerf> {
  if (factory) return factory().catch(failRuntime); // injected (tests) — never cached
  if (!runtime) {
    runtime = instantiate().catch((error) => {
      runtime = null;
      return failRuntime(error);
    });
  }
  return runtime;
}

function failRuntime(error: unknown): never {
  console.error('❌ laz-perf: WASM runtime unavailable:', error);
  throw new Error(POINTCLOUD_MSG.ERROR_LAZ_RUNTIME_UNAVAILABLE);
}
