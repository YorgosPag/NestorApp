/**
 * =============================================================================
 * 🏢 ENTERPRISE: PIPELINE MODULE REGISTRATION
 * =============================================================================
 *
 * Bootstrap file that registers all available UC modules with the pipeline.
 * Called lazily (via dynamic import) during worker/operator-inbox execution.
 * Idempotent — safe to call multiple times.
 *
 * @module services/ai-pipeline/modules/register-modules
 * @see ADR-080 (Pipeline Implementation)
 * @see ModuleRegistry (../module-registry.ts)
 */

import 'server-only';

import { getModuleRegistry } from '../module-registry';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { AppointmentModule } from './uc-001-appointment';

const logger = createModuleLogger('PIPELINE_MODULE_REGISTRATION');

let initialized = false;

/**
 * Register all available UC modules with the pipeline registry.
 *
 * Called once during worker initialization — lazy, idempotent.
 * New UC modules should be added here as they are implemented.
 */
export function registerAllPipelineModules(): void {
  if (initialized) return;

  const registry = getModuleRegistry();

  // UC-001: Appointment Request
  registry.register(new AppointmentModule());

  // Future modules:
  // registry.register(new InvoiceModule());         // UC-002
  // registry.register(new DefectReportModule());     // UC-003
  // registry.register(new PropertySearchModule());   // UC-004

  initialized = true;

  const stats = registry.getStats();
  logger.info('Pipeline modules registered', {
    totalModules: stats.totalModules,
    totalIntentMappings: stats.totalIntentMappings,
    modules: stats.modules.map(m => m.moduleId),
  });
}
