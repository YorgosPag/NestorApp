/**
 * Hook for the Greek Administrative Hierarchy (Διοικητική Διαίρεση Ελλάδας).
 *
 * Lazily loads 20,713 entities (3.2 MB raw, ~490 KB gzip) and provides:
 * - Fast lookup by ID
 * - Search by name (accent-insensitive, punctuation-stripped)
 * - Bottom-up path resolution: given any entity, returns the full hierarchy upward
 * - Filtered search by level (e.g. only municipalities, only settlements)
 *
 * Data source: ΕΛΣΤΑΤ / Καλλικράτης
 * @see src/data/administrative-hierarchy.json
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { ComboboxOption } from '@/components/ui/searchable-combobox';

// ============================================================================
// TYPES
// ============================================================================

/** Short-key entity as stored in the JSON file */
interface RawEntity {
  id: string;
  /** name */
  n: string;
  /** shortName */
  sn: string;
  /** normalizedName (no accents, lowercase) */
  nn: string;
  /** code (Kallikratis) */
  c: string;
  /** parentId */
  p: string | null;
  /** level (1-8) */
  l: number;
  /** postalCode (settlements only) */
  pc?: string;
  /** article (settlements only) */
  a?: string;
}

interface RawData {
  meta: {
    source: string;
    date: string;
    counts: Record<string, number>;
    levels: Record<string, string>;
  };
  data: RawEntity[];
}

/** Public entity with readable field names */
export interface AdminEntity {
  id: string;
  name: string;
  shortName: string;
  normalizedName: string;
  code: string;
  parentId: string | null;
  level: number;
  postalCode?: string;
  article?: string;
}

/** Level numbers and their keys */
export const ADMIN_LEVELS = {
  MAJOR_GEO: 1,
  DECENTRALIZED_ADMIN: 2,
  REGION: 3,
  REGIONAL_UNIT: 4,
  MUNICIPALITY: 5,
  MUNICIPAL_UNIT: 6,
  COMMUNITY: 7,
  SETTLEMENT: 8,
} as const;

export type AdminLevel = (typeof ADMIN_LEVELS)[keyof typeof ADMIN_LEVELS];

/** Labels for each level */
export const ADMIN_LEVEL_LABELS: Record<number, string> = {
  1: 'Γεωγραφική Ενότητα',
  2: 'Αποκεντρωμένη Διοίκηση',
  3: 'Περιφέρεια',
  4: 'Περιφερειακή Ενότητα',
  5: 'Δήμος',
  6: 'Δημοτική Ενότητα',
  7: 'Κοινότητα',
  8: 'Οικισμός',
};

/** Full resolved path from an entity up to the top level */
export interface AdminPath {
  majorGeo: AdminEntity | null;
  decentAdmin: AdminEntity | null;
  region: AdminEntity | null;
  regionalUnit: AdminEntity | null;
  municipality: AdminEntity | null;
  municipalUnit: AdminEntity | null;
  community: AdminEntity | null;
  settlement: AdminEntity | null;
}

// ============================================================================
// LAZY LOADING + CACHE
// ============================================================================

let cachedEntities: Map<string, AdminEntity> | null = null;
let cachedByLevel: Map<number, AdminEntity[]> | null = null;
let loadingPromise: Promise<void> | null = null;

function mapRawToEntity(raw: RawEntity): AdminEntity {
  const entity: AdminEntity = {
    id: raw.id,
    name: raw.n,
    shortName: raw.sn,
    normalizedName: raw.nn,
    code: raw.c,
    parentId: raw.p,
    level: raw.l,
  };
  if (raw.pc) entity.postalCode = raw.pc;
  if (raw.a) entity.article = raw.a;
  return entity;
}

async function loadHierarchy(): Promise<void> {
  if (cachedEntities) return;
  if (loadingPromise) {
    await loadingPromise;
    return;
  }

  loadingPromise = (async () => {
    const rawData: RawData = await import('@/data/administrative-hierarchy.json');
    const entityMap = new Map<string, AdminEntity>();
    const levelMap = new Map<number, AdminEntity[]>();

    for (const raw of rawData.data) {
      const entity = mapRawToEntity(raw);
      entityMap.set(entity.id, entity);

      const levelList = levelMap.get(entity.level);
      if (levelList) {
        levelList.push(entity);
      } else {
        levelMap.set(entity.level, [entity]);
      }
    }

    cachedEntities = entityMap;
    cachedByLevel = levelMap;
  })();

  await loadingPromise;
}

