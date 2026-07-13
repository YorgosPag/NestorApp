/**
 * ADR-650 M8β — the bundled laz-perf `.wasm` asset URL. **Browser/Worker only.**
 *
 * `new URL(asset, import.meta.url)` is webpack 5's asset-module idiom (the same one
 * `io/pointcloud-import.ts` uses to point at the Worker entry): the file is emitted into the build
 * output and the expression becomes its final, hashed URL. Nothing else in this module — it exists
 * purely so `laz-runtime.ts` can reach the URL through a DYNAMIC import and stay loadable under
 * jest, where `import.meta` does not exist.
 */

export const LAZ_WASM_URL: string = new URL('laz-perf/lib/laz-perf.wasm', import.meta.url).href;
