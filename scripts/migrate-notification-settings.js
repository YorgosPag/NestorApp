#!/usr/bin/env node

/**
 * 🏢 ENTERPRISE NOTIFICATION SETTINGS MIGRATION SCRIPT
 *
 * Migrates notification configuration from hardcoded values to database-driven configuration.
 * Populates Firebase/Firestore with enterprise notification settings for multi-tenant deployments.
 *
 * This script creates:
 * - Notification priorities configuration
 * - Channel configurations with retry policies
 * - Severity to priority mappings
 * - Processing configurations
 * - Environment-specific settings
 * - Tenant-specific overrides
 *
 * Run with: node scripts/migrate-notification-settings.js
 *
 * @enterprise-ready true
 * @multi-tenant true
 * @environments dev,staging,production
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, collection, writeBatch } = require('firebase/firestore');

// ============================================================================
// FIREBASE CONFIGURATION
// ============================================================================

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "demo-api-key",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "nestor-app.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "nestor-app",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "nestor-app.appspot.com",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.FIREBASE_APP_ID || "1:123456789:web:abcdef"
};

// ============================================================================
// MIGRATION DATA
// ============================================================================

/**
 * 🎯 ENTERPRISE NOTIFICATION PRIORITIES
 *
 * Replaces hardcoded priorities: ['immediate', 'high', 'normal', 'low', 'batch']
 * Configurable per environment and tenant
 */
const NOTIFICATION_PRIORITIES = {
  // Global priorities (used as base for all tenants)
  global: {
    production: [
      {
        id: 'immediate',
        name: 'Immediate Priority',
        order: 1,
        batchSize: 1,
        processingIntervalMs: 500,
        description: 'Critical alerts requiring immediate delivery (< 1 second)',
        isActive: true,
        tenantSpecific: false,
        environmentRestrictions: []
      },
      {
        id: 'high',
        name: 'High Priority',
        order: 2,
        batchSize: 3,
        processingIntervalMs: 1000,
        description: 'High importance alerts processed quickly (< 5 seconds)',
        isActive: true,
        tenantSpecific: false,
        environmentRestrictions: []
      },
      {
        id: 'normal',
        name: 'Normal Priority',
        order: 3,
        batchSize: 5,
        processingIntervalMs: 2000,
        description: 'Standard priority alerts with normal processing',
        isActive: true,
        tenantSpecific: false,
        environmentRestrictions: []
      },
      {
        id: 'low',
        name: 'Low Priority',
        order: 4,
        batchSize: 10,
        processingIntervalMs: 5000,
        description: 'Low priority notifications processed in larger batches',
        isActive: true,
        tenantSpecific: false,
        environmentRestrictions: []
      },
      {
        id: 'batch',
        name: 'Batch Processing',
        order: 5,
        batchSize: 20,
        processingIntervalMs: 30000,
        description: 'Bulk notifications processed every 30 seconds',
        isActive: true,
        tenantSpecific: false,
        environmentRestrictions: []
      }
    ],
    staging: [
      // Same as production but with faster intervals για testing
      {
        id: 'immediate',
        name: 'Immediate Priority (Staging)',
        order: 1,
        batchSize: 1,
        processingIntervalMs: 100, // Faster για testing
        description: 'Critical alerts in staging environment',
        isActive: true,
        tenantSpecific: false,
        environmentRestrictions: ['staging']
      },
      {
        id: 'high',
        name: 'High Priority (Staging)',
        order: 2,
        batchSize: 2, // Smaller batches για testing
        processingIntervalMs: 500,
        description: 'High importance alerts in staging',
        isActive: true,
        tenantSpecific: false,
        environmentRestrictions: ['staging']
      },
      {
        id: 'normal',
        name: 'Normal Priority (Staging)',
        order: 3,
        batchSize: 3,
        processingIntervalMs: 1000,
        description: 'Standard priority alerts in staging',
        isActive: true,
        tenantSpecific: false,
        environmentRestrictions: ['staging']
      },
      {
        id: 'low',
        name: 'Low Priority (Staging)',
        order: 4,
        batchSize: 5,
        processingIntervalMs: 2000,
        description: 'Low priority notifications in staging',
        isActive: true,
        tenantSpecific: false,
        environmentRestrictions: ['staging']
      },
      {
        id: 'batch',
        name: 'Batch Processing (Staging)',
        order: 5,
        batchSize: 10,
        processingIntervalMs: 10000, // 10 seconds για faster testing
        description: 'Bulk notifications in staging environment',
        isActive: true,
        tenantSpecific: false,
        environmentRestrictions: ['staging']
      }
    ],
    development: [
      // Development priorities με even faster processing για debugging
      {
        id: 'immediate',
        name: 'Immediate Priority (Dev)',
        order: 1,
        batchSize: 1,
        processingIntervalMs: 50,
        description: 'Critical alerts in development',
        isActive: true,
        tenantSpecific: false,
        environmentRestrictions: ['development']
      },
      {
        id: 'high',
        name: 'High Priority (Dev)',
        order: 2,
        batchSize: 1,
        processingIntervalMs: 100,
        description: 'High alerts in development',
        isActive: true,
        tenantSpecific: false,
        environmentRestrictions: ['development']
      },
      {
        id: 'normal',
        name: 'Normal Priority (Dev)',
        order: 3,
        batchSize: 2,
        processingIntervalMs: 500,
        description: 'Normal alerts in development',
        isActive: true,
        tenantSpecific: false,
        environmentRestrictions: ['development']
      },
      {
        id: 'low',
        name: 'Low Priority (Dev)',
        order: 4,
        batchSize: 3,
        processingIntervalMs: 1000,
        description: 'Low alerts in development',
        isActive: true,
        tenantSpecific: false,
        environmentRestrictions: ['development']
      },
      {
        id: 'batch',
        name: 'Batch Processing (Dev)',
        order: 5,
        batchSize: 5,
        processingIntervalMs: 5000,
        description: 'Batch alerts in development',
        isActive: true,
        tenantSpecific: false,
        environmentRestrictions: ['development']
      }
    ]
  }
};

