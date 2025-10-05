/**
 * 🧪 GLOBAL TEST SETUP
 *
 * Runs once before all tests
 * Exposes GC για memory leak tests
 */

export default function setup() {
  // ═══ EXPOSE GARBAGE COLLECTOR ═══
  // This allows tests to manually trigger GC για memory leak detection
  // Run tests με: node --expose-gc ./node_modules/.bin/vitest

  if (typeof global.gc === 'function') {
    console.log('✅ Garbage collector exposed - memory leak tests enabled');
  } else {
    console.warn('⚠️ Garbage collector not exposed - run με --expose-gc flag για full coverage');
    console.warn('   Example: node --expose-gc ./node_modules/.bin/vitest');
  }

  // ═══ SET TEST ENVIRONMENT VARIABLES ═══
  process.env.NODE_ENV = 'test';
  process.env.VITEST = 'true';

  return () => {
    // Teardown (runs after all tests)
    console.log('🧹 Global test teardown complete');
  };
}
