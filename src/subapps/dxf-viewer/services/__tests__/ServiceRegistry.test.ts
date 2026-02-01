/**
 * UNIT TESTS - ServiceRegistry
 *
 * Enterprise-grade testing για το Service Registry pattern
 *
 * Test Coverage:
 * - Service registration (factory & singleton)
 * - Service retrieval (lazy initialization)
 * - Service lifecycle (reset, cleanup)
 * - Type safety
 * - Error handling
 * - Performance monitoring
 *
 * @enterprise-grade
 * @updated 2026-01-02 - Fixed CI/CD compatibility issues
 */

// ✅ ENTERPRISE FIX: Mock all service dependencies BEFORE importing ServiceRegistry
// This prevents module resolution errors in CI environment

// Mock FitToViewService
jest.mock('../FitToViewService', () => ({
  FitToViewService: {
    calculateFitToViewTransform: jest.fn().mockReturnValue({ scale: 1, offsetX: 0, offsetY: 0 })
  }
}));

// Mock HitTestingService
jest.mock('../HitTestingService', () => ({
  HitTestingService: jest.fn().mockImplementation(() => ({
    hitTest: jest.fn().mockReturnValue(null)
  }))
}));

// Mock CanvasBoundsService
// Note: Using literal values 800x600 to match VIEWPORT_DEFAULTS from transform-config.ts
jest.mock('../CanvasBoundsService', () => ({
  canvasBoundsService: {
    getBounds: jest.fn().mockReturnValue({ x: 0, y: 0, width: 800, height: 600 }), // Matches VIEWPORT_DEFAULTS
    updateBounds: jest.fn()
  }
}));

// Mock LayerOperationsService
jest.mock('../LayerOperationsService', () => ({
  LayerOperationsService: jest.fn().mockImplementation(() => ({
    getVisibleLayers: jest.fn().mockReturnValue([])
  }))
}));

// Mock EntityMergeService
jest.mock('../EntityMergeService', () => ({
  EntityMergeService: jest.fn().mockImplementation(() => ({
    merge: jest.fn()
  }))
}));

// Mock DxfFirestoreService
jest.mock('../dxf-firestore.service', () => ({
  DxfFirestoreService: {
    save: jest.fn(),
    load: jest.fn()
  }
}));

// Mock DxfImportService
jest.mock('../../io/dxf-import', () => ({
  DxfImportService: jest.fn().mockImplementation(() => ({
    import: jest.fn()
  }))
}));

// Mock SceneUpdateManager
jest.mock('../../managers/SceneUpdateManager', () => ({
  SceneUpdateManager: jest.fn().mockImplementation(() => ({
    update: jest.fn()
  }))
}));

// Mock SmartBoundsManager
jest.mock('../../utils/SmartBoundsManager', () => ({
  SmartBoundsManager: jest.fn().mockImplementation(() => ({
    calculate: jest.fn()
  }))
}));

// ✅ Now safe to import ServiceRegistry (all deps are mocked)
import { ServiceRegistry } from '../ServiceRegistry';
import type { ServiceName } from '../ServiceRegistry';

