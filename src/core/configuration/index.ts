/**
 * ============================================================================
 * 🏢 ENTERPRISE CONFIGURATION MANAGEMENT SYSTEM - PUBLIC API
 * ============================================================================
 *
 * SINGLE IMPORT POINT ΓΙΑ ΤΟ ΟΛΟΚΛΗΡΟ CONFIGURATION SYSTEM
 *
 * Αυτό είναι το κύριο entry point για όλο το Enterprise Configuration
 * Management System. Προσφέρει clean, type-safe API για όλα τα
 * configuration-related operations.
 *
 * Τηρεί όλους τους κανόνες CLAUDE.md:
 * - ΟΧΙ any types ✅
 * - Κεντρικοποιημένες εξαγωγές ✅
 * - Clean public API ✅
 * - Full TypeScript support ✅
 *
 * Features:
 * - Single import για όλες τις λειτουργίες
 * - Type-safe interfaces
 * - React hooks για UI integration
 * - Migration tools
 * - Testing utilities
 * - Admin interface components
 *
 * ============================================================================
 */

// ============================================================================
// INTERNAL IMPORTS (for local usage in convenience APIs below)
// ============================================================================

// 🏢 ENTERPRISE: Import as local variables for use in convenience objects
import {
  ConfigurationAPI as _ConfigurationAPI,
  getConfigManager as _getConfigManager
} from './enterprise-config-management';
import {
  ConfigurationTestingAPI as _ConfigurationTestingAPI,
  type TestSuiteResult as _TestSuiteResult
} from './testing-validation';
import {
  MigrationAPI as _MigrationAPI,
  type MigrationResult as _MigrationResult
} from './hardcoded-values-migration';

// ============================================================================
// 📊 CORE CONFIGURATION SYSTEM EXPORTS
// ============================================================================

/**
 * Core Configuration Management
 * Κεντρικό σύστημα διαχείρισης configurations
 */
export {
  EnterpriseConfigurationManager,
  getConfigManager,
  ConfigurationAPI,
  CONFIGURATION_COLLECTIONS,
  CONFIGURATION_DOCUMENTS
} from './enterprise-config-management';

/**
 * Configuration Types & Interfaces
 * Όλα τα TypeScript types για type safety
 */
export type {
  CompanyConfiguration,
  SystemConfiguration,
  ProjectTemplateConfiguration,
  UserPreferencesConfiguration,
  EnterpriseConfiguration
} from './enterprise-config-management';

/**
 * Default Configuration Values
 * Fallback configurations για development
 */
export {
  DEFAULT_COMPANY_CONFIG,
  DEFAULT_SYSTEM_CONFIG
} from './enterprise-config-management';

// ============================================================================
// 🔄 MIGRATION SYSTEM EXPORTS
// ============================================================================

/**
 * Migration Engine & Tools
 * Σύστημα migration από hardcoded values στη βάση
 */
export {
  HardcodedValuesMigrationEngine,
  MigrationAPI
} from './hardcoded-values-migration';

/**
 * Migration Types
 */
export type {
  MigrationResult,
  MigrationProgress
} from './hardcoded-values-migration';

// ============================================================================
// 🎣 REACT HOOKS EXPORTS
// ============================================================================

/**
 * React Hooks για Configuration
 * Easy-to-use React hooks για UI integration
 */
export {
  useCompanyConfig,
  useSystemConfig,
  useProjectTemplates,
  useConfigQuickAccess,
  useCompanyEmail,
  useAppUrls,
  useWebhookUrls,
  useCompanyConfigSSR,
  useSystemConfigSSR,
  useEnterpriseConfig
} from './useEnterpriseConfig';

/**
 * Hook Types & Interfaces
 */
export type {
  UseCompanyConfigResult,
  UseSystemConfigResult,
  UseConfigQuickAccessResult,
  UseProjectTemplatesResult,
  UseEnterpriseConfigResult,
  ConfigurationOptions
} from './useEnterpriseConfig';

// Set default export για primary hook
export { default as useConfiguration } from './useEnterpriseConfig';

// ============================================================================
// 🎨 UI COMPONENTS EXPORTS
// ============================================================================

