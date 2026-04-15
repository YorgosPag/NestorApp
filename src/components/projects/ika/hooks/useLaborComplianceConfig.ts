'use client';

/**
 * =============================================================================
 * useLaborComplianceConfig — Hook for reading labor compliance configuration
 * =============================================================================
 *
 * Reads insurance classes and contribution rates via server-side API route.
 * Falls back to DEFAULT_LABOR_COMPLIANCE_CONFIG when no config exists.
 *
 * @module components/projects/ika/hooks/useLaborComplianceConfig
 * @enterprise ADR-090 — IKA/EFKA Labor Compliance System (Phase 3)
 */

import { useState, useEffect, useCallback } from 'react';
import type { LaborComplianceConfig } from '../contracts';
import { DEFAULT_LABOR_COMPLIANCE_CONFIG } from '../contracts';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { createModuleLogger } from '@/lib/telemetry';
import { createStaleCache } from '@/lib/stale-cache';

const laborComplianceConfigCache = createStaleCache<LaborComplianceConfig>('labor-compliance-config');

const logger = createModuleLogger('useLaborComplianceConfig');

interface LaborComplianceApiResponse {
  success: boolean;
  config: {
    insuranceClasses: LaborComplianceConfig['insuranceClasses'] | null;
    contributionRates: LaborComplianceConfig['contributionRates'] | null;
    lastUpdated: string | null;
  } | null;
}

interface UseLaborComplianceConfigReturn {
  config: LaborComplianceConfig;
  isLoading: boolean;
  error: string | null;
  isFromFirestore: boolean;
  refetch: () => void;
}

export function useLaborComplianceConfig(): UseLaborComplianceConfigReturn {
  const [config, setConfig] = useState<LaborComplianceConfig>(
    laborComplianceConfigCache.get() ?? DEFAULT_LABOR_COMPLIANCE_CONFIG
  );
  const [isLoading, setIsLoading] = useState(!laborComplianceConfigCache.hasLoaded());
  const [error, setError] = useState<string | null>(null);
  const [isFromFirestore, setIsFromFirestore] = useState(false);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  const refetch = useCallback(() => {
    setFetchTrigger(prev => prev + 1);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function fetchConfig() {
      try {
        if (!laborComplianceConfigCache.hasLoaded()) setIsLoading(true);
        setError(null);

        const result = await apiClient.get<LaborComplianceApiResponse>('/api/settings/labor-compliance');

        if (!mounted) return;

        if (result?.config?.insuranceClasses && result?.config?.contributionRates) {
          const updatedConfig: LaborComplianceConfig = {
            insuranceClasses: result.config.insuranceClasses,
            contributionRates: result.config.contributionRates,
            lastUpdated: result.config.lastUpdated ?? DEFAULT_LABOR_COMPLIANCE_CONFIG.lastUpdated,
          };
          laborComplianceConfigCache.set(updatedConfig);
          setConfig(updatedConfig);
          setIsFromFirestore(true);
        } else {
          // No remote config — cache defaults so hasLoaded() returns true
          laborComplianceConfigCache.set(DEFAULT_LABOR_COMPLIANCE_CONFIG);
        }
        // If no config, keep defaults
      } catch (err) {
        if (mounted) {
          const message = err instanceof Error ? err.message : 'Failed to load labor compliance config';
          setError(message);
          logger.error('Failed to load labor compliance config', { error: message });
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    fetchConfig();
    return () => { mounted = false; };
  }, [fetchTrigger]);

  return { config, isLoading, error, isFromFirestore, refetch };
}
