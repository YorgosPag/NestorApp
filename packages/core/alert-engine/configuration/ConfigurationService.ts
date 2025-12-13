/**
 * CONFIGURATION SERVICE
 * Geo-Alert System - Phase 5: Enterprise Configuration Management Service
 *
 * Centralized service για configuration management, validation, και persistence.
 * Implements enterprise configuration patterns με versioning και audit trail.
 */

import { Rule, RulesEngine, rulesEngine } from '../rules/RulesEngine';
import { AlertTemplate } from '../detection/AlertDetectionSystem';
import { NotificationTemplate } from '../notifications/NotificationDispatchEngine';

// ============================================================================
// LOCAL CONFIGURATION INTERFACES
// ============================================================================

interface DetectionConfig {
  pollingInterval: number;
  batchSize: number;
  enableRealTime: boolean;
  accuracyThresholds: {
    warning: number;
    critical: number;
  };
}

interface NotificationConfig {
  channels: {
    email: { enabled: boolean; priority: number };
    sms: { enabled: boolean; priority: number };
    webhook: { enabled: boolean; priority: number };
    push: { enabled: boolean; priority: number };
    in_app: { enabled: boolean; priority: number };
  };
  retryAttempts: number;
  retryDelay: number;
  batchSize: number;
  rateLimit: number;
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

export interface SystemConfiguration {
  id: string;
  version: string;
  timestamp: Date;
  description: string;
  rules: Rule[];
  alertTemplates: AlertTemplate[];
  notificationTemplates: NotificationTemplate[];
  detectionConfig: DetectionConfig;
  notificationConfig: NotificationConfig;
  globalSettings: GlobalSettings;
  metadata: ConfigurationMetadata;
}

export interface GlobalSettings {
  enableAutoDetection: boolean;
  enableNotifications: boolean;
  enableRealTimeUpdates: boolean;
  defaultSeverity: 'low' | 'medium' | 'high' | 'critical';
  maxConcurrentAlerts: number;
  alertRetentionDays: number;
  notificationRetryAttempts: number;
  emergencyEscalationEnabled: boolean;
  maintenanceMode: boolean;
  debugMode: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  performanceMonitoring: boolean;
}

export interface ConfigurationMetadata {
  createdBy: string;
  createdAt: Date;
  lastModifiedBy: string;
  lastModifiedAt: Date;
  environment: 'development' | 'staging' | 'production';
  tags: string[];
  approvalStatus: 'draft' | 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: Date;
}

export interface ConfigurationValidationResult {
  isValid: boolean;
  errors: ConfigurationError[];
  warnings: ConfigurationWarning[];
  recommendations: ConfigurationRecommendation[];
}

export interface ConfigurationError {
  code: string;
  message: string;
  path: string;
  severity: 'error' | 'warning';
  details?: any;
}

export interface ConfigurationWarning {
  code: string;
  message: string;
  path: string;
  impact: 'low' | 'medium' | 'high';
  suggestion?: string;
}

export interface ConfigurationRecommendation {
  code: string;
  title: string;
  description: string;
  impact: 'performance' | 'security' | 'reliability' | 'usability';
  effort: 'low' | 'medium' | 'high';
  benefits: string[];
}

export interface ConfigurationDiff {
  added: ConfigurationChange[];
  modified: ConfigurationChange[];
  removed: ConfigurationChange[];
  summary: {
    totalChanges: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    requiresApproval: boolean;
  };
}

export interface ConfigurationChange {
  path: string;
  type: 'add' | 'modify' | 'remove';
  oldValue?: any;
  newValue?: any;
  impact: 'low' | 'medium' | 'high';
  description: string;
}

export interface ConfigurationBackup {
  id: string;
  timestamp: Date;
  configuration: SystemConfiguration;
  reason: string;
  createdBy: string;
  isAutomatic: boolean;
}

// ============================================================================
// CONFIGURATION SERVICE CLASS
// ============================================================================

export class ConfigurationService {
  private static instance: ConfigurationService | null = null;

