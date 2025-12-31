/**
 * CLOUD PROVIDERS TYPE DEFINITIONS
 *
 * EXACT COPY από original CloudInfrastructure.ts για modular architecture
 * ZERO MODIFICATIONS - Original source is the authoritative truth
 *
 * @module enterprise/types/cloud-providers
 * @version 1.0.0 - EXACT ORIGINAL COPY
 * @updated 2025-12-28 - Exact copy from CloudInfrastructure.ts lines 15-86
 */

/**
 * Cloud provider configuration
 */
export interface CloudProvider {
  name: 'aws' | 'azure' | 'gcp' | 'digitalocean' | 'linode';
  region: string;
  credentials: CloudCredentials;
  endpoints: CloudEndpoints;
  features: CloudFeatures;
  pricing: CloudPricing;
}

/**
 * Cloud credentials
 */
export interface CloudCredentials {
  accessKey?: string;
  secretKey?: string;
  tenantId?: string;
  subscriptionId?: string;
  projectId?: string;
  serviceAccountKey?: any;
  token?: string;
}

/**
 * Cloud endpoints
 */
export interface CloudEndpoints {
  compute: string;
  storage: string;
  database: string;
  networking: string;
  monitoring: string;
  dns: string;
}

/**
 * Cloud features
 */
export interface CloudFeatures {
  autoScaling: boolean;
  loadBalancing: boolean;
  cdn: boolean;
  database: boolean;
  objectStorage: boolean;
  kubernetes: boolean;
  serverless: boolean;
  monitoring: boolean;
}

/**
 * Cloud pricing
 */
export interface CloudPricing {
  compute: PricingTier[];
  storage: PricingTier[];
  network: PricingTier[];
  database: PricingTier[];
}

/**
 * Pricing tier
 */
export interface PricingTier {
  name: string;
  cpu: number;
  memory: number;
  storage: number;
  pricePerHour: number;
  pricePerMonth: number;
}

// ============================================================================
// ✅ ENTERPRISE FIX: ADD MISSING PROVIDER-SPECIFIC TYPES
// ============================================================================

/**
 * Supported cloud provider names
 */
export type SupportedCloudProvider = CloudProvider['name'];
export type CloudProviderName = CloudProvider['name'];

/**
 * Provider validation result
 */
export interface ProviderValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  provider?: string; // Add missing provider property
}

/**
 * Provider connection status
 */
export interface ProviderConnectionStatus {
  provider: string;
  isConnected: boolean;
  connected: boolean;
  lastChecked: Date;
  latency?: number;
  error?: string;
  capabilities?: any;
}

// ============================================================================
// AWS PROVIDER TYPES
// ============================================================================

/**
 * AWS-specific cloud provider configuration
 */
export interface AWSCloudProvider extends CloudProvider {
  name: 'aws';
  credentials: AWSCredentials;
  accountId: string;
  awsSpecific: {
    accountId: string;
    role?: string;
  };
}

/**
 * AWS-specific credentials
 */
export interface AWSCredentials extends CloudCredentials {
  accessKey: string;
  secretKey: string;
  region: string;
  sessionToken?: string;
}

// ============================================================================
// AZURE PROVIDER TYPES
// ============================================================================

/**
 * Azure-specific cloud provider configuration
 */
export interface AzureCloudProvider extends CloudProvider {
  name: 'azure';
  credentials: AzureCredentials;
  subscriptionId: string;
  azureSpecific: {
    subscriptionId: string;
    tenantId: string;
    resourceGroup?: string;
  };
}

/**
 * Azure-specific credentials
 */
export interface AzureCredentials extends CloudCredentials {
  tenantId: string;
  subscriptionId: string;
  clientId: string;
  clientSecret: string;
}

// ============================================================================
// GCP PROVIDER TYPES
// ============================================================================

/**
 * GCP-specific cloud provider configuration
 */
export interface GCPCloudProvider extends CloudProvider {
  name: 'gcp';
  credentials: GCPCredentials;
  projectId: string;
  gcpSpecific: {
    projectId: string;
    projectNumber?: string;
    billingAccountId?: string;
    region?: string;
    zone?: string;
  };
}

/**
 * GCP-specific credentials
 */
export interface GCPCredentials extends CloudCredentials {
  projectId: string;
  keyFilename?: string;
  serviceAccountKey?: any;
}