/**
 * Admin Interface Components
 * Ready-to-use React components για configuration management
 */
export { ConfigurationAdminInterface } from './admin-interface';

// ============================================================================
// 🧪 TESTING & VALIDATION EXPORTS
// ============================================================================

/**
 * Testing & Validation Suite
 * Comprehensive testing tools για configuration system
 */
export {
  ConfigurationTestingSuite,
  ConfigurationTestingAPI
} from './testing-validation';

/**
 * Testing Types
 */
export type {
  TestResult,
  ValidationResult,
  BenchmarkResult,
  SecurityAuditResult,
  TestSuiteResult
} from './testing-validation';

// ============================================================================
// 🎯 CONVENIENCE API - QUICK ACCESS METHODS
// ============================================================================

/**
 * Quick Access API για common operations
 * Shortcut methods για frequently used configurations
 */
export const QuickConfigAPI = {
  /**
   * Get company email (αντικαθιστά hardcoded 'info@pagonis.gr')
   */
  getCompanyEmail: _ConfigurationAPI.getCompanyEmail,

  /**
   * Get company phone (αντικαθιστά hardcoded phone numbers)
   */
  getCompanyPhone: _ConfigurationAPI.getCompanyPhone,

  /**
   * Get app base URL — από το ΕΝΑ SSoT (`lib/http/public-origin`), ADR-853 §19.
   * ⚠️ Το σχόλιο έλεγε «αντικαθιστά hardcoded nestor-app.vercel.app» ενώ η ίδια η
   * προεπιλογή μάντευε `localhost:3001`. Η αντικατάσταση **δεν είχε γίνει**.
   */
  getAppBaseUrl: _ConfigurationAPI.getAppBaseUrl,

  /**
   * Get webhook URLs (αντικαθιστά hardcoded webhook endpoints)
   */
  getWebhookUrls: _ConfigurationAPI.getWebhookUrls,

  /**
   * Get API endpoints (αντικαθιστά hardcoded API URLs)
   */
  getApiEndpoints: _ConfigurationAPI.getApiEndpoints
} as const;

// ============================================================================
// 🚀 MAIN CONFIGURATION INSTANCE - SINGLETON ACCESS
// ============================================================================

/**
 * Global Configuration Manager Instance
 * Singleton instance για global access
 */
export const GlobalConfigManager = _getConfigManager();

// ============================================================================
// 📋 CONFIGURATION STATUS CHECKER
// ============================================================================

/**
 * Configuration System Health Check
 * Utility για έλεγχο της κατάστασης του configuration system
 */
