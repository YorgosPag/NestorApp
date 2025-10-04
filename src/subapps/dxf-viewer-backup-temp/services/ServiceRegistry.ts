/**
 * 🏢 SERVICE REGISTRY - ENTERPRISE ARCHITECTURE PATTERN
 *
 * **Purpose**: Centralized service management με dependency injection support
 *
 * **Enterprise Benefits**:
 * - Single source of truth για όλα τα services
 * - Lazy initialization (services δημιουργούνται μόνο όταν χρειάζονται)
 * - Testability (mock services για testing)
 * - Lifecycle management (initialization, cleanup)
 * - Service discovery (runtime service lookup)
 *
 * **Design Patterns**:
 * - Singleton Registry
 * - Service Locator
 * - Dependency Injection Container
 *
 * @module services/ServiceRegistry
 * @created 2025-09-30
 * @enterprise-grade
 */

import { FitToViewService } from './FitToViewService';
import { HitTestingService } from './HitTestingService';
import { canvasBoundsService, type CanvasBoundsCache } from './CanvasBoundsService';
import { LayerOperationsService } from './LayerOperationsService';
import { EntityMergeService } from './EntityMergeService';
import { DxfFirestoreService } from './dxf-firestore.service';
import { DxfImportService } from '../io/dxf-import';
import { SceneUpdateManager } from '../managers/SceneUpdateManager';
import { SmartBoundsManager } from '../utils/SmartBoundsManager';

/**
 * Service type definitions για type-safe registry
 */
export interface ServiceMap {
  'fit-to-view': typeof FitToViewService; // Static class
  'hit-testing': HitTestingService; // Instance
  'canvas-bounds': typeof canvasBoundsService; // Singleton instance
  'layer-operations': LayerOperationsService; // Instance
  'entity-merge': EntityMergeService; // Instance
  'dxf-firestore': typeof DxfFirestoreService; // Static class
  'dxf-import': DxfImportService; // Instance
  'scene-update': SceneUpdateManager; // Instance
  'smart-bounds': SmartBoundsManager; // Instance
}

/**
 * Service names as const για autocomplete
 */
export type ServiceName = keyof ServiceMap;

/**
 * Service factory function type
 */
type ServiceFactory<T = unknown> = () => T;

/**
 * Service metadata για debugging και monitoring
 */
interface ServiceMetadata {
  name: ServiceName;
  initialized: boolean;
  instanceCount: number;
  lastAccessed: number;
  initializationTime?: number;
}

/**
 * 🏢 ENTERPRISE SERVICE REGISTRY
 *
 * Centralized management για όλα τα application services
 */
export class ServiceRegistry {
  private static instance: ServiceRegistry;
  private services = new Map<ServiceName, unknown>();
  private factories = new Map<ServiceName, ServiceFactory>();
  private metadata = new Map<ServiceName, ServiceMetadata>();

  private constructor() {
    this.registerDefaultServices();
  }

  /**
   * Singleton instance access
   */
  public static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  /**
   * 📝 Register default application services
   */
  private registerDefaultServices(): void {
    // Static class services (no instantiation needed - use class methods directly)
    this.registerSingleton('fit-to-view', FitToViewService as any);
    this.registerSingleton('dxf-firestore', DxfFirestoreService as any);

    // Instance-based services (lazy initialization)
    this.registerFactory('hit-testing', () => new HitTestingService());
    this.registerFactory('layer-operations', () => new LayerOperationsService());
    this.registerFactory('entity-merge', () => new EntityMergeService());
    this.registerFactory('dxf-import', () => new DxfImportService());
    this.registerFactory('scene-update', () => new SceneUpdateManager());
    this.registerFactory('smart-bounds', () => new SmartBoundsManager());

    // Singleton services (already instantiated)
    this.registerSingleton('canvas-bounds', canvasBoundsService);
  }

  /**
   * 🔧 Register a service factory (lazy initialization)
   *
   * @param name - Service identifier
   * @param factory - Function που δημιουργεί το service instance
   */
  public registerFactory<K extends ServiceName>(
    name: K,
    factory: ServiceFactory<ServiceMap[K]>
  ): void {
    this.factories.set(name, factory as ServiceFactory);
    this.metadata.set(name, {
      name,
      initialized: false,
      instanceCount: 0,
      lastAccessed: 0
    });
  }

