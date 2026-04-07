/**
 * AWS PRICING TIERS - Static pricing data
 *
 * Extracted from aws-provider.ts for SRP compliance (ADR-065)
 * Contains EC2, S3, Network, and RDS pricing tiers
 *
 * @module enterprise/providers/aws/aws-pricing-tiers
 * @version 1.0.0
 */

import type { PricingTier } from '../../types/cloud-providers';

// ============================================================================
// EC2 COMPUTE PRICING
// ============================================================================

/**
 * Get EC2 compute pricing tiers
 * Enterprise: Instance type optimization
 */
export function getComputePricingTiers(): PricingTier[] {
  return [
    {
      name: 't3.nano',
      cpu: 2,
      memory: 0.5,
      storage: 0,
      pricePerHour: 0.0052,
      pricePerMonth: 3.77
    },
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
      name: 't3.medium',
      cpu: 2,
      memory: 4,
      storage: 0,
      pricePerHour: 0.0416,
      pricePerMonth: 30.16
    },
    {
      name: 'm6i.large',
      cpu: 2,
      memory: 8,
      storage: 0,
      pricePerHour: 0.0864,
      pricePerMonth: 62.59
    },
    {
      name: 'm6i.xlarge',
      cpu: 4,
      memory: 16,
      storage: 0,
      pricePerHour: 0.1728,
      pricePerMonth: 125.18
    },
    {
      name: 'c6i.large',
      cpu: 2,
      memory: 4,
      storage: 0,
      pricePerHour: 0.0765,
      pricePerMonth: 55.42
    },
    {
      name: 'r6i.large',
      cpu: 2,
      memory: 16,
      storage: 0,
      pricePerHour: 0.1134,
      pricePerMonth: 82.18
    }
  ];
}

// ============================================================================
// S3 STORAGE PRICING
// ============================================================================

/**
 * Get S3 storage pricing tiers
 * Enterprise: Storage class optimization
 */
export function getStoragePricingTiers(): PricingTier[] {
  return [
    {
      name: 'S3 Standard',
      cpu: 0,
      memory: 0,
      storage: 1,
      pricePerHour: 0.000031,
      pricePerMonth: 0.023
    },
    {
      name: 'S3 Standard-IA',
      cpu: 0,
      memory: 0,
      storage: 1,
      pricePerHour: 0.000017,
      pricePerMonth: 0.0125
    },
    {
      name: 'S3 One Zone-IA',
      cpu: 0,
      memory: 0,
      storage: 1,
      pricePerHour: 0.000014,
      pricePerMonth: 0.01
    },
    {
      name: 'S3 Glacier Instant',
      cpu: 0,
      memory: 0,
      storage: 1,
      pricePerHour: 0.0000056,
      pricePerMonth: 0.004
    },
    {
      name: 'S3 Glacier Flexible',
      cpu: 0,
      memory: 0,
      storage: 1,
      pricePerHour: 0.0000049,
      pricePerMonth: 0.0036
    },
    {
      name: 'S3 Glacier Deep Archive',
      cpu: 0,
      memory: 0,
      storage: 1,
      pricePerHour: 0.0000014,
      pricePerMonth: 0.00099
    }
  ];
}

// ============================================================================
// NETWORK PRICING
// ============================================================================

/**
 * Get network pricing tiers
 * Enterprise: Data transfer optimization
 */
export function getNetworkPricingTiers(): PricingTier[] {
  return [
    {
      name: 'Data Transfer In',
      cpu: 0,
      memory: 0,
      storage: 0,
      pricePerHour: 0,
      pricePerMonth: 0
    },
    {
      name: 'Data Transfer Out (First 1GB)',
      cpu: 0,
      memory: 0,
      storage: 0,
      pricePerHour: 0,
      pricePerMonth: 0
    },
    {
      name: 'Data Transfer Out (Up to 10TB)',
      cpu: 0,
      memory: 0,
      storage: 0,
      pricePerHour: 0.000012,
      pricePerMonth: 0.09
    },
    {
      name: 'CloudFront Distribution',
      cpu: 0,
      memory: 0,
      storage: 0,
      pricePerHour: 0.000011,
      pricePerMonth: 0.085
    }
  ];
}

// ============================================================================
// RDS DATABASE PRICING
// ============================================================================

/**
 * Get RDS database pricing tiers
 * Enterprise: Database optimization
 */
export function getDatabasePricingTiers(): PricingTier[] {
  return [
    {
      name: 'db.t3.micro',
      cpu: 2,
      memory: 1,
      storage: 20,
      pricePerHour: 0.017,
      pricePerMonth: 12.33
    },
    {
      name: 'db.t3.small',
      cpu: 2,
      memory: 2,
      storage: 20,
      pricePerHour: 0.034,
      pricePerMonth: 24.67
    },
    {
      name: 'db.m6i.large',
      cpu: 2,
      memory: 8,
      storage: 100,
      pricePerHour: 0.192,
      pricePerMonth: 139.30
    },
    {
      name: 'db.r6i.large',
      cpu: 2,
      memory: 16,
      storage: 100,
      pricePerHour: 0.24,
      pricePerMonth: 174.00
    }
  ];
}
