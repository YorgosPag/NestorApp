'use client';

/**
 * =============================================================================
 * useLaborComplianceConfig — Hook for reading labor compliance configuration
 * =============================================================================
 *
 * Reads insurance classes and contribution rates from Firestore
 * (system/settings.laborCompliance). Falls back to DEFAULT_LABOR_COMPLIANCE_CONFIG
 * when no config is stored yet.
 *
 * @module components/projects/ika/hooks/useLaborComplianceConfig
 * @enterprise ADR-090 — IKA/EFKA Labor Compliance System (Phase 3)
 */

import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { LaborComplianceConfig } from '../contracts';
import { DEFAULT_LABOR_COMPLIANCE_CONFIG } from '../contracts';

interface UseLaborComplianceConfigReturn {
  /** Labor compliance configuration (insurance classes + contribution rates) */
  config: LaborComplianceConfig;
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
}

/**
 * Hook for reading labor compliance configuration.
 *
 * Reads from `system/settings` document, field `laborCompliance`.
 * If not found, returns DEFAULT_LABOR_COMPLIANCE_CONFIG with KPK 781 rates.
 */
export function useLaborComplianceConfig(): UseLaborComplianceConfigReturn {
  const [config, setConfig] = useState<LaborComplianceConfig>(DEFAULT_LABOR_COMPLIANCE_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchConfig() {
      try {
        setIsLoading(true);
        setError(null);

        const settingsRef = doc(db, 'system', 'settings');
        const snapshot = await getDoc(settingsRef);

        if (!mounted) return;

        if (snapshot.exists()) {
          const data = snapshot.data();
          const laborConfig = data?.laborCompliance as LaborComplianceConfig | undefined;

          if (laborConfig && laborConfig.insuranceClasses && laborConfig.contributionRates) {
            setConfig(laborConfig);
          }
          // If no laborCompliance field, keep defaults
        }
        // If document doesn't exist, keep defaults
      } catch (err) {
        if (mounted) {
          const message = err instanceof Error ? err.message : 'Failed to load labor compliance config';
          setError(message);
          console.error('[useLaborComplianceConfig] Error:', message);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    fetchConfig();
    return () => { mounted = false; };
  }, []);

  return { config, isLoading, error };
}
