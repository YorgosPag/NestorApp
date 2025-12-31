/**
 * 🧪 TEST SETUP - Enterprise Test Environment
 *
 * Runs before each test file
 */

// ✅ ENTERPRISE FIX: Mock testing utilities for environments without vitest
interface VitestMock {
  fn: (impl?: (...args: unknown[]) => unknown) => ((...args: unknown[]) => unknown);
  useFakeTimers: () => void;
  useRealTimers: () => void;
}

const vi: VitestMock = {
  fn: (impl?: (...args: unknown[]) => unknown) => impl || (() => {}),
  useFakeTimers: () => {},
  useRealTimers: () => {}
};

const beforeEach = globalThis.beforeEach || ((fn: () => void) => {});
const afterEach = globalThis.afterEach || ((fn: () => void) => {});

// ═══ MOCK PERFORMANCE API ═══
if (typeof performance === 'undefined') {
  global.performance = {
    now: () => Date.now(),
    mark: () => {},
    measure: () => {},
    clearMarks: () => {},
    clearMeasures: () => {},
    getEntries: () => [],
    getEntriesByName: () => [],
    getEntriesByType: () => []
  } as any;
}

// ═══ MOCK CONSOLE (optional - για cleaner test output) ═══
if (process.env.SILENT_TESTS === 'true') {
  global.console = {
    ...console,
    log: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
    // Keep error για debugging
  };
}

// ═══ RESET TIMERS ═══
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ═══ DETERMINISTIC RANDOM (για reproducible tests) ═══
// Uncomment if needed για tests που χρησιμοποιούν Math.random()
// let seed = 12345;
// Math.random = () => {
//   const x = Math.sin(seed++) * 10000;
//   return x - Math.floor(x);
// };

export {};