  private currentConfiguration: SystemConfiguration | null = null;
  private configurationHistory: SystemConfiguration[] = [];
  private backups: ConfigurationBackup[] = [];
  private validationRules: Map<string, (config: any) => ConfigurationValidationResult> = new Map();

  // Service dependencies
  private rulesEngine: RulesEngine;

  // ========================================================================
  // SINGLETON PATTERN
  // ========================================================================

  private constructor() {
    this.rulesEngine = rulesEngine;
    this.initializeValidationRules();
    this.loadDefaultConfiguration();
  }

  public static getInstance(): ConfigurationService {
    if (!ConfigurationService.instance) {
      ConfigurationService.instance = new ConfigurationService();
    }
    return ConfigurationService.instance;
  }

  // ========================================================================
  // CONFIGURATION LOADING και SAVING
  // ========================================================================

  public async loadConfiguration(id?: string): Promise<SystemConfiguration> {
    try {
      // Αν δεν υπάρχει ID, φορτώνω την τρέχουσα
      if (!id && this.currentConfiguration) {
        return this.currentConfiguration;
      }

      // Mock implementation - στην πραγματικότητα θα φορτώνει από database/file
      const configuration = await this.loadConfigurationFromStorage(id);

      this.currentConfiguration = configuration;
      return configuration;

    } catch (error) {
      console.error('Configuration load error:', error);
      return this.getDefaultConfiguration();
    }
  }

  public async saveConfiguration(
    configuration: Partial<SystemConfiguration>,
    metadata: { description: string; author: string }
  ): Promise<SystemConfiguration> {
    try {
      // Validate configuration
      const validationResult = await this.validateConfiguration(configuration);

      if (!validationResult.isValid) {
        throw new Error(
          `Configuration validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`
        );
      }

      // Create new configuration version
      const newConfig: SystemConfiguration = {
        id: `config_${Date.now()}`,
        version: this.generateVersion(),
        timestamp: new Date(),
        description: metadata.description,
        ...this.mergeWithDefaults(configuration),
        metadata: {
          createdBy: metadata.author,
          createdAt: new Date(),
          lastModifiedBy: metadata.author,
          lastModifiedAt: new Date(),
          environment: 'development', // Mock
          tags: ['alert-engine', 'geo-system'],
          approvalStatus: 'draft'
        }
      };

      // Create backup of current configuration
      if (this.currentConfiguration) {
        await this.createBackup('Pre-update backup', metadata.author, true);
      }

      // Save to storage
      await this.saveConfigurationToStorage(newConfig);

      // Update current configuration
      this.currentConfiguration = newConfig;

      // Add to history
      this.configurationHistory.unshift(newConfig);

      // Limit history size
      if (this.configurationHistory.length > 50) {
        this.configurationHistory = this.configurationHistory.slice(0, 50);
      }

      return newConfig;

    } catch (error) {
      console.error('Configuration save error:', error);
      throw error;
    }
  }

  // ========================================================================
  // CONFIGURATION VALIDATION
  // ========================================================================

  public async validateConfiguration(config: Partial<SystemConfiguration>): Promise<ConfigurationValidationResult> {
    const errors: ConfigurationError[] = [];
    const warnings: ConfigurationWarning[] = [];
    const recommendations: ConfigurationRecommendation[] = [];

    try {
      // Validate rules
      if (config.rules) {
        const rulesValidation = this.validateRules(config.rules);
        errors.push(...rulesValidation.errors);
        warnings.push(...rulesValidation.warnings);
      }

      // Validate global settings
      if (config.globalSettings) {
        const settingsValidation = this.validateGlobalSettings(config.globalSettings);
        errors.push(...settingsValidation.errors);
        warnings.push(...settingsValidation.warnings);
      }

      // Validate notification config
      if (config.notificationConfig) {
        const notificationValidation = this.validateNotificationConfig(config.notificationConfig);
        errors.push(...notificationValidation.errors);
        warnings.push(...notificationValidation.warnings);
      }

      // Generate recommendations
      recommendations.push(...this.generateRecommendations(config));

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        recommendations
      };

    } catch (error) {
      errors.push({
        code: 'VALIDATION_ERROR',
        message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        path: 'root',
        severity: 'error'
      });

      return {
        isValid: false,
        errors,
        warnings,
        recommendations
      };
    }
  }