  /**
   * 🔧 Register a singleton service (already instantiated)
   *
   * @param name - Service identifier
   * @param instance - Pre-created service instance
   */
  public registerSingleton<K extends ServiceName>(
    name: K,
    instance: ServiceMap[K]
  ): void {
    this.services.set(name, instance);
    this.metadata.set(name, {
      name,
      initialized: true,
      instanceCount: 1,
      lastAccessed: performance.now()
    });
  }

  /**
   * 🎯 Get service instance (type-safe)
   *
   * **Lazy initialization**: Service δημιουργείται την πρώτη φορά που ζητηθεί
   *
   * @param name - Service identifier
   * @returns Service instance
   *
   * @example
   * ```typescript
   * const registry = ServiceRegistry.getInstance();
   * const fitToView = registry.get('fit-to-view');
   * fitToView.calculateFitToViewTransform(scene, layers, viewport);
   * ```
   */
  public get<K extends ServiceName>(name: K): ServiceMap[K] {
    const startTime = performance.now();

    // Check if already instantiated
    let service = this.services.get(name) as ServiceMap[K] | undefined;

    if (!service) {
      // Lazy initialization
      const factory = this.factories.get(name);
      if (!factory) {
        throw new Error(`Service "${name}" is not registered in ServiceRegistry`);
      }

      service = factory() as ServiceMap[K];
      this.services.set(name, service);

      // Update metadata
      const meta = this.metadata.get(name);
      if (meta) {
        meta.initialized = true;
        meta.instanceCount++;
        meta.initializationTime = performance.now() - startTime;
      }
    }

    // Update last accessed time
    const meta = this.metadata.get(name);
    if (meta) {
      meta.lastAccessed = performance.now();
    }

    return service;
  }

  /**
   * 🔍 Check if service is registered
   */
  public has(name: ServiceName): boolean {
    return this.factories.has(name) || this.services.has(name);
  }

  /**
   * 🔄 Reset service instance (force re-initialization)
   *
   * **Use case**: Testing, hot reload, service state corruption
   */
  public reset(name: ServiceName): void {
    this.services.delete(name);
    const meta = this.metadata.get(name);
    if (meta) {
      meta.initialized = false;
      meta.instanceCount = 0;
    }
  }

  /**
   * 🔄 Reset all services
   *
   * **Use case**: Application shutdown, testing cleanup
   */
  public resetAll(): void {
    this.services.clear();
    this.metadata.forEach(meta => {
      meta.initialized = false;
      meta.instanceCount = 0;
    });
  }

  /**
   * 🔍 Get service metadata (για debugging)
   */
  public getMetadata(name: ServiceName): ServiceMetadata | undefined {
    return this.metadata.get(name);
  }

  /**
   * 📊 Get registry statistics
   */
  public getStats() {
    const stats = {
      totalRegistered: this.factories.size + this.services.size,
      totalInitialized: Array.from(this.metadata.values()).filter(m => m.initialized).length,
      services: Array.from(this.metadata.entries()).map(([name, meta]) => ({
        name,
        initialized: meta.initialized,
        lastAccessed: meta.lastAccessed ? new Date(meta.lastAccessed).toISOString() : 'never',
        initTime: meta.initializationTime ? `${meta.initializationTime.toFixed(2)}ms` : 'N/A'
      }))
    };

    return stats;
  }

  /**
   * 🧹 Cleanup - για production environments
   *
   * Releases all service references για garbage collection
   */
  public cleanup(): void {
    this.services.clear();
    this.factories.clear();
    this.metadata.clear();
  }
}

/**
 * 🎯 Global registry instance (convenience export)
 *
 * **Usage**:
 * ```typescript
 * import { serviceRegistry } from '@/subapps/dxf-viewer/services/ServiceRegistry';
 *
 * const fitToView = serviceRegistry.get('fit-to-view');
 * const hitTesting = serviceRegistry.get('hit-testing');
 * ```
 */
export const serviceRegistry = ServiceRegistry.getInstance();

/**
 * 🔧 Convenience getters (για backward compatibility)
 */
export const getService = <K extends ServiceName>(name: K): ServiceMap[K] => {
  return serviceRegistry.get(name);
};

/**
 * 🔍 Type guard για service existence check
 */
export const hasService = (name: ServiceName): boolean => {
  return serviceRegistry.has(name);
};

/**
 * 📊 Development helper - log registry stats
 */
export const logServiceStats = (): void => {
  if (process.env.NODE_ENV === 'development') {
    console.group('🏢 Service Registry Statistics');
    console.table(serviceRegistry.getStats().services);
    console.groupEnd();
  }
};