/**
 * 🏢 Enterprise Notification Types & Interfaces
 *
 * All type definitions for the enterprise notification configuration system.
 * Extracted from EnterpriseNotificationService.ts (ADR-065 SRP split).
 *
 * @enterprise-ready true
 * @multi-tenant true
 */

// ============================================================================
// CORE TYPES
// ============================================================================

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type ChannelType = 'email' | 'sms' | 'webhook' | 'push' | 'slack' | 'teams' | 'in_app';

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Enterprise Notification Priority Configuration
 */
export interface EnterpriseNotificationPriority {
  id: string;
  name: string;
  order: number; // Processing order (lower = higher priority)
  batchSize: number;
  processingIntervalMs: number;
  description: string;
  isActive: boolean;
  // Enterprise features
  tenantSpecific?: boolean;
  environmentRestrictions?: string[]; // ['dev', 'staging', 'production']
}

/**
 * Enterprise Severity Mapping Configuration
 */
export interface EnterpriseSeverityMapping {
  severity: AlertSeverity;
  priority: string; // Priority ID
  description: string;
  overrides?: {
    [tenantId: string]: string; // Tenant-specific priority mappings
  };
}

/**
 * Enterprise Retry Policy Configuration
 */
export interface EnterpriseRetryPolicy {
  maxRetries: number;
  retryDelayMs: number;
  backoffMultiplier: number;
  maxRetryDelayMs: number;

  // Enterprise features
  priorityMultipliers?: {
    [priorityId: string]: number; // Priority-specific retry multipliers
  };

  // Smart retry features
  adaptiveRetry?: boolean; // Learn from failure patterns
  circuitBreaker?: {
    enabled: boolean;
    failureThreshold: number;
    recoveryTimeoutMs: number;
  };
}

/**
 * Enterprise Rate Limiting Configuration
 */
export interface EnterpriseRateLimit {
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  maxRequestsPerDay: number;
  burstAllowance: number;

  // Priority-specific limits
  priorityLimits?: {
    [priorityId: string]: {
      maxPerMinute: number;
      maxPerHour: number;
    };
  };

  // Tenant-specific limits
  tenantLimits?: {
    [tenantId: string]: {
      maxPerMinute: number;
      maxPerHour: number;
      maxPerDay: number;
    };
  };
}

/**
 * Enterprise Channel Configuration
 */
export interface EnterpriseChannelConfig {
  channelId: string;
  name: string;
  type: ChannelType;
  isEnabled: boolean;
  supportedPriorities: string[]; // Priority IDs

  // Retry configuration
  retryPolicy: EnterpriseRetryPolicy;

  // Rate limiting
  rateLimiting: EnterpriseRateLimit;

  // Environment settings
  environmentConfigs: {
    [environment: string]: {
      isEnabled: boolean;
      config: Record<string, unknown>; // Environment-specific config
    };
  };

  // Tenant overrides
  tenantOverrides?: {
    [tenantId: string]: Partial<EnterpriseChannelConfig>;
  };
}

/**
 * Enterprise Processing Configuration
 */
export interface EnterpriseProcessingConfig {
  globalProcessingIntervalMs: number;

  // Priority-specific processing
  priorityProcessing: {
    [priorityId: string]: {
      intervalMs: number;
      batchSize: number;
      maxConcurrent: number;
    };
  };

  // System limits
  systemLimits: {
    maxQueueSize: number;
    maxConcurrentDeliveries: number;
    deadLetterQueueEnabled: boolean;
    messageRetentionHours: number;
  };

  // Performance optimization
  performanceSettings: {
    enableBatching: boolean;
    enablePipelining: boolean;
    enableCompression: boolean;
    cacheTimeoutMs: number;
  };
}

/**
 * Complete Enterprise Notification Configuration
 */
export interface EnterpriseNotificationConfig {
  // Configuration metadata
  configId: string;
  version: string;
  tenantId?: string;
  environment: string;
  lastUpdated: Date;

  // Core configuration
  priorities: EnterpriseNotificationPriority[];
  severityMappings: EnterpriseSeverityMapping[];
  channels: EnterpriseChannelConfig[];
  processing: EnterpriseProcessingConfig;

  // Global defaults
  defaults: {
    priorityId: string;
    channelIds: string[];
    retryPolicy: EnterpriseRetryPolicy;
  };

  // Feature flags
  features: {
    enableAdaptiveRetry: boolean;
    enablePriorityBoost: boolean;
    enableDeadLetterQueue: boolean;
    enableMetricsCollection: boolean;
    enableRealtimeUpdates: boolean;
  };
}
