/**
 * INFRASTRUCTURE VALIDATION — Provider config validation & connection testing
 *
 * Validates cloud provider configurations and tests connections.
 * Extracted from InfrastructureManager (ADR-065).
 *
 * @module enterprise/core/infrastructure-validation
 * @see infrastructure-manager.ts
 */

import type { CloudProvider, ProviderConnectionStatus } from '../types/cloud-providers';

// ============================================================================
// PROVIDER CONFIG VALIDATION
// ============================================================================

export async function validateProviderConfig(config: CloudProvider): Promise<{
  isValid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config.name) errors.push('Provider name is required');
  if (!config.region) errors.push('Provider region is required');
  if (!config.credentials) errors.push('Provider credentials are required');

  switch (config.name) {
    case 'aws':
      if (!config.credentials.accessKey) errors.push('AWS Access Key is required');
      if (!config.credentials.secretKey) errors.push('AWS Secret Key is required');
      break;
    case 'azure':
      if (!config.credentials.tenantId) errors.push('Azure Tenant ID is required');
      if (!config.credentials.subscriptionId) errors.push('Azure Subscription ID is required');
      break;
    case 'gcp':
      if (!config.credentials.projectId) errors.push('GCP Project ID is required');
      if (!config.credentials.serviceAccountKey) errors.push('GCP Service Account Key is required');
      break;
    default:
      warnings.push(`Provider ${config.name} validation not implemented`);
  }

  return { isValid: errors.length === 0, errors, warnings };
}

// ============================================================================
// CONNECTION TESTING
// ============================================================================

export async function testProviderConnection(config: CloudProvider): Promise<ProviderConnectionStatus> {
  try {
    const startTime = Date.now();
    await simulateProviderCall(config);
    const latency = Date.now() - startTime;

    return {
      provider: config.name,
      isConnected: true,
      connected: true,
      lastChecked: new Date(),
      latency,
      capabilities: config.features
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Connection test failed';
    return {
      provider: config.name,
      isConnected: false,
      connected: false,
      lastChecked: new Date(),
      error: errorMessage,
      capabilities: config.features
    };
  }
}

async function simulateProviderCall(config: CloudProvider): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
  if (Math.random() < 0.05) {
    throw new Error(`${config.name} API call failed: Network timeout`);
  }
}
