'use client';

/**
 * =============================================================================
 * SPEC-237D: Floorplan Import State Machine
 * =============================================================================
 *
 * 6-step wizard: Company → Project → Building → Floor → Unit → Upload
 *
 * Steps 2-4 offer a "shortcut" floorplan card: user can upload a floorplan
 * at project/building/floor level without going deeper. Clicking the card
 * sets floorplanType and jumps to step 6 (upload).
 *
 * Step 5 is the unit selector (with level radio for multi-level units).
 *
 * @module features/floorplan-import/hooks/useFloorplanImportState
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { useAuth } from '@/auth/hooks/useAuth';
import { useFirestoreProperties } from '@/hooks/useFirestoreProperties';
import type { FloorplanUploadConfig } from '@/hooks/useFloorplanUpload';
import { API_ROUTES, ENTITY_TYPES } from '@/config/domain-constants';
import type { EntityType, FileDomain, FileCategory } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';

import {
  type FloorplanType,
  type FloorplanImportSelection,
  type EntityOption,
  type UseFloorplanImportStateReturn,
  type UseFloorplanImportStateOptions,
  type CompaniesApiResponse,
  type CompanyItem,
  type ProjectsByCompanyResponse,
  type ProjectItem,
  type BuildingItem,
  type FloorsApiResponse,
  type FloorItem,
  type PropertyItem,
  INITIAL_SELECTION,
  TOTAL_STEPS,
  FLOORPLAN_PURPOSE_BY_TYPE,
} from './floorplan-import-types';

// Re-export types for backward compatibility
export type { FloorplanType, FloorplanImportSelection, EntityOption, UseFloorplanImportStateReturn };

const logger = createModuleLogger('useFloorplanImportState');

// =============================================================================
// HOOK
// =============================================================================

export function useFloorplanImportState(
  options: UseFloorplanImportStateOptions
): UseFloorplanImportStateReturn {
  const { isOpen } = options;
  const { user, loading: authLoading } = useAuth();

  // ── Step state ──
  const [step, setStep] = useState(1);
  const [selection, setSelection] = useState<FloorplanImportSelection>(INITIAL_SELECTION);

  // ── Cascading data ──
  const [companies, setCompanies] = useState<EntityOption[]>([]);
  const [projects, setProjects] = useState<EntityOption[]>([]);
  const [buildings, setBuildings] = useState<EntityOption[]>([]);
  const [floors, setFloors] = useState<EntityOption[]>([]);

  // ── Loading states ──
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [buildingsLoading, setBuildingsLoading] = useState(false);
  const [floorsLoading, setFloorsLoading] = useState(false);

  // ── Open epoch: increments each time wizard opens → forces fresh data fetch ──
  const [openEpoch, setOpenEpoch] = useState(0);
  const prevOpenRef = useRef(false);

  // Detect open transitions: closed→open increments epoch and resets state
  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      setOpenEpoch((e) => e + 1);
      setStep(1);
      setSelection(INITIAL_SELECTION);
      setCompanies([]);
      setProjects([]);
      setBuildings([]);
      setFloors([]);
    }
    prevOpenRef.current = isOpen;
  }, [isOpen]);

  // ── Units via existing hook (step 5) ──
  const { properties: rawUnits, loading: unitLoading } = useFirestoreProperties({
    buildingId: selection.buildingId ?? undefined,
    floorId: selection.floorId ?? undefined,
    autoFetch: !!selection.buildingId && step === 5,
  });

  const unitItems: EntityOption[] = rawUnits.map((u: PropertyItem) => ({
    id: u.id,
    label: u.name,
  }));

  // ── Multi-level unit detection (ADR-236) ──
  const selectedProperty = rawUnits.find((u: PropertyItem) => u.id === selection.propertyId) as PropertyItem | undefined;
  const selectedPropertyIsMultiLevel = !!(selectedProperty?.isMultiLevel && selectedProperty.levels && selectedProperty.levels.length >= 2);

  const unitLevelItems: EntityOption[] = useMemo(() => {
    if (!selectedPropertyIsMultiLevel || !selectedProperty?.levels) return [];
    return [...selectedProperty.levels]
      .sort((a, b) => a.floorNumber - b.floorNumber)
      .map((level) => ({
        id: level.floorId,
        label: level.name,
      }));
  }, [selectedPropertyIsMultiLevel, selectedProperty?.levels]);

  // ===========================================================================
  // AUTH + OPEN GUARDS
  // ===========================================================================
  const isReady = isOpen && !authLoading && !!user;

  // ===========================================================================
  // DATA FETCHING
  // ===========================================================================

  // Step 1: Companies — fetches when wizard opens with auth ready
  useEffect(() => {
    if (!isReady) return;

    let cancelled = false;
    setCompaniesLoading(true);

    logger.info('Fetching companies', { openEpoch });

    apiClient.get<CompaniesApiResponse | Record<string, unknown>>(API_ROUTES.COMPANIES.LIST)
      .then((res) => {
        if (cancelled) return;
        const raw = res as Record<string, unknown>;
        const companiesList = (raw.companies ?? raw.data ?? []) as CompanyItem[];
        logger.info('Companies loaded', { count: companiesList.length });
        const items = companiesList.map((c) => ({
          id: c.id,
          label: c.companyName ?? c.tradeName ?? c.legalName ?? c.id,
        }));
        setCompanies(items);
      })
      .catch((err) => {
        if (!cancelled) {
          logger.error('Failed to load companies', { error: String(err) });
          setCompanies([]);
        }
      })
      .finally(() => { if (!cancelled) setCompaniesLoading(false); });

    return () => { cancelled = true; };
  }, [isReady, openEpoch]);

  // Step 2: Projects by company
  useEffect(() => {
    if (!isReady || step !== 2 || !selection.companyId) return;

    let cancelled = false;
    setProjectsLoading(true);

    apiClient.get<ProjectsByCompanyResponse | Record<string, unknown>>(API_ROUTES.PROJECTS.BY_COMPANY(selection.companyId))
      .then((res) => {
        if (cancelled) return;
        const raw = res as Record<string, unknown>;
        const projectsList = (raw.projects ?? raw.data ?? []) as ProjectItem[];
        logger.info('Projects loaded', { count: projectsList.length });
        const items = projectsList.map((p) => ({
          id: p.id,
          label: p.name ?? p.title ?? p.id,
        }));
        setProjects(items);
      })
      .catch((err) => {
        if (!cancelled) {
          logger.error('Failed to load projects', { error: String(err) });
          setProjects([]);
        }
      })
      .finally(() => { if (!cancelled) setProjectsLoading(false); });

    return () => { cancelled = true; };
  }, [isReady, step, selection.companyId]);

  // Step 3: Buildings — fetched via /api/buildings?projectId=xxx
  useEffect(() => {
    if (!isReady || step !== 3 || !selection.projectId) return;

    let cancelled = false;
    setBuildingsLoading(true);

    apiClient.get<Record<string, unknown>>(`${API_ROUTES.BUILDINGS.LIST}?projectId=${selection.projectId}`)
      .then((res) => {
        if (cancelled) return;
        const raw = res as Record<string, unknown>;
        const buildingsList = (raw.buildings ?? raw.data ?? []) as BuildingItem[];
        logger.info('Buildings loaded', { count: buildingsList.length });
        const items = buildingsList.map((b) => ({
          id: b.id,
          label: b.name ?? b.id,
        }));
        setBuildings(items);
      })
      .catch((err) => {
        if (!cancelled) {
          logger.error('Failed to load buildings', { error: String(err) });
          setBuildings([]);
        }
      })
      .finally(() => { if (!cancelled) setBuildingsLoading(false); });

    return () => { cancelled = true; };
  }, [isReady, step, selection.projectId]);

  // Step 4: Floors by building
  useEffect(() => {
    if (!isReady || step !== 4 || !selection.buildingId) return;

    let cancelled = false;
    setFloorsLoading(true);

    apiClient.get<FloorsApiResponse | Record<string, unknown>>(`${API_ROUTES.FLOORS.LIST}?buildingId=${selection.buildingId}`)
      .then((res) => {
        if (cancelled) return;
        const raw = res as Record<string, unknown>;
        const floorsList = (raw.floors ?? raw.data ?? []) as FloorItem[];
        logger.info('Floors loaded', { count: floorsList.length });
        const items = floorsList.map((f) => ({
          id: f.id,
          label: f.name || `Όροφος ${f.number}`,
        }));
        setFloors(items);
      })
      .catch((err) => {
        if (!cancelled) {
          logger.error('Failed to load floors', { error: String(err) });
          setFloors([]);
        }
      })
      .finally(() => { if (!cancelled) setFloorsLoading(false); });

    return () => { cancelled = true; };
  }, [isReady, step, selection.buildingId]);

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  function getCurrentItems(): EntityOption[] {
    switch (step) {
      case 1: return companies;
      case 2: return projects;
      case 3: return buildings;
      case 4: return floors;
      default: return [];
    }
  }

  function getCurrentLoading(): boolean {
    switch (step) {
      case 1: return companiesLoading;
      case 2: return projectsLoading;
      case 3: return buildingsLoading;
      case 4: return floorsLoading;
      default: return false;
    }
  }

  // ===========================================================================
  // SELECTION HANDLERS
  // ===========================================================================

  const handleSelectEntity = useCallback((id: string) => {
    setSelection((prev) => {
      switch (step) {
        case 1: {
          const label = companies.find((c) => c.id === id)?.label ?? null;
          return { ...INITIAL_SELECTION, companyId: id, companyName: label };
        }
        case 2: {
          const label = projects.find((p) => p.id === id)?.label ?? null;
          return {
            ...prev, projectId: id, projectName: label,
            buildingId: null, buildingName: null, floorId: null, floorName: null,
            floorplanType: null, propertyId: null, propertyName: null, levelFloorId: null, levelName: null,
          };
        }
        case 3: {
          const label = buildings.find((b) => b.id === id)?.label ?? null;
          return {
            ...prev, buildingId: id, buildingName: label,
            floorId: null, floorName: null, floorplanType: null,
            propertyId: null, propertyName: null, levelFloorId: null, levelName: null,
          };
        }
        case 4: {
          const label = floors.find((f) => f.id === id)?.label ?? null;
          return {
            ...prev, floorId: id, floorName: label,
            floorplanType: null, propertyId: null, propertyName: null, levelFloorId: null, levelName: null,
          };
        }
        default:
          return prev;
      }
    });
  }, [step, companies, projects, buildings, floors]);

  const selectProperty = useCallback((id: string) => {
    const label = unitItems.find((u) => u.id === id)?.label ?? null;
    setSelection((prev) => ({
      ...prev, propertyId: id, propertyName: label,
      floorplanType: 'property', levelFloorId: null, levelName: null,
    }));
  }, [unitItems]);

  const selectLevel = useCallback((floorId: string) => {
    const label = unitLevelItems.find((l) => l.id === floorId)?.label ?? null;
    setSelection((prev) => ({ ...prev, levelFloorId: floorId, levelName: label }));
  }, [unitLevelItems]);

  // ===========================================================================
  // SHORTCUT: Jump to upload from steps 2-4
  // ===========================================================================

  const jumpToUpload = useCallback((type: FloorplanType) => {
    setSelection((prev) => ({
      ...prev,
      floorplanType: type,
      ...(type === 'project' ? { buildingId: null, buildingName: null, floorId: null, floorName: null, propertyId: null, propertyName: null } : {}),
      ...(type === 'building' ? { floorId: null, floorName: null, propertyId: null, propertyName: null } : {}),
      ...(type === 'floor' ? { propertyId: null, propertyName: null } : {}),
      levelFloorId: null, levelName: null,
    }));
    setStep(6);
  }, []);

  // ===========================================================================
  // CONTINUE DEEPER (load mode: step 6 → next entity level)
  // ===========================================================================

  const continueDeeper = useCallback(() => {
    if (step !== 6) return;
    const nextStep = ((): number | null => {
      switch (selection.floorplanType) {
        case 'project': return 3;
        case 'building': return 4;
        case 'floor': return 5;
        default: return null;
      }
    })();
    if (nextStep === null) return;
    setSelection((prev) => ({ ...prev, floorplanType: null }));
    setStep(nextStep);
  }, [step, selection.floorplanType]);

  const canContinueDeeper =
    step === 6 &&
    (selection.floorplanType === 'project' ||
      selection.floorplanType === 'building' ||
      selection.floorplanType === 'floor');

  // ===========================================================================
  // NAVIGATION
  // ===========================================================================

  const canProceed = (() => {
    switch (step) {
      case 1: return !!selection.companyId;
      case 2: return !!selection.projectId;
      case 3: return !!selection.buildingId;
      case 4: return !!selection.floorId;
      case 5: {
        if (!selection.propertyId) return false;
        if (selectedPropertyIsMultiLevel && !selection.levelFloorId) return false;
        return true;
      }
      case 6: return true;
      default: return false;
    }
  })();

  const handleNext = useCallback(() => {
    if (canProceed && step < TOTAL_STEPS) {
      if (step === 5) {
        setSelection((prev) => ({ ...prev, floorplanType: 'property' }));
      }
      setStep((prev) => prev + 1);
    }
  }, [canProceed, step]);

  const handleBack = useCallback(() => {
    if (step > 1) {
      if (step === 6 && selection.floorplanType === 'project') {
        setStep(2);
      } else if (step === 6 && selection.floorplanType === 'building') {
        setStep(3);
      } else if (step === 6 && selection.floorplanType === 'floor') {
        setStep(4);
      } else {
        setStep((prev) => prev - 1);
      }
    }
  }, [step, selection.floorplanType]);

  const goToStep = useCallback((targetStep: number) => {
    if (targetStep >= 1 && targetStep < step) {
      setStep(targetStep);
    }
  }, [step]);

  // ===========================================================================
  // UPLOAD CONFIG (step 6)
  // ===========================================================================

  const uploadConfig: FloorplanUploadConfig | null = (() => {
    if (step !== 6 || !selection.companyId || !selection.floorplanType || !user?.uid) return null;

    let entityType: EntityType;
    let entityId: string;
    let entityLabel: string | undefined;

    switch (selection.floorplanType) {
      case 'project':
        entityType = ENTITY_TYPES.PROJECT;
        entityId = selection.projectId!;
        entityLabel = selection.projectName ?? undefined;
        break;
      case 'building':
        entityType = ENTITY_TYPES.BUILDING;
        entityId = selection.buildingId!;
        entityLabel = selection.buildingName ?? undefined;
        break;
      case 'floor':
        entityType = ENTITY_TYPES.FLOOR;
        entityId = selection.floorId!;
        entityLabel = selection.floorName ?? undefined;
        break;
      case 'property':
        entityType = ENTITY_TYPES.PROPERTY;
        entityId = selection.propertyId!;
        entityLabel = selection.levelName
          ? `${selection.propertyName} — ${selection.levelName}`
          : selection.propertyName ?? undefined;
        break;
      default:
        return null;
    }

    const linkedTo: string[] = [];
    if (selection.floorplanType === 'property') {
      if (selection.floorId) linkedTo.push(`floor:${selection.floorId}`);
      if (selection.buildingId) linkedTo.push(`building:${selection.buildingId}`);
    } else if (selection.floorplanType === 'floor') {
      if (selection.buildingId) linkedTo.push(`building:${selection.buildingId}`);
    }

    return {
      companyId: user?.companyId ?? selection.companyId,
      projectId: selection.projectId ?? undefined,
      entityType,
      entityId,
      domain: 'construction' as FileDomain,
      category: 'floorplans' as FileCategory,
      userId: user.uid,
      entityLabel,
      purpose: FLOORPLAN_PURPOSE_BY_TYPE[selection.floorplanType!],
      ...(selection.levelFloorId ? { levelFloorId: selection.levelFloorId } : {}),
      ...(linkedTo.length > 0 ? { linkedTo } : {}),
    };
  })();

  // ===========================================================================
  // RESET
  // ===========================================================================

  const reset = useCallback(() => {
    setStep(1);
    setSelection(INITIAL_SELECTION);
    setCompanies([]);
    setProjects([]);
    setBuildings([]);
    setFloors([]);
  }, []);

  // ===========================================================================
  // RETURN
  // ===========================================================================

  return {
    step,
    handleNext,
    handleBack,
    goToStep,
    canProceed,

    selection,
    selectEntity: handleSelectEntity,
    selectProperty,
    jumpToUpload,
    continueDeeper,
    canContinueDeeper,

    currentStepItems: getCurrentItems(),
    currentStepLoading: getCurrentLoading(),
    currentStepEmpty: !getCurrentLoading() && getCurrentItems().length === 0 && step <= 4,

    uploadConfig,
    reset,

    unitItems,
    unitLoading,

    selectedPropertyIsMultiLevel,
    unitLevelItems,
    selectLevel,
  };
}
