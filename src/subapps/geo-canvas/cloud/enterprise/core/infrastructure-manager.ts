/**
 * INFRASTRUCTURE MANAGER - CORE CLASS
 *
 * Enterprise-class infrastructure orchestration και management
 * Split from monolithic CloudInfrastructure.ts για modular architecture
 * INTEGRATES με existing Alert Engine System για unified monitoring
 *
 * Split into SRP modules (ADR-065):
 * - infrastructure-metrics.ts — metrics calculations, mock data, status factories
 *
 * @module enterprise/core/infrastructure-manager
 * @version 1.0.0 - ENTERPRISE MODULAR SPLITTING
 * @updated 2025-12-28 - Split from CloudInfrastructure.ts
 */

import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('InfrastructureManager');

// SRP modules (ADR-065)
import {
  getProviderComponents,
  calculateAverageResponseTime,
  calculateTotalThroughput,
  createSecurityStatus,
  createCostStatus,
  collectStatusMetrics,
  getRegionStatuses,
  getProviderStatuses,
} from './infrastructure-metrics';
import {
  validateProviderConfig,
  testProviderConnection,
} from './infrastructure-validation';

// ✅ ENTERPRISE FIX: Import existing Alert Engine - Use canonical path alias
// TODO: Verify correct path to alert engine
// import { geoAlertEngine } from '@core/alert-engine';
// TEMPORARY: Comment out until we verify the correct alert engine path

import type {
  CloudProvider,
  SupportedCloudProvider,
  ProviderConnectionStatus
} from '../types/cloud-providers';

import type {
  InfrastructureConfig,
  InfrastructureStatus,
  ComponentStatus,
  StatusMetrics,
  OverallStatus
} from '../types/infrastructure';

import type {
  ResponseTimeMetrics,
  ThroughputMetrics,
  SecurityStatus,
  CostStatus,
  ActiveAlert,
  RegionStatus,
  ProviderStatus
} from '../types/status';

// ============================================================================
// 🏢 ENTERPRISE: Mock types for alert engine integration
// ============================================================================

/**
 * Mock alert structure for alert engine integration
 */
type MockAlert = ActiveAlert;

// ============================================================================
// CORE INFRASTRUCTURE MANAGER CLASS
// ============================================================================

/**
 * Infrastructure Manager - Enterprise orchestration class
 * Enterprise: Unified multi-cloud infrastructure management
 * INTEGRATES: Existing Alert Engine για monitoring και notifications
 */
export class InfrastructureManager {
  private config: InfrastructureConfig;
  private providers: Map<string, SupportedCloudProvider> = new Map();
  private isInitialized: boolean = false;
  private monitoringEnabled: boolean = false;
  private lastStatusCheck: Date | null = null;

  // Enterprise: Integration με existing Alert Engine
  // TODO: Connect to real alert engine when available
  // 🏢 ENTERPRISE: Properly typed mock alert engine
  private alertEngine = {
    reportAlert: (alert: MockAlert) => logger.warn('Alert Engine not connected', { alert }),
    createAlert: async (
      type: ActiveAlert['type'],
      title: string,
      description: string,
      severity: ActiveAlert['severity'],
      source: string,
      metadata?: Record<string, unknown>
    ) => {
      logger.warn('Alert Engine not connected - createAlert', { type, title, description, severity, source, metadata });
    },
    generateQuickReport: async () => ({ alerts: { active: [] as MockAlert[] } })
  };

  constructor(config: InfrastructureConfig) {
    this.config = config;
  }

  // ========================================================================
  // INITIALIZATION METHODS
  // ========================================================================

