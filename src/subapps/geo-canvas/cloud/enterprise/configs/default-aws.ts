/**
 * DEFAULT AWS CONFIGURATION
 *
 * Enterprise-class default AWS configurations για quick deployment
 * Split from monolithic CloudInfrastructure.ts για modular architecture
 *
 * @module enterprise/configs/default-aws
 * @version 1.0.0 - ENTERPRISE MODULAR SPLITTING
 * @updated 2025-12-28 - Split from CloudInfrastructure.ts
 */

import type {
  AWSCloudProvider,
  CloudFeatures,
  CloudEndpoints,
  CloudPricing
} from '../types/cloud-providers';

// ============================================================================
// DEFAULT AWS CONFIGURATIONS
// ============================================================================

/**
 * Create default AWS provider configuration
 * Enterprise: Production-ready defaults με security best practices
 */
export function createDefaultAWSConfig(
  region: string = 'us-east-1',
  accountId: string,
  accessKey: string,
  secretKey: string
): AWSCloudProvider {
  return {
    name: 'aws',
    region,
    credentials: {
      accessKey,
      secretKey
    },
    endpoints: getDefaultAWSEndpoints(region),
    features: getDefaultAWSFeatures(),
    pricing: getDefaultAWSPricing(),
    awsSpecific: {
      accountId,
      role: `arn:aws:iam::${accountId}:role/CloudInfrastructureRole`,
      externalId: `geo-alert-${Date.now()}`
    }
  };
}

/**
 * Get default AWS service endpoints
 * Enterprise: Regional endpoint optimization
 */
export function getDefaultAWSEndpoints(region: string): CloudEndpoints {
  return {
    compute: `https://ec2.${region}.amazonaws.com`,
    storage: `https://s3.${region}.amazonaws.com`,
    database: `https://rds.${region}.amazonaws.com`,
    networking: `https://ec2.${region}.amazonaws.com`,
    monitoring: `https://monitoring.${region}.amazonaws.com`,
    dns: 'https://route53.amazonaws.com'
  };
}

/**
 * Get default AWS features
 * Enterprise: Full feature matrix για AWS
 */
export function getDefaultAWSFeatures(): CloudFeatures {
  return {
    autoScaling: true,
    loadBalancing: true,
    cdn: true,
    database: true,
    objectStorage: true,
    kubernetes: true,
    serverless: true,
    monitoring: true
  };
}

/**
 * Get default AWS pricing tiers
 * Enterprise: Cost-optimized instance selection
 */
export function getDefaultAWSPricing(): CloudPricing {
  return {
    compute: [
      {
        name: 't3.micro',
        cpu: 2,
        memory: 1,
        storage: 0,
        pricePerHour: 0.0104,
        pricePerMonth: 7.54
      },
      {
        name: 't3.small',
        cpu: 2,
        memory: 2,
        storage: 0,
        pricePerHour: 0.0208,
        pricePerMonth: 15.08
      },
      {
        name: 'm6i.large',
        cpu: 2,
        memory: 8,
        storage: 0,
        pricePerHour: 0.0864,
        pricePerMonth: 62.59
      }
    ],
    storage: [
      {
        name: 'S3 Standard',
        cpu: 0,
        memory: 0,
        storage: 1,
        pricePerHour: 0.000031,
        pricePerMonth: 0.023
      }
    ],
    network: [
      {
        name: 'Data Transfer',
        cpu: 0,
        memory: 0,
        storage: 0,
        pricePerHour: 0.000012,
        pricePerMonth: 0.09
      }
    ],
    database: [
      {
        name: 'db.t3.micro',
        cpu: 2,
        memory: 1,
        storage: 20,
        pricePerHour: 0.017,
        pricePerMonth: 12.33
      }
    ]
  };
}

/**
 * AWS region recommendations
 * Enterprise: Region selection guidance
 */
export const AWS_REGION_RECOMMENDATIONS = {
  'us-east-1': {
    name: 'US East (N. Virginia)',
    description: 'Largest AWS region με lowest latency για US East Coast',
    pros: ['Most services available', 'Lowest pricing', 'Highest capacity'],
    cons: ['Weather-related outages', 'High competition for resources']
  },
  'us-west-2': {
    name: 'US West (Oregon)',
    description: 'Primary West Coast region με excellent connectivity',
    pros: ['Stable infrastructure', 'Good for West Coast users', 'Latest services'],
    cons: ['Slightly higher pricing than us-east-1']
  },
  'eu-west-1': {
    name: 'Europe (Ireland)',
    description: 'Primary European region με GDPR compliance',
    pros: ['GDPR compliant', 'Central European location', 'Mature infrastructure'],
    cons: ['Higher pricing than US regions']
  },
  'ap-southeast-1': {
    name: 'Asia Pacific (Singapore)',
    description: 'Primary APAC region για Southeast Asia',
    pros: ['Central APAC location', 'Good connectivity to Asia', 'Growing capacity'],
    cons: ['Limited service availability', 'Higher pricing']
  }
} as const;

/**
 * AWS service recommendations για different use cases
 * Enterprise: Service selection guidance
 */
export const AWS_SERVICE_RECOMMENDATIONS = {
  webApplication: {
    compute: ['EC2', 'ECS', 'Lambda'],
    storage: ['S3', 'EFS'],
    database: ['RDS', 'DynamoDB'],
    networking: ['ALB', 'CloudFront', 'Route53'],
    monitoring: ['CloudWatch', 'X-Ray']
  },
  dataAnalytics: {
    compute: ['EMR', 'Glue', 'Lambda'],
    storage: ['S3', 'Redshift'],
    database: ['Redshift', 'Timestream'],
    networking: ['VPC', 'PrivateLink'],
    monitoring: ['CloudWatch', 'QuickSight']
  },
  microservices: {
    compute: ['EKS', 'Fargate', 'Lambda'],
    storage: ['S3', 'EFS'],
    database: ['RDS', 'DynamoDB', 'ElastiCache'],
    networking: ['ALB', 'API Gateway', 'Service Mesh'],
    monitoring: ['CloudWatch', 'X-Ray', 'Container Insights']
  },
  iotPlatform: {
    compute: ['IoT Core', 'Lambda', 'EC2'],
    storage: ['S3', 'IoT Analytics'],
    database: ['Timestream', 'DynamoDB'],
    networking: ['IoT Device Management', 'Greengrass'],
    monitoring: ['IoT Device Defender', 'CloudWatch']
  }
} as const;