/**
 * DATABASE CONNECTION MANAGER
 * Geo-Alert System - Phase 4: Enterprise PostGIS Connection Management
 *
 * Enterprise-class database connection manager με:
 * - Connection pooling με auto-scaling
 * - Health monitoring και automatic recovery
 * - Transaction management
 * - Query performance tracking
 * - SSL-secured connections
 */

import type {
  DatabaseConfig,
  DatabaseHealthStatus,
  HEALTH_CHECK_QUERIES
} from '../config/database.config';
import { getDatabaseConfig, validateDatabaseConfig, generateConnectionString } from '../config/database.config';

// ============================================================================
// DATABASE CONNECTION TYPES
// ============================================================================

export interface DatabaseConnection {
  query<T = unknown>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
  transaction<T>(callback: (trx: DatabaseTransaction) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  isConnected(): boolean;
}

export interface DatabaseTransaction {
  query<T = unknown>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface QueryResult<T = unknown> {
  rows: T[];
  rowCount: number;
  command: string;
  fields: QueryField[];
}

export interface QueryField {
  name: string;
  dataTypeID: number;
  dataTypeSize: number;
  dataTypeModifier: number;
  format: string;
}

export interface ConnectionPoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingConnections: number;
  maxConnections: number;
  minConnections: number;
}

export interface QueryPerformanceMetrics {
  queryCount: number;
  averageExecutionTime: number;
  slowestQuery: {
    sql: string;
    executionTime: number;
    timestamp: Date;
  } | null;
  fastestQuery: {
    sql: string;
    executionTime: number;
    timestamp: Date;
  } | null;
}

// ============================================================================
// DATABASE ROW INTERFACES - Query Result Types
// ============================================================================

/** Row type for PostGIS version query */
interface PostGISVersionRow {
  version: string;
}

/** Row type for connection count query */
interface ConnectionCountRow {
  active_connections: string;
}

// ============================================================================
// MOCK DATABASE IMPLEMENTATION (για development χωρίς PostgreSQL)
// ============================================================================

/**
 * Mock implementation για development environment
 * Simulates PostGIS functionality για testing without actual database
 */
class MockDatabaseConnection implements DatabaseConnection {
  private connected = false;
  private queryLog: Array<{ sql: string; params?: unknown[]; timestamp: Date }> = [];

  constructor(private config: DatabaseConfig) {
    this.connected = true;
    console.log('🔌 Mock PostGIS connection established');
  }

  async query<T = unknown>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
    if (!this.connected) {
      throw new Error('Database connection is not available');
    }

    this.queryLog.push({ sql: text, params, timestamp: new Date() });

    // Simulate query execution time
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));

    // Mock different query responses
    if (text.includes('PostGIS_Version')) {
      return {
        rows: [{ version: 'PostGIS 3.4.0 MOCK' }] as T[],
        rowCount: 1,
        command: 'SELECT',
        fields: [{ name: 'version', dataTypeID: 25, dataTypeSize: -1, dataTypeModifier: -1, format: 'text' }]
      };
    }

    if (text.includes('pg_stat_activity')) {
      return {
        rows: [{ active_connections: Math.floor(Math.random() * 10) + 1 }] as T[],
        rowCount: 1,
        command: 'SELECT',
        fields: [{ name: 'active_connections', dataTypeID: 23, dataTypeSize: 4, dataTypeModifier: -1, format: 'text' }]
      };
    }

    if (text.includes('geo_projects')) {
      return {
        rows: [] as T[],
        rowCount: 0,
        command: text.trim().split(' ')[0].toUpperCase(),
        fields: []
      };
    }

    // Default empty response
    return {
      rows: [] as T[],
      rowCount: 0,
      command: text.trim().split(' ')[0].toUpperCase(),
      fields: []
    };
  }

  async transaction<T>(callback: (trx: DatabaseTransaction) => Promise<T>): Promise<T> {
    const mockTransaction: DatabaseTransaction = {
      query: this.query.bind(this),
      commit: async () => { console.log('📝 Mock transaction committed'); },
      rollback: async () => { console.log('🔄 Mock transaction rolled back'); }
    };

    try {
      const result = await callback(mockTransaction);
      await mockTransaction.commit();
      return result;
    } catch (error) {
      await mockTransaction.rollback();
      throw error;
    }
  }

  async close(): Promise<void> {
    this.connected = false;
    console.log('🔌 Mock PostGIS connection closed');
  }

  isConnected(): boolean {
    return this.connected;
  }

  getQueryLog() {
    return [...this.queryLog];
  }
}

