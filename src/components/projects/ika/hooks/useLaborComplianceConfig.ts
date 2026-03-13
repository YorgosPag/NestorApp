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

import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS, SYSTEM_DOCS } from '@/config/firestore-collections';
import type { LaborComplianceConfig } from '../contracts';
import { DEFAULT_LABOR_COMPLIANCE_CONFIG } from '../contracts';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useLaborComplianceConfig');

interface UseLaborComplianceConfigReturn {
  /** Labor compliance configuration (insurance classes + contribution rates) */
  config: LaborComplianceConfig;
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Whether data comes from Firestore (true) or hardcoded defaults (false) */
  isFromFirestore: boolean;
  /** Re-fetch from Firestore */
  refetch: () => void;
}

/**
 * Hook for reading labor compliance configuration.
 *
 * Reads from `settings/labor_compliance` document (dedicated document).
 * If not found, returns DEFAULT_LABOR_COMPLIANCE_CONFIG with KPK 781 rates.
 */
export function useLaborComplianceConfig(): UseLaborComplianceConfigReturn {
  const [config, setConfig] = useState<LaborComplianceConfig>(DEFAULT_LABOR_COMPLIANCE_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
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
        setIsLoading(true);
        setError(null);

        const settingsRef = doc(db, COLLECTIONS.SETTINGS, SYSTEM_DOCS.LABOR_COMPLIANCE_SETTINGS);
        const snapshot = await getDoc(settingsRef);

        if (!mounted) return;

        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data?.insuranceClasses && data?.contributionRates) {
            setConfig({
              insuranceClasses: data.insuranceClasses,
              contributionRates: data.contributionRates,
              lastUpdated: data.lastUpdated ?? DEFAULT_LABOR_COMPLIANCE_CONFIG.lastUpdated,
            });
            setIsFromFirestore(true);
          }
        }
        // If document doesn't exist, keep defaults
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
