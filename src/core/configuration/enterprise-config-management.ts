/**
 * ============================================================================
 * 🏢 ENTERPRISE CONFIGURATION MANAGEMENT SYSTEM — BARREL
 * ============================================================================
 *
 * MICROSOFT/GOOGLE-CLASS CONFIGURATION ARCHITECTURE
 *
 * ADR-314 Phase C.5.43: SRP split into focused modules under `enterprise-config/`.
 * This file re-exports the public API to preserve blast-radius.
 *
 * Modules:
 * - enterprise-config/types       → interfaces (Company/System/Project/User/Enterprise)
 * - enterprise-config/defaults    → DEFAULT_COMPANY_CONFIG, DEFAULT_SYSTEM_CONFIG
 * - enterprise-config/constants   → CONFIGURATION_COLLECTIONS, CONFIGURATION_DOCUMENTS
 * - enterprise-config/validators  → type guards + validators (standalone)
 * - enterprise-config/manager     → EnterpriseConfigurationManager (+ firestoreQueryService SSoT)
 * - enterprise-config/configuration-api → getConfigManager + ConfigurationAPI
 *
 * ADR-209: Email validation centralized. ADR-214: firestoreQueryService SSoT.
 *
 * ============================================================================
 */

// ============================================================================
// TYPES
// ============================================================================

export type {
  CompanyConfiguration,
  SystemConfiguration,
  ProjectTemplateConfiguration,
  UserPreferencesConfiguration,
  EnterpriseConfiguration
} from './enterprise-config/types';

// ============================================================================
// DEFAULTS
// ============================================================================

export {
  DEFAULT_COMPANY_CONFIG,
  DEFAULT_SYSTEM_CONFIG
} from './enterprise-config/defaults';

// ============================================================================
// CONSTANTS
// ============================================================================

export {
  CONFIGURATION_COLLECTIONS,
  CONFIGURATION_DOCUMENTS
} from './enterprise-config/constants';

// ============================================================================
// MANAGER + API
// ============================================================================

export { EnterpriseConfigurationManager } from './enterprise-config/manager';
export { getConfigManager, ConfigurationAPI } from './enterprise-config/configuration-api';

// ============================================================================
// DEFAULT EXPORT — preserves legacy `import X from './enterprise-config-management'`
// ============================================================================

import { EnterpriseConfigurationManager } from './enterprise-config/manager';
export default EnterpriseConfigurationManager;
