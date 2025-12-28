/**
 * CLOUD INFRASTRUCTURE MANAGER
 * Geo-Alert System - Phase 8: Enterprise Cloud Infrastructure & Auto-Scaling
 *
 * Enterprise-class cloud infrastructure management που διαχειρίζεται
 * multi-cloud deployments, auto-scaling, load balancing, και resource optimization.
 */

import { performance } from 'perf_hooks';

// ============================================================================
// MODULAR IMPORTS - ENTERPRISE ARCHITECTURE
// ============================================================================

import type {
  CloudProvider,
  CloudCredentials,
  CloudEndpoints,
  CloudFeatures,
  CloudPricing,
  PricingTier
} from './enterprise/types/cloud-providers';

import type {
  InfrastructureConfig,
  RegionConfig,
  ComputeConfig,
  InstanceConfig,
  AutoScalingConfig,
  ScalingPolicy,
  ScalingMetric,
  LoadBalancingConfig,
  HealthCheckConfig,
  ContainerConfig,
  ServerlessConfig,
  StorageConfig,
  DatabaseConfig,
  MonitoringConfig,
  BackupConfig,
  SecurityConfig
} from './enterprise/types/infrastructure';

import type {
  NetworkConfig
} from './enterprise/types/networking';

import type {
  InfrastructureStatus
} from './enterprise/types/status';

// ============================================================================
// TYPE DEFINITIONS - COMMENTED OUT (NOW USING MODULAR IMPORTS)
// ============================================================================

// COMMENTED OUT: All original interfaces moved to modular files
// Now using ./enterprise/types/cloud-providers.ts and ./enterprise/types/infrastructure.ts


// All original type definitions have been moved to modular files:
// - ./enterprise/types/cloud-providers.ts
// - ./enterprise/types/infrastructure.ts
// - ./enterprise/types/networking.ts
// - ./enterprise/types/status.ts


// ============================================================================
// MAIN CLOUD INFRASTRUCTURE CLASS
// ============================================================================

/**
 * Cloud Infrastructure Manager - Enterprise Multi-Cloud Management
 * Singleton pattern για centralized cloud infrastructure management
 */
export class GeoAlertCloudInfrastructure {
  private static instance: GeoAlertCloudInfrastructure | null = null;
  private infrastructures: Map<string, InfrastructureStatus> = new Map();
  private providers: Map<string, CloudProvider> = new Map();
  private isMonitoring: boolean = false;
  private monitoringInterval?: NodeJS.Timeout;

  // ========================================================================
  // SINGLETON PATTERN
  // ========================================================================

  private constructor() {
    this.initializeCloudProviders();
  }

  public static getInstance(): GeoAlertCloudInfrastructure {
    if (!GeoAlertCloudInfrastructure.instance) {
      GeoAlertCloudInfrastructure.instance = new GeoAlertCloudInfrastructure();
    }
    return GeoAlertCloudInfrastructure.instance;
  }

  // ========================================================================
  // CLOUD PROVIDER INITIALIZATION
  // ========================================================================

  private initializeCloudProviders(): void {
    // AWS Provider
    this.providers.set('aws', {
      name: 'aws',
      region: 'us-east-1',
      credentials: {
        accessKey: 'AKIA...',
        secretKey: 'secret'
      },
      endpoints: {
        compute: 'https://ec2.us-east-1.amazonaws.com',
        storage: 'https://s3.us-east-1.amazonaws.com',
        database: 'https://rds.us-east-1.amazonaws.com',
        networking: 'https://elasticloadbalancing.us-east-1.amazonaws.com',
        monitoring: 'https://monitoring.us-east-1.amazonaws.com',
        dns: 'https://route53.amazonaws.com'
      },
      features: {
        autoScaling: true,
        loadBalancing: true,
        cdn: true,
        database: true,
        objectStorage: true,
        kubernetes: true,
        serverless: true,
        monitoring: true
      },
      pricing: {
        compute: [
          { name: 't3.micro', cpu: 2, memory: 1, storage: 8, pricePerHour: 0.0104, pricePerMonth: 7.59 },
          { name: 't3.small', cpu: 2, memory: 2, storage: 20, pricePerHour: 0.0208, pricePerMonth: 15.18 },
          { name: 'm5.large', cpu: 2, memory: 8, storage: 50, pricePerHour: 0.096, pricePerMonth: 70.08 },
          { name: 'm5.xlarge', cpu: 4, memory: 16, storage: 100, pricePerHour: 0.192, pricePerMonth: 140.16 },
          { name: 'c5.2xlarge', cpu: 8, memory: 16, storage: 200, pricePerHour: 0.34, pricePerMonth: 248.20 }
        ],
        storage: [
          { name: 'gp3', cpu: 0, memory: 0, storage: 1000, pricePerHour: 0.0125, pricePerMonth: 0.08 },
          { name: 's3-standard', cpu: 0, memory: 0, storage: 1000, pricePerHour: 0.0312, pricePerMonth: 0.023 }
        ],
        network: [
          { name: 'data-transfer', cpu: 0, memory: 0, storage: 0, pricePerHour: 0, pricePerMonth: 0.09 }
        ],
        database: [
          { name: 'db.t3.micro', cpu: 2, memory: 1, storage: 20, pricePerHour: 0.017, pricePerMonth: 12.41 },
          { name: 'db.r5.large', cpu: 2, memory: 16, storage: 100, pricePerHour: 0.24, pricePerMonth: 175.20 }
        ]
      }
    });

    // Azure Provider
    this.providers.set('azure', {
      name: 'azure',
      region: 'East US',
      credentials: {
        tenantId: 'tenant-id',
        subscriptionId: 'subscription-id'
      },
      endpoints: {
        compute: 'https://management.azure.com',
        storage: 'https://storage.azure.com',
        database: 'https://database.azure.com',
        networking: 'https://network.azure.com',
        monitoring: 'https://monitor.azure.com',
        dns: 'https://dns.azure.com'
      },
      features: {
        autoScaling: true,
        loadBalancing: true,
        cdn: true,
        database: true,
        objectStorage: true,
        kubernetes: true,
        serverless: true,
        monitoring: true
      },
      pricing: {
        compute: [
          { name: 'B1s', cpu: 1, memory: 1, storage: 8, pricePerHour: 0.0104, pricePerMonth: 7.59 },
          { name: 'B2s', cpu: 2, memory: 4, storage: 16, pricePerHour: 0.0416, pricePerMonth: 30.37 },
          { name: 'D2s_v3', cpu: 2, memory: 8, storage: 32, pricePerHour: 0.096, pricePerMonth: 70.08 }
        ],
        storage: [
          { name: 'standard-lrs', cpu: 0, memory: 0, storage: 1000, pricePerHour: 0.0208, pricePerMonth: 0.0208 }
        ],
        network: [
          { name: 'bandwidth', cpu: 0, memory: 0, storage: 0, pricePerHour: 0, pricePerMonth: 0.087 }
        ],
        database: [
          { name: 'Basic', cpu: 1, memory: 1, storage: 2, pricePerHour: 0.0067, pricePerMonth: 4.90 }
        ]
      }
    });

    // GCP Provider
    this.providers.set('gcp', {
      name: 'gcp',
      region: 'us-central1',
      credentials: {
        projectId: 'project-id',
        serviceAccountKey: {}
      },
      endpoints: {
        compute: 'https://compute.googleapis.com',
        storage: 'https://storage.googleapis.com',
        database: 'https://sqladmin.googleapis.com',
        networking: 'https://compute.googleapis.com',
        monitoring: 'https://monitoring.googleapis.com',
        dns: 'https://dns.googleapis.com'
      },
      features: {
        autoScaling: true,
        loadBalancing: true,
        cdn: true,
        database: true,
        objectStorage: true,
        kubernetes: true,
        serverless: true,
        monitoring: true
      },
      pricing: {
        compute: [
          { name: 'e2-micro', cpu: 1, memory: 1, storage: 10, pricePerHour: 0.0063, pricePerMonth: 4.60 },
          { name: 'e2-small', cpu: 1, memory: 2, storage: 20, pricePerHour: 0.0126, pricePerMonth: 9.20 },
          { name: 'n2-standard-2', cpu: 2, memory: 8, storage: 50, pricePerHour: 0.0971, pricePerMonth: 70.88 }
        ],
        storage: [
          { name: 'standard', cpu: 0, memory: 0, storage: 1000, pricePerHour: 0.0277, pricePerMonth: 0.020 }
        ],
        network: [
          { name: 'egress', cpu: 0, memory: 0, storage: 0, pricePerHour: 0, pricePerMonth: 0.12 }
        ],
        database: [
          { name: 'db-f1-micro', cpu: 1, memory: 0.6, storage: 10, pricePerHour: 0.0075, pricePerMonth: 5.48 }
        ]
      }
    });
  }

