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
import { useFirestoreUnits } from '@/hooks/useFirestoreUnits';
import type { FloorplanUploadConfig } from '@/hooks/useFloorplanUpload';
import type { EntityType, FileDomain, FileCategory } from '@/config/domain-constants';
import type { UnitLevel } from '@/types/unit';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useFloorplanImportState');

// =============================================================================
// TYPES
// =============================================================================

export type FloorplanType = 'project' | 'building' | 'floor' | 'unit';

export interface FloorplanImportSelection {
  companyId: string | null;
  companyName: string | null;
  projectId: string | null;
  projectName: string | null;
  buildingId: string | null;
  buildingName: string | null;
  floorId: string | null;
  floorName: string | null;
  floorplanType: FloorplanType | null;
  unitId: string | null;
  unitName: string | null;
  /** For multi-level units: which level's floorplan to upload */
  levelFloorId: string | null;
  levelName: string | null;
}

export interface EntityOption {
  id: string;
  label: string;
}

export interface UseFloorplanImportStateReturn {
  step: number;
  handleNext: () => void;
  handleBack: () => void;
  /** Navigate to a completed step (click on step number) */
  goToStep: (step: number) => void;
  canProceed: boolean;

  selection: FloorplanImportSelection;
  selectEntity: (id: string) => void;
  selectUnit: (id: string) => void;

  /** Shortcut: set floorplanType and jump to upload (step 6) */
  jumpToUpload: (type: FloorplanType) => void;

  currentStepItems: EntityOption[];
  currentStepLoading: boolean;
  currentStepEmpty: boolean;

  uploadConfig: FloorplanUploadConfig | null;
  reset: () => void;

  unitItems: EntityOption[];
  unitLoading: boolean;

  /** Multi-level unit support (ADR-236) */
  selectedUnitIsMultiLevel: boolean;
  unitLevelItems: EntityOption[];
  selectLevel: (floorId: string) => void;
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

interface CompanyItem {
  id: string;
  companyName?: string;
  tradeName?: string;
  legalName?: string;
}

interface CompaniesApiResponse {
  companies: CompanyItem[];
}

interface BuildingItem {
  id: string;
  name: string;
  projectId?: string;
}

interface ProjectItem {
  id: string;
  name: string;
  title?: string;
  companyId?: string;
  linkedCompanyId?: string;
}

interface ProjectsByCompanyResponse {
  projects: ProjectItem[];
}

interface FloorItem {
  id: string;
  number: number;
  name: string;
  buildingId?: string;
}

interface FloorsApiResponse {
  floors: FloorItem[];
}

interface UnitItem {
  id: string;
  name: string;
  isMultiLevel?: boolean;
  levels?: UnitLevel[];
}

// =============================================================================
// INITIAL STATE
// =============================================================================

const INITIAL_SELECTION: FloorplanImportSelection = {
  companyId: null,
  companyName: null,
  projectId: null,
  projectName: null,
  buildingId: null,
  buildingName: null,
  floorId: null,
  floorName: null,
  floorplanType: null,
  unitId: null,
  unitName: null,
  levelFloorId: null,
  levelName: null,
};

const TOTAL_STEPS = 6;

// =============================================================================
// OPTIONS
// =============================================================================

interface UseFloorplanImportStateOptions {
  /** Whether the wizard dialog is currently open */
  isOpen: boolean;
}

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
  const { units: rawUnits, loading: unitLoading } = useFirestoreUnits({
    buildingId: selection.buildingId ?? undefined,
    floorId: selection.floorId ?? undefined,
    autoFetch: !!selection.buildingId && step === 5,
  });

  const unitItems: EntityOption[] = rawUnits.map((u: UnitItem) => ({
    id: u.id,
    label: u.name,
  }));

  // ── Multi-level unit detection (ADR-236) ──
  const selectedUnit = rawUnits.find((u: UnitItem) => u.id === selection.unitId) as UnitItem | undefined;
  const selectedUnitIsMultiLevel = !!(selectedUnit?.isMultiLevel && selectedUnit.levels && selectedUnit.levels.length >= 2);

  const unitLevelItems: EntityOption[] = useMemo(() => {
    if (!selectedUnitIsMultiLevel || !selectedUnit?.levels) return [];
    return [...selectedUnit.levels]
      .sort((a, b) => a.floorNumber - b.floorNumber)
      .map((level) => ({
        id: level.floorId,
        label: level.name,
      }));
  }, [selectedUnitIsMultiLevel, selectedUnit?.levels]);

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

    apiClient.get<CompaniesApiResponse | Record<string, unknown>>('/api/companies')
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

    apiClient.get<ProjectsByCompanyResponse | Record<string, unknown>>(`/api/projects/by-company/${selection.companyId}`)
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

