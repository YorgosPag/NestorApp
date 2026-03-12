/**
 * Hook for searching the ΥΠΕΣ Public Services Registry (1920 entities).
 *
 * Loads the registry JSON lazily on first use and provides
 * a search function that returns ComboboxOption[] for SearchableCombobox.
 *
 * @see src/data/public-services-registry.json
 */

import { useState, useEffect, useMemo } from 'react';
import type { ComboboxOption } from '@/components/ui/searchable-combobox';

// ============================================================================
// TYPES
// ============================================================================

interface RegistryEntity {
  name: string;
  supervisingMinistry: string;
  legalForm: string;
  policyArea: string | null;
  publicSector: string | null;
  notes: string | null;
  source: 'ΦΟΡΕΙΣ' | 'ΦΟΡΕΙΣ_ΟΤΑ';
  // OTA-specific
  supervisingOTA?: string | null;
}

interface RegistryData {
  metadata: {
    source: string;
    date: string;
    totalEntries: number;
  };
  enums: {
    ministries: string[];
    legalForms: string[];
    policyAreas: string[];
  };
  foreis: RegistryEntity[];
  foreisOTA: RegistryEntity[];
}

export interface RegistryEntry {
  name: string;
  supervisingMinistry: string;
  legalForm: string;
  policyArea: string | null;
  publicSector: string | null;
  source: 'ΦΟΡΕΙΣ' | 'ΦΟΡΕΙΣ_ΟΤΑ';
  supervisingOTA: string | null;
}

// ============================================================================
// LAZY LOADING
// ============================================================================

let cachedRegistry: RegistryEntry[] | null = null;
let cachedMinistries: string[] | null = null;
let loadingPromise: Promise<void> | null = null;

async function loadRegistry(): Promise<void> {
  if (cachedRegistry) return;
  if (loadingPromise) {
    await loadingPromise;
    return;
  }

  loadingPromise = (async () => {
    const imported = await import('@/data/public-services-registry.json');
    const data: RegistryData = (imported as { default: RegistryData }).default ?? imported as RegistryData;

    const foreis: RegistryEntry[] = data.foreis.map(f => ({
      name: f.name,
      supervisingMinistry: f.supervisingMinistry,
      legalForm: f.legalForm,
      policyArea: f.policyArea,
      publicSector: f.publicSector,
      source: f.source,
      supervisingOTA: null
    }));

    const foreisOTA: RegistryEntry[] = data.foreisOTA.map(f => ({
      name: f.name,
      supervisingMinistry: f.supervisingOTA || '',
      legalForm: f.legalForm,
      policyArea: f.policyArea ?? null,
      publicSector: f.publicSector,
      source: f.source,
      supervisingOTA: f.supervisingOTA ?? null
    }));

    cachedRegistry = [...foreis, ...foreisOTA];
    cachedMinistries = data.enums.ministries;
  })();

  await loadingPromise;
}

// ============================================================================
// HOOK
// ============================================================================

interface UsePublicServiceRegistryReturn {
  /** All entities as ComboboxOption[] for SearchableCombobox */
  options: ComboboxOption[];
  /** All ministries for the ministry picker */
  ministries: ComboboxOption[];
  /** Find a specific entry by name */
  findByName: (name: string) => RegistryEntry | undefined;
  /** Whether the registry is still loading */
  isLoading: boolean;
}

export function usePublicServiceRegistry(): UsePublicServiceRegistryReturn {
  const [isLoading, setIsLoading] = useState(!cachedRegistry);

  useEffect(() => {
    if (cachedRegistry) {
      setIsLoading(false);
      return;
    }
    loadRegistry().then(() => setIsLoading(false));
  }, []);

  const options: ComboboxOption[] = useMemo(() => {
    if (!cachedRegistry) return [];
    return cachedRegistry.map(entry => ({
      value: entry.name,
      label: entry.name,
      secondaryLabel: entry.supervisingMinistry || entry.supervisingOTA || undefined
    }));
  }, [isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const ministries: ComboboxOption[] = useMemo(() => {
    if (!cachedMinistries) return [];
    return cachedMinistries.map(m => ({
      value: m,
      label: m
    }));
  }, [isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const findByName = (name: string): RegistryEntry | undefined => {
    if (!cachedRegistry) return undefined;
    return cachedRegistry.find(e => e.name === name);
  };

  return { options, ministries, findByName, isLoading };
}