  private validateRules(rules: Rule[]): { errors: ConfigurationError[]; warnings: ConfigurationWarning[] } {
    const errors: ConfigurationError[] = [];
    const warnings: ConfigurationWarning[] = [];

    rules.forEach((rule, index) => {
      const path = `rules[${index}]`;

      // Required fields
      if (!rule.name || rule.name.trim().length === 0) {
        errors.push({
          code: 'RULE_NAME_REQUIRED',
          message: 'Rule name is required',
          path: `${path}.name`,
          severity: 'error'
        });
      }

      if (!rule.conditions) {
        warnings.push({
          code: 'RULE_NO_CONDITIONS',
          message: 'Rule has no conditions defined',
          path: `${path}.conditions`,
          impact: 'medium',
          suggestion: 'Add at least one condition to make the rule functional'
        });
      }

      if (!rule.actions || rule.actions.length === 0) {
        warnings.push({
          code: 'RULE_NO_ACTIONS',
          message: 'Rule has no actions defined',
          path: `${path}.actions`,
          impact: 'high',
          suggestion: 'Add actions to specify what happens when the rule triggers'
        });
      }

      // Priority validation - priority is string enum
      const validPriorities = ['critical', 'high', 'medium', 'low', 'info'];
      if (!validPriorities.includes(rule.priority)) {
        errors.push({
          code: 'RULE_INVALID_PRIORITY',
          message: 'Rule priority must be one of: critical, high, medium, low, info',
          path: `${path}.priority`,
          severity: 'error'
        });
      }
    });

    return { errors, warnings };
  }

  private validateGlobalSettings(settings: GlobalSettings): { errors: ConfigurationError[]; warnings: ConfigurationWarning[] } {
    const errors: ConfigurationError[] = [];
    const warnings: ConfigurationWarning[] = [];

    // Alert retention validation
    if (settings.alertRetentionDays < 1 || settings.alertRetentionDays > 365) {
      errors.push({
        code: 'INVALID_RETENTION_PERIOD',
        message: 'Alert retention period must be between 1 and 365 days',
        path: 'globalSettings.alertRetentionDays',
        severity: 'error'
      });
    }

    // Max concurrent alerts validation
    if (settings.maxConcurrentAlerts < 10 || settings.maxConcurrentAlerts > 10000) {
      warnings.push({
        code: 'UNUSUAL_CONCURRENT_ALERTS',
        message: 'Unusual max concurrent alerts value',
        path: 'globalSettings.maxConcurrentAlerts',
        impact: 'medium',
        suggestion: 'Consider a value between 100-1000 for optimal performance'
      });
    }

    // Performance recommendations
    if (settings.enableRealTimeUpdates && settings.performanceMonitoring === false) {
      warnings.push({
        code: 'REALTIME_WITHOUT_MONITORING',
        message: 'Real-time updates enabled without performance monitoring',
        path: 'globalSettings',
        impact: 'low',
        suggestion: 'Enable performance monitoring when using real-time updates'
      });
    }

    return { errors, warnings };
  }

  private validateNotificationConfig(config: NotificationConfig): { errors: ConfigurationError[]; warnings: ConfigurationWarning[] } {
    const errors: ConfigurationError[] = [];
    const warnings: ConfigurationWarning[] = [];

    // Retry attempts validation
    if (config.retryAttempts < 1 || config.retryAttempts > 10) {
      errors.push({
        code: 'INVALID_RETRY_ATTEMPTS',
        message: 'Retry attempts must be between 1 and 10',
        path: 'notificationConfig.retryAttempts',
        severity: 'error'
      });
    }

    // Rate limit validation
    if (config.rateLimit < 1 || config.rateLimit > 10000) {
      warnings.push({
        code: 'UNUSUAL_RATE_LIMIT',
        message: 'Unusual rate limit value',
        path: 'notificationConfig.rateLimit',
        impact: 'medium',
        suggestion: 'Consider a rate limit between 10-1000 messages per minute'
      });
    }

    // Check if at least one channel is enabled
    const enabledChannels = Object.values(config.channels).filter(channel => channel.enabled);
    if (enabledChannels.length === 0) {
      warnings.push({
        code: 'NO_NOTIFICATION_CHANNELS',
        message: 'No notification channels are enabled',
        path: 'notificationConfig.channels',
        impact: 'high',
        suggestion: 'Enable at least one notification channel to receive alerts'
      });
    }

    return { errors, warnings };
  }

