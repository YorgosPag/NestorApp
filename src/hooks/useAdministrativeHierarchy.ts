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

import { useState, useEffect, useCallback } from 'react';
import type { ComboboxOption } from '@/components/ui/searchable-combobox';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useAdministrativeHierarchy');

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
    // 🔴 **ΑΝ ΑΥΤΟ ΠΕΤΑΞΕΙ, ΠΕΦΤΕΙ ΟΛΟΚΛΗΡΗ Η ΟΘΟΝΗ** — και μέχρι το ADR-846 πετούσε.
    //    Το `await fetch(…).then(r => r.json())` ακολουθούμενο από `for (… of rawData.data)`
    //    δίνει `TypeError: rawData.data is not iterable` σε **κάθε** απόκριση που δεν είναι
    //    το αναμενόμενο σχήμα: σελίδα σφάλματος του διακομιστή, HTML του SPA fallback,
    //    διακοπή δικτύου στα μισά των **4,1 MB**. Ένα δημόσιο, ανώνυμο component
    //    *(`/pro`)* **δεν επιτρέπεται** να εξαφανίζεται επειδή ένα βοηθητικό αρχείο
    //    άργησε — και η ίδια η ύπαρξη του `isLoading` υπόσχεται ότι δεν θα το κάνει.
    //
    // ⚠️ **Το κενό cache ΕΙΝΑΙ η σωστή κατάσταση αποτυχίας** (N.12): κάθε αναγνώστης
    //    *(`findById` · `lineageIdsOf` · `levelOptions`)* απαντά ήδη «δεν ξέρω» με κενό —
    //    και οι καταναλωτές του ADR-846 μεταφράζουν το «δεν ξέρω» σε *«δεν φιλτράρω, και
    //    το λέω»*, ποτέ σε *«κανείς δεν ταιριάζει»*.
    try {
      const response = await fetch('/data/administrative-hierarchy.json');
      const rawData = (await response.json()) as Partial<RawData>;
      if (!Array.isArray(rawData.data)) {
        throw new TypeError('Η διοικητική ιεραρχία δεν έχει το αναμενόμενο σχήμα');
      }

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
    } catch (error) {
      // ⚠️ **Δεν γράφεται τίποτα στο cache** — ώστε μια επόμενη προσπάθεια να ξαναρωτήσει
      //    αντί να κληρονομήσει μισοφορτωμένη ιεραρχία.
      logger.warn('Δεν φορτώθηκε η διοικητική ιεραρχία — οι περιοχές μένουν άγνωστες', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  })();

  await loadingPromise;
  // 🔑 **Καθαρίζεται ΠΑΝΤΑ**, ώστε μια αποτυχία να μη «κλειδώσει» τη φόρτωση για όλη τη
  //    ζωή της σελίδας: χωρίς αυτό, κάθε επόμενος καλών θα περίμενε την **ίδια**
  //    αποτυχημένη υπόσχεση και δεν θα ξαναδοκίμαζε ποτέ.
  loadingPromise = null;
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
// ΓΕΝΕΑΛΟΓΙΑ — εκτός hook, επίτηδες (ADR-846)
// ============================================================================

/**
 * **Η γραμμή μιας οντότητας προς τη ρίζα, ΜΕ ΤΟΝ ΕΑΥΤΟ ΤΗΣ ΠΡΩΤΟ** — π.χ.
 * `['community:…', 'municipalUnit:…', 'municipality:…', …, 'major_geographic_unit:2']`.
 *
 * 🔑 **Γιατί ζει ΕΞΩ από το hook** *(ADR-846)*: ο καταναλωτής της είναι το
 * `lib/agency/coverage-match.ts` — **καθαρό φύλλο** που καλείται μέσα από `useMemo` και
 * **δεν επιτρέπεται** να εισάγει React. Ένα δεύτερο πέρασμα πάνω στα ίδια δεδομένα μέσα
 * στο `lib/` θα ήταν κλώνος του `resolvePath` *(N.18)*· ένα `resolvePath` μέσα σε
 * `useCallback` δεν μπορεί να ταξιδέψει εκεί. Άρα: **ίδιο module cache, μία γραφή,
 * χωρίς hook**.
 *
 * ⚠️ **Κενός πίνακας = «δεν ξέρω»** — είτε η ιεραρχία δεν έχει φορτώσει *(τεμπέλικη
 * φόρτωση 4,1 MB)*, είτε το id δεν υπάρχει. Ο καλών **οφείλει** να το ξεχωρίσει από
 * «καμία σχέση»: δες τη σύμβαση του `LineageResolver`.
 *
 * ⚠️ **Δεν διπλασιάζει το `resolvePath`** — εκείνο απαντά *«ποια οντότητα σε κάθε
 * βαθμίδα;»* *(δοχείο 8 θέσεων, για **διεύθυνση**)*· αυτό απαντά *«ποιοι με περιέχουν;»*
 * *(αλυσίδα, για **σχέση**)*. Ίδια διαδρομή, **διαφορετική ερώτηση** — και η δεύτερη
 * δεν εκφράζεται από την πρώτη χωρίς να ξέρει ο καλών ποια κλειδιά είναι `null`.
 */
