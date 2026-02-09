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
import { DocumentRequestModule } from './uc-006-document-request';
// ── ADR-145: Super Admin Command Modules ──
import { AdminContactSearchModule } from './uc-010-admin-contact-search';
import { AdminProjectStatusModule } from './uc-011-admin-project-status';
import { AdminSendEmailModule } from './uc-012-admin-send-email';
import { AdminUnitStatsModule } from './uc-013-admin-unit-stats';

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

  // UC-006: Document & Financial Requests (ADR-145)
  registry.register(new DocumentRequestModule());

  // ── ADR-145: Super Admin Command Modules ──

  // UC-010: Admin Contact Search
  registry.register(new AdminContactSearchModule());

  // UC-011: Admin Project Status
  registry.register(new AdminProjectStatusModule());

  // UC-012: Admin Send Email
  registry.register(new AdminSendEmailModule());

  // UC-013: Admin Unit Stats
  registry.register(new AdminUnitStatsModule());

  // UC-014: Admin Fallback — NOT registered here (no global intent mapping)
  // It is invoked explicitly by the pipeline worker for admin messages
  // when no other admin module matches.

  initialized = true;

  const stats = registry.getStats();
  logger.info('Pipeline modules registered', {
    totalModules: stats.totalModules,
    totalIntentMappings: stats.totalIntentMappings,
    modules: stats.modules.map(m => m.moduleId),
  });
}