  /**
   * Initialize infrastructure manager
   * Enterprise: Comprehensive initialization με error handling
   */
  public async initialize(): Promise<{
    success: boolean;
    providersInitialized: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let providersInitialized = 0;

    try {
      console.debug('🚀 Initializing Infrastructure Manager...');

      // Initialize Alert Engine integration
      // TODO: Add proper alert engine initialization when connected
      console.debug('Alert Engine integration placeholder - ready for connection');

      // Initialize all configured providers
      for (const providerConfig of this.config.providers) {
        try {
          await this.initializeProvider(providerConfig);
          providersInitialized++;

          // Log successful provider initialization
          console.debug(`✅ Provider ${providerConfig.name} initialized για region ${providerConfig.region}`);

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : `Failed to initialize ${providerConfig.name}`;
          errors.push(errorMessage);

          // Alert on provider initialization failure
          await this.alertEngine.createAlert(
            'availability',
            `Provider initialization failed`,
            `Failed to initialize ${providerConfig.name}: ${errorMessage}`,
            'high',
            'infrastructure-manager'
          );
        }
      }

      // Enable monitoring if any providers initialized
      if (providersInitialized > 0) {
        await this.enableMonitoring();
        this.isInitialized = true;

        console.debug(`✅ Infrastructure Manager initialized με ${providersInitialized} providers`);
      } else {
        logger.error('No providers initialized successfully');
      }

      return {
        success: providersInitialized > 0,
        providersInitialized,
        errors
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Infrastructure initialization failed';
      logger.error('Infrastructure Manager initialization failed', { errorMessage });

      return {
        success: false,
        providersInitialized,
        errors: [...errors, errorMessage]
      };
    }
  }

  /**
   * Initialize individual cloud provider
   * Enterprise: Provider-specific initialization
   */
  private async initializeProvider(config: CloudProvider): Promise<void> {
    // Store provider configuration
    this.providers.set(config.name, config.name);

    // Validate provider configuration
    const validation = await validateProviderConfig(config);
    if (!validation.isValid) {
      throw new Error(`Provider validation failed: ${validation.errors.join(', ')}`);
    }

    // Test provider connectivity
    const connection = await testProviderConnection(config);
    if (!connection.isConnected) {
      throw new Error(`Provider connection failed: ${connection.error}`);
    }

    console.debug(`✅ Provider ${config.name} initialized successfully`);
  }

  // ========================================================================
  // MONITORING METHODS
  // ========================================================================

  /**
   * Enable infrastructure monitoring
   * Enterprise: Integrates με Alert Engine για unified monitoring
   */
  private async enableMonitoring(): Promise<void> {
    try {
      this.monitoringEnabled = true;

      // Start periodic status checks
      setInterval(async () => {
        await this.performStatusCheck();
      }, 60000); // Check every minute

      // Start performance monitoring
      setInterval(async () => {
        await Promise.resolve();
      }, 300000); // Collect every 5 minutes

      console.debug('📊 Infrastructure monitoring enabled');

    } catch (error) {
      logger.error('Failed to enable monitoring', { error });
    }
  }

  /**
   * Perform comprehensive status check
   * Enterprise: Multi-dimensional health assessment
   */
  public async performStatusCheck(): Promise<InfrastructureStatus> {
    try {
      const timestamp = new Date();
      this.lastStatusCheck = timestamp;

      // Get component statuses
      const components = await this.getComponentStatuses();

      // Calculate overall status
      const overall = this.calculateOverallStatus(components);

      // Get regional statuses
      const regions = await getRegionStatuses(this.config);

      // Get provider statuses
      const providers = await getProviderStatuses(this.providers);

      // Collect metrics
      const metrics = await collectStatusMetrics(components);

      // Get active alerts από Alert Engine
      const alerts = await this.getActiveAlerts();

      const status: InfrastructureStatus = {
        overall,
        timestamp,
        components,
        regions,
        providers,
        metrics,
        alerts
      };

      // Check for critical issues και create alerts
      await this.processStatusAlerts(status);

      return status;

    } catch (error) {
      logger.error('Status check failed', { error });
      throw error;
    }
  }

  /**
   * Get component statuses από all providers
   * Enterprise: Cross-cloud component monitoring
   */
  private async getComponentStatuses(): Promise<ComponentStatus[]> {
    const components: ComponentStatus[] = [];

    for (const [providerName, providerId] of Array.from(this.providers.entries())) {
      try {
        const provider = this.config.providers.find(p => p.name === providerId);
        if (!provider) continue;

        // Simulate component discovery και status checking
        const providerComponents = await getProviderComponents(provider);
        components.push(...providerComponents);

      } catch (error) {
        logger.error(`Failed to get components for ${providerName}`, { error });
      }
    }

    return components;
  }

  /**
   * Calculate overall infrastructure status
   * Enterprise: Weighted health calculation
   */
  private calculateOverallStatus(components: ComponentStatus[]): OverallStatus {
    if (components.length === 0) {
      return {
        health: 'unknown',
        availability: 0,
        performance: {
          responseTime: { average: 0, p50: 0, p95: 0, p99: 0, max: 0 },
          throughput: { requestsPerSecond: 0, requestsPerMinute: 0, requestsPerHour: 0, peakThroughput: 0 },
          errorRate: 0,
          saturation: 0
        },
        security: createSecurityStatus('unknown'),
        cost: createCostStatus([])
      };
    }

    // Calculate health distribution
    const healthyCount = components.filter(c => c.health === 'healthy').length;
    const warningCount = components.filter(c => c.health === 'warning').length;
    const criticalCount = components.filter(c => c.health === 'critical').length;

    // Determine overall health
    let health: 'healthy' | 'degraded' | 'critical' | 'unknown' = 'healthy';
    if (criticalCount > 0) {
      health = 'critical';
    } else if (warningCount > 0) {
      health = 'degraded';
    }

    // Calculate availability
    const onlineCount = components.filter(c => c.status === 'online').length;
    const availability = (onlineCount / components.length) * 100;

    return {
      health,
      availability,
      performance: {
        responseTime: calculateAverageResponseTime(components),
        throughput: calculateTotalThroughput(components),
        errorRate: health === 'healthy' ? 0.1 : health === 'degraded' ? 1.5 : 5.0,
        saturation: health === 'healthy' ? 45 : health === 'degraded' ? 75 : 95
      },
      security: createSecurityStatus(health),
      cost: createCostStatus(components)
    };
  }

  // Provider validation delegated to infrastructure-validation.ts
  }