// ============================================================================
// SEARCH HELPERS
// ============================================================================

/** Normalize text for accent+punctuation-insensitive Greek search */
function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.\-_/\\()]/g, '')
    .toLowerCase();
}

// ============================================================================
// HOOK
// ============================================================================

interface UseAdministrativeHierarchyReturn {
  /** Whether the hierarchy data is still loading */
  isLoading: boolean;
  /** Find entity by ID */
  findById: (id: string) => AdminEntity | undefined;
  /** Resolve full path upward from any entity */
  resolvePath: (entityId: string) => AdminPath;
  /** Get all entities at a specific level */
  getByLevel: (level: AdminLevel) => AdminEntity[];
  /** Search entities by name at a specific level, returns ComboboxOption[] */
  searchOptions: (query: string, level: AdminLevel, maxResults?: number) => ComboboxOption[];
  /** Get children of a specific entity */
  getChildren: (parentId: string) => AdminEntity[];
  /** All entities at a level as ComboboxOption[] */
  levelOptions: (level: AdminLevel) => ComboboxOption[];
}

export function useAdministrativeHierarchy(): UseAdministrativeHierarchyReturn {
  const [isLoading, setIsLoading] = useState(!cachedEntities);

  useEffect(() => {
    if (cachedEntities) {
      setIsLoading(false);
      return;
    }
    loadHierarchy().then(() => setIsLoading(false));
  }, []);

  const findById = useCallback((id: string): AdminEntity | undefined => {
    return cachedEntities?.get(id);
  }, []);

  const resolvePath = useCallback((entityId: string): AdminPath => {
    const path: AdminPath = {
      majorGeo: null,
      decentAdmin: null,
      region: null,
      regionalUnit: null,
      municipality: null,
      municipalUnit: null,
      community: null,
      settlement: null,
    };

    if (!cachedEntities) return path;

    const LEVEL_TO_KEY: Record<number, keyof AdminPath> = {
      1: 'majorGeo',
      2: 'decentAdmin',
      3: 'region',
      4: 'regionalUnit',
      5: 'municipality',
      6: 'municipalUnit',
      7: 'community',
      8: 'settlement',
    };

    let current: AdminEntity | undefined = cachedEntities.get(entityId);
    while (current) {
      const key = LEVEL_TO_KEY[current.level];
      if (key) {
        path[key] = current;
      }
      current = current.parentId ? cachedEntities.get(current.parentId) : undefined;
    }

    return path;
  }, []);

  const getByLevel = useCallback((level: AdminLevel): AdminEntity[] => {
    return cachedByLevel?.get(level) ?? [];
  }, []);

  const getChildren = useCallback((parentId: string): AdminEntity[] => {
    if (!cachedEntities) return [];
    const children: AdminEntity[] = [];
    cachedEntities.forEach((entity) => {
      if (entity.parentId === parentId) {
        children.push(entity);
      }
    });
    return children;
  }, []);

  const searchOptions = useCallback(
    (query: string, level: AdminLevel, maxResults = 30): ComboboxOption[] => {
      if (!cachedByLevel || !query.trim()) return [];
      const entities = cachedByLevel.get(level);
      if (!entities) return [];

      const normalizedQuery = normalizeSearch(query);
      const results: ComboboxOption[] = [];

      for (const entity of entities) {
        if (results.length >= maxResults) break;
        const normalizedEntityName = normalizeSearch(entity.name);
        if (normalizedEntityName.includes(normalizedQuery)) {
          results.push({
            value: entity.id,
            label: entity.name,
            secondaryLabel: entity.postalCode
              ? `ΤΚ ${entity.postalCode}`
              : undefined,
          });
        }
      }
      return results;
    },
    [],
  );

  const levelOptions = useCallback((level: AdminLevel): ComboboxOption[] => {
    const entities = cachedByLevel?.get(level) ?? [];
    return entities.map((e) => ({
      value: e.id,
      label: e.name,
      secondaryLabel: e.postalCode ? `ΤΚ ${e.postalCode}` : undefined,
    }));
  }, []);

  return {
    isLoading,
    findById,
    resolvePath,
    getByLevel,
    searchOptions,
    getChildren,
    levelOptions,
  };
}