/**
 * 🚨 SEVERITY TO PRIORITY MAPPINGS
 *
 * Replaces hardcoded mapping:
 * { critical: 'immediate', high: 'high', medium: 'normal', low: 'low', info: 'batch' }
 */
const SEVERITY_MAPPINGS = {
  global: {
    production: [
      {
        severity: 'critical',
        priority: 'immediate',
        description: 'Critical system failures require immediate notification',
        overrides: {}
      },
      {
        severity: 'high',
        priority: 'high',
        description: 'High severity issues need prompt attention',
        overrides: {}
      },
      {
        severity: 'medium',
        priority: 'normal',
        description: 'Medium severity issues processed normally',
        overrides: {}
      },
      {
        severity: 'low',
        priority: 'low',
        description: 'Low severity issues can wait',
        overrides: {}
      },
      {
        severity: 'info',
        priority: 'batch',
        description: 'Informational messages processed in batches',
        overrides: {}
      }
    ],
    staging: [
      // Same mappings για staging
      {
        severity: 'critical',
        priority: 'immediate',
        description: 'Critical alerts in staging',
        overrides: {}
      },
      {
        severity: 'high',
        priority: 'high',
        description: 'High severity in staging',
        overrides: {}
      },
      {
        severity: 'medium',
        priority: 'normal',
        description: 'Medium severity in staging',
        overrides: {}
      },
      {
        severity: 'low',
        priority: 'low',
        description: 'Low severity in staging',
        overrides: {}
      },
      {
        severity: 'info',
        priority: 'batch',
        description: 'Info messages in staging',
        overrides: {}
      }
    ],
    development: [
      // Development mappings - all high priority για debugging
      {
        severity: 'critical',
        priority: 'immediate',
        description: 'Critical alerts in dev',
        overrides: {}
      },
      {
        severity: 'high',
        priority: 'immediate', // Map to immediate για dev testing
        description: 'High severity as immediate in dev',
        overrides: {}
      },
      {
        severity: 'medium',
        priority: 'high', // Boost medium to high for dev
        description: 'Medium severity as high in dev',
        overrides: {}
      },
      {
        severity: 'low',
        priority: 'normal',
        description: 'Low severity as normal in dev',
        overrides: {}
      },
      {
        severity: 'info',
        priority: 'low', // Info as low (not batch) για dev
        description: 'Info as low priority in dev',
        overrides: {}
      }
    ]
  }
};

/**
 * 📡 ENTERPRISE CHANNEL CONFIGURATIONS
 *
 * Replaces hardcoded channel initialization με configurable settings
 */
const CHANNEL_CONFIGURATIONS = {
  global: {
    production: [
      {
        channelId: 'email',
        name: 'Email Notifications',
        type: 'email',
        isEnabled: true,
        supportedPriorities: ['immediate', 'high', 'normal', 'low', 'batch'],
        retryPolicy: {
          maxRetries: 3,
          retryDelayMs: 5000,
          backoffMultiplier: 2,
          maxRetryDelayMs: 60000,
          priorityMultipliers: {
            immediate: 0.5, // Faster retries για critical
            high: 0.8,
            normal: 1.0,
            low: 1.5,
            batch: 2.0
          },
          adaptiveRetry: true,
          circuitBreaker: {
            enabled: true,
            failureThreshold: 5,
            recoveryTimeoutMs: 300000 // 5 minutes
          }
        },
        rateLimiting: {
          maxRequestsPerMinute: 60,
          maxRequestsPerHour: 1000,
          maxRequestsPerDay: 10000,
          burstAllowance: 10,
          priorityLimits: {
            immediate: { maxPerMinute: 20, maxPerHour: 200 },
            high: { maxPerMinute: 30, maxPerHour: 500 },
            normal: { maxPerMinute: 60, maxPerHour: 1000 }
          }
        },
        environmentConfigs: {
          production: {
            isEnabled: true,
            config: {
              smtp: {
                host: 'smtp.production.com',
                port: 587,
                secure: true
              }
            }
          },
          staging: {
            isEnabled: true,
            config: {
              smtp: {
                host: 'smtp.staging.com',
                port: 587,
                secure: true
              }
            }
          },
          development: {
            isEnabled: false, // Disable emails in dev
            config: {}
          }
        }
      },
      {
        channelId: 'in_app',
        name: 'In-App Notifications',
        type: 'in_app',
        isEnabled: true,
        supportedPriorities: ['immediate', 'high', 'normal'],
        retryPolicy: {
          maxRetries: 1, // In-app doesn't need many retries
          retryDelayMs: 1000,
          backoffMultiplier: 1,
          maxRetryDelayMs: 1000,
          priorityMultipliers: {
            immediate: 0.5,
            high: 0.8,
            normal: 1.0
          },
          adaptiveRetry: false,
          circuitBreaker: {
            enabled: false,
            failureThreshold: 10,
            recoveryTimeoutMs: 60000
          }
        },
        rateLimiting: {
          maxRequestsPerMinute: 120, // Higher limit για in-app
          maxRequestsPerHour: 2000,
          maxRequestsPerDay: 20000,
          burstAllowance: 20,
          priorityLimits: {
            immediate: { maxPerMinute: 60, maxPerHour: 600 },
            high: { maxPerMinute: 80, maxPerHour: 1000 },
            normal: { maxPerMinute: 120, maxPerHour: 2000 }
          }
        },
        environmentConfigs: {
          production: { isEnabled: true, config: {} },
          staging: { isEnabled: true, config: {} },
          development: { isEnabled: true, config: {} }
        }
      },
      {
        channelId: 'webhook',
        name: 'Webhook Notifications',
        type: 'webhook',
        isEnabled: true,
        supportedPriorities: ['immediate', 'high', 'normal'],
        retryPolicy: {
          maxRetries: 3,
          retryDelayMs: 2000,
          backoffMultiplier: 2,
          maxRetryDelayMs: 30000,
          priorityMultipliers: {
            immediate: 0.3,
            high: 0.6,
            normal: 1.0
          },
          adaptiveRetry: true,
          circuitBreaker: {
            enabled: true,
            failureThreshold: 3,
            recoveryTimeoutMs: 180000 // 3 minutes
          }
        },
        rateLimiting: {
          maxRequestsPerMinute: 30, // Lower για external webhooks
          maxRequestsPerHour: 500,
          maxRequestsPerDay: 5000,
          burstAllowance: 5,
          priorityLimits: {
            immediate: { maxPerMinute: 15, maxPerHour: 150 },
            high: { maxPerMinute: 20, maxPerHour: 300 },
            normal: { maxPerMinute: 30, maxPerHour: 500 }
          }
        },
        environmentConfigs: {
          production: {
            isEnabled: true,
            config: {
              webhook: {
                url: 'https://api.production.com/notifications',
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-API-Version': 'v1'
                },
                timeout: 10000
              }
            }
          },
          staging: {
            isEnabled: true,
            config: {
              webhook: {
                url: 'https://api.staging.com/notifications',
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-API-Version': 'v1'
                },
                timeout: 15000
              }
            }
          },
          development: {
            isEnabled: false,
            config: {}
          }
        }
      },
      {
        channelId: 'sms',
        name: 'SMS Notifications',
        type: 'sms',
        isEnabled: false, // Disabled by default (costs money)
        supportedPriorities: ['immediate', 'high'],
        retryPolicy: {
          maxRetries: 2,
          retryDelayMs: 10000,
          backoffMultiplier: 1.5,
          maxRetryDelayMs: 30000,
          priorityMultipliers: {
            immediate: 0.5,
            high: 0.8
          },
          adaptiveRetry: true,
          circuitBreaker: {
            enabled: true,
            failureThreshold: 2,
            recoveryTimeoutMs: 600000 // 10 minutes
          }
        },
        rateLimiting: {
          maxRequestsPerMinute: 5, // Very low για SMS (cost control)
          maxRequestsPerHour: 50,
          maxRequestsPerDay: 200,
          burstAllowance: 2,
          priorityLimits: {
            immediate: { maxPerMinute: 3, maxPerHour: 30 },
            high: { maxPerMinute: 5, maxPerHour: 50 }
          }
        },
        environmentConfigs: {
          production: { isEnabled: false, config: {} }, // Enable manually for production
          staging: { isEnabled: false, config: {} },
          development: { isEnabled: false, config: {} }
        }
      }
    ]
  }
};

