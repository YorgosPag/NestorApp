'use client';

/**
 * =============================================================================
 * ENTERPRISE: useNewUnitHierarchy — Self-contained hierarchy state for inline create
 * =============================================================================
 *
 * Self-contained hook που παρέχει όλα τα hierarchy data + derived state για το
 * inline "new unit" flow στο `/properties` σελίδα (Path #2, PropertyFieldsBlock).
 *
 * Μιμείται τα patterns του `useAddPropertyDialogState` αλλά πιο lightweight —
 * μόνο hierarchy (όχι all form state).
 *
 * Provides:
 *   - Projects list (fetched on mount via `getProjectsList`)
 *   - Buildings list (filtered by selected Project)
 *   - Floors list (onSnapshot when Building selected)
 *   - Discriminator: `isStandalone` (Family A vs Family B)
 *   - Empty state flags: noProjects, noBuildings, orphanBuilding, noFloors
 *
 * @module components/properties/shared/useNewUnitHierarchy
 * @enterprise ADR-284 §9.3, Batch 7 (SSoT Consolidation — Path #2 integration)
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { useAuth } from '@/auth/contexts/AuthContext';
import type { ProjectListItem } from '@/components/building-management/building-services';
import { useProjectsList } from '@/hooks/useProjectsList';
import { createModuleLogger } from '@/lib/telemetry';
import { isStandaloneUnitType } from '@/hooks/properties/usePropertyCreateValidation';
import type { PropertyType } from '@/types/property';

const logger = createModuleLogger('useNewUnitHierarchy');

/** Minimal building shape required for hierarchy operations (SSoT-lite). */
export interface BuildingLike {
  id: string;
  name: string;
  projectId: string | null | undefined;
}

// =============================================================================
// TYPES
// =============================================================================

export interface NewUnitFloorOption {
  id: string;
  number: number;
  name: string;
}

export interface NewUnitHierarchySelection {
  type: PropertyType | '';
  projectId: string;
  buildingId: string;
  floorId: string;
  floor: number;
}

export interface UseNewUnitHierarchyOptions {
  /** Full list of buildings (from parent — usually via useRealtimeBuildings). */
  buildings: BuildingLike[];
  /** Whether the hook is active (skip data fetching when creation mode is off). */
  enabled: boolean;
  /** Current selection (controlled externally). */
  selection: NewUnitHierarchySelection;
}

export interface UseNewUnitHierarchyResult {
  projects: ProjectListItem[];
  projectsLoading: boolean;
  reloadProjects: () => void;
  filteredBuildings: BuildingLike[];
  selectedBuilding: BuildingLike | undefined;
  floorOptions: NewUnitFloorOption[];
  floorsLoading: boolean;
  isStandalone: boolean;
  isOrphanBuilding: boolean;
  emptyStates: {
    noProjects: boolean;
    noBuildings: boolean;
    noFloors: boolean;
    orphanBuilding: boolean;
  };
}

// =============================================================================
// HOOK
// =============================================================================

export function useNewUnitHierarchy({
  buildings,
  enabled,
  selection,
}: UseNewUnitHierarchyOptions): UseNewUnitHierarchyResult {
  const { user } = useAuth();

  // ── Projects (stale-while-revalidate cache — Google pattern) ──
  // The cache is shared across every component that calls `useProjectsList`,
  // so opening this form after the list was already loaded elsewhere shows
  // the projects instantly (no 20-second API wait on dev server cold calls).
  const {
    projects: cachedProjects,
    loading: projectsLoading,
    refetch: refetchProjects,
  } = useProjectsList({ enabled });
  const projects = cachedProjects;
  const reloadProjects = useCallback(() => {
    refetchProjects().catch((err: unknown) => logger.error('Failed to load projects', { error: err }));
  }, [refetchProjects]);

  // ── Derived: isStandalone ──
  const isStandalone = useMemo(
    () => isStandaloneUnitType(selection.type),
    [selection.type],
  );

  // ── Derived: filtered buildings (by selected Project) ──
  const filteredBuildings = useMemo<BuildingLike[]>(() => {
    if (!selection.projectId) return buildings;
    return buildings.filter((b) => b.projectId === selection.projectId);
  }, [buildings, selection.projectId]);

  // ── Derived: selected building (for orphan detection + name display) ──
  const selectedBuilding = useMemo<BuildingLike | undefined>(
    () => buildings.find((b) => b.id === selection.buildingId),
    [buildings, selection.buildingId],
  );

  const isOrphanBuilding = useMemo(
    () =>
      !isStandalone &&
      !!selection.buildingId &&
      !!selectedBuilding &&
      !selectedBuilding.projectId,
    [isStandalone, selection.buildingId, selectedBuilding],
  );

  // ── Floors (onSnapshot when building selected) ──
  const [floorOptions, setFloorOptions] = useState<NewUnitFloorOption[]>([]);
  const [floorsLoading, setFloorsLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !selection.buildingId || !user) {
      setFloorOptions([]);
      setFloorsLoading(false);
      return;
    }

    setFloorsLoading(true);
    const floorsCol = collection(db, COLLECTIONS.FLOORS);
    const constraints = [
      where('buildingId', '==', selection.buildingId),
      ...(user.companyId ? [where('companyId', '==', user.companyId)] : []),
    ];
    const q = query(floorsCol, ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const floors = snapshot.docs
          .map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              number: typeof data.number === 'number' ? data.number : 0,
              name: (data.name as string) || '',
            };
          })
          .sort((a, b) => a.number - b.number);
        setFloorOptions(floors);
        setFloorsLoading(false);
      },
      () => {
        setFloorOptions([]);
        setFloorsLoading(false);
      },
    );
    return () => unsubscribe();
  }, [enabled, selection.buildingId, user]);

  // ── Empty state flags ──
  const emptyStates = useMemo(() => ({
    noProjects: enabled && !projectsLoading && projects.length === 0,
    noBuildings:
      enabled &&
      !isStandalone &&
      !!selection.projectId &&
      filteredBuildings.length === 0,
    noFloors:
      enabled &&
      !isStandalone &&
      !!selection.buildingId &&
      !floorsLoading &&
      floorOptions.length === 0,
    orphanBuilding: enabled && isOrphanBuilding,
  }), [
    enabled,
    projectsLoading,
    projects.length,
    isStandalone,
    selection.projectId,
    selection.buildingId,
    filteredBuildings.length,
    floorsLoading,
    floorOptions.length,
    isOrphanBuilding,
  ]);

  return {
    projects,
    projectsLoading,
    reloadProjects,
    filteredBuildings,
    selectedBuilding,
    floorOptions,
    floorsLoading,
    isStandalone,
    isOrphanBuilding,
    emptyStates,
  };
}