  // ========================================================================
  // GEO-ALERT INFRASTRUCTURE CONFIGURATION
  // ========================================================================

  /**
   * Get production-ready Geo-Alert infrastructure configuration
   */
  public getGeoAlertInfrastructureConfig(): InfrastructureConfig {
    return {
      name: 'geo-alert-production',
      environment: 'production',
      providers: Array.from(this.providers.values()),
      regions: [
        {
          name: 'us-east-1',
          provider: 'aws',
          primary: true,
          availabilityZones: ['us-east-1a', 'us-east-1b', 'us-east-1c'],
          latencyRequirements: {
            maxLatency: 100,
            targetLatency: 50
          },
          complianceRequirements: ['SOC2', 'GDPR', 'HIPAA']
        },
        {
          name: 'eu-west-1',
          provider: 'aws',
          primary: false,
          availabilityZones: ['eu-west-1a', 'eu-west-1b', 'eu-west-1c'],
          latencyRequirements: {
            maxLatency: 150,
            targetLatency: 75
          },
          complianceRequirements: ['GDPR', 'SOC2']
        },
        {
          name: 'ap-southeast-1',
          provider: 'aws',
          primary: false,
          availabilityZones: ['ap-southeast-1a', 'ap-southeast-1b'],
          latencyRequirements: {
            maxLatency: 200,
            targetLatency: 100
          },
          complianceRequirements: ['SOC2']
        }
      ],
      networking: this.getNetworkingConfig(),
      compute: this.getComputeConfig(),
      storage: this.getStorageConfig(),
      database: this.getDatabaseConfig(),
      monitoring: this.getMonitoringConfig(),
      security: this.getSecurityConfig(),
      scaling: this.getScalingConfig(),
      backup: this.getBackupConfig()
    };
  }