export function lineageIdsOf(entityId: string): readonly string[] {
  if (!cachedEntities) return [];

  const lineage: string[] = [];
  let current: AdminEntity | undefined = cachedEntities.get(entityId);
  // 🔒 Φρουρός κύκλου: δεδομένα ΕΛΣΤΑΤ, αλλά ένας κύκλος parentId θα κρέμαγε την οθόνη
  //    αθόρυβα. Το βάθος είναι 8 — το 16 είναι διπλάσιο κάθε νόμιμης αλυσίδας.
  let guard = 16;
  while (current && guard-- > 0) {
    lineage.push(current.id);
    current = current.parentId ? cachedEntities.get(current.parentId) : undefined;
  }
  return lineage;
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

  /**
   * Build a disambiguation label by walking up the parent chain.
   * e.g. Settlement "Αγία Παρασκευή" → "Δ. Λέσβου, Π.Ε. Λέσβου"
   * This helps users distinguish between 1,369 homonymous settlements.
   */
  const buildSecondaryLabel = useCallback((entity: AdminEntity): string => {
    if (!cachedEntities) return '';
    const parts: string[] = [];

    // Walk up to find municipality (level 5) and regional unit (level 4)
    let current: AdminEntity | undefined = entity.parentId
      ? cachedEntities.get(entity.parentId)
      : undefined;

    while (current) {
      if (current.level === 5) {
        const name = current.shortName || current.name;
        parts.push(`Δ. ${name}`);
      } else if (current.level === 4) {
        const name = current.shortName || current.name;
        parts.push(`Π.Ε. ${name}`);
        break;
      }
      current = current.parentId ? cachedEntities.get(current.parentId) : undefined;
    }

    if (entity.postalCode) {
      parts.push(`ΤΚ ${entity.postalCode}`);
    }

    return parts.join(', ');
  }, []);

  const searchOptions = useCallback(
    (query: string, level: AdminLevel, maxResults = 30): ComboboxOption[] => {
      if (!cachedByLevel || !query.trim()) return [];
      const entities = cachedByLevel.get(level);
      if (!entities) return [];

      const normalizedQuery = normalizeSearch(query);
      const results: ComboboxOption[] = [];

      const needsDisambiguation = level >= 5;
      for (const entity of entities) {
        if (results.length >= maxResults) break;
        const normalizedEntityName = normalizeSearch(entity.name);
        if (normalizedEntityName.includes(normalizedQuery)) {
          results.push({
            value: entity.id,
            label: entity.name,
            secondaryLabel: needsDisambiguation
              ? buildSecondaryLabel(entity)
              : undefined,
          });
        }
      }
      return results;
    },
    [buildSecondaryLabel],
  );

  const levelOptions = useCallback((level: AdminLevel): ComboboxOption[] => {
    const entities = cachedByLevel?.get(level) ?? [];
    // Only compute disambiguation for levels with potential homonyms (5+)
    const needsDisambiguation = level >= 5;
    return entities.map((e) => ({
      value: e.id,
      label: e.name,
      secondaryLabel: needsDisambiguation ? buildSecondaryLabel(e) : undefined,
    }));
  }, [buildSecondaryLabel]);

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
