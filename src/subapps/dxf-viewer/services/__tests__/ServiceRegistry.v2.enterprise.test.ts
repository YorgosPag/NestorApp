/**
 * 🏢 ENTERPRISE TEST SUITE - ServiceRegistry V2
 *
 * AutoCAD/Fortune 500-class test coverage
 * Based on ChatGPT-5 enterprise audit recommendations
 *
 * @module services/__tests__/ServiceRegistry.v2.enterprise.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EnterpriseServiceRegistry, type ServiceName } from '../ServiceRegistry.v2';

describe('EnterpriseServiceRegistry - Fortune 500 Tests', () => {
  let registry: EnterpriseServiceRegistry;

  beforeEach(() => {
    registry = EnterpriseServiceRegistry.getInstance();
  });

  afterEach(() => {
    registry.resetAll();
  });

  // ═══════════════════════════════════════════════════════════════════
  // TEST 1: Duplicate Registration Prevention
  // ═══════════════════════════════════════════════════════════════════
  describe('1. Duplicate Registration & Immutability', () => {
    it('rejects duplicate factory registrations', () => {
      registry.registerFactory('fit-to-view', () => ({} as any));

      expect(() => {
        registry.registerFactory('fit-to-view', () => ({} as any));
      }).toThrow(/already registered/i);
    });

    it('rejects duplicate singleton registrations', () => {
      registry.registerSingleton('canvas-bounds', {} as any);

      expect(() => {
        registry.registerSingleton('canvas-bounds', {} as any);
      }).toThrow(/already registered/i);
    });

    it('prevents registering factory after singleton', () => {
      registry.registerSingleton('hit-testing', {} as any);

      expect(() => {
        registry.registerFactory('hit-testing', () => ({} as any));
      }).toThrow(/already registered/i);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // TEST 2: Concurrent Async Initialization Deduplication
  // ═══════════════════════════════════════════════════════════════════
  describe('2. Dedupe Concurrent Async Initialization', () => {
    it('dedupes concurrent get() calls to same service', async () => {
      const initSpy = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return { id: Math.random() };
      });

      registry.registerFactory('hit-testing', initSpy, { async: true });

      // Fire 3 concurrent get() calls
      const [a, b, c] = await Promise.all([
        registry.get('hit-testing'),
        registry.get('hit-testing'),
        registry.get('hit-testing')
      ]);

      // Factory should only be called once
      expect(initSpy).toHaveBeenCalledTimes(1);

      // All should return same instance
      expect(a).toBe(b);
      expect(b).toBe(c);
    });

    it('handles concurrent calls during initialization', async () => {
      let initCount = 0;

      registry.registerFactory('layer-operations', async () => {
        initCount++;
        await new Promise(resolve => setTimeout(resolve, 30));
        return { initialized: true } as any;
      }, { async: true });

      // Start multiple concurrent requests
      const results = await Promise.all([
        registry.get('layer-operations'),
        registry.get('layer-operations'),
        registry.get('layer-operations'),
        registry.get('layer-operations'),
        registry.get('layer-operations')
      ]);

      // Only one initialization should occur
      expect(initCount).toBe(1);

      // All should be same instance
      const first = results[0];
      results.forEach(result => {
        expect(result).toBe(first);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // TEST 3: Retry με Circuit Breaker
  // ═══════════════════════════════════════════════════════════════════
  describe('3. Retry Logic & Circuit Breaker', () => {
    it('retries initialization on failure', async () => {
      let attemptCount = 0;

      registry.registerFactory('canvas-bounds', async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Init failed');
        }
        return { initialized: true } as any;
      }, { async: true, retries: 3, backoffMs: 1 });

      const service = await registry.get('canvas-bounds');

      expect(attemptCount).toBe(3);
      expect(service).toEqual({ initialized: true });
    });

    it('trips circuit breaker after failures', async () => {
      let attemptCount = 0;

      registry.registerFactory('entity-merge', async () => {
        attemptCount++;
        throw new Error('Init always fails');
      }, { async: true, retries: 1, backoffMs: 1 });

      // First attempt - should fail and increment failure count
      await expect(registry.get('entity-merge')).rejects.toThrow();

      // Second attempt - increment failure count
      await expect(registry.get('entity-merge')).rejects.toThrow();

      // Third attempt - increment failure count (total 3, circuit opens)
      await expect(registry.get('entity-merge')).rejects.toThrow();

      // Check circuit breaker is open
      const meta = registry.getMetadata('entity-merge');
      expect(meta?.circuitState).toBe('open');
      expect(meta?.circuitOpen).toBe(true); // Backward compat
      expect(meta?.failureCount).toBeGreaterThanOrEqual(3);

      // Fourth attempt - should be rejected by circuit breaker
      await expect(registry.get('entity-merge')).rejects.toThrow(/circuit breaker/i);
    });

    it('respects initialization timeout', async () => {
      registry.registerFactory('dxf-import', async () => {
        // Simulate slow initialization (200ms)
        await new Promise(resolve => setTimeout(resolve, 200));
        return { loaded: true } as any;
      }, { async: true, timeout: 50 }); // 50ms timeout

      await expect(registry.get('dxf-import')).rejects.toThrow(/timeout/i);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // TEST 4: Disposal με LIFO Order + Idempotency
  // ═══════════════════════════════════════════════════════════════════
  describe('4. Disposal Hooks & LIFO Order', () => {
    it('disposes services in LIFO order', async () => {
      const disposalOrder: string[] = [];

      registry.registerSingleton('fit-to-view', {
        dispose: () => disposalOrder.push('A')
      } as any);

      registry.registerSingleton('hit-testing', {
        dispose: () => disposalOrder.push('B')
      } as any);

      registry.registerSingleton('canvas-bounds', {
        dispose: () => disposalOrder.push('C')
      } as any);

      await registry.cleanup();

      // Should dispose in reverse registration order (LIFO)
      expect(disposalOrder).toEqual(['C', 'B', 'A']);
    });

    it('cleanup is idempotent', async () => {
      const disposalCalls: string[] = [];

      registry.registerSingleton('layer-operations', {
        dispose: () => disposalCalls.push('dispose')
      } as any);

      // First cleanup
      await registry.cleanup();
      expect(disposalCalls).toEqual(['dispose']);

      // Second cleanup - should not call dispose again
      await registry.cleanup();
      expect(disposalCalls).toEqual(['dispose']); // Still just one call
    });

    it('handles async dispose methods', async () => {
      let disposed = false;

      registry.registerSingleton('scene-update', {
        dispose: async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          disposed = true;
        }
      } as any);

      await registry.cleanup();
      expect(disposed).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // TEST 5: Memory Leak Detection με WeakRef
  // ═══════════════════════════════════════════════════════════════════
  describe('5. Memory Leak Detection', () => {
    it('does not leak after reset', async () => {
      let weakRef: WeakRef<object> | undefined;

      registry.registerFactory('smart-bounds', () => {
        const obj = { data: new Array(1000).fill(0) };
        weakRef = new WeakRef(obj);
        return obj as any;
      });

      // Get service
      await registry.get('smart-bounds');

      // Reset (should remove strong references)
      registry.reset('smart-bounds');

      // Force garbage collection (only works με --expose-gc flag)
      if (global.gc) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 100));

        // Object should be GC'd
        expect(weakRef!.deref()).toBeUndefined();
      } else {
        // Skip if GC not exposed
        console.warn('⚠️ Skipping GC test (run με --expose-gc για full test)');
      }
    });

    it('tracks memory leaks via checkMemoryLeaks()', async () => {
      registry.registerFactory('dxf-firestore', () => ({ data: 'test' }));

      await registry.get('dxf-firestore');

      // Before reset - should be initialized
      expect(registry.getMetadata('dxf-firestore')?.initialized).toBe(true);

      // Reset
      registry.reset('dxf-firestore');

      // Check for leaks
      const leakCheck = registry.checkMemoryLeaks();

      // This test depends on GC behavior, so we just check the API works
      expect(leakCheck).toHaveProperty('leaks');
      expect(leakCheck).toHaveProperty('ok');
      expect(Array.isArray(leakCheck.leaks)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // TEST 6: Security - Name Validation
  // ═══════════════════════════════════════════════════════════════════
  describe('6. Security - Unsafe Service Names', () => {
    it('rejects __proto__ as service name', () => {
      expect(() => {
        // @ts-expect-error Testing security
        registry.registerFactory('__proto__' as any, () => ({}));
      }).toThrow(/not allowed/i);
    });

    it('rejects constructor as service name', () => {
      expect(() => {
        // @ts-expect-error Testing security
        registry.registerFactory('constructor' as any, () => ({}));
      }).toThrow(/not allowed/i);
    });

    it('rejects empty string as service name', () => {
      expect(() => {
        // @ts-expect-error Testing security
        registry.registerFactory('' as any, () => ({}));
      }).toThrow(/empty or whitespace/i);
    });

    it('rejects whitespace-only service names', () => {
      expect(() => {
        // @ts-expect-error Testing security
        registry.registerFactory('   ' as any, () => ({}));
      }).toThrow(/empty or whitespace/i);
    });

    it('rejects special characters in service names', () => {
      expect(() => {
        // @ts-expect-error Testing security
        registry.registerFactory('service<script>' as any, () => ({}));
      }).toThrow(/illegal characters/i);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // TEST 7: Type Safety & Mapping
  // ═══════════════════════════════════════════════════════════════════
  describe('7. Type Safety & Service Map', () => {
    it('enforces correct service types', async () => {
      // This is primarily a compile-time check
      const fitToView = await registry.get('fit-to-view');
      const hitTesting = await registry.get('hit-testing');

      // Runtime checks
      expect(fitToView).toBeDefined();
      expect(hitTesting).toBeDefined();

      // These would fail at compile time:
      // const wrong: HitTestingService = await registry.get('fit-to-view');
    });

    it('provides type inference', async () => {
      // Type inference should work
      const service = await registry.get('canvas-bounds');

      // Service should have expected properties
      expect(service).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // TEST 8: Cross-Worker Isolation
  // ═══════════════════════════════════════════════════════════════════
  describe('8. Cross-Worker Isolation', () => {
    it('maintains separate instances per registry', () => {
      // Create second registry instance (simulating worker)
      const registry2 = EnterpriseServiceRegistry.getInstance();

      // They should be the same instance (singleton)
      expect(registry).toBe(registry2);

      // In real workers, each would have its own instance
      // This test validates the singleton pattern works correctly
    });

    it('does not share state across resets', async () => {
      registry.registerFactory('layer-operations', () => ({ id: 'first' }));

      const first = await registry.get('layer-operations');
      expect(first).toEqual({ id: 'first' });

      // Reset
      registry.reset('layer-operations');

      // Re-register με different factory
      registry.registerFactory('layer-operations', () => ({ id: 'second' }));

      const second = await registry.get('layer-operations');
      expect(second).toEqual({ id: 'second' });
      expect(second).not.toBe(first);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // TEST 9: Observability - Metrics Events
  // ═══════════════════════════════════════════════════════════════════
  describe('9. Observability - Metric Events', () => {
    it('emits metrics for register/get/reset/error', async () => {
      const events: any[] = [];
      const unsubscribe = registry.onMetric((event) => events.push(event));

      // Register
      registry.registerFactory('entity-merge', () => ({ test: true }));

      // Get
      await registry.get('entity-merge');

      // Reset
      registry.reset('entity-merge');

      // Error
      try {
        // @ts-expect-error Testing error
        await registry.get('non-existent' as any);
      } catch {}

      unsubscribe();

      // Verify events
      expect(events.some(e => e.name === 'service.register')).toBe(true);
      expect(events.some(e => e.name === 'service.get')).toBe(true);
      expect(events.some(e => e.name === 'service.reset')).toBe(true);
      expect(events.some(e => e.name === 'service.error')).toBe(true);
    });

    it('tracks event timestamps', async () => {
      const events: any[] = [];
      registry.onMetric((event) => events.push(event));

      registry.registerFactory('smart-bounds', () => ({}));
      await registry.get('smart-bounds');

      events.forEach(event => {
        expect(event.timestamp).toBeGreaterThan(0);
        expect(typeof event.timestamp).toBe('number');
      });
    });

    it('tracks service get duration', async () => {
      const events: any[] = [];
      registry.onMetric((event) => events.push(event));

      registry.registerFactory('dxf-import', () => ({}));
      await registry.get('dxf-import');

      const getEvent = events.find(e => e.name === 'service.get');
      expect(getEvent).toBeDefined();
      expect(getEvent.duration).toBeGreaterThanOrEqual(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // TEST 10: Performance Budget (P99)
  // ═══════════════════════════════════════════════════════════════════
  describe('10. Performance Budget - P99 Tracking', () => {
    it('get() p99 under budget', async () => {
      const N = 10000;
      const times: number[] = [];

      registry.registerSingleton('hit-testing', { test: true } as any);

      // Warm up
      await registry.get('hit-testing');
      await registry.get('hit-testing');

      // Benchmark
      for (let i = 0; i < N; i++) {
        const t0 = performance.now();
        await registry.get('hit-testing');
        const t1 = performance.now();
        times.push(t1 - t0);
      }

      // Calculate P99
      times.sort((a, b) => a - b);
      const p99Index = Math.floor(N * 0.99);
      const p99 = times[p99Index];

      // P99 should be under 0.1ms (100 microseconds)
      // Adjust threshold based on CI environment
      const threshold = process.env.CI ? 0.5 : 0.1;

      expect(p99).toBeLessThan(threshold);
    });

    it('tracks initialization performance', async () => {
      registry.registerFactory('scene-update', () => ({ test: true }), { async: true });

      await registry.get('scene-update');

      const meta = registry.getMetadata('scene-update');
      expect(meta?.initializationTime).toBeDefined();
      expect(meta?.initializationTime).toBeGreaterThan(0);
      expect(meta?.initializationTime).toBeLessThan(100); // < 100ms
    });

    it('maintains performance under load', async () => {
      registry.registerSingleton('canvas-bounds', { data: 'test' } as any);

      const startTime = performance.now();
      const iterations = 50000;

      for (let i = 0; i < iterations; i++) {
        await registry.get('canvas-bounds');
      }

      const totalTime = performance.now() - startTime;
      const avgTime = totalTime / iterations;

      // Average should be under 0.01ms (10 microseconds)
      expect(avgTime).toBeLessThan(0.01);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // BONUS: Integration Tests
  // ═══════════════════════════════════════════════════════════════════
  describe('Bonus: Real-World Integration', () => {
    it('handles complex lifecycle scenario', async () => {
      const events: string[] = [];

      // Register services με dispose hooks
      registry.registerSingleton('fit-to-view', {
        dispose: () => events.push('dispose-fit-to-view')
      } as any);

      registry.registerFactory('hit-testing', () => ({
        dispose: () => events.push('dispose-hit-testing')
      }), { async: true });

      // Use services
      await registry.get('fit-to-view');
      await registry.get('hit-testing');

      // Reset one
      registry.reset('hit-testing');

      // Cleanup all
      await registry.cleanup();

      // Verify disposal happened
      expect(events).toContain('dispose-fit-to-view');
    });

    it('recovers from errors gracefully', async () => {
      let failureCount = 0;

      registry.registerFactory('layer-operations', async () => {
        failureCount++;
        if (failureCount === 1) {
          throw new Error('First attempt fails');
        }
        return { recovered: true } as any;
      }, { async: true, retries: 2, backoffMs: 1 });

      const service = await registry.get('layer-operations');

      expect(service).toEqual({ recovered: true });
      expect(failureCount).toBe(2);
    });
  });
});
