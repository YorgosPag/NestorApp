/**
 * 🏢 SERVICES MODULE - ENTERPRISE EXPORTS
 *
 * **Purpose**: Centralized service exports με barrel pattern
 *
 * **Usage**:
 * ```typescript
 * // OLD (still supported):
 * import { FitToViewService } from '../../services/FitToViewService';
 *
 * // NEW (recommended):
 * import { serviceRegistry } from '@/subapps/dxf-viewer/services';
 * const fitToView = serviceRegistry.get('fit-to-view');
 * ```
 *
 * ⚠️ **TODO - MIGRATION REMINDER**:
 * 📌 Κάποια στιγμή πρέπει να μετατρέψουμε τα existing files από V1 → V2
 * 📖 Δες: MIGRATION_GUIDE_V1_TO_V2.md
 * ✅ Status: V2 is production ready, migration can happen incrementally
 * 🎯 Strategy: Migrate files as we touch them (no rush!)
 *
 * @module services
 */

// ===== SERVICE REGISTRY V1 (Deprecated - use V2) =====
export {
  ServiceRegistry,
  serviceRegistry,
  getService,
  hasService,
  logServiceStats,
  type ServiceMap,
  type ServiceName
} from './ServiceRegistry';

// ===== SERVICE REGISTRY V2 (Enterprise - RECOMMENDED) =====
export {
  EnterpriseServiceRegistry,
  enterpriseServiceRegistry,
  getService as getServiceV2,
  hasService as hasServiceV2,
  type ServiceMap as ServiceMapV2,
  type ServiceName as ServiceNameV2
} from './ServiceRegistry.v2';

// ===== SERVICE HEALTH MONITORING =====
export {
  ServiceHealthMonitor,
  serviceHealthMonitor,
  logHealthStatus,
  HealthStatus,
  type HealthCheckResult,
  type HealthReport
} from './ServiceHealthMonitor';

// ===== INDIVIDUAL SERVICES (Legacy compatibility) =====
export { FitToViewService } from './FitToViewService';
export { HitTestingService, hitTestingService } from './HitTestingService';
export { canvasBoundsService, type CanvasBoundsCache } from './CanvasBoundsService';
export { LayerOperationsService } from './LayerOperationsService';
export { EntityMergeService } from './EntityMergeService';
export { DxfFirestoreService } from './dxf-firestore.service';

// ===== ADDITIONAL SERVICES (Available via ServiceRegistry) =====
export { DxfImportService } from '../io/dxf-import';
export { SceneUpdateManager } from '../managers/SceneUpdateManager';
export { SmartBoundsManager } from '../utils/SmartBoundsManager';

// ===== TYPE EXPORTS =====
export type { BoundingBox as Bounds } from '../rendering/types/Types';
export type { DxfScene } from '../canvas-v2/dxf-canvas/dxf-types';
export type { ColorLayer } from '../canvas-v2/layer-canvas/layer-types';