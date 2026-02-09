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
import { PropertySearchModule } from './uc-003-property-search';
import { ComplaintModule } from './uc-004-complaint';
import { GeneralInquiryModule } from './uc-005-general-inquiry';

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

  // UC-003: Property Search
  registry.register(new PropertySearchModule());

  // UC-004: Complaint / Defect Report (ADR-132)
  registry.register(new ComplaintModule());

  // UC-005: General Inquiry — Catch-All (ADR-132)
  registry.register(new GeneralInquiryModule());

  initialized = true;

  const stats = registry.getStats();
  logger.info('Pipeline modules registered', {
    totalModules: stats.totalModules,
    totalIntentMappings: stats.totalIntentMappings,
    modules: stats.modules.map(m => m.moduleId),
  });
}