  // ========================================================================
  // CONFIGURATION COMPARISON και DIFF
  // ========================================================================

  public compareConfigurations(
    oldConfig: SystemConfiguration,
    newConfig: SystemConfiguration
  ): ConfigurationDiff {
    const added: ConfigurationChange[] = [];
    const modified: ConfigurationChange[] = [];
    const removed: ConfigurationChange[] = [];

    // Compare rules
    this.compareArrays(
      oldConfig.rules,
      newConfig.rules,
      'rules',
      (rule) => rule.id,
      added,
      modified,
      removed
    );

    // Compare global settings
    this.compareObjects(
      oldConfig.globalSettings,
      newConfig.globalSettings,
      'globalSettings',
      modified
    );

    // Compare notification config
    this.compareObjects(
      oldConfig.notificationConfig,
      newConfig.notificationConfig,
      'notificationConfig',
      modified
    );

    const totalChanges = added.length + modified.length + removed.length;

    // Calculate risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    const highImpactChanges = [...added, ...modified, ...removed].filter(c => c.impact === 'high');

    if (highImpactChanges.length > 5) {
      riskLevel = 'critical';
    } else if (highImpactChanges.length > 2) {
      riskLevel = 'high';
    } else if (totalChanges > 10) {
      riskLevel = 'medium';
    }

    return {
      added,
      modified,
      removed,
      summary: {
        totalChanges,
        riskLevel,
        requiresApproval: riskLevel === 'high' || riskLevel === 'critical'
      }
    };
  }

  // ========================================================================
  // BACKUP MANAGEMENT
  // ========================================================================

  public async createBackup(reason: string, author: string, isAutomatic: boolean = false): Promise<ConfigurationBackup> {
    if (!this.currentConfiguration) {
      throw new Error('No current configuration to backup');
    }

    const backup: ConfigurationBackup = {
      id: `backup_${Date.now()}`,
      timestamp: new Date(),
      configuration: { ...this.currentConfiguration },
      reason,
      createdBy: author,
      isAutomatic
    };

    this.backups.unshift(backup);

    // Limit backup history
    if (this.backups.length > 20) {
      this.backups = this.backups.slice(0, 20);
    }

    return backup;
  }

  public async restoreFromBackup(backupId: string, author: string): Promise<SystemConfiguration> {
    const backup = this.backups.find(b => b.id === backupId);
    if (!backup) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    // Create backup of current state before restore
    await this.createBackup(`Pre-restore backup (restoring ${backupId})`, author, true);

    // Restore configuration
    const restoredConfig = {
      ...backup.configuration,
      id: `config_${Date.now()}`,
      version: this.generateVersion(),
      timestamp: new Date(),
      description: `Restored from backup: ${backup.reason}`,
      metadata: {
        ...backup.configuration.metadata,
        lastModifiedBy: author,
        lastModifiedAt: new Date(),
        approvalStatus: 'draft' as const
      }
    };

    this.currentConfiguration = restoredConfig;
    return restoredConfig;
  }

