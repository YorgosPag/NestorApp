/**
 * CONFIGURATION MODULE INDEX
 * Geo-Alert System - Phase 5: Alert Configuration Interface
 *
 * Centralized exports για όλα τα configuration components και services.
 */

// ============================================================================
// MAIN CONFIGURATION INTERFACE
// ============================================================================

export { default as AlertConfigurationInterface } from './AlertConfigurationInterface';
export { AlertConfigurationInterface as ConfigurationInterface } from './AlertConfigurationInterface';

// ============================================================================
// CONFIGURATION SERVICE
// ============================================================================

export {
  ConfigurationService,
  configurationService as defaultConfigurationService
} from './ConfigurationService';

// Import for internal use
import { ConfigurationService } from './ConfigurationService';
import type { SystemConfiguration } from './ConfigurationService';

export type {
  SystemConfiguration,
  GlobalSettings,
  ConfigurationMetadata,
  ConfigurationValidationResult,
  ConfigurationError,
  ConfigurationWarning,
  ConfigurationRecommendation,
  ConfigurationDiff,
  ConfigurationChange,
  ConfigurationBackup
} from './ConfigurationService';

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

/**
 * Initialize configuration system
 */
export const initializeConfiguration = async () => {
  const service = ConfigurationService.getInstance();
  return await service.loadConfiguration();
};

/**
 * Quick configuration validation
 */
export const validateConfiguration = async (config: Partial<SystemConfiguration>) => {
  const service = ConfigurationService.getInstance();
  return await service.validateConfiguration(config);
};

/**
 * Emergency configuration reset
 */
export const resetToDefaults = async (author: string = 'system') => {
  const service = ConfigurationService.getInstance();

  // Create backup first
  await service.createBackup('Pre-reset backup', author, true);

  // Load default configuration
  return await service.loadConfiguration();
};

/**
 * Quick export utility
 */
export const exportCurrentConfiguration = async (format: 'json' | 'yaml' = 'json') => {
  const service = ConfigurationService.getInstance();
  return await service.exportConfiguration(format);
};
