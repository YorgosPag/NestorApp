/**
 * 🏢 Enterprise Notification Fallback/Default Configurations
 *
 * Static fallback data for offline mode and default factory functions.
 * Extracted from EnterpriseNotificationService.ts (ADR-065 SRP split).
 *
 * These are used when the database is unreachable or for initial bootstrapping.
 *
 * @enterprise-ready true
 * @config-data true
 */

import type {
  EnterpriseNotificationConfig,
  EnterpriseNotificationPriority,
  EnterpriseSeverityMapping,
  EnterpriseChannelConfig,
  EnterpriseRetryPolicy,
  EnterpriseRateLimit,
  EnterpriseProcessingConfig,
} from './notification-types';

// ============================================================================
// DEFAULT POLICIES
// ============================================================================

/**
 * Default retry policy
 */
export function getDefaultRetryPolicy(): EnterpriseRetryPolicy {
  return {
    maxRetries: 3,
    retryDelayMs: 5000,
    backoffMultiplier: 2,
    maxRetryDelayMs: 60000,
  };
}

/**
 * Default rate limiting
 */
export function getDefaultRateLimit(): EnterpriseRateLimit {
  return {
    maxRequestsPerMinute: 60,
    maxRequestsPerHour: 1000,
    maxRequestsPerDay: 10000,
    burstAllowance: 10,
  };
}

/**
 * Default processing configuration
 */
export function getDefaultProcessingConfig(): EnterpriseProcessingConfig {
  return {
    globalProcessingIntervalMs: 2000,
    priorityProcessing: {
      immediate: { intervalMs: 500, batchSize: 1, maxConcurrent: 5 },
      high: { intervalMs: 1000, batchSize: 3, maxConcurrent: 10 },
      normal: { intervalMs: 2000, batchSize: 5, maxConcurrent: 15 },
      low: { intervalMs: 5000, batchSize: 10, maxConcurrent: 20 },
      batch: { intervalMs: 30000, batchSize: 20, maxConcurrent: 25 },
    },
    systemLimits: {
      maxQueueSize: 10000,
      maxConcurrentDeliveries: 100,
      deadLetterQueueEnabled: true,
      messageRetentionHours: 72,
    },
    performanceSettings: {
      enableBatching: true,
      enablePipelining: true,
      enableCompression: false,
      cacheTimeoutMs: 300000, // 5 minutes
    },
  };
}

/**
 * Default defaults configuration
 */
export function getDefaultDefaults(): EnterpriseNotificationConfig['defaults'] {
  return {
    priorityId: 'normal',
    channelIds: ['email', 'in_app'],
    retryPolicy: getDefaultRetryPolicy(),
  };
}

/**
 * Default feature flags
 */
export function getDefaultFeatures(): EnterpriseNotificationConfig['features'] {
  return {
    enableAdaptiveRetry: true,
    enablePriorityBoost: true,
    enableDeadLetterQueue: true,
    enableMetricsCollection: true,
    enableRealtimeUpdates: false,
  };
}

// ============================================================================
// FALLBACK DATA (offline mode)
// ============================================================================

/**
 * ⚠️ FALLBACK: Default notification priorities (offline mode)
 */
export function getFallbackPriorities(): EnterpriseNotificationPriority[] {
  return [
    {
      id: 'immediate',
      name: 'Immediate',
      order: 1,
      batchSize: 1,
      processingIntervalMs: 500,
      description: 'Critical alerts requiring immediate delivery',
      isActive: true,
    },
    {
      id: 'high',
      name: 'High Priority',
      order: 2,
      batchSize: 3,
      processingIntervalMs: 1000,
      description: 'High importance alerts',
      isActive: true,
    },
    {
      id: 'normal',
      name: 'Normal',
      order: 3,
      batchSize: 5,
      processingIntervalMs: 2000,
      description: 'Standard priority alerts',
      isActive: true,
    },
    {
      id: 'low',
      name: 'Low Priority',
      order: 4,
      batchSize: 10,
      processingIntervalMs: 5000,
      description: 'Low priority notifications',
      isActive: true,
    },
    {
      id: 'batch',
      name: 'Batch Processing',
      order: 5,
      batchSize: 20,
      processingIntervalMs: 30000,
      description: 'Bulk notifications processed in batches',
      isActive: true,
    },
  ];
}

/**
 * ⚠️ FALLBACK: Default severity mappings (offline mode)
 */
export function getFallbackSeverityMappings(): EnterpriseSeverityMapping[] {
  return [
    {
      severity: 'critical',
      priority: 'immediate',
      description: 'Critical alerts require immediate notification',
    },
    {
      severity: 'high',
      priority: 'high',
      description: 'High severity alerts get high priority',
    },
    {
      severity: 'medium',
      priority: 'normal',
      description: 'Medium severity alerts get normal priority',
    },
    {
      severity: 'low',
      priority: 'low',
      description: 'Low severity alerts get low priority',
    },
    {
      severity: 'info',
      priority: 'batch',
      description: 'Informational alerts can be batched',
    },
  ];
}

/**
 * ⚠️ FALLBACK: Default channel configurations (offline mode)
 */
export function getFallbackChannels(): EnterpriseChannelConfig[] {
  return [
    {
      channelId: 'email',
      name: 'Email Notifications',
      type: 'email',
      isEnabled: true,
      supportedPriorities: ['immediate', 'high', 'normal', 'low', 'batch'],
      retryPolicy: getDefaultRetryPolicy(),
      rateLimiting: getDefaultRateLimit(),
      environmentConfigs: {
        production: { isEnabled: true, config: {} },
        staging: { isEnabled: true, config: {} },
        development: { isEnabled: false, config: {} },
      },
    },
    {
      channelId: 'in_app',
      name: 'In-App Notifications',
      type: 'in_app',
      isEnabled: true,
      supportedPriorities: ['immediate', 'high', 'normal'],
      retryPolicy: { ...getDefaultRetryPolicy(), maxRetries: 1 },
      rateLimiting: getDefaultRateLimit(),
      environmentConfigs: {
        production: { isEnabled: true, config: {} },
        staging: { isEnabled: true, config: {} },
        development: { isEnabled: true, config: {} },
      },
    },
    {
      channelId: 'webhook',
      name: 'Webhook Notifications',
      type: 'webhook',
      isEnabled: true,
      supportedPriorities: ['immediate', 'high', 'normal'],
      retryPolicy: getDefaultRetryPolicy(),
      rateLimiting: getDefaultRateLimit(),
      environmentConfigs: {
        production: { isEnabled: true, config: {} },
        staging: { isEnabled: true, config: {} },
        development: { isEnabled: false, config: {} },
      },
    },
  ];
}

/**
 * Get complete fallback configuration for offline mode
 */
export function getFallbackConfiguration(
  environment: string,
  tenantId?: string
): EnterpriseNotificationConfig {
  return {
    configId: 'fallback',
    version: '1.0.0',
    tenantId,
    environment,
    lastUpdated: new Date(),
    priorities: getFallbackPriorities(),
    severityMappings: getFallbackSeverityMappings(),
    channels: getFallbackChannels(),
    processing: getDefaultProcessingConfig(),
    defaults: getDefaultDefaults(),
    features: getDefaultFeatures(),
  };
}