export const ConfigurationHealthCheck = {
  /**
   * Check if configuration system is properly initialized
   */
  async isSystemHealthy(): Promise<boolean> {
    try {
      const validation = await _ConfigurationTestingAPI.executeQuickValidation();
      return validation.isValid && validation.score >= 80;
    } catch {
      return false;
    }
  },

  /**
   * Get system status summary
   */
  async getSystemStatus(): Promise<{
    isHealthy: boolean;
    score: number;
    errors: readonly string[];
    warnings: readonly string[];
  }> {
    try {
      const validation = await _ConfigurationTestingAPI.executeQuickValidation();
      return {
        isHealthy: validation.isValid,
        score: validation.score,
        errors: validation.errors,
        warnings: validation.warnings
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Health check failed';
      return {
        isHealthy: false,
        score: 0,
        errors: [errorMessage],
        warnings: []
      };
    }
  },

  /**
   * Perform full system test
   */
  async performFullTest(): Promise<_TestSuiteResult> {
    return _ConfigurationTestingAPI.executeFullSuite();
  }
} as const;

// ============================================================================
// 💫 MIGRATION UTILITIES - EASY ACCESS
// ============================================================================

/**
 * Migration Utilities για easy access
 */
export const MigrationUtils = {
  /**
   * Execute migration preview (dry run)
   */
  previewMigration: (): Promise<_MigrationResult> => _MigrationAPI.executeDryRun(),

  /**
   * Execute actual migration
   */
  executeMigration: (createBackup: boolean = true): Promise<_MigrationResult> =>
    _MigrationAPI.executeMigration({ createBackup }),

  /**
   * Rollback migration
   */
  rollbackMigration: (backupId: string): Promise<boolean> => _MigrationAPI.rollback(backupId)
} as const;

// ============================================================================
// 📚 DOCUMENTATION & USAGE EXAMPLES
// ============================================================================

/**
 * Usage Examples για quick reference
 */
export const UsageExamples = {
  /**
   * Basic configuration loading
   */
  basicUsage: `
    import { useCompanyConfig, useSystemConfig } from '@/core/configuration';

    function MyComponent() {
      const { company, isLoading, error } = useCompanyConfig();
      const { system } = useSystemConfig();

      if (isLoading) return <div>Loading...</div>;
      if (error) return <div>Error: {error}</div>;

      return (
        <div>
          <h1>{company.name}</h1>
          <p>Environment: {system.app.environment}</p>
        </div>
      );
    }
  `,

  /**
   * Quick access usage
   */
  quickAccess: `
    import { useConfigQuickAccess } from '@/core/configuration';

    function ContactInfo() {
      const { companyEmail, companyPhone, isLoading } = useConfigQuickAccess();

      if (isLoading) return <div>Loading contact info...</div>;

      return (
        <div>
          <p>Email: {companyEmail}</p>
          <p>Phone: {companyPhone}</p>
        </div>
      );
    }
  `,

  /**
   * Migration usage
   */
  migration: `
    import { MigrationUtils } from '@/core/configuration';

    async function runMigration() {
      // Preview migration first
      const preview = await MigrationUtils.previewMigration();
      console.log('Will migrate:', preview.itemsMigrated, 'items');

      // Execute if preview looks good
      if (preview.success) {
        const result = await MigrationUtils.executeMigration(true);
        console.log('Migration result:', result);
      }
    }
  `,

  /**
   * Admin interface usage
   */
  adminInterface: `
    import { ConfigurationAdminInterface } from '@/core/configuration';

    function AdminPage() {
      return (
        <div className="admin-page">
          <h1>Configuration Management</h1>
          <ConfigurationAdminInterface />
        </div>
      );
    }
  `,

  /**
   * Testing usage
   */
  testing: `
    import { ConfigurationTestingAPI } from '@/core/configuration';

    async function runTests() {
      // Quick validation
      const validation = await _ConfigurationTestingAPI.executeQuickValidation();
      console.log('Validation score:', validation.score);

      // Full test suite
      const fullTest = await _ConfigurationTestingAPI.executeFullSuite();
      console.log('Test results:', fullTest);

      // Security audit
      const security = await ConfigurationTestingAPI.performSecurityAudit();
      console.log('Security score:', security.complianceScore);
    }
  `
} as const;

// ============================================================================
// 📊 VERSION INFORMATION
// ============================================================================

/**
 * Configuration System Version Information
 */
export const ConfigurationSystemInfo = {
  version: '1.0.0',
  buildDate: '2025-12-16',
  features: [
    'Dynamic Configuration Management',
    'Hardcoded Values Migration',
    'React Hooks Integration',
    'Admin Interface',
    'Testing & Validation Suite',
    'Security Audit Tools',
    'Performance Benchmarking',
    'Real-time Updates',
    'TypeScript Support',
    'SSR Compatibility'
  ],
  documentation: {
    readme: '/docs/configuration/README.md',
    api: '/docs/configuration/API.md',
    migration: '/docs/configuration/MIGRATION.md',
    testing: '/docs/configuration/TESTING.md'
  }
} as const;

// ============================================================================
// 🎯 DEFAULT EXPORT - MAIN API
// ============================================================================

/**
 * Main Configuration System API
 * Primary interface για όλες τις configuration operations
 */
export default {
  // Core system
  manager: GlobalConfigManager,
  api: _ConfigurationAPI,

  // Quick access
  quick: QuickConfigAPI,

  // Migration
  migration: MigrationUtils,

  // Health & testing
  health: ConfigurationHealthCheck,
  testing: _ConfigurationTestingAPI,

  // System info
  info: ConfigurationSystemInfo,

  // Usage examples
  examples: UsageExamples
} as const;