    apiClient.get<Record<string, unknown>>(`/api/buildings?projectId=${selection.projectId}`)
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

    apiClient.get<FloorsApiResponse | Record<string, unknown>>(`/api/floors?buildingId=${selection.buildingId}`)
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
            floorplanType: null, unitId: null, unitName: null, levelFloorId: null, levelName: null,
          };
        }
        case 3: {
          const label = buildings.find((b) => b.id === id)?.label ?? null;
          return {
            ...prev, buildingId: id, buildingName: label,
            floorId: null, floorName: null, floorplanType: null,
            unitId: null, unitName: null, levelFloorId: null, levelName: null,
          };
        }
        case 4: {
          const label = floors.find((f) => f.id === id)?.label ?? null;
          return {
            ...prev, floorId: id, floorName: label,
            floorplanType: null, unitId: null, unitName: null, levelFloorId: null, levelName: null,
          };
        }
        default:
          return prev;
      }
    });
  }, [step, companies, projects, buildings, floors]);

  const selectUnit = useCallback((id: string) => {
    const label = unitItems.find((u) => u.id === id)?.label ?? null;
    setSelection((prev) => ({
      ...prev, unitId: id, unitName: label,
      floorplanType: 'unit', levelFloorId: null, levelName: null,
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
      // Clear downstream selections not needed for this type
      ...(type === 'project' ? { buildingId: null, buildingName: null, floorId: null, floorName: null, unitId: null, unitName: null } : {}),
      ...(type === 'building' ? { floorId: null, floorName: null, unitId: null, unitName: null } : {}),
      ...(type === 'floor' ? { unitId: null, unitName: null } : {}),
      levelFloorId: null, levelName: null,
    }));
    setStep(6);
  }, []);

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
        if (!selection.unitId) return false;
        if (selectedUnitIsMultiLevel && !selection.levelFloorId) return false;
        return true;
      }
      case 6: return true;
      default: return false;
    }
  })();

  const handleNext = useCallback(() => {
    if (canProceed && step < TOTAL_STEPS) {
      // Step 5 → 6: auto-set floorplanType to 'unit'
      if (step === 5) {
        setSelection((prev) => ({ ...prev, floorplanType: 'unit' }));
      }
      setStep((prev) => prev + 1);
    }
  }, [canProceed, step]);

  const handleBack = useCallback(() => {
    if (step > 1) {
      // If we jumped to step 6 from a shortcut, go back to where we came from
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
        entityType = 'project' as EntityType;
        entityId = selection.projectId!;
        entityLabel = selection.projectName ?? undefined;
        break;
      case 'building':
        entityType = 'building' as EntityType;
        entityId = selection.buildingId!;
        entityLabel = selection.buildingName ?? undefined;
        break;
      case 'floor':
        entityType = 'floor' as EntityType;
        entityId = selection.floorId!;
        entityLabel = selection.floorName ?? undefined;
        break;
      case 'unit':
        entityType = 'unit' as EntityType;
        entityId = selection.unitId!;
        entityLabel = selection.levelName
          ? `${selection.unitName} — ${selection.levelName}`
          : selection.unitName ?? undefined;
        break;
      default:
        return null;
    }

    // Build parent entity links for cross-entity visibility
    const linkedTo: string[] = [];
    if (selection.floorplanType === 'unit') {
      if (selection.floorId) linkedTo.push(`floor:${selection.floorId}`);
      if (selection.buildingId) linkedTo.push(`building:${selection.buildingId}`);
    } else if (selection.floorplanType === 'floor') {
      if (selection.buildingId) linkedTo.push(`building:${selection.buildingId}`);
    }

    return {
      companyId: selection.companyId,
      projectId: selection.projectId ?? undefined,
      entityType,
      entityId,
      domain: 'construction' as FileDomain,
      category: 'floorplans' as FileCategory,
      userId: user.uid,
      entityLabel,
      purpose: selection.floorplanType === 'floor' ? 'floor-floorplan' : 'floorplan',
      ...(selection.levelFloorId ? { levelFloorId: selection.levelFloorId } : {}),
      ...(linkedTo.length > 0 ? { linkedTo } : {}),
    };
  })();

  // ===========================================================================
  // RESET (called externally on dialog close)
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
    selectUnit,
    jumpToUpload,

    currentStepItems: getCurrentItems(),
    currentStepLoading: getCurrentLoading(),
    currentStepEmpty: !getCurrentLoading() && getCurrentItems().length === 0 && step <= 4,

    uploadConfig,
    reset,

    unitItems,
    unitLoading,

    selectedUnitIsMultiLevel,
    unitLevelItems,
    selectLevel,
  };
}