  public getBackups(): ConfigurationBackup[] {
    return [...this.backups];
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  private initializeValidationRules(): void {
    // Initialize custom validation rules
    this.validationRules.set('rules', (rules: any) => {
      const result = this.validateRules(rules as Rule[]);
      return { isValid: result.errors.length === 0, errors: result.errors, warnings: result.warnings, recommendations: [] };
    });
    this.validationRules.set('globalSettings', (settings: any) => {
      const result = this.validateGlobalSettings(settings as GlobalSettings);
      return { isValid: result.errors.length === 0, errors: result.errors, warnings: result.warnings, recommendations: [] };
    });
    this.validationRules.set('notificationConfig', (config: any) => {
      const result = this.validateNotificationConfig(config as NotificationConfig);
      return { isValid: result.errors.length === 0, errors: result.errors, warnings: result.warnings, recommendations: [] };
    });
  }

  private loadDefaultConfiguration(): void {
    this.currentConfiguration = this.getDefaultConfiguration();
  }

  private getDefaultConfiguration(): SystemConfiguration {
    return {
      id: 'default_config',
      version: '1.0.0',
      timestamp: new Date(),
      description: 'Default system configuration',
      rules: [],
      alertTemplates: [],
      notificationTemplates: [],
      detectionConfig: {
        pollingInterval: 5000,
        batchSize: 50,
        enableRealTime: true,
        accuracyThresholds: {
          warning: 0.1,
          critical: 0.5
        }
      },
      notificationConfig: {
        channels: {
          email: { enabled: true, priority: 1 },
          sms: { enabled: false, priority: 2 },
          webhook: { enabled: true, priority: 3 },
          push: { enabled: false, priority: 4 },
          in_app: { enabled: true, priority: 5 }
        },
        retryAttempts: 3,
        retryDelay: 5000,
        batchSize: 10,
        rateLimit: 100
      },
      globalSettings: {
        enableAutoDetection: true,
        enableNotifications: true,
        enableRealTimeUpdates: true,
        defaultSeverity: 'medium',
        maxConcurrentAlerts: 100,
        alertRetentionDays: 30,
        notificationRetryAttempts: 3,
        emergencyEscalationEnabled: true,
        maintenanceMode: false,
        debugMode: false,
        logLevel: 'info',
        performanceMonitoring: true
      },
      metadata: {
        createdBy: 'system',
        createdAt: new Date(),
        lastModifiedBy: 'system',
        lastModifiedAt: new Date(),
        environment: 'development',
        tags: ['default', 'system'],
        approvalStatus: 'approved'
      }
    };
  }

  private mergeWithDefaults(partial: Partial<SystemConfiguration>): Omit<SystemConfiguration, 'id' | 'version' | 'timestamp' | 'description' | 'metadata'> {
    const defaults = this.getDefaultConfiguration();

    return {
      rules: partial.rules || defaults.rules,
      alertTemplates: partial.alertTemplates || defaults.alertTemplates,
      notificationTemplates: partial.notificationTemplates || defaults.notificationTemplates,
      detectionConfig: { ...defaults.detectionConfig, ...partial.detectionConfig },
      notificationConfig: { ...defaults.notificationConfig, ...partial.notificationConfig },
      globalSettings: { ...defaults.globalSettings, ...partial.globalSettings }
    };
  }

  private generateVersion(): string {
    const now = new Date();
    return `${now.getFullYear()}.${now.getMonth() + 1}.${now.getDate()}.${now.getTime()}`;
  }

  private generateRecommendations(config: Partial<SystemConfiguration>): ConfigurationRecommendation[] {
    const recommendations: ConfigurationRecommendation[] = [];

    // Performance recommendations
    if (config.globalSettings?.enableRealTimeUpdates && config.detectionConfig?.pollingInterval && config.detectionConfig.pollingInterval < 3000) {
      recommendations.push({
        code: 'OPTIMIZE_POLLING_INTERVAL',
        title: 'Optimize Polling Interval',
        description: 'Consider increasing polling interval for better performance',
        impact: 'performance',
        effort: 'low',
        benefits: ['Reduced CPU usage', 'Better system responsiveness', 'Lower resource consumption']
      });
    }

    // Security recommendations
    if (config.globalSettings?.debugMode === true) {
      recommendations.push({
        code: 'DISABLE_DEBUG_PRODUCTION',
        title: 'Disable Debug Mode in Production',
        description: 'Debug mode should be disabled in production environments',
        impact: 'security',
        effort: 'low',
        benefits: ['Improved security', 'Better performance', 'Cleaner logs']
      });
    }

    return recommendations;
  }

  private compareArrays<T>(
    oldArray: T[],
    newArray: T[],
    path: string,
    getKey: (item: T) => string,
    added: ConfigurationChange[],
    modified: ConfigurationChange[],
    removed: ConfigurationChange[]
  ): void {
    const oldMap = new Map(oldArray.map(item => [getKey(item), item]));
    const newMap = new Map(newArray.map(item => [getKey(item), item]));

    // Find added items
    for (const [key, newItem] of newMap) {
      if (!oldMap.has(key)) {
        added.push({
          path: `${path}[${key}]`,
          type: 'add',
          newValue: newItem,
          impact: 'medium',
          description: `Added new item: ${key}`
        });
      }
    }

    // Find modified and removed items
    for (const [key, oldItem] of oldMap) {
      if (!newMap.has(key)) {
        removed.push({
          path: `${path}[${key}]`,
          type: 'remove',
          oldValue: oldItem,
          impact: 'medium',
          description: `Removed item: ${key}`
        });
      } else {
        const newItem = newMap.get(key);
        if (JSON.stringify(oldItem) !== JSON.stringify(newItem)) {
          modified.push({
            path: `${path}[${key}]`,
            type: 'modify',
            oldValue: oldItem,
            newValue: newItem,
            impact: 'medium',
            description: `Modified item: ${key}`
          });
        }
      }
    }
  }

  private compareObjects(
    oldObj: any,
    newObj: any,
    path: string,
    modified: ConfigurationChange[]
  ): void {
    for (const key in { ...oldObj, ...newObj }) {
      const oldValue = oldObj[key];
      const newValue = newObj[key];

      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        modified.push({
          path: `${path}.${key}`,
          type: 'modify',
          oldValue,
          newValue,
          impact: 'low',
          description: `Changed ${key} from ${JSON.stringify(oldValue)} to ${JSON.stringify(newValue)}`
        });
      }
    }
  }

