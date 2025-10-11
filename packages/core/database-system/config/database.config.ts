/**
 * POSTGIS DATABASE CONFIGURATION
 * Geo-Alert System - Phase 4: Enterprise Spatial Data Management
 *
 * Production-ready PostGIS connection configuration με:
 * - Connection pooling
 * - SSL security
 * - Environment-based configuration
 * - Health monitoring
 */

// ============================================================================
// DATABASE CONFIGURATION TYPES
// ============================================================================

export interface DatabaseConfig {
  // Connection parameters
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;

  // SSL configuration
  ssl: {
    enabled: boolean;
    rejectUnauthorized: boolean;
    ca?: string;
    cert?: string;
    key?: string;
  };

  // Connection pool settings
  pool: {
    min: number;
    max: number;
    acquireTimeoutMillis: number;
    createTimeoutMillis: number;
    destroyTimeoutMillis: number;
    idleTimeoutMillis: number;
    reapIntervalMillis: number;
    createRetryIntervalMillis: number;
  };

  // PostGIS specific settings
  postgis: {
    defaultSRID: number;
    spatialRefSysTable: string;
    geometryColumns: string;
  };

  // Application settings
  app: {
    environment: 'development' | 'staging' | 'production';
    enableLogging: boolean;
    enableAuditLog: boolean;
    maxQueryTimeout: number;
  };
}

export interface DatabaseHealthStatus {
  isConnected: boolean;
  postgisVersion: string | null;
  connectionCount: number;
  lastCheck: Date;
  errors: string[];
}

// ============================================================================
// ENVIRONMENT-BASED CONFIGURATION
// ============================================================================

/**
 * Load database configuration από environment variables
 * Supports .env files και system environment
 */
export function loadDatabaseConfig(): DatabaseConfig {
  // Default configuration για development
  const defaultConfig: DatabaseConfig = {
    host: process.env.POSTGIS_HOST || 'localhost',
    port: parseInt(process.env.POSTGIS_PORT || '5432'),
    database: process.env.POSTGIS_DATABASE || 'geoalert_dev',
    username: process.env.POSTGIS_USERNAME || 'postgres',
    password: process.env.POSTGIS_PASSWORD || 'postgres',

    ssl: {
      enabled: process.env.POSTGIS_SSL_ENABLED === 'true',
      rejectUnauthorized: process.env.POSTGIS_SSL_REJECT_UNAUTHORIZED !== 'false',
      ca: process.env.POSTGIS_SSL_CA,
      cert: process.env.POSTGIS_SSL_CERT,
      key: process.env.POSTGIS_SSL_KEY
    },

    pool: {
      min: parseInt(process.env.POSTGIS_POOL_MIN || '2'),
      max: parseInt(process.env.POSTGIS_POOL_MAX || '10'),
      acquireTimeoutMillis: parseInt(process.env.POSTGIS_POOL_ACQUIRE_TIMEOUT || '60000'),
      createTimeoutMillis: parseInt(process.env.POSTGIS_POOL_CREATE_TIMEOUT || '30000'),
      destroyTimeoutMillis: parseInt(process.env.POSTGIS_POOL_DESTROY_TIMEOUT || '5000'),
      idleTimeoutMillis: parseInt(process.env.POSTGIS_POOL_IDLE_TIMEOUT || '30000'),
      reapIntervalMillis: parseInt(process.env.POSTGIS_POOL_REAP_INTERVAL || '1000'),
      createRetryIntervalMillis: parseInt(process.env.POSTGIS_POOL_RETRY_INTERVAL || '200')
    },

    postgis: {
      defaultSRID: parseInt(process.env.POSTGIS_DEFAULT_SRID || '4326'), // WGS84
      spatialRefSysTable: 'spatial_ref_sys',
      geometryColumns: 'geometry_columns'
    },

    app: {
      environment: (process.env.NODE_ENV as 'development' | 'staging' | 'production') || 'development',
      enableLogging: process.env.POSTGIS_ENABLE_LOGGING !== 'false',
      enableAuditLog: process.env.POSTGIS_ENABLE_AUDIT !== 'false',
      maxQueryTimeout: parseInt(process.env.POSTGIS_QUERY_TIMEOUT || '30000')
    }
  };

  return defaultConfig;
}

// ============================================================================
// CONFIGURATION VALIDATION
// ============================================================================

/**
 * Validate database configuration
 * Ensures all required parameters are present και valid
 */
