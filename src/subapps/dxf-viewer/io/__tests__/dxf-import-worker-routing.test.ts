/**
 * ADR-639 Στάδιο 1 — Large-file DXF import routing.
 *
 * Pins the contract that `DxfImportService.importDxfFile`:
 *  1. parses SMALL files inline on the main thread (no Worker spin-up),
 *  2. parses LARGE files (≥ threshold) in the Web Worker, off the main thread,
 *  3. hands the worker CORRECTLY-DECODED content (encodingService, never raw UTF-8),
 *  4. falls back to the direct main-thread parse when the worker soft-fails.
 */

import type { DxfImportResult } from '../../types/scene';
import { DXF_IMPORT_THRESHOLDS } from '../../config/dxf-import-thresholds';

// --- Mocks -----------------------------------------------------------------

const mockReadFileWithAutoDetect = jest.fn();
jest.mock('../encoding-service', () => ({
  encodingService: {
    readFileWithAutoDetect: (...args: unknown[]) => mockReadFileWithAutoDetect(...args),
  },
}));

const mockRunDxfParse = jest.fn();
jest.mock('../../utils/run-dxf-parse', () => ({
  runDxfParse: (...args: unknown[]) => mockRunDxfParse(...args),
}));

jest.mock('../../utils/bounds-utils', () => ({
  calculateTightBounds: () => ({ minX: 0, minY: 0, maxX: 1, maxY: 1 }),
}));

// Fake Worker that records construction + postMessage, and lets a test drive onmessage/onerror.
let lastWorker: FakeWorker | null = null;
let workerConstructCount = 0;

class FakeWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  lastPosted: unknown = null;
  terminated = false;
  // ADR-639 Στάδιο 1 — the service attaches a persistent `message` listener via
  // addEventListener for the `worker-ready` liveness handshake (separate from the
  // per-parse `onmessage`), so the mock must mirror the real Worker interface.
  private messageListeners: ((e: MessageEvent) => void)[] = [];
  constructor() {
    workerConstructCount += 1;
    lastWorker = this;
  }
  postMessage(msg: unknown) {
    this.lastPosted = msg;
  }
  addEventListener(type: string, cb: (e: MessageEvent) => void) {
    if (type === 'message') this.messageListeners.push(cb);
  }
  removeEventListener(type: string, cb: (e: MessageEvent) => void) {
    if (type === 'message') this.messageListeners = this.messageListeners.filter((l) => l !== cb);
  }
  terminate() {
    this.terminated = true;
  }
  /** Dispatch a message to BOTH onmessage and addEventListener('message') listeners (real Worker). */
  private dispatch(data: unknown) {
    const ev = { data } as MessageEvent;
    this.onmessage?.(ev);
    this.messageListeners.forEach((l) => l(ev));
  }
  /** Simulate the module-load liveness signal (`worker-ready`). */
  emitReady() {
    this.dispatch({ type: 'worker-ready' });
  }
  emitSuccess(result: DxfImportResult) {
    this.dispatch(result);
  }
  emitError(err: unknown) {
    this.onerror?.(err);
  }
}

// The service constructs `new Worker(new URL(...))`; stub both globals.
(globalThis as unknown as { Worker: unknown }).Worker = FakeWorker;
const OriginalURL = globalThis.URL;

function makeFile(sizeBytes: number, name = 'plan.dxf'): File {
  // Only .size / .name are read by the service (encodingService is mocked), so a
  // lightweight stand-in avoids allocating multi-MB buffers in the test.
  return { size: sizeBytes, name } as unknown as File;
}

const SUCCESS_SCENE: DxfImportResult = {
  success: true,
  scene: { entities: [], bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 } } as never,
  stats: { entityCount: 3, layerCount: 1, parseTimeMs: 1 },
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
async function freshService() {
  jest.resetModules();
  const mod = await import('../dxf-import');
  return new mod.DxfImportService();
}

beforeEach(() => {
  jest.clearAllMocks();
  lastWorker = null;
  workerConstructCount = 0;
  (globalThis as unknown as { Worker: unknown }).Worker = FakeWorker;
  // `new URL('../workers/...', import.meta.url)` — keep it from throwing under jsdom.
  globalThis.URL = OriginalURL;
  mockReadFileWithAutoDetect.mockResolvedValue({ content: 'DECODED-GREEK-SAFE', encoding: 'windows-1253' });
});

// --- Tests -----------------------------------------------------------------