  // Mock storage methods (στην πραγματικότητα θα χρησιμοποιούν database/filesystem)
  private async loadConfigurationFromStorage(id?: string): Promise<SystemConfiguration> {
    // Mock implementation
    return this.getDefaultConfiguration();
  }

  private async saveConfigurationToStorage(config: SystemConfiguration): Promise<void> {
    // Mock implementation
    console.log('Saving configuration to storage:', config.id);
  }

  // ========================================================================
  // PUBLIC API
  // ========================================================================

  public getCurrentConfiguration(): SystemConfiguration | null {
    return this.currentConfiguration;
  }

  public getConfigurationHistory(): SystemConfiguration[] {
    return [...this.configurationHistory];
  }

  public async exportConfiguration(format: 'json' | 'yaml' = 'json'): Promise<string> {
    if (!this.currentConfiguration) {
      throw new Error('No configuration to export');
    }

    if (format === 'json') {
      return JSON.stringify(this.currentConfiguration, null, 2);
    } else {
      // Mock YAML export
      return `# Configuration Export\nversion: ${this.currentConfiguration.version}\n# ... YAML content`;
    }
  }

  public async importConfiguration(data: string, format: 'json' | 'yaml' = 'json'): Promise<SystemConfiguration> {
    try {
      let configData: any;

      if (format === 'json') {
        configData = JSON.parse(data);
      } else {
        // Mock YAML import
        throw new Error('YAML import not yet implemented');
      }

      // Validate imported configuration
      const validation = await this.validateConfiguration(configData);
      if (!validation.isValid) {
        throw new Error(`Invalid configuration: ${validation.errors.map(e => e.message).join(', ')}`);
      }

      return await this.saveConfiguration(configData, {
        description: 'Imported configuration',
        author: 'system'
      });

    } catch (error) {
      throw new Error(`Configuration import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const configurationService = ConfigurationService.getInstance();
export default configurationService;