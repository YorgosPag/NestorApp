/**
 * Service Registry V2 - Type Definitions
 *
 * Types, interfaces, and enums for the Enterprise Service Registry.
 * Extracted from ServiceRegistry.v2.ts per ADR-065 (file size compliance).
 *
 * @module services/service-registry-types
 */

import type { FitToViewService } from './FitToViewService';
import type { HitTestingService } from './HitTestingService';
import type { canvasBoundsService } from './CanvasBoundsService';
import type { LayerOperationsService } from './LayerOperationsService';
import type { EntityMergeService } from './EntityMergeService';
import type { DxfFirestoreService } from './dxf-firestore.service';
import type { DxfImportService } from '../io/dxf-import';
import type { SceneUpdateManager } from '../managers/SceneUpdateManager';
import type { SmartBoundsManager } from '../utils/SmartBoundsManager';

/**
 * Service type definitions for type-safe registry
 */
export interface ServiceMap {
  'fit-to-view': typeof FitToViewService;
  'hit-testing': HitTestingService;
  'canvas-bounds': typeof canvasBoundsService;
  'layer-operations': LayerOperationsService;
  'entity-merge': EntityMergeService;
  'dxf-firestore': typeof DxfFirestoreService;
  'dxf-import': DxfImportService;
  'scene-update': SceneUpdateManager;
  'smart-bounds': SmartBoundsManager;
}

export type ServiceName = keyof ServiceMap;

/**
 * Service factory options
 */
export interface ServiceFactoryOptions {
  async?: boolean;
  retries?: number;
  backoffMs?: number;
  timeout?: number;
}

/**
 * Service factory function type
 */
export type ServiceFactory<T = unknown> = () => T | Promise<T>;

/**
 * Disposable service interface
 */
export interface Disposable {
  dispose?: () => void | Promise<void>;
}

/**
 * Circuit breaker states
 */
export enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

/**
 * Service metadata with extended tracking
 */
export interface ServiceMetadata {
  name: ServiceName;
  initialized: boolean;
  instanceCount: number;
  lastAccessed: number;
  initializationTime?: number;
  circuitState: CircuitState;
  circuitOpen?: boolean;
  failureCount: number;
  lastFailure?: number;
  disposed: boolean;
  registrationOrder: number;
}

/**
 * Metric event types
 */
export type MetricEvent =
  | { name: 'service.register'; service: ServiceName; timestamp: number }
  | { name: 'service.get'; service: ServiceName; duration: number; timestamp: number }
  | { name: 'service.reset'; service: ServiceName; timestamp: number }
  | { name: 'service.error'; service: ServiceName; error: string; timestamp: number }
  | { name: 'service.dispose'; service: ServiceName; timestamp: number };

/**
 * Metric listener callback
 */
export type MetricListener = (event: MetricEvent) => void;