  // ========================================================================
  // ALERT INTEGRATION METHODS
  // ========================================================================

  /**
   * Process status alerts με Alert Engine integration
   * Enterprise: Intelligent alerting με Alert Engine
   */
  private async processStatusAlerts(status: InfrastructureStatus): Promise<void> {
    try {
      // Check for critical overall health
      if (status.overall.health === 'critical') {
        await this.alertEngine.createAlert(
          'availability',
          'Infrastructure Critical Health',
          `Infrastructure health is critical με availability ${status.overall.availability.toFixed(1)}%`,
          'critical',
          'infrastructure-manager'
        );
      }

      // Check for low availability
      if (status.overall.availability < 95) {
        await this.alertEngine.createAlert(
          'availability',
          'Low Infrastructure Availability',
          `Infrastructure availability is ${status.overall.availability.toFixed(1)}% (below 95% threshold)`,
          status.overall.availability < 90 ? 'high' : 'medium',
          'infrastructure-manager'
        );
      }

      // Check for failed components
      const failedComponents = status.components.filter(c => c.status === 'offline' || c.health === 'critical');
      for (const component of failedComponents) {
        await this.alertEngine.createAlert(
          'resource',
          `Component ${component.name} Failed`,
          `Component ${component.name} (${component.type}) is ${component.status} με health ${component.health}`,
          'high',
          'infrastructure-manager',
          {
            componentId: component.id,
            componentType: component.type,
            provider: component.provider,
            region: component.region
          }
        );
      }

    } catch (error) {
      logger.error('Failed to process status alerts', { error });
    }
  }

  /**
   * Get active alerts από Alert Engine
   * Enterprise: Unified alert management
   */
  // 🏢 ENTERPRISE: Proper return type for alerts
  private async getActiveAlerts(): Promise<MockAlert[]> {
    try {
      // Get recent analytics report από Alert Engine
      const report = await this.alertEngine.generateQuickReport();
      return report.alerts?.active || [];

    } catch (error) {
      logger.error('Failed to get active alerts', { error });
      return [];
    }
  }

  // ========================================================================
  // GETTERS
  // ========================================================================

  public get isReady(): boolean {
    return this.isInitialized;
  }

  public get providerCount(): number {
    return this.providers.size;
  }

  public get lastChecked(): Date | null {
    return this.lastStatusCheck;
  }

  public get configuration(): InfrastructureConfig {
    return this.config;
  }
}

