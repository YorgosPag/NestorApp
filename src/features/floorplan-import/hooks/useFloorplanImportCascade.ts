'use client';

/**
 * SPEC-237D — οι λίστες επιλογής των βημάτων 1-4 του οδηγού (Εταιρεία → Έργο → Κτίριο → Όροφος).
 *
 * ΕΝΑΣ φορτωτής (`useEntityOptions`) για τα τέσσερα βήματα· ήταν τέσσερα δίδυμα effects μέσα στο
 * `useFloorplanImportState`. Κάθε βήμα δηλώνει μόνο ό,τι διαφέρει: από πού διαβάζει, και πώς
 * ονομάζει ένα στοιχείο.
 *
 * @module features/floorplan-import/hooks/useFloorplanImportCascade
 */

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';
import { storedFloorLabel } from '@/lib/floor/floor-label-bundle';
import type {
  BuildingItem,
  CompanyItem,
  EntityOption,
  FloorItem,
  FloorplanImportSelection,
  ProjectItem,
} from './floorplan-import-types';

const logger = createModuleLogger('useFloorplanImportCascade');

/** Κοινή κενή λίστα — σταθερή αναφορά, δεν μεταλλάσσεται ποτέ. */
const NO_OPTIONS: EntityOption[] = [];

/** Τι διαφέρει από βήμα σε βήμα: το κλειδί της λίστας στην απάντηση και το όνομα ενός στοιχείου. */
interface OptionSource<T> {
  /** Για τα logs του διακομιστή — όχι κείμενο οθόνης. */
  readonly name: string;
  readonly listKey: string;
  readonly toOption: (item: T) => EntityOption;
}

const COMPANY_SOURCE: OptionSource<CompanyItem> = {
  name: 'companies',
  listKey: 'companies',
  toOption: (c) => ({ id: c.id, label: c.companyName ?? c.tradeName ?? c.legalName ?? c.id }),
};

const PROJECT_SOURCE: OptionSource<ProjectItem> = {
  name: 'projects',
  listKey: 'projects',
  toOption: (p) => ({ id: p.id, label: p.name ?? p.title ?? p.id }),
};

const BUILDING_SOURCE: OptionSource<BuildingItem> = {
  name: 'buildings',
  listKey: 'buildings',
  toOption: (b) => ({ id: b.id, label: b.name ?? b.id }),
};

/** Ο όροφος με το ΙΔΙΟ όνομα που δείχνουν οι καρτέλες ορόφων (ADR-914 §8.18). */
const FLOOR_SOURCE: OptionSource<FloorItem> = {
  name: 'floors',
  listKey: 'floors',
  toOption: (f) => ({ id: f.id, label: storedFloorLabel(f) }),
};

interface EntityOptionsState {
  readonly items: EntityOption[];
  readonly loading: boolean;
  readonly clear: () => void;
}

/**
 * Φορτώνει τη λίστα ενός βήματος. `url === null` ⇒ το βήμα δεν είναι ενεργό: καμία κλήση, και η
 * λίστα μένει ως έχει. Κάθε νέο `url` ή `epoch` ⇒ φρέσκια κλήση.
 */
function useEntityOptions<T>(url: string | null, source: OptionSource<T>, epoch = 0): EntityOptionsState {
  const [items, setItems] = useState<EntityOption[]>(NO_OPTIONS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!url) return;

    let cancelled = false;
    setLoading(true);

    apiClient.get<Record<string, unknown>>(url)
      .then((raw) => {
        if (cancelled) return;
        const list = (raw[source.listKey] ?? raw.data ?? []) as T[];
        logger.info('Options loaded', { source: source.name, count: list.length });
        setItems(list.map(source.toOption));
      })
      .catch((err) => {
        if (cancelled) return;
        logger.error('Failed to load options', { source: source.name, error: String(err) });
        setItems(NO_OPTIONS);
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [url, source, epoch]);

  const clear = useCallback(() => setItems(NO_OPTIONS), []);
  return { items, loading, clear };
}

export interface UseFloorplanImportCascadeParams {
  /** Ο οδηγός είναι ανοιχτός και ο χρήστης γνωστός. */
  readonly isReady: boolean;
  readonly step: number;
  readonly selection: FloorplanImportSelection;
  /** Αυξάνει σε κάθε άνοιγμα του οδηγού ⇒ φρέσκες εταιρείες. */
  readonly openEpoch: number;
}

export interface UseFloorplanImportCascadeResult {
  /** Η λίστα του τρέχοντος βήματος (κενή για τα βήματα 5-6). */
  readonly items: EntityOption[];
  readonly loading: boolean;
  /** Αδειάζει και τις τέσσερις λίστες (άνοιγμα / επαναφορά του οδηγού). */
  readonly clearAll: () => void;
}

export function useFloorplanImportCascade(params: UseFloorplanImportCascadeParams): UseFloorplanImportCascadeResult {
  const { isReady, step, selection, openEpoch } = params;
  const at = (target: number, parentId: string | null): parentId is string => isReady && step === target && !!parentId;

  const companies = useEntityOptions(isReady ? API_ROUTES.COMPANIES.LIST : null, COMPANY_SOURCE, openEpoch);
  const projects = useEntityOptions(
    at(2, selection.companyId) ? API_ROUTES.PROJECTS.BY_COMPANY(selection.companyId) : null,
    PROJECT_SOURCE,
  );
  const buildings = useEntityOptions(
    at(3, selection.projectId) ? `${API_ROUTES.BUILDINGS.LIST}?projectId=${selection.projectId}` : null,
    BUILDING_SOURCE,
  );
  const floors = useEntityOptions(
    at(4, selection.buildingId) ? `${API_ROUTES.FLOORS.LIST}?buildingId=${selection.buildingId}` : null,
    FLOOR_SOURCE,
  );

  const clearCompanies = companies.clear;
  const clearProjects = projects.clear;
  const clearBuildings = buildings.clear;
  const clearFloors = floors.clear;
  const clearAll = useCallback(() => {
    clearCompanies();
    clearProjects();
    clearBuildings();
    clearFloors();
  }, [clearCompanies, clearProjects, clearBuildings, clearFloors]);

  const current = [companies, projects, buildings, floors][step - 1];
  return { items: current?.items ?? NO_OPTIONS, loading: current?.loading ?? false, clearAll };
}
