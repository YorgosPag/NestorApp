/**
 * 🧪 TEST SETUP - Enterprise Test Environment
 *
 * Runs before each test file
 */

import { vi, beforeEach, afterEach } from 'vitest';

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