describe('ADR-639 Στάδιο 1 — importDxfFile worker routing', () => {
  it('parses a SMALL file inline (no Worker constructed)', async () => {
    mockRunDxfParse.mockResolvedValue(SUCCESS_SCENE);
    const svc = await freshService();

    const small = makeFile(DXF_IMPORT_THRESHOLDS.WORKER_PARSE_MIN_BYTES - 1);
    const result = await svc.importDxfFile(small, undefined, 'mm');

    expect(result.success).toBe(true);
    expect(workerConstructCount).toBe(0);
    expect(mockRunDxfParse).toHaveBeenCalledTimes(1);
  });

  it('parses a LARGE file in the Worker with correctly-decoded content', async () => {
    const svc = await freshService();

    const large = makeFile(DXF_IMPORT_THRESHOLDS.WORKER_PARSE_MIN_BYTES);
    const promise = svc.importDxfFile(large, undefined, 'm');

    // Let the async encoding read resolve so the worker gets constructed + posted to.
    await Promise.resolve();
    await Promise.resolve();

    expect(workerConstructCount).toBe(1);
    expect(lastWorker).not.toBeNull();
    const posted = lastWorker!.lastPosted as { type: string; fileContent: string; unitsOverride: string };
    expect(posted.type).toBe('parse-dxf');
    expect(posted.fileContent).toBe('DECODED-GREEK-SAFE'); // NOT raw UTF-8
    expect(posted.unitsOverride).toBe('m');
    // Direct path must NOT run when the worker handles it.
    expect(mockRunDxfParse).not.toHaveBeenCalled();

    lastWorker!.emitSuccess(SUCCESS_SCENE);
    const result = await promise;
    expect(result.success).toBe(true);
  });

  it('falls back to the direct main-thread parse when the Worker soft-fails', async () => {
    mockRunDxfParse.mockResolvedValue(SUCCESS_SCENE);
    const svc = await freshService();

    const large = makeFile(DXF_IMPORT_THRESHOLDS.WORKER_PARSE_MIN_BYTES + 10);
    const promise = svc.importDxfFile(large, undefined, 'mm');

    await Promise.resolve();
    await Promise.resolve();
    expect(workerConstructCount).toBe(1);

    lastWorker!.emitError(new Error('worker boom'));
    const result = await promise;

    expect(result.success).toBe(true);
    expect(mockRunDxfParse).toHaveBeenCalledTimes(1); // direct fallback ran
  });

  it('falls back FAST when the worker never signals readiness (liveness probe)', async () => {
    // Regression pin for the 2026-07-12 incident: a worker whose module failed to load
    // under Turbopack never posts `worker-ready` and never responds. Before the probe the
    // service dead-waited the ENTIRE parse ceiling (60s→242s) before falling back. Now the
    // readiness probe abandons it after WORKER_READY_PROBE_MS and the main-thread parse runs.
    jest.useFakeTimers();
    try {
      mockRunDxfParse.mockResolvedValue(SUCCESS_SCENE);
      const svc = await freshService();

      const large = makeFile(DXF_IMPORT_THRESHOLDS.WORKER_PARSE_MIN_BYTES + 10);
      const promise = svc.importDxfFile(large, undefined, 'mm');

      // Flush the async encoding read so the worker is constructed + posted to.
      await Promise.resolve();
      await Promise.resolve();
      expect(workerConstructCount).toBe(1);
      // Worker stays silent (no emitReady, no emitSuccess) → advance past the probe window.
      jest.advanceTimersByTime(DXF_IMPORT_THRESHOLDS.WORKER_READY_PROBE_MS + 1);

      const result = await promise;
      expect(result.success).toBe(true);
      expect(mockRunDxfParse).toHaveBeenCalledTimes(1); // fast fallback ran (not a dead-wait)
      expect(lastWorker!.terminated).toBe(true); // the wedged worker was disposed
    } finally {
      jest.useRealTimers();
    }
  });

  it('does NOT fall back while a ready worker is still parsing a large scene', async () => {
    // A worker that signalled readiness but takes a while to parse must NOT trip the probe.
    jest.useFakeTimers();
    try {
      const svc = await freshService();

      const large = makeFile(DXF_IMPORT_THRESHOLDS.WORKER_PARSE_MIN_BYTES);
      const promise = svc.importDxfFile(large, undefined, 'm');
      await Promise.resolve();
      await Promise.resolve();
      expect(workerConstructCount).toBe(1);

      // Worker signals it loaded, then keeps parsing past the readiness window.
      lastWorker!.emitReady();
      jest.advanceTimersByTime(DXF_IMPORT_THRESHOLDS.WORKER_READY_PROBE_MS + 1);
      expect(mockRunDxfParse).not.toHaveBeenCalled(); // still trusting the live worker

      lastWorker!.emitSuccess(SUCCESS_SCENE);
      const result = await promise;
      expect(result.success).toBe(true);
      expect(mockRunDxfParse).not.toHaveBeenCalled(); // worker delivered — no fallback
    } finally {
      jest.useRealTimers();
    }
  });
});