export function validateDatabaseConfig(config: DatabaseConfig): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required connection parameters
  if (!config.host) errors.push('Database host is required');
  if (!config.port || config.port < 1 || config.port > 65535) {
    errors.push('Database port must be between 1 and 65535');
  }
  if (!config.database) errors.push('Database name is required');
  if (!config.username) errors.push('Database username is required');
  if (!config.password) errors.push('Database password is required');

  // Pool configuration validation
  if (config.pool.min < 0) errors.push('Pool minimum connections cannot be negative');
  if (config.pool.max < config.pool.min) {
    errors.push('Pool maximum connections must be >= minimum connections');
  }
  if (config.pool.acquireTimeoutMillis < 1000) {
    errors.push('Pool acquire timeout should be at least 1000ms');
  }

  // PostGIS SRID validation
  if (config.postgis.defaultSRID < 1) {
    errors.push('PostGIS default SRID must be positive');
  }

  // Timeout validation
  if (config.app.maxQueryTimeout < 1000) {
    errors.push('Query timeout should be at least 1000ms');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// ============================================================================
// PRODUCTION CONFIGURATIONS
// ============================================================================

/**
 * Production-optimized configuration για high-performance scenarios
 */
export function getProductionConfig(): Partial<DatabaseConfig> {
  return {
    ssl: {
      enabled: true,
      rejectUnauthorized: true
    },

    pool: {
      min: 5,
      max: 50,
      acquireTimeoutMillis: 120000,
      createTimeoutMillis: 60000,
      destroyTimeoutMillis: 10000,
      idleTimeoutMillis: 600000, // 10 minutes
      reapIntervalMillis: 2000,
      createRetryIntervalMillis: 500
    },

    app: {
      environment: 'production',
      enableLogging: false, // Disable verbose logging in production
      enableAuditLog: true,
      maxQueryTimeout: 60000 // 1 minute για complex spatial queries
    }
  };
}

/**
 * Development-optimized configuration για local testing
 */
export function getDevelopmentConfig(): Partial<DatabaseConfig> {
  return {
    ssl: {
      enabled: false,
      rejectUnauthorized: false
    },

    pool: {
      min: 1,
      max: 5,
      acquireTimeoutMillis: 30000,
      createTimeoutMillis: 10000,
      destroyTimeoutMillis: 2000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200
    },

    app: {
      environment: 'development',
      enableLogging: true,
      enableAuditLog: true,
      maxQueryTimeout: 10000 // Shorter timeout για development
    }
  };
}

// ============================================================================
// CONNECTION STRING GENERATION
// ============================================================================

/**
 * Generate PostgreSQL connection string από configuration
 */
export function generateConnectionString(config: DatabaseConfig): string {
  const auth = `${config.username}:${config.password}`;
  const host = `${config.host}:${config.port}`;
  const database = config.database;

  let connectionString = `postgresql://${auth}@${host}/${database}`;

  // Add SSL parameters
  const params: string[] = [];
  if (config.ssl.enabled) {
    params.push('sslmode=require');
    if (!config.ssl.rejectUnauthorized) {
      params.push('sslmode=prefer');
    }
  } else {
    params.push('sslmode=disable');
  }

  // Add application name
  params.push('application_name=geo-alert-system');

  if (params.length > 0) {
    connectionString += '?' + params.join('&');
  }

  return connectionString;
}

// ============================================================================
// HEALTH CHECK CONFIGURATION
// ============================================================================

/**
 * Database health check queries
 */
export const HEALTH_CHECK_QUERIES = {
  // Basic connectivity test
  BASIC_CONNECTION: 'SELECT 1 as status',

  // PostGIS availability test
  POSTGIS_VERSION: 'SELECT PostGIS_Version() as version',

  // Connection count check
  CONNECTION_COUNT: `
    SELECT count(*) as active_connections
    FROM pg_stat_activity
    WHERE datname = current_database()
      AND state = 'active'
  `,

  // Spatial reference system check
  SPATIAL_REF_CHECK: `
    SELECT count(*) as srs_count
    FROM spatial_ref_sys
    WHERE srid = $1
  `,

  // Table existence check
  TABLES_CHECK: `
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename LIKE 'geo_%'
    ORDER BY tablename
  `
} as const;

// ============================================================================
// EXPORT DEFAULT CONFIGURATION LOADER
// ============================================================================

/**
 * Get the appropriate configuration για current environment
 */
export function getDatabaseConfig(): DatabaseConfig {
  const baseConfig = loadDatabaseConfig();
  const environment = baseConfig.app.environment;

  let envSpecificConfig: Partial<DatabaseConfig> = {};

  switch (environment) {
    case 'production':
      envSpecificConfig = getProductionConfig();
      break;
    case 'development':
      envSpecificConfig = getDevelopmentConfig();
      break;
    case 'staging':
      // Use production settings with development SSL settings
      envSpecificConfig = {
        ...getProductionConfig(),
        ssl: getDevelopmentConfig().ssl
      };
      break;
  }

  // Merge configurations
  const finalConfig: DatabaseConfig = {
    ...baseConfig,
    ...envSpecificConfig,
    ssl: { ...baseConfig.ssl, ...envSpecificConfig.ssl },
    pool: { ...baseConfig.pool, ...envSpecificConfig.pool },
    postgis: { ...baseConfig.postgis, ...envSpecificConfig.postgis },
    app: { ...baseConfig.app, ...envSpecificConfig.app }
  };

  return finalConfig;
}

export default getDatabaseConfig;