/**
 * ⚙️ PROCESSING CONFIGURATIONS
 *
 * Replaces hardcoded processing intervals and batch sizes
 */
const PROCESSING_CONFIGURATIONS = {
  global: {
    production: {
      globalProcessingIntervalMs: 2000,
      priorityProcessing: {
        immediate: {
          intervalMs: 500,
          batchSize: 1,
          maxConcurrent: 5
        },
        high: {
          intervalMs: 1000,
          batchSize: 3,
          maxConcurrent: 10
        },
        normal: {
          intervalMs: 2000,
          batchSize: 5,
          maxConcurrent: 15
        },
        low: {
          intervalMs: 5000,
          batchSize: 10,
          maxConcurrent: 20
        },
        batch: {
          intervalMs: 30000,
          batchSize: 20,
          maxConcurrent: 25
        }
      },
      systemLimits: {
        maxQueueSize: 10000,
        maxConcurrentDeliveries: 100,
        deadLetterQueueEnabled: true,
        messageRetentionHours: 72
      },
      performanceSettings: {
        enableBatching: true,
        enablePipelining: true,
        enableCompression: false,
        cacheTimeoutMs: 300000
      }
    },
    staging: {
      globalProcessingIntervalMs: 1000, // Faster για testing
      priorityProcessing: {
        immediate: {
          intervalMs: 100,
          batchSize: 1,
          maxConcurrent: 3
        },
        high: {
          intervalMs: 500,
          batchSize: 2,
          maxConcurrent: 5
        },
        normal: {
          intervalMs: 1000,
          batchSize: 3,
          maxConcurrent: 8
        },
        low: {
          intervalMs: 2000,
          batchSize: 5,
          maxConcurrent: 10
        },
        batch: {
          intervalMs: 10000,
          batchSize: 10,
          maxConcurrent: 15
        }
      },
      systemLimits: {
        maxQueueSize: 5000,
        maxConcurrentDeliveries: 50,
        deadLetterQueueEnabled: true,
        messageRetentionHours: 24
      },
      performanceSettings: {
        enableBatching: true,
        enablePipelining: false, // Disable για debugging
        enableCompression: false,
        cacheTimeoutMs: 60000 // 1 minute
      }
    },
    development: {
      globalProcessingIntervalMs: 500, // Very fast για development
      priorityProcessing: {
        immediate: {
          intervalMs: 50,
          batchSize: 1,
          maxConcurrent: 2
        },
        high: {
          intervalMs: 100,
          batchSize: 1,
          maxConcurrent: 3
        },
        normal: {
          intervalMs: 500,
          batchSize: 2,
          maxConcurrent: 5
        },
        low: {
          intervalMs: 1000,
          batchSize: 3,
          maxConcurrent: 5
        },
        batch: {
          intervalMs: 5000,
          batchSize: 5,
          maxConcurrent: 10
        }
      },
      systemLimits: {
        maxQueueSize: 1000,
        maxConcurrentDeliveries: 20,
        deadLetterQueueEnabled: false, // Disable για dev
        messageRetentionHours: 1
      },
      performanceSettings: {
        enableBatching: false, // Disable batching για dev debugging
        enablePipelining: false,
        enableCompression: false,
        cacheTimeoutMs: 10000 // 10 seconds
      }
    }
  }
};

