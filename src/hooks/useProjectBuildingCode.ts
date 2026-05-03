/**
 * @related ADR-186 §8b — Project Building Code Phase 2 form hook
 *
 * Owns the full lifecycle of `project.buildingCode` editing:
 *   - Sync local draft from `project.buildingCode` (or empty default)
 *   - Apply provenance-aware mutations (zone auto-fill, manual edits, reset)
 *   - Live validation via `validateBuildingCodePhase2`
 *   - Optimistic save through `updateProjectClient` (PATCH /api/projects/[id])
 *   - Toast feedback (sonner) — server-side audit trail handled by
 *     `EntityAuditService.recordChange()` in `project-mutations.service.ts`
 *
 * No Firestore writes from the client — single writer is the API endpoint.
 */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import type { Project } from '@/types/project';
import type {
  BuildingCodeValidationResult,
  ProjectBuildingCodePhase2,
} from '@/types/project-building-code';
import type { PlotType } from '@/services/building-code/types/site.types';
import { validateBuildingCodePhase2 } from '@/services/building-code/validation/validate-phase2';
import { updateProjectClient } from '@/services/projects-client.service';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';
import { nowISO } from '@/lib/date-local';
import {
  applyNumericEdit,
  applyPlotType,
  applyZoneSelection,
  canResetField,
  createEmptyDraft,
  isDraftEqual,
  resetFieldToZone,
} from './useProjectBuildingCode.helpers';

const logger = createModuleLogger('useProjectBuildingCode');

type NumericFieldKey = 'sd' | 'coveragePct' | 'maxHeight';

export interface UseProjectBuildingCodeResult {
  readonly draft: ProjectBuildingCodePhase2;
  readonly persisted: ProjectBuildingCodePhase2 | null;
  readonly isDirty: boolean;
  readonly isSaving: boolean;
  readonly canSave: boolean;
  readonly validation: BuildingCodeValidationResult;
  readonly hasZone: boolean;

  setPlotType(type: PlotType): void;
  setFrontagesCount(count: number): void;
  setZoneId(zoneId: string | null): void;
  setSd(value: number): void;
  setCoveragePct(value: number): void;
  setMaxHeight(value: number): void;
  resetField(field: NumericFieldKey): void;
  isFieldResettable(field: NumericFieldKey): boolean;

  reset(): void;
  save(): Promise<void>;
}

function pickPersisted(project: Project | null): ProjectBuildingCodePhase2 | null {
  return project?.buildingCode ?? null;
}

export function useProjectBuildingCode(
  project: Project | null,
): UseProjectBuildingCodeResult {
  const { t } = useTranslation('buildingCode');

  const persisted = pickPersisted(project);
  const initialDraft = useMemo<ProjectBuildingCodePhase2>(
    () => persisted ?? createEmptyDraft(),
    // Re-seed only when the project reference itself changes (post-save refetch
    // or initial hydration). Mid-edit setProject calls won't re-seed because
    // `project` reference is stable inside detail views.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project?.id],
  );

  const [draft, setDraft] = useState<ProjectBuildingCodePhase2>(initialDraft);
  const [isSaving, setIsSaving] = useState(false);

  // Re-seed draft when the project id changes (navigating to a different
  // project) or when persisted state arrives after first paint.
  const lastSeededFor = useRef<string | null>(project?.id ?? null);
  useEffect(() => {
    const id = project?.id ?? null;
    if (id !== lastSeededFor.current) {
      lastSeededFor.current = id;
      setDraft(persisted ?? createEmptyDraft());
    }
  }, [project?.id, persisted]);

  const validation = useMemo(() => validateBuildingCodePhase2(draft), [draft]);

  const isDirty = useMemo(() => {
    if (!persisted) {
      // No persisted yet — treat as dirty as soon as user touches anything.
      return !isDraftEqual(draft, createEmptyDraft());
    }
    return !isDraftEqual(draft, persisted);
  }, [draft, persisted]);

  const canSave = isDirty && validation.errors.length === 0 && !isSaving;

  const setPlotType = useCallback((type: PlotType) => {
    setDraft((prev) => applyPlotType(prev, type));
  }, []);

  const setFrontagesCount = useCallback((count: number) => {
    setDraft((prev) => ({ ...prev, frontagesCount: count }));
  }, []);

  const setZoneId = useCallback((zoneId: string | null) => {
    setDraft((prev) => applyZoneSelection(prev, zoneId));
  }, []);

  const setSd = useCallback((value: number) => {
    setDraft((prev) => applyNumericEdit(prev, 'sd', value));
  }, []);

  const setCoveragePct = useCallback((value: number) => {
    setDraft((prev) => applyNumericEdit(prev, 'coveragePct', value));
  }, []);

  const setMaxHeight = useCallback((value: number) => {
    setDraft((prev) => applyNumericEdit(prev, 'maxHeight', value));
  }, []);

  const resetField = useCallback((field: NumericFieldKey) => {
    setDraft((prev) => resetFieldToZone(prev, field));
  }, []);

  const isFieldResettable = useCallback(
    (field: NumericFieldKey): boolean => canResetField(draft, field),
    [draft],
  );

  const reset = useCallback(() => {
    setDraft(persisted ?? createEmptyDraft());
  }, [persisted]);

  const save = useCallback(async () => {
    if (!project?.id) {
      logger.warn('save() called without a project id — ignoring');
      return;
    }
    if (validation.errors.length > 0) return;

    const payload: ProjectBuildingCodePhase2 = {
      ...draft,
      lastUpdated: nowISO(),
    };

    setIsSaving(true);
    try {
      const result = await updateProjectClient(project.id, {
        buildingCode: payload,
      });
      if (!result.success) {
        toast.error(t('toast.saveError'));
        logger.warn('Building code save failed', {
          projectId: project.id,
          error: result.error,
        });
        return;
      }
      // Optimistic local sync — useProjectDetail will reconcile via realtime.
      setDraft(payload);
      toast.success(t('toast.saveSuccess'));
    } catch (error) {
      toast.error(t('toast.saveError'));
      logger.warn('Building code save threw', { projectId: project.id, error });
    } finally {
      setIsSaving(false);
    }
  }, [project?.id, draft, validation.errors.length, t]);

  return {
    draft,
    persisted,
    isDirty,
    isSaving,
    canSave,
    validation,
    hasZone: draft.zoneId !== null,
    setPlotType,
    setFrontagesCount,
    setZoneId,
    setSd,
    setCoveragePct,
    setMaxHeight,
    resetField,
    isFieldResettable,
    reset,
    save,
  };
}
