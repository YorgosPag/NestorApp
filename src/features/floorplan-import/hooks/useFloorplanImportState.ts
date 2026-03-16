'use client';

/**
 * =============================================================================
 * SPEC-237D: Floorplan Import State Machine
 * =============================================================================
 *
 * 6-step wizard state: Company → Project → Building → Floor → Type → Upload
 *
 * - Cascading API calls via enterprise-api-client
 * - Auth-gated fetching (no API calls before authentication)
 * - Open-gated fetching (no API calls when wizard is closed)
 * - User must explicitly select at every step (no auto-skip)
 * - Builds FloorplanUploadConfig for step 6
 *
 * @module features/floorplan-import/hooks/useFloorplanImportState
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { useAuth } from '@/auth/hooks/useAuth';
import { useFirestoreUnits } from '@/hooks/useFirestoreUnits';
import type { FloorplanUploadConfig } from '@/hooks/useFloorplanUpload';
import type { EntityType, FileDomain, FileCategory } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useFloorplanImportState');

// =============================================================================
// TYPES
// =============================================================================

export type FloorplanType = 'building' | 'floor' | 'unit';

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
}

export interface EntityOption {
  id: string;
  label: string;
}

export interface UseFloorplanImportStateReturn {
  step: number;
  handleNext: () => void;
  handleBack: () => void;
  canProceed: boolean;

  selection: FloorplanImportSelection;
  selectEntity: (id: string) => void;
  selectFloorplanType: (type: FloorplanType) => void;
  selectUnit: (id: string) => void;

  currentStepItems: EntityOption[];
  currentStepLoading: boolean;
  currentStepEmpty: boolean;

  uploadConfig: FloorplanUploadConfig | null;
  reset: () => void;

  unitItems: EntityOption[];
  unitLoading: boolean;
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

  // (projectsRawRef removed — buildings now fetched via /api/buildings)

  // ── Open epoch: increments each time wizard opens → forces fresh data fetch ──
  const [openEpoch, setOpenEpoch] = useState(0);
  const prevOpenRef = useRef(false);

  // Detect open transitions: closed→open increments epoch and resets state
  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      // Wizard just opened — fresh start
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

  // ── Units via existing hook ──
  const { units: rawUnits, loading: unitLoading } = useFirestoreUnits({
    buildingId: selection.buildingId ?? undefined,
    autoFetch: !!selection.buildingId && selection.floorplanType === 'unit',
  });

  const unitItems: EntityOption[] = rawUnits.map((u: UnitItem) => ({
    id: u.id,
    label: u.name,
  }));

  // (Auto-skip removed — user must explicitly select at every step)

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
        // Handle both canonical (unwrapped) and raw responses
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

  // (Auto-skip removed — user controls navigation at every step)

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
            ...prev,
            projectId: id,
            projectName: label,
            buildingId: null,
            buildingName: null,
            floorId: null,
            floorName: null,
            floorplanType: null,
            unitId: null,
            unitName: null,
          };
        }
        case 3: {
          const label = buildings.find((b) => b.id === id)?.label ?? null;
          return {
            ...prev,
            buildingId: id,
            buildingName: label,
            floorId: null,
            floorName: null,
            floorplanType: null,
            unitId: null,
            unitName: null,
          };
        }
        case 4: {
          const label = floors.find((f) => f.id === id)?.label ?? null;
          return {
            ...prev,
            floorId: id,
            floorName: label,
            floorplanType: null,
            unitId: null,
            unitName: null,
          };
        }
        default:
          return prev;
      }
    });
  }, [step, companies, projects, buildings, floors]);

  const selectFloorplanType = useCallback((type: FloorplanType) => {
    setSelection((prev) => ({
      ...prev,
      floorplanType: type,
      unitId: type === 'unit' ? prev.unitId : null,
      unitName: type === 'unit' ? prev.unitName : null,
    }));
  }, []);

  const selectUnit = useCallback((id: string) => {
    const label = unitItems.find((u) => u.id === id)?.label ?? null;
    setSelection((prev) => ({ ...prev, unitId: id, unitName: label }));
  }, [unitItems]);

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
        if (!selection.floorplanType) return false;
        if (selection.floorplanType === 'unit' && !selection.unitId) return false;
        return true;
      }
      case 6: return true; // Upload step — button handled separately
      default: return false;
    }
  })();

  const handleNext = useCallback(() => {
    if (canProceed && step < TOTAL_STEPS) {
      setStep((prev) => prev + 1);
    }
  }, [canProceed, step]);

  const handleBack = useCallback(() => {
    if (step > 1) {
      setStep((prev) => prev - 1);
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
        entityLabel = selection.unitName ?? undefined;
        break;
      default:
        return null;
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
      purpose: 'floorplan',
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
    canProceed,

    selection,
    selectEntity: handleSelectEntity,
    selectFloorplanType,
    selectUnit,

    currentStepItems: getCurrentItems(),
    currentStepLoading: getCurrentLoading(),
    currentStepEmpty: !getCurrentLoading() && getCurrentItems().length === 0 && step <= 4,

    uploadConfig,
    reset,

    unitItems,
    unitLoading,
  };
}