/**
 * 🏢 MAIN CONFIGURATION OBJECTS
 *
 * Replaces hardcoded main configurations
 */
const MAIN_CONFIGURATIONS = {
  global: {
    production: {
      version: '1.0.0',
      lastUpdated: new Date(),
      defaults: {
        priorityId: 'normal',
        channelIds: ['email', 'in_app'],
        retryPolicy: {
          maxRetries: 3,
          retryDelayMs: 5000,
          backoffMultiplier: 2,
          maxRetryDelayMs: 60000
        }
      },
      features: {
        enableAdaptiveRetry: true,
        enablePriorityBoost: true,
        enableDeadLetterQueue: true,
        enableMetricsCollection: true,
        enableRealtimeUpdates: true // Production gets real-time updates
      }
    },
    staging: {
      version: '1.0.0',
      lastUpdated: new Date(),
      defaults: {
        priorityId: 'high', // Default to high για staging testing
        channelIds: ['in_app'], // Only in-app για staging
        retryPolicy: {
          maxRetries: 2,
          retryDelayMs: 2000,
          backoffMultiplier: 1.5,
          maxRetryDelayMs: 30000
        }
      },
      features: {
        enableAdaptiveRetry: true,
        enablePriorityBoost: false,
        enableDeadLetterQueue: true,
        enableMetricsCollection: true,
        enableRealtimeUpdates: false
      }
    },
    development: {
      version: '1.0.0',
      lastUpdated: new Date(),
      defaults: {
        priorityId: 'immediate', // Everything immediate για dev debugging
        channelIds: ['in_app'], // Only in-app για development
        retryPolicy: {
          maxRetries: 1,
          retryDelayMs: 1000,
          backoffMultiplier: 1,
          maxRetryDelayMs: 5000
        }
      },
      features: {
        enableAdaptiveRetry: false,
        enablePriorityBoost: false,
        enableDeadLetterQueue: false,
        enableMetricsCollection: false,
        enableRealtimeUpdates: false
      }
    }
  }
};

// ============================================================================
// MIGRATION FUNCTIONS
// ============================================================================

/**
 * Initialize Firebase connection
 */
async function initializeFirebase() {
  try {
    console.log('🔥 Initializing Firebase connection...');
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    console.log('✅ Firebase initialized successfully');
    return db;
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error.message);
    throw error;
  }
}

/**
 * Migrate notification priorities
 */
async function migratePriorities(db) {
  console.log('\n📊 Migrating notification priorities...');

  const tenants = ['global'];
  const environments = ['production', 'staging', 'development'];

  for (const tenant of tenants) {
    for (const environment of environments) {
      const priorities = NOTIFICATION_PRIORITIES[tenant][environment];

      console.log(`   🎯 Processing ${tenant}/${environment} priorities (${priorities.length} items)`);

      const batch = writeBatch(db);

      for (const priority of priorities) {
        const collectionPath = tenant === 'global'
          ? `notification_priorities/global/${environment}`
          : `notification_priorities/tenants/${tenant}/${environment}`;

        const docRef = doc(db, collectionPath, priority.id);
        batch.set(docRef, {
          ...priority,
          createdAt: new Date(),
          migrationVersion: '1.0.0'
        });
      }

      await batch.commit();
      console.log(`   ✅ ${tenant}/${environment} priorities migrated successfully`);
    }
  }

  console.log('✅ All notification priorities migrated successfully');
}

/**
 * Migrate severity mappings
 */
async function migrateSeverityMappings(db) {
  console.log('\n🚨 Migrating severity mappings...');

  const tenants = ['global'];
  const environments = ['production', 'staging', 'development'];

  for (const tenant of tenants) {
    for (const environment of environments) {
      const mappings = SEVERITY_MAPPINGS[tenant][environment];

      console.log(`   🎯 Processing ${tenant}/${environment} severity mappings (${mappings.length} items)`);

      const batch = writeBatch(db);

      for (const mapping of mappings) {
        const collectionPath = tenant === 'global'
          ? `severity_mappings/global/${environment}`
          : `severity_mappings/tenants/${tenant}/${environment}`;

        const docRef = doc(db, collectionPath, mapping.severity);
        batch.set(docRef, {
          ...mapping,
          createdAt: new Date(),
          migrationVersion: '1.0.0'
        });
      }

      await batch.commit();
      console.log(`   ✅ ${tenant}/${environment} severity mappings migrated successfully`);
    }
  }

  console.log('✅ All severity mappings migrated successfully');
}