describe('ServiceRegistry', () => {
  let registry: ServiceRegistry;

  beforeEach(() => {
    // ✅ ENTERPRISE: Clear singleton instance before each test for isolation
    // @ts-expect-error - Accessing private static for test reset
    ServiceRegistry.instance = undefined;

    // Get fresh registry instance
    registry = ServiceRegistry.getInstance();
  });

  afterEach(() => {
    // Cleanup after each test
    registry.resetAll();
  });

  describe('Singleton Pattern', () => {
    it('should return same instance on multiple calls', () => {
      const instance1 = ServiceRegistry.getInstance();
      const instance2 = ServiceRegistry.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Service Registration', () => {
    it('should register factory services', () => {
      expect(registry.has('fit-to-view')).toBe(true);
      expect(registry.has('hit-testing')).toBe(true);
      expect(registry.has('layer-operations')).toBe(true);
    });

    it('should register singleton services', () => {
      expect(registry.has('canvas-bounds')).toBe(true);
    });

    it('should return false for non-registered services', () => {
      expect(registry.has('non-existent' as ServiceName)).toBe(false);
    });
  });

  describe('Service Retrieval - Lazy Initialization', () => {
    it('should create service on first access', () => {
      // 🔧 FIX: Use factory-based service (hit-testing) instead of singleton (fit-to-view)
      // Singletons are already initialized, so we need a factory-based service for lazy init test
      const metadata = registry.getMetadata('hit-testing');
      expect(metadata?.initialized).toBe(false);

      // First access - triggers lazy initialization
      const service = registry.get('hit-testing');
      expect(service).toBeDefined();

      const updatedMetadata = registry.getMetadata('hit-testing');
      expect(updatedMetadata?.initialized).toBe(true);
    });

    it('should return same instance on multiple calls', () => {
      const service1 = registry.get('fit-to-view');
      const service2 = registry.get('fit-to-view');

      expect(service1).toBe(service2);
    });

    it('should throw error for non-registered service', () => {
      expect(() => {
        registry.get('invalid-service' as ServiceName);
      }).toThrow('Service "invalid-service" is not registered');
    });

    it('should return singleton instances immediately', () => {
      const metadata = registry.getMetadata('canvas-bounds');
      expect(metadata?.initialized).toBe(true); // Already initialized

      const service = registry.get('canvas-bounds');
      expect(service).toBeDefined();
    });
  });

  describe('Service Lifecycle - Reset', () => {
    it('should reset individual service', () => {
      // 🔧 FIX: Use factory-based service (layer-operations) instead of singleton (fit-to-view)
      // Singletons cannot be reset because they don't have factories
      // Initialize service
      const service1 = registry.get('layer-operations');
      expect(registry.getMetadata('layer-operations')?.initialized).toBe(true);

      // Reset
      registry.reset('layer-operations');
      expect(registry.getMetadata('layer-operations')?.initialized).toBe(false);

      // Get again - should create new instance
      const service2 = registry.get('layer-operations');
      expect(service2).toBeDefined();
      expect(service1).not.toBe(service2); // Different instances
    });

    it('should reset all services', () => {
      // Initialize multiple services
      registry.get('fit-to-view');
      registry.get('hit-testing');

      expect(registry.getMetadata('fit-to-view')?.initialized).toBe(true);
      expect(registry.getMetadata('hit-testing')?.initialized).toBe(true);

      // Reset all
      registry.resetAll();

      expect(registry.getMetadata('fit-to-view')?.initialized).toBe(false);
      expect(registry.getMetadata('hit-testing')?.initialized).toBe(false);
    });
  });

  describe('Metadata & Monitoring', () => {
    it('should track service metadata', () => {
      const service = registry.get('fit-to-view');
      const metadata = registry.getMetadata('fit-to-view');

      expect(metadata).toBeDefined();
      expect(metadata?.name).toBe('fit-to-view');
      expect(metadata?.initialized).toBe(true);
      expect(metadata?.instanceCount).toBeGreaterThan(0);
      expect(metadata?.lastAccessed).toBeGreaterThan(0);
    });

    it('should measure initialization time', () => {
      // 🔧 FIX: Use factory-based service (dxf-import) instead of singleton (fit-to-view)
      // Only factory-based services measure initialization time
      const service = registry.get('dxf-import');
      const metadata = registry.getMetadata('dxf-import');

      expect(metadata?.initializationTime).toBeDefined();
      expect(metadata?.initializationTime).toBeGreaterThanOrEqual(0);
    });

    it('should update last accessed time', () => {
      registry.get('fit-to-view');
      const firstAccess = registry.getMetadata('fit-to-view')?.lastAccessed || 0;

      // Wait a bit
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      return delay(10).then(() => {
        registry.get('fit-to-view');
        const secondAccess = registry.getMetadata('fit-to-view')?.lastAccessed || 0;

        expect(secondAccess).toBeGreaterThan(firstAccess);
      });
    });
  });

  describe('Statistics', () => {
    it('should return registry statistics', () => {
      // Initialize some services
      registry.get('fit-to-view');
      registry.get('canvas-bounds');

      const stats = registry.getStats();

      expect(stats.totalRegistered).toBeGreaterThan(0);
      expect(stats.totalInitialized).toBeGreaterThanOrEqual(2);
      expect(stats.services).toBeInstanceOf(Array);
      expect(stats.services.length).toBeGreaterThan(0);
    });

    it('should track individual service stats', () => {
      registry.get('fit-to-view');

      const stats = registry.getStats();
      const fitToViewStats = stats.services.find(s => s.name === 'fit-to-view');

      expect(fitToViewStats).toBeDefined();
      expect(fitToViewStats?.initialized).toBe(true);
      expect(fitToViewStats?.lastAccessed).not.toBe('never');
    });
  });

  describe('Type Safety', () => {
    it('should enforce correct service types', () => {
      const fitToView = registry.get('fit-to-view');
      const hitTesting = registry.get('hit-testing');
      const canvasBounds = registry.get('canvas-bounds');

      // These should not throw TypeScript errors
      expect(fitToView).toHaveProperty('calculateFitToViewTransform');
      expect(hitTesting).toHaveProperty('hitTest');
      expect(canvasBounds).toHaveProperty('getBounds');
    });
  });

  describe('Performance', () => {
    it('should initialize services quickly (< 5ms)', () => {
      const start = performance.now();
      registry.get('fit-to-view');
      const end = performance.now();

      const duration = end - start;
      expect(duration).toBeLessThan(5);
    });

    it('should retrieve cached services instantly (< 0.1ms)', () => {
      // Initialize
      registry.get('fit-to-view');

      // Measure cached retrieval
      const start = performance.now();
      registry.get('fit-to-view');
      const end = performance.now();

      const duration = end - start;
      expect(duration).toBeLessThan(0.1);
    });

    it('should handle multiple service retrievals efficiently', () => {
      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        registry.get('fit-to-view');
        registry.get('hit-testing');
        registry.get('canvas-bounds');
      }

      const end = performance.now();
      const duration = end - start;

      // 3000 retrievals should take < 100ms
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup all service references', () => {
      // Initialize services
      registry.get('fit-to-view');
      registry.get('hit-testing');

      expect(registry.getStats().totalInitialized).toBeGreaterThan(0);

      // Cleanup
      registry.cleanup();

      // After cleanup, registry should be empty
      // Note: This test assumes cleanup() clears metadata too
      const statsAfterCleanup = registry.getStats();
      expect(statsAfterCleanup.totalRegistered).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid service names gracefully', () => {
      expect(() => {
        registry.get('invalid' as ServiceName);
      }).toThrow();
    });

    it('should handle reset of non-initialized service', () => {
      // Should not throw
      expect(() => {
        registry.reset('layer-operations');
      }).not.toThrow();
    });
  });

  describe('Real-World Usage Scenarios', () => {
    it('should support dependency injection pattern', () => {
      // Get services for component
      const fitToView = registry.get('fit-to-view');
      const hitTesting = registry.get('hit-testing');

      // Use services
      expect(fitToView).toBeDefined();
      expect(hitTesting).toBeDefined();

      // Services should be independent
      expect(fitToView).not.toBe(hitTesting);
    });

    it('should support testing with service mocking', () => {
      // This test demonstrates how to mock services
      // In real tests, you would register a mock service

      // Reset service
      registry.reset('fit-to-view');

      // In a real test, you'd do:
      // const mockService = new MockFitToViewService();
      // registry.registerSingleton('fit-to-view', mockService);

      // For this test, just verify reset works
      expect(registry.getMetadata('fit-to-view')?.initialized).toBe(false);
    });
  });
});