  private getNetworkingConfig(): NetworkConfig {
    return {
      vpc: {
        cidr: '10.0.0.0/16',
        enableDnsHostnames: true,
        enableDnsSupport: true,
        tags: {
          'Name': 'geo-alert-vpc',
          'Environment': 'production'
        }
      },
      subnets: [
        {
          name: 'public-subnet-1',
          cidr: '10.0.1.0/24',
          availabilityZone: 'us-east-1a',
          type: 'public',
          routeTable: 'public-rt'
        },
        {
          name: 'public-subnet-2',
          cidr: '10.0.2.0/24',
          availabilityZone: 'us-east-1b',
          type: 'public',
          routeTable: 'public-rt'
        },
        {
          name: 'private-subnet-1',
          cidr: '10.0.10.0/24',
          availabilityZone: 'us-east-1a',
          type: 'private',
          routeTable: 'private-rt-1'
        },
        {
          name: 'private-subnet-2',
          cidr: '10.0.11.0/24',
          availabilityZone: 'us-east-1b',
          type: 'private',
          routeTable: 'private-rt-2'
        },
        {
          name: 'database-subnet-1',
          cidr: '10.0.20.0/24',
          availabilityZone: 'us-east-1a',
          type: 'database',
          routeTable: 'database-rt'
        },
        {
          name: 'database-subnet-2',
          cidr: '10.0.21.0/24',
          availabilityZone: 'us-east-1b',
          type: 'database',
          routeTable: 'database-rt'
        }
      ],
      loadBalancers: [
        {
          name: 'geo-alert-alb',
          type: 'application',
          scheme: 'internet-facing',
          listeners: [
            {
              port: 80,
              protocol: 'HTTP',
              ssl: false,
              rules: [
                {
                  priority: 100,
                  conditions: [{ type: 'path-pattern', values: ['/*'] }],
                  actions: [{ type: 'redirect', redirectConfig: { protocol: 'HTTPS', port: '443', statusCode: 'HTTP_301' } }]
                }
              ]
            },
            {
              port: 443,
              protocol: 'HTTPS',
              ssl: true,
              certificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012',
              rules: [
                {
                  priority: 100,
                  conditions: [{ type: 'host-header', values: ['api.geo-alert.com'] }],
                  actions: [{ type: 'forward', targetGroupArn: 'arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/geo-alert-api/1234567890123456' }]
                },
                {
                  priority: 200,
                  conditions: [{ type: 'host-header', values: ['geo-alert.com', 'www.geo-alert.com'] }],
                  actions: [{ type: 'forward', targetGroupArn: 'arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/geo-alert-web/1234567890123456' }]
                }
              ]
            }
          ],
          healthCheck: {
            enabled: true,
            type: 'http',
            path: '/health',
            port: 80,
            initialDelaySeconds: 30,
            periodSeconds: 30,
            timeoutSeconds: 5,
            failureThreshold: 3,
            successThreshold: 2
          },
          sslPolicy: 'ELBSecurityPolicy-TLS-1-2-2017-01',
          stickySessions: false
        }
      ],
      cdn: {
        enabled: true,
        provider: 'aws-cloudfront',
        origins: [
          {
            id: 'geo-alert-web',
            domainName: 'geo-alert-alb-123456789.us-east-1.elb.amazonaws.com',
            customHeaders: {},
            sslProtocols: ['TLSv1.2']
          }
        ],
        caching: {
          defaultTtl: 86400,
          maxTtl: 31536000,
          behaviors: [
            {
              pathPattern: '/api/*',
              targetOriginId: 'geo-alert-web',
              compress: true,
              allowedMethods: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'POST', 'PATCH', 'DELETE'],
              cachedMethods: ['GET', 'HEAD'],
              forwardCookies: 'all',
              forwardHeaders: ['Authorization', 'Content-Type'],
              ttl: { min: 0, default: 0, max: 0 }
            },
            {
              pathPattern: '/static/*',
              targetOriginId: 'geo-alert-web',
              compress: true,
              allowedMethods: ['GET', 'HEAD'],
              cachedMethods: ['GET', 'HEAD'],
              forwardCookies: 'none',
              forwardHeaders: [],
              ttl: { min: 86400, default: 86400, max: 31536000 }
            }
          ]
        },
        compression: true,
        minify: true,
        waf: {
          enabled: true,
          rules: [
            {
              name: 'SQL-Injection-Protection',
              priority: 1,
              action: 'block',
              conditions: [
                { type: 'sql-injection', value: '', operator: 'contains' }
              ]
            },
            {
              name: 'XSS-Protection',
              priority: 2,
              action: 'block',
              conditions: [
                { type: 'xss', value: '', operator: 'contains' }
              ]
            }
          ],
          rateLimiting: {
            enabled: true,
            requestsPerMinute: 2000
          },
          geoBlocking: {
            enabled: true,
            blockedCountries: ['CN', 'RU', 'KP'],
            allowedCountries: []
          }
        }
      },
      dns: {
        provider: 'route53',
        domain: 'geo-alert.com',
        records: [
          {
            name: 'geo-alert.com',
            type: 'A',
            value: 'ALIAS dualstack.geo-alert-alb-123456789.us-east-1.elb.amazonaws.com',
            ttl: 300
          },
          {
            name: 'www.geo-alert.com',
            type: 'CNAME',
            value: 'geo-alert.com',
            ttl: 300
          },
          {
            name: 'api.geo-alert.com',
            type: 'A',
            value: 'ALIAS dualstack.geo-alert-alb-123456789.us-east-1.elb.amazonaws.com',
            ttl: 300
          }
        ],
        healthChecks: [
          {
            name: 'geo-alert-web-health',
            type: 'HTTPS',
            target: 'geo-alert.com',
            path: '/health',
            interval: 30,
            timeout: 10,
            failureThreshold: 3
          },
          {
            name: 'geo-alert-api-health',
            type: 'HTTPS',
            target: 'api.geo-alert.com',
            path: '/api/health',
            interval: 30,
            timeout: 10,
            failureThreshold: 3
          }
        ]
      },
      firewall: {
        rules: [
          {
            name: 'allow-https',
            priority: 100,
            direction: 'inbound',
            action: 'allow',
            protocol: 'TCP',
            destinationPort: '443',
            sourceIP: '0.0.0.0/0'
          },
          {
            name: 'allow-http-redirect',
            priority: 101,
            direction: 'inbound',
            action: 'allow',
            protocol: 'TCP',
            destinationPort: '80',
            sourceIP: '0.0.0.0/0'
          },
          {
            name: 'allow-ssh-admin',
            priority: 200,
            direction: 'inbound',
            action: 'allow',
            protocol: 'TCP',
            destinationPort: '22',
            sourceIP: '10.0.0.0/16'
          }
        ],
        defaultAction: 'deny',
        logging: true
      }
    };
  }

  private getComputeConfig(): ComputeConfig {
    return {
      instances: [
        {
          name: 'geo-alert-web-server',
          type: 't3.medium',
          image: 'ami-0abcdef1234567890',
          keyPair: 'geo-alert-keypair',
          securityGroups: ['geo-alert-web-sg'],
          subnet: 'private-subnet-1',
          publicIP: false,
          userData: `#!/bin/bash
            yum update -y
            docker run -d --name geo-alert-web -p 3000:3000 geo-alert/frontend:latest
          `,
          tags: {
            'Name': 'geo-alert-web-server',
            'Environment': 'production',
            'Application': 'geo-alert'
          },
          monitoring: true
        }
      ],
      autoScaling: {
        enabled: true,
        minInstances: 2,
        maxInstances: 20,
        desiredCapacity: 3,
        scalingPolicies: [
          {
            name: 'cpu-scale-up',
            type: 'target-tracking',
            metricType: 'cpu',
            targetValue: 70,
            scaleUpAdjustment: 2,
            scaleDownAdjustment: 1,
            cooldown: 300
          },
          {
            name: 'memory-scale-up',
            type: 'target-tracking',
            metricType: 'memory',
            targetValue: 80,
            scaleUpAdjustment: 2,
            scaleDownAdjustment: 1,
            cooldown: 300
          }
        ],
        healthCheckType: 'ELB',
        healthCheckGracePeriod: 300
      },
      kubernetes: {
        enabled: true,
        version: '1.28',
        nodeGroups: [
          {
            name: 'geo-alert-workers',
            instanceType: 'm5.large',
            minSize: 2,
            maxSize: 10,
            desiredSize: 3,
            diskSize: 50,
            labels: {
              'application': 'geo-alert',
              'tier': 'worker'
            },
            taints: []
          },
          {
            name: 'geo-alert-spot-workers',
            instanceType: 'm5.xlarge',
            minSize: 0,
            maxSize: 5,
            desiredSize: 1,
            diskSize: 100,
            labels: {
              'application': 'geo-alert',
              'tier': 'spot-worker'
            },
            taints: [
              {
                key: 'spot-instance',
                value: 'true',
                effect: 'NoSchedule'
              }
            ]
          }
        ],
        addons: [
          'vpc-cni',
          'coredns',
          'kube-proxy',
          'aws-load-balancer-controller',
          'cluster-autoscaler',
          'metrics-server'
        ],
        rbac: true,
        networkPolicy: true
      },
      serverless: {
        functions: [
          {
            name: 'geo-alert-processor',
            runtime: 'nodejs18.x',
            handler: 'index.handler',
            memory: 512,
            timeout: 300,
            environment: {
              'NODE_ENV': 'production',
              'DATABASE_URL': 'postgresql://...'
            },
            triggers: [
              {
                type: 'queue',
                config: { queueName: 'geo-alert-processing' }
              }
            ]
          }
        ],
        apiGateway: {
          name: 'geo-alert-api',
          type: 'REST',
          cors: true,
          authentication: 'cognito',
          throttling: {
            rateLimit: 10000,
            burstLimit: 5000
          }
        },
        eventSources: [
          {
            type: 'sqs',
            config: { queueName: 'geo-alert-events' }
          }
        ]
      }
    };
  }

  private getStorageConfig(): StorageConfig {
    return {
      objectStorage: {
        buckets: [
          {
            name: 'geo-alert-uploads',
            region: 'us-east-1',
            storageClass: 'STANDARD',
            encryption: true,
            versioning: true,
            publicRead: false,
            cors: {
              allowedOrigins: ['https://geo-alert.com'],
              allowedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
              allowedHeaders: ['*'],
              maxAge: 3600
            }
          },
          {
            name: 'geo-alert-static',
            region: 'us-east-1',
            storageClass: 'STANDARD',
            encryption: true,
            versioning: false,
            publicRead: true,
            cors: {
              allowedOrigins: ['*'],
              allowedMethods: ['GET'],
              allowedHeaders: ['*'],
              maxAge: 86400
            }
          },
          {
            name: 'geo-alert-backups',
            region: 'us-east-1',
            storageClass: 'GLACIER',
            encryption: true,
            versioning: true,
            publicRead: false,
            cors: {
              allowedOrigins: [],
              allowedMethods: [],
              allowedHeaders: [],
              maxAge: 0
            }
          }
        ],
        lifecycle: [
          {
            id: 'uploads-lifecycle',
            status: 'enabled',
            transitions: [
              { days: 30, storageClass: 'STANDARD_IA' },
              { days: 90, storageClass: 'GLACIER' },
              { days: 365, storageClass: 'DEEP_ARCHIVE' }
            ],
            expiration: {
              days: 2555, // 7 years
              expiredObjectDeleteMarker: true
            }
          }
        ],
        replication: [
          {
            destinationBucket: 'geo-alert-uploads-replica',
            destinationRegion: 'eu-west-1',
            storageClass: 'STANDARD_IA'
          }
        ]
      },
      blockStorage: {
        volumes: [
          {
            name: 'geo-alert-database-volume',
            size: 500,
            type: 'gp3',
            iops: 3000,
            throughput: 125,
            encrypted: true,
            availabilityZone: 'us-east-1a'
          }
        ],
        snapshots: [
          {
            volumeId: 'vol-1234567890abcdef0',
            schedule: '0 2 * * *', // Daily at 2 AM
            retention: 30,
            crossRegionCopy: true
          }
        ]
      },
      fileStorage: {
        enabled: true,
        type: 'nfs',
        performance: 'general-purpose',
        throughput: 'bursting',
        encryption: true
      },
      backup: {
        enabled: true,
        schedule: '0 1 * * *', // Daily at 1 AM
        retention: 90,
        crossRegion: true,
        encryption: true,
        testing: true,
        resources: [
          {
            type: 'database',
            name: 'geo-alert-db',
            schedule: '0 1 * * *',
            retention: 35
          },
          {
            type: 'volume',
            name: 'geo-alert-data',
            schedule: '0 2 * * *',
            retention: 30
          }
        ]
      }
    };
  }

  private getDatabaseConfig(): DatabaseConfig {
    return {
      primary: {
        engine: 'postgresql',
        version: '14.9',
        instanceClass: 'db.r5.xlarge',
        allocatedStorage: 500,
        maxAllocatedStorage: 2000,
        storageType: 'gp3',
        multiAZ: true,
        encryption: true,
        backupRetention: 35,
        maintenanceWindow: 'sun:03:00-sun:04:00',
        parameterGroup: 'geo-alert-pg14'
      },
      replicas: [
        {
          region: 'eu-west-1',
          instanceClass: 'db.r5.large',
          readOnly: true,
          lagThreshold: 300
        },
        {
          region: 'ap-southeast-1',
          instanceClass: 'db.r5.large',
          readOnly: true,
          lagThreshold: 300
        }
      ],
      backup: {
        automated: true,
        retentionPeriod: 35,
        backupWindow: '03:00-04:00',
        copyTags: true,
        crossRegionBackup: true,
        pointInTimeRecovery: true
      },
      monitoring: {
        performanceInsights: true,
        enhancedMonitoring: true,
        slowQueryLog: true,
        generalLog: false,
        errorLog: true
      }
    };
  }

  private getMonitoringConfig(): MonitoringConfig {
    return {
      metrics: {
        provider: 'cloudwatch',
        retention: 365,
        customMetrics: [
          {
            name: 'DXFProcessingTime',
            namespace: 'GeoAlert/Application',
            dimensions: { 'Environment': 'Production' },
            unit: 'Milliseconds',
            statistic: 'average'
          },
          {
            name: 'ActiveUsers',
            namespace: 'GeoAlert/Application',
            dimensions: { 'Environment': 'Production' },
            unit: 'Count',
            statistic: 'sum'
          }
        ],
        aggregation: [
          {
            period: 300,
            statistic: 'Average',
            threshold: 1000
          }
        ]
      },
      logging: {
        provider: 'cloudwatch',
        retention: 90,
        logGroups: [
          {
            name: '/aws/eks/geo-alert/cluster',
            retention: 90,
            encryption: true,
            filters: [
              {
                name: 'error-filter',
                pattern: 'ERROR',
                metricTransformation: {
                  metricName: 'ErrorCount',
                  metricNamespace: 'GeoAlert/Application',
                  metricValue: '1'
                }
              }
            ]
          }
        ],
        parsing: {
          format: 'json',
          patterns: ['timestamp', 'level', 'message', 'metadata'],
          fields: ['timestamp', 'level', 'service', 'message']
        }
      },
      alerting: {
        rules: [
          {
            name: 'High-CPU-Usage',
            condition: {
              metric: 'AWS/EC2/CPUUtilization',
              operator: 'gt',
              threshold: 80,
              period: 300,
              evaluationPeriods: 2
            },
            severity: 'high',
            enabled: true,
            channels: ['email-alerts', 'slack-alerts']
          },
          {
            name: 'Database-Connection-Failures',
            condition: {
              metric: 'AWS/RDS/DatabaseConnections',
              operator: 'gt',
              threshold: 80,
              period: 300,
              evaluationPeriods: 1
            },
            severity: 'critical',
            enabled: true,
            channels: ['email-alerts', 'pagerduty']
          }
        ],
        channels: [
          {
            name: 'email-alerts',
            type: 'email',
            config: {
              recipients: ['ops@geo-alert.com', 'team@geo-alert.com']
            }
          },
          {
            name: 'slack-alerts',
            type: 'slack',
            config: {
              webhook: 'https://hooks.slack.com/services/...'
            }
          },
          {
            name: 'pagerduty',
            type: 'pagerduty',
            config: {
              integrationKey: 'pagerduty-integration-key'
            }
          }
        ],
        escalation: [
          {
            name: 'critical-escalation',
            levels: [
              { delay: 0, channels: ['pagerduty'] },
              { delay: 300, channels: ['email-alerts'] },
              { delay: 900, channels: ['slack-alerts'] }
            ]
          }
        ]
      },
      dashboards: [
        {
          name: 'Geo-Alert-Overview',
          widgets: [
            {
              type: 'metric',
              title: 'CPU Utilization',
              config: {
                metrics: ['AWS/EC2/CPUUtilization'],
                period: 300,
                stat: 'Average'
              },
              position: { x: 0, y: 0, width: 6, height: 6 }
            },
            {
              type: 'metric',
              title: 'Memory Utilization',
              config: {
                metrics: ['AWS/EC2/MemoryUtilization'],
                period: 300,
                stat: 'Average'
              },
              position: { x: 6, y: 0, width: 6, height: 6 }
            }
          ],
          layout: {
            columns: 12,
            rows: 12,
            spacing: 1
          }
        }
      ]
    };
  }

  private getSecurityConfig(): SecurityConfig {
    return {
      encryption: {
        atRest: true,
        inTransit: true,
        keyManagement: 'aws-kms',
        keys: [
          {
            id: 'geo-alert-master-key',
            purpose: 'general-encryption',
            algorithm: 'AES-256',
            keySize: 256,
            rotation: true,
            rotationPeriod: 365
          }
        ]
      },
      iam: {
        users: [
          {
            username: 'geo-alert-admin',
            groups: ['administrators'],
            policies: ['AdministratorAccess'],
            accessKeys: false,
            mfa: true
          }
        ],
        roles: [
          {
            name: 'GeoAlertInstanceRole',
            trustPolicy: {
              Version: '2012-10-17',
              Statement: [{
                Effect: 'Allow',
                Principal: { Service: 'ec2.amazonaws.com' },
                Action: 'sts:AssumeRole'
              }]
            },
            policies: ['GeoAlertApplicationPolicy'],
            maxSessionDuration: 3600
          }
        ],
        policies: [
          {
            name: 'GeoAlertApplicationPolicy',
            type: 'managed',
            document: {
              Version: '2012-10-17',
              Statement: [
                {
                  Effect: 'Allow',
                  Action: ['s3:GetObject', 's3:PutObject'],
                  Resource: 'arn:aws:s3:::geo-alert-uploads/*'
                }
              ]
            }
          }
        ],
        groups: [
          {
            name: 'administrators',
            policies: ['AdministratorAccess']
          }
        ]
      },
      compliance: {
        standards: ['SOC2', 'GDPR', 'HIPAA'],
        auditing: true,
        dataResidency: {
          allowedRegions: ['us-east-1', 'eu-west-1'],
          blockedRegions: ['cn-north-1', 'cn-northwest-1'],
          dataClassification: [
            {
              type: 'confidential',
              requirements: ['encryption', 'access-logging', 'data-residency']
            }
          ]
        },
        retention: [
          {
            dataType: 'audit-logs',
            retentionPeriod: 2555, // 7 years
            archivalPolicy: 'glacier',
            deletionPolicy: 'secure-delete'
          }
        ]
      },
      secrets: {
        provider: 'aws-secrets',
        rotation: true,
        encryption: true,
        secrets: [
          {
            name: 'geo-alert-database-credentials',
            type: 'password',
            rotation: true,
            rotationPeriod: 90,
            accessPolicy: 'GeoAlertSecretsPolicy'
          }
        ]
      }
    };
  }

  private getScalingConfig(): ScalingConfig {
    return {
      autoScaling: true,
      predictiveScaling: true,
      scheduledScaling: [
        {
          name: 'business-hours-scale-up',
          schedule: '0 8 * * 1-5', // 8 AM weekdays
          minCapacity: 5,
          maxCapacity: 20,
          desiredCapacity: 8
        },
        {
          name: 'off-hours-scale-down',
          schedule: '0 18 * * 1-5', // 6 PM weekdays
          minCapacity: 2,
          maxCapacity: 10,
          desiredCapacity: 3
        }
      ],
      metrics: [
        {
          name: 'CPUUtilization',
          targetValue: 70,
          scaleOutCooldown: 300,
          scaleInCooldown: 300
        },
        {
          name: 'MemoryUtilization',
          targetValue: 80,
          scaleOutCooldown: 300,
          scaleInCooldown: 600
        }
      ],
      policies: [
        {
          name: 'cpu-target-tracking',
          type: 'target-tracking',
          metricType: 'cpu',
          targetValue: 70,
          scaleUpAdjustment: 2,
          scaleDownAdjustment: 1,
          cooldown: 300
        }
      ]
    };
  }

  private getBackupConfig(): BackupConfig {
    return {
      enabled: true,
      schedule: '0 1 * * *',
      retention: 90,
      crossRegion: true,
      encryption: true,
      testing: true,
      resources: [
        {
          type: 'database',
          name: 'geo-alert-production-db',
          schedule: '0 1 * * *',
          retention: 35
        },
        {
          type: 'volume',
          name: 'geo-alert-data-volumes',
          schedule: '0 2 * * *',
          retention: 30
        },
        {
          type: 'application',
          name: 'geo-alert-application-state',
          schedule: '0 3 * * *',
          retention: 14
        }
      ]
    };
  }

  // ========================================================================
  // INFRASTRUCTURE DEPLOYMENT
  // ========================================================================

  /**
   * Deploy complete Geo-Alert infrastructure
   */
  public async deployInfrastructure(): Promise<{
    success: boolean;
    infrastructureId: string;
    duration: number;
    status: InfrastructureStatus;
  }> {
    console.log('☁️  CLOUD INFRASTRUCTURE - Deploying Geo-Alert Infrastructure...');

    const startTime = performance.now();
    const config = this.getGeoAlertInfrastructureConfig();
    const infrastructureId = this.generateInfrastructureId();

    try {
      const infrastructureStatus: InfrastructureStatus = {
        name: config.name,
        environment: config.environment,
        status: 'provisioning',
        regions: [],
        resources: [],
        costs: {
          total: 0,
          byService: {},
          byRegion: {},
          trends: [],
          forecasts: [],
          recommendations: []
        },
        health: {
          overall: 'healthy',
          services: [],
          incidents: []
        },
        lastUpdated: Date.now()
      };

      this.infrastructures.set(infrastructureId, infrastructureStatus);

      // Deploy networking
      await this.deployNetworking(config.networking, infrastructureStatus);

      // Deploy compute resources
      await this.deployCompute(config.compute, infrastructureStatus);

      // Deploy storage
      await this.deployStorage(config.storage, infrastructureStatus);

      // Deploy database
      await this.deployDatabase(config.database, infrastructureStatus);

      // Setup monitoring
      await this.setupMonitoring(config.monitoring, infrastructureStatus);

      // Configure security
      await this.configureSecurity(config.security, infrastructureStatus);

      // Setup auto-scaling
      await this.setupAutoScaling(config.scaling, infrastructureStatus);

      infrastructureStatus.status = 'running';
      infrastructureStatus.lastUpdated = Date.now();

      const duration = performance.now() - startTime;

      console.log(`✅ Infrastructure deployed successfully: ${infrastructureId} (${duration.toFixed(2)}ms)`);

      return {
        success: true,
        infrastructureId,
        duration,
        status: infrastructureStatus
      };

    } catch (error) {
      console.error('❌ Infrastructure deployment failed:', error);

      const failedStatus = this.infrastructures.get(infrastructureId);
      if (failedStatus) {
        failedStatus.status = 'failed';
        failedStatus.lastUpdated = Date.now();
      }

      return {
        success: false,
        infrastructureId,
        duration: performance.now() - startTime,
        status: failedStatus || {} as InfrastructureStatus
      };
    }
  }

  /**
   * Deploy networking components
   */
  private async deployNetworking(config: NetworkConfig, status: InfrastructureStatus): Promise<void> {
    console.log('  🌐 Deploying networking components...');

    // Simulate VPC creation
    await this.simulateResourceDeployment('VPC', 2000);
    status.resources.push({
      id: 'vpc-123456789',
      type: 'VPC',
      name: 'geo-alert-vpc',
      status: 'running',
      region: 'us-east-1',
      tags: config.vpc.tags,
      cost: 0,
      metrics: { cpu: 0, memory: 0, network: 0, storage: 0, requests: 0 }
    });

    // Simulate subnet creation
    for (const subnet of config.subnets) {
      await this.simulateResourceDeployment('Subnet', 1000);
      status.resources.push({
        id: `subnet-${Math.random().toString(36).substr(2, 9)}`,
        type: 'Subnet',
        name: subnet.name,
        status: 'running',
        region: 'us-east-1',
        tags: { 'Type': subnet.type },
        cost: 0,
        metrics: { cpu: 0, memory: 0, network: 0, storage: 0, requests: 0 }
      });
    }

    // Simulate load balancer deployment
    for (const lb of config.loadBalancers) {
      await this.simulateResourceDeployment('LoadBalancer', 3000);
      status.resources.push({
        id: `alb-${Math.random().toString(36).substr(2, 9)}`,
        type: 'ApplicationLoadBalancer',
        name: lb.name,
        status: 'running',
        region: 'us-east-1',
        tags: { 'Type': lb.type },
        cost: 22.5, // $22.50/month
        metrics: { cpu: 0, memory: 0, network: 1000, storage: 0, requests: 5000 }
      });
    }

    console.log('  ✅ Networking deployed');
  }

  /**
   * Deploy compute resources
   */
  private async deployCompute(config: ComputeConfig, status: InfrastructureStatus): Promise<void> {
    console.log('  💻 Deploying compute resources...');

    // Deploy instances
    for (const instance of config.instances) {
      await this.simulateResourceDeployment('EC2Instance', 2500);
      status.resources.push({
        id: `i-${Math.random().toString(36).substr(2, 9)}`,
        type: 'EC2Instance',
        name: instance.name,
        status: 'running',
        region: 'us-east-1',
        tags: instance.tags,
        cost: 70.08, // m5.large pricing
        metrics: { cpu: 45, memory: 60, network: 500, storage: 80, requests: 1000 }
      });
    }

    // Deploy Kubernetes cluster if enabled
    if (config.kubernetes.enabled) {
      await this.simulateResourceDeployment('EKS Cluster', 5000);
      status.resources.push({
        id: `eks-${Math.random().toString(36).substr(2, 9)}`,
        type: 'EKSCluster',
        name: 'geo-alert-cluster',
        status: 'running',
        region: 'us-east-1',
        tags: { 'Type': 'kubernetes' },
        cost: 144, // $0.20/hour
        metrics: { cpu: 30, memory: 40, network: 2000, storage: 200, requests: 10000 }
      });
    }

    console.log('  ✅ Compute resources deployed');
  }

  /**
   * Deploy storage resources
   */
  private async deployStorage(config: StorageConfig, status: InfrastructureStatus): Promise<void> {
    console.log('  💾 Deploying storage resources...');

    // Deploy S3 buckets
    for (const bucket of config.objectStorage.buckets) {
      await this.simulateResourceDeployment('S3 Bucket', 1500);
      status.resources.push({
        id: `bucket-${bucket.name}`,
        type: 'S3Bucket',
        name: bucket.name,
        status: 'running',
        region: bucket.region,
        tags: { 'StorageClass': bucket.storageClass },
        cost: 23, // ~$23/month for standard storage
        metrics: { cpu: 0, memory: 0, network: 300, storage: 1000000, requests: 2000 }
      });
    }

    // Deploy EBS volumes
    for (const volume of config.blockStorage.volumes) {
      await this.simulateResourceDeployment('EBS Volume', 1000);
      status.resources.push({
        id: `vol-${Math.random().toString(36).substr(2, 9)}`,
        type: 'EBSVolume',
        name: volume.name,
        status: 'running',
        region: 'us-east-1',
        tags: { 'Type': volume.type },
        cost: 50, // gp3 pricing
        metrics: { cpu: 0, memory: 0, network: 0, storage: volume.size * 1024 * 1024 * 1024, requests: 0 }
      });
    }

    console.log('  ✅ Storage resources deployed');
  }

  /**
   * Deploy database resources
   */
  private async deployDatabase(config: DatabaseConfig, status: InfrastructureStatus): Promise<void> {
    console.log('  🗄️  Deploying database resources...');

    // Deploy primary database
    await this.simulateResourceDeployment('RDS Instance', 4000);
    status.resources.push({
      id: `db-${Math.random().toString(36).substr(2, 9)}`,
      type: 'RDSInstance',
      name: 'geo-alert-primary-db',
      status: 'running',
      region: 'us-east-1',
      tags: { 'Engine': config.primary.engine },
      cost: 350, // db.r5.xlarge pricing
      metrics: { cpu: 25, memory: 50, network: 400, storage: 500000, requests: 5000 }
    });

    // Deploy read replicas
    for (const replica of config.replicas) {
      await this.simulateResourceDeployment('RDS Replica', 3000);
      status.resources.push({
        id: `db-replica-${Math.random().toString(36).substr(2, 9)}`,
        type: 'RDSReplica',
        name: `geo-alert-replica-${replica.region}`,
        status: 'running',
        region: replica.region,
        tags: { 'ReplicaOf': 'geo-alert-primary-db' },
        cost: 175, // db.r5.large pricing
        metrics: { cpu: 15, memory: 30, network: 200, storage: 500000, requests: 2000 }
      });
    }

    console.log('  ✅ Database resources deployed');
  }

  /**
   * Setup monitoring
   */
  private async setupMonitoring(config: MonitoringConfig, status: InfrastructureStatus): Promise<void> {
    console.log('  📊 Setting up monitoring...');

    await this.simulateResourceDeployment('CloudWatch', 1000);
    status.resources.push({
      id: 'monitoring-stack',
      type: 'Monitoring',
      name: 'geo-alert-monitoring',
      status: 'running',
      region: 'us-east-1',
      tags: { 'Provider': config.metrics.provider },
      cost: 15, // CloudWatch costs
      metrics: { cpu: 0, memory: 0, network: 100, storage: 10000, requests: 50000 }
    });

    console.log('  ✅ Monitoring configured');
  }

  /**
   * Configure security
   */
  private async configureSecurity(config: SecurityConfig, status: InfrastructureStatus): Promise<void> {
    console.log('  🔒 Configuring security...');

    await this.simulateResourceDeployment('Security Configuration', 2000);
    status.resources.push({
      id: 'security-stack',
      type: 'Security',
      name: 'geo-alert-security',
      status: 'running',
      region: 'us-east-1',
      tags: { 'Compliance': config.compliance.standards.join(',') },
      cost: 5, // KMS and other security costs
      metrics: { cpu: 0, memory: 0, network: 50, storage: 1000, requests: 1000 }
    });

    console.log('  ✅ Security configured');
  }

  /**
   * Setup auto-scaling
   */
  private async setupAutoScaling(config: ScalingConfig, status: InfrastructureStatus): Promise<void> {
    console.log('  ⚖️ Setting up auto-scaling...');

    await this.simulateResourceDeployment('Auto Scaling', 1500);
    status.resources.push({
      id: 'autoscaling-stack',
      type: 'AutoScaling',
      name: 'geo-alert-autoscaling',
      status: 'running',
      region: 'us-east-1',
      tags: { 'Enabled': config.autoScaling.toString() },
      cost: 0, // Auto Scaling is free
      metrics: { cpu: 0, memory: 0, network: 20, storage: 100, requests: 500 }
    });

    console.log('  ✅ Auto-scaling configured');
  }

  // ========================================================================
  // INFRASTRUCTURE MONITORING
  // ========================================================================

  /**
   * Start infrastructure monitoring
   */
  public startInfrastructureMonitoring(): void {
    if (this.isMonitoring) {
      console.warn('Infrastructure monitoring already active');
      return;
    }

    console.log('📊 Starting infrastructure monitoring...');
    this.isMonitoring = true;

    this.monitoringInterval = setInterval(() => {
      this.collectInfrastructureMetrics();
      this.updateCostAnalysis();
      this.performHealthChecks();
    }, 60000); // Every minute

    console.log('✅ Infrastructure monitoring started');
  }

  /**
   * Stop infrastructure monitoring
   */
  public stopInfrastructureMonitoring(): void {
    if (!this.isMonitoring) return;

    console.log('🛑 Stopping infrastructure monitoring...');
    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    console.log('✅ Infrastructure monitoring stopped');
  }

  /**
   * Collect infrastructure metrics
   */
  private collectInfrastructureMetrics(): void {
    for (const [infrastructureId, status] of this.infrastructures.entries()) {
      // Update resource metrics
      status.resources.forEach(resource => {
        // Simulate metric updates
        resource.metrics.cpu = Math.max(0, Math.min(100, resource.metrics.cpu + (Math.random() - 0.5) * 10));
        resource.metrics.memory = Math.max(0, Math.min(100, resource.metrics.memory + (Math.random() - 0.5) * 10));
        resource.metrics.network = Math.max(0, resource.metrics.network + (Math.random() - 0.5) * 100);
        resource.metrics.requests = Math.max(0, resource.metrics.requests + (Math.random() - 0.5) * 500);
      });

      // Update region status
      status.regions.forEach(region => {
        region.latency = Math.max(10, region.latency + (Math.random() - 0.5) * 20);
        region.availability = Math.min(100, Math.max(90, region.availability + (Math.random() - 0.5) * 2));
      });

      status.lastUpdated = Date.now();
    }
  }

  /**
   * Update cost analysis
   */
  private updateCostAnalysis(): void {
    for (const [infrastructureId, status] of this.infrastructures.entries()) {
      // Calculate total costs
      const totalCost = status.resources.reduce((sum, resource) => sum + resource.cost, 0);
      status.costs.total = totalCost;

      // Update cost breakdown by service
      status.costs.byService = {};
      status.resources.forEach(resource => {
        if (!status.costs.byService[resource.type]) {
          status.costs.byService[resource.type] = 0;
        }
        status.costs.byService[resource.type] += resource.cost;
      });

      // Update cost breakdown by region
      status.costs.byRegion = {};
      status.resources.forEach(resource => {
        if (!status.costs.byRegion[resource.region]) {
          status.costs.byRegion[resource.region] = 0;
        }
        status.costs.byRegion[resource.region] += resource.cost;
      });

      // Add cost trend
      status.costs.trends.push({
        period: new Date().toISOString().slice(0, 10),
        cost: totalCost,
        change: Math.random() * 20 - 10 // Random change
      });

      // Keep only last 30 days
      if (status.costs.trends.length > 30) {
        status.costs.trends = status.costs.trends.slice(-30);
      }
    }
  }

  /**
   * Perform health checks
   */
  private performHealthChecks(): void {
    for (const [infrastructureId, status] of this.infrastructures.entries()) {
      // Update service health
      status.health.services = status.resources.map(resource => ({
        name: resource.name,
        status: this.calculateResourceHealth(resource),
        uptime: 99.9, // Mock uptime
        responseTime: Math.random() * 200 + 50, // 50-250ms
        errorRate: Math.random() * 2 // 0-2%
      }));

      // Calculate overall health
      const unhealthyServices = status.health.services.filter(s => s.status === 'unhealthy').length;
      const degradedServices = status.health.services.filter(s => s.status === 'degraded').length;

      if (unhealthyServices > 0) {
        status.health.overall = 'unhealthy';
      } else if (degradedServices > 0) {
        status.health.overall = 'degraded';
      } else {
        status.health.overall = 'healthy';
      }
    }
  }

  private calculateResourceHealth(resource: ResourceStatus): 'healthy' | 'degraded' | 'unhealthy' {
    if (resource.status !== 'running') return 'unhealthy';
    if (resource.metrics.cpu > 90 || resource.metrics.memory > 90) return 'degraded';
    return 'healthy';
  }

  // ========================================================================
  // COST OPTIMIZATION
  // ========================================================================

  /**
   * Analyze costs και generate optimization recommendations
   */
  public generateCostOptimizationRecommendations(infrastructureId: string): CostOptimization[] {
    const infrastructure = this.infrastructures.get(infrastructureId);
    if (!infrastructure) return [];

    const recommendations: CostOptimization[] = [];

    // Right-sizing recommendations
    infrastructure.resources.forEach(resource => {
      if (resource.type === 'EC2Instance' && resource.metrics.cpu < 30 && resource.metrics.memory < 40) {
        recommendations.push({
          type: 'right-sizing',
          description: `Instance ${resource.name} is underutilized (CPU: ${resource.metrics.cpu}%, Memory: ${resource.metrics.memory}%). Consider downsizing.`,
          potentialSavings: resource.cost * 0.3, // 30% savings
          effort: 'low'
        });
      }
    });

    // Reserved instances recommendations
    const ec2Instances = infrastructure.resources.filter(r => r.type === 'EC2Instance');
    if (ec2Instances.length >= 3) {
      const monthlyCost = ec2Instances.reduce((sum, instance) => sum + instance.cost, 0);
      recommendations.push({
        type: 'reserved-instances',
        description: `Consider Reserved Instances για ${ec2Instances.length} EC2 instances για significant cost savings.`,
        potentialSavings: monthlyCost * 0.4, // 40% savings with RIs
        effort: 'medium'
      });
    }

    // Storage optimization
    infrastructure.resources.forEach(resource => {
      if (resource.type === 'S3Bucket' && resource.cost > 50) {
        recommendations.push({
          type: 'storage-optimization',
          description: `S3 bucket ${resource.name} has high storage costs. Consider lifecycle policies and Intelligent Tiering.`,
          potentialSavings: resource.cost * 0.25, // 25% savings
          effort: 'low'
        });
      }
    });

    return recommendations;
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  private simulateResourceDeployment(resourceType: string, delay: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  private generateInfrastructureId(): string {
    return `infra-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // ========================================================================
  // PUBLIC API
  // ========================================================================

  /**
   * Get infrastructure status
   */
  public getInfrastructureStatus(infrastructureId: string): InfrastructureStatus | undefined {
    return this.infrastructures.get(infrastructureId);
  }

  /**
   * Get all infrastructures
   */
  public getAllInfrastructures(): Map<string, InfrastructureStatus> {
    return this.infrastructures;
  }

  /**
   * Get cloud provider
   */
  public getCloudProvider(providerName: string): CloudProvider | undefined {
    return this.providers.get(providerName);
  }

  /**
   * Get infrastructure statistics
   */
  public getInfrastructureStatistics(): {
    totalInfrastructures: number;
    totalResources: number;
    totalMonthlyCost: number;
    healthyResources: number;
    regions: number;
    providers: number;
  } {
    let totalResources = 0;
    let totalMonthlyCost = 0;
    let healthyResources = 0;
    const regionsSet = new Set<string>();

    for (const infrastructure of this.infrastructures.values()) {
      totalResources += infrastructure.resources.length;
      totalMonthlyCost += infrastructure.costs.total;
      healthyResources += infrastructure.resources.filter(r => r.status === 'running').length;
      infrastructure.resources.forEach(r => regionsSet.add(r.region));
    }

    return {
      totalInfrastructures: this.infrastructures.size,
      totalResources,
      totalMonthlyCost,
      healthyResources,
      regions: regionsSet.size,
      providers: this.providers.size
    };
  }
}

// ============================================================================
// GLOBAL EXPORTS & UTILITIES
// ============================================================================

/**
 * Global Cloud Infrastructure Instance
 */
export const geoAlertCloudInfrastructure = GeoAlertCloudInfrastructure.getInstance();

/**
 * Quick infrastructure utilities
 */
export const deployInfrastructure = () => geoAlertCloudInfrastructure.deployInfrastructure();
export const startMonitoring = () => geoAlertCloudInfrastructure.startInfrastructureMonitoring();
export const getInfrastructureStats = () => geoAlertCloudInfrastructure.getInfrastructureStatistics();

/**
 * Default export για convenience
 */
export default geoAlertCloudInfrastructure;