/**
 * Migrate channel configurations
 */
async function migrateChannelConfigurations(db) {
  console.log('\n📡 Migrating channel configurations...');

  const tenants = ['global'];
  const environments = ['production', 'staging', 'development'];

  for (const tenant of tenants) {
    for (const environment of environments) {
      const channels = CHANNEL_CONFIGURATIONS[tenant][environment];

      console.log(`   🎯 Processing ${tenant}/${environment} channels (${channels.length} items)`);

      const batch = writeBatch(db);

      for (const channel of channels) {
        const collectionPath = tenant === 'global'
          ? `notification_channels/global/${environment}`
          : `notification_channels/tenants/${tenant}/${environment}`;

        const docRef = doc(db, collectionPath, channel.channelId);
        batch.set(docRef, {
          ...channel,
          createdAt: new Date(),
          migrationVersion: '1.0.0'
        });
      }

      await batch.commit();
      console.log(`   ✅ ${tenant}/${environment} channels migrated successfully`);
    }
  }

  console.log('✅ All channel configurations migrated successfully');
}

/**
 * Migrate main configurations
 */
async function migrateMainConfigurations(db) {
  console.log('\n⚙️ Migrating main configurations...');

  const tenants = ['global'];
  const environments = ['production', 'staging', 'development'];

  for (const tenant of tenants) {
    for (const environment of environments) {
      const config = MAIN_CONFIGURATIONS[tenant][environment];
      const processing = PROCESSING_CONFIGURATIONS[tenant][environment];

      console.log(`   🎯 Processing ${tenant}/${environment} main config`);

      const docPath = tenant === 'global'
        ? `notification_configs/global/${environment}`
        : `notification_configs/tenants/${tenant}/${environment}`;

      await setDoc(doc(db, docPath), {
        ...config,
        processing,
        createdAt: new Date(),
        migrationVersion: '1.0.0'
      });

      console.log(`   ✅ ${tenant}/${environment} main configuration migrated successfully`);
    }
  }

  console.log('✅ All main configurations migrated successfully');
}

// ============================================================================
// MAIN MIGRATION SCRIPT
// ============================================================================

/**
 * Run complete notification settings migration
 */
async function runMigration() {
  console.log('🚀 Starting Enterprise Notification Settings Migration...');
  console.log('════════════════════════════════════════════════════════');

  try {
    // Initialize Firebase
    const db = await initializeFirebase();

    // Run migrations in order
    await migratePriorities(db);
    await migrateSeverityMappings(db);
    await migrateChannelConfigurations(db);
    await migrateMainConfigurations(db);

    console.log('\n════════════════════════════════════════════════════════');
    console.log('✅ ENTERPRISE NOTIFICATION SETTINGS MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('\n📊 Migration Summary:');
    console.log('   • Notification Priorities: ✅ Migrated (3 environments × 5 priorities = 15 configs)');
    console.log('   • Severity Mappings: ✅ Migrated (3 environments × 5 severities = 15 mappings)');
    console.log('   • Channel Configurations: ✅ Migrated (3 environments × 4 channels = 12 configs)');
    console.log('   • Main Configurations: ✅ Migrated (3 environments = 3 configs)');
    console.log('\n🏢 Next Steps:');
    console.log('   1. Update NotificationDispatchEngine.ts to use EnterpriseNotificationService');
    console.log('   2. Test notification configurations in development environment');
    console.log('   3. Verify Firebase Firestore collections are populated correctly');
    console.log('   4. Deploy to staging and production environments');
    console.log('\n🔧 Firebase Collections Created:');
    console.log('   • notification_priorities/global/{environment}');
    console.log('   • severity_mappings/global/{environment}');
    console.log('   • notification_channels/global/{environment}');
    console.log('   • notification_configs/global/{environment}');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// ============================================================================
// SCRIPT EXECUTION
// ============================================================================

// Run migration if this script is executed directly
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('\n🎉 Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = {
  runMigration,
  NOTIFICATION_PRIORITIES,
  SEVERITY_MAPPINGS,
  CHANNEL_CONFIGURATIONS,
  PROCESSING_CONFIGURATIONS,
  MAIN_CONFIGURATIONS
};