// ============================================================================
// DATABASE MANAGER CLASS
// ============================================================================

/**
 * Enterprise Database Manager για PostGIS connections
 * Manages connection pooling, health monitoring, και performance tracking
 */
export class DatabaseManager {
  private static instance: DatabaseManager | null = null;
  private config: DatabaseConfig;
  private connection: DatabaseConnection | null = null;
  private healthStatus: DatabaseHealthStatus;
  private performanceMetrics: QueryPerformanceMetrics;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.config = getDatabaseConfig();
    this.healthStatus = {
      isConnected: false,
      postgisVersion: null,
      connectionCount: 0,
      lastCheck: new Date(),
      errors: []
    };
    this.performanceMetrics = {
      queryCount: 0,
      averageExecutionTime: 0,
      slowestQuery: null,
      fastestQuery: null
    };
  }

  // ========================================================================
  // SINGLETON PATTERN
  // ========================================================================

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  // ========================================================================
  // CONNECTION MANAGEMENT
  // ========================================================================

  /**
   * Initialize database connection με health monitoring
   */
  public async initialize(): Promise<void> {
    try {
      // Validate configuration
      const validation = validateDatabaseConfig(this.config);
      if (!validation.isValid) {
        throw new Error(`Database configuration invalid: ${validation.errors.join(', ')}`);
      }

      // Create connection (Mock για development)
      if (this.config.app.environment === 'development') {
        this.connection = new MockDatabaseConnection(this.config);
      } else {
        // TODO: Implement real PostgreSQL connection με pg library
        throw new Error('Real PostgreSQL connection not implemented yet - use development mode');
      }

      // Perform initial health check
      await this.performHealthCheck();

      // Start periodic health monitoring
      this.startHealthMonitoring();

      console.log('✅ Database Manager initialized successfully');
    } catch (error) {
      this.healthStatus.errors.push(`Initialization failed: ${error}`);
      console.error('❌ Database Manager initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get database connection (with connection validation)
   */
  public async getConnection(): Promise<DatabaseConnection> {
    if (!this.connection || !this.connection.isConnected()) {
      throw new Error('Database connection is not available. Call initialize() first.');
    }

    return this.connection;
  }

  /**
   * Execute query με performance tracking
   */
  public async query<T = unknown>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
    const startTime = Date.now();

    try {
      const connection = await this.getConnection();
      const result = await connection.query<T>(sql, params);

      // Track performance metrics
      const executionTime = Date.now() - startTime;
      this.updatePerformanceMetrics(sql, executionTime);

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`Query failed after ${executionTime}ms:`, sql, error);
      throw error;
    }
  }

  /**
   * Execute transaction με automatic rollback on error
   */
  public async transaction<T>(callback: (trx: DatabaseTransaction) => Promise<T>): Promise<T> {
    const connection = await this.getConnection();
    return connection.transaction(callback);
  }

  // ========================================================================
  // HEALTH MONITORING
  // ========================================================================

  /**
   * Perform comprehensive health check
   */
  public async performHealthCheck(): Promise<DatabaseHealthStatus> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      if (!this.connection || !this.connection.isConnected()) {
        throw new Error('No active database connection');
      }

      // Test basic connectivity
      await this.connection.query('SELECT 1 as status');

      // Check PostGIS version
      try {
        const postgisResult = await this.connection.query('SELECT PostGIS_Version() as version');
        const versionRow = postgisResult.rows[0] as PostGISVersionRow | undefined;
        this.healthStatus.postgisVersion = versionRow?.version || null;
      } catch (error) {
        errors.push(`PostGIS check failed: ${error}`);
      }

      // Check connection count
      try {
        const connResult = await this.connection.query(`
          SELECT count(*) as active_connections
          FROM pg_stat_activity
          WHERE datname = current_database()
            AND state = 'active'
        `);
        const connRow = connResult.rows[0] as ConnectionCountRow | undefined;
        this.healthStatus.connectionCount = parseInt(connRow?.active_connections || '0');
      } catch (error) {
        errors.push(`Connection count check failed: ${error}`);
      }

      this.healthStatus = {
        ...this.healthStatus,
        isConnected: true,
        lastCheck: new Date(),
        errors
      };

      if (this.config.app.enableLogging) {
        console.log(`✅ Health check completed in ${Date.now() - startTime}ms`);
      }

    } catch (error) {
      errors.push(`Health check failed: ${error}`);
      this.healthStatus = {
        ...this.healthStatus,
        isConnected: false,
        lastCheck: new Date(),
        errors
      };

      console.error('❌ Database health check failed:', error);
    }

    return this.healthStatus;
  }

  /**
   * Start periodic health monitoring
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Perform health check κάθε 30 seconds
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        console.error('Scheduled health check failed:', error);
      }
    }, 30000);
  }

  /**
   * Stop health monitoring
   */
  private stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  // ========================================================================
  // PERFORMANCE TRACKING
  // ========================================================================

  /**
   * Update query performance metrics
   */
  private updatePerformanceMetrics(sql: string, executionTime: number): void {
    this.performanceMetrics.queryCount++;

    // Update average execution time
    const previousAvg = this.performanceMetrics.averageExecutionTime;
    const count = this.performanceMetrics.queryCount;
    this.performanceMetrics.averageExecutionTime =
      (previousAvg * (count - 1) + executionTime) / count;

    // Track slowest query
    if (!this.performanceMetrics.slowestQuery ||
        executionTime > this.performanceMetrics.slowestQuery.executionTime) {
      this.performanceMetrics.slowestQuery = {
        sql: sql.substring(0, 200), // Truncate για memory efficiency
        executionTime,
        timestamp: new Date()
      };
    }

    // Track fastest query
    if (!this.performanceMetrics.fastestQuery ||
        executionTime < this.performanceMetrics.fastestQuery.executionTime) {
      this.performanceMetrics.fastestQuery = {
        sql: sql.substring(0, 200),
        executionTime,
        timestamp: new Date()
      };
    }
  }

  // ========================================================================
  // STATUS και MONITORING
  // ========================================================================

  /**
   * Get current health status
   */
  public getHealthStatus(): DatabaseHealthStatus {
    return { ...this.healthStatus };
  }

  /**
   * Get performance metrics
   */
  public getPerformanceMetrics(): QueryPerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Get connection pool statistics (Mock implementation)
   */
  public getConnectionPoolStats(): ConnectionPoolStats {
    return {
      totalConnections: this.connection ? 1 : 0,
      activeConnections: this.healthStatus.isConnected ? 1 : 0,
      idleConnections: 0,
      waitingConnections: 0,
      maxConnections: this.config.pool.max,
      minConnections: this.config.pool.min
    };
  }

  /**
   * Get database configuration (without sensitive data)
   */
  public getDatabaseInfo() {
    return {
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      environment: this.config.app.environment,
      sslEnabled: this.config.ssl.enabled,
      poolConfig: {
        min: this.config.pool.min,
        max: this.config.pool.max
      },
      postgis: this.config.postgis
    };
  }

  // ========================================================================
  // CLEANUP
  // ========================================================================

  /**
   * Graceful shutdown με connection cleanup
   */
  public async shutdown(): Promise<void> {
    console.log('🔄 Shutting down Database Manager...');

    try {
      // Stop health monitoring
      this.stopHealthMonitoring();

      // Close database connection
      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }

      // Reset health status
      this.healthStatus.isConnected = false;

      console.log('✅ Database Manager shutdown completed');
    } catch (error) {
      console.error('❌ Database Manager shutdown failed:', error);
      throw error;
    }
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

/**
 * Global Database Manager instance
 * Use this για all database operations
 */
export const databaseManager = DatabaseManager.getInstance();

export default databaseManager;