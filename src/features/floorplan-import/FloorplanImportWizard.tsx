'use client';

/**
 * =============================================================================
 * SPEC-237D: Floorplan Import Wizard
 * =============================================================================
 *
 * 6-step horizontal wizard for importing floorplans into the system.
 * Company → Project → Building → Floor → Unit → Upload
 *
 * Steps 2-4 have a floorplan shortcut card above the entity list:
 * - Step 2: "Γενική Κάτοψη Έργου" → jump to upload
 * - Step 3: "Γενική Κάτοψη Κτιρίου" → jump to upload
 * - Step 4: "Κάτοψη Ορόφου" → jump to upload
 *
 * Step 5 is the unit selector (with level radio for multi-level units).
 *
 * @module features/floorplan-import/FloorplanImportWizard
 */

import React, { useCallback, useMemo, useState } from 'react';
import { FolderKanban, Building2, Layers } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { WizardProgress } from '@/subapps/dxf-viewer/ui/components/WizardProgress';

import { useFloorplanImportState } from './hooks/useFloorplanImportState';
import { StepEntitySelector } from './components/StepEntitySelector';
import { StepPropertySelector } from './components/StepPropertySelector';
import { StepUpload } from './components/StepUpload';
import { StepStoragePicker } from './components/StepStoragePicker';
import type { FloorplanType } from './hooks/useFloorplanImportState';
import type { EntityType } from '@/config/domain-constants';
import '@/lib/design-system';

// =============================================================================
// TYPES
// =============================================================================

/** Context passed to onComplete — lets callers configure auto-save with correct entity info */
export interface WizardCompleteMeta {
  companyId: string;
  projectId?: string;
  entityType: EntityType;
  entityId: string;
  purpose: string;
  /** Human-readable entity label (e.g., "Κτήριο Α", "ΣΟΦΙΤΑ") for displayName generation */
  entityLabel?: string;
}

interface FloorplanImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  /** 'import' (default): step 6 = upload. 'load': step 6 = pick from saved. */
  mode?: 'import' | 'load';
  /** import mode: called when file upload completes */
  onComplete?: (file: File, meta: WizardCompleteMeta) => void;
  /** load mode: called when user picks a saved floorplan. Throws on failure. */
  onLoad?: (fileId: string, meta: WizardCompleteMeta) => Promise<void>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const TOTAL_STEPS = 6;

const STEP_LABEL_KEYS = [
  'floorplanImport.steps.company',
  'floorplanImport.steps.project',
  'floorplanImport.steps.building',
  'floorplanImport.steps.floor',
  'floorplanImport.steps.unit',
  'floorplanImport.steps.upload',
] as const;

const SELECT_PLACEHOLDER_KEYS: Record<number, string> = {
  1: 'floorplanImport.select.company',
  2: 'floorplanImport.select.project',
  3: 'floorplanImport.select.building',
  4: 'floorplanImport.select.floor',
};

/** Shortcut floorplan card config for steps 2-4. Labels differ by mode. */
const STEP_SHORTCUT_CONFIG: Record<number, {
  type: FloorplanType;
  importLabelKey: string;
  loadLabelKey: string;
  icon: React.ElementType;
}> = {
  2: { type: 'project', importLabelKey: 'floorplanImport.shortcuts.project', loadLabelKey: 'floorplanImport.shortcuts.loadProject', icon: FolderKanban },
  3: { type: 'building', importLabelKey: 'floorplanImport.shortcuts.building', loadLabelKey: 'floorplanImport.shortcuts.loadBuilding', icon: Building2 },
  4: { type: 'floor', importLabelKey: 'floorplanImport.shortcuts.floor', loadLabelKey: 'floorplanImport.shortcuts.loadFloor', icon: Layers },
};

// =============================================================================
// COMPONENT
// =============================================================================

export function FloorplanImportWizard({
  isOpen,
  onClose,
  mode = 'import',
  onComplete,
  onLoad,
}: FloorplanImportWizardProps) {
  const { t, isNamespaceReady } = useTranslation(['files', 'files-media']);

  const state = useFloorplanImportState({ isOpen });

  // ADR-309 Phase 5: selection state for load mode step 6
  const [selectedStorageFileId, setSelectedStorageFileId] = useState<string | null>(null);
  const [loadingStorage, setLoadingStorage] = useState(false);

  const stepLabels = useMemo(
    () => [
      ...STEP_LABEL_KEYS.slice(0, 5).map((key) => t(key)),
      mode === 'load'
        ? t('floorplanImport.steps.select')
        : t('floorplanImport.steps.upload'),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, isNamespaceReady, mode],
  );

  const handleUploadComplete = useCallback((file: File) => {
    // 🏢 ADR-240: Build WizardCompleteMeta from uploadConfig so callers can configure auto-save
    const cfg = state.uploadConfig;
    if (cfg && onComplete) {
      const meta: WizardCompleteMeta = {
        companyId: cfg.companyId,
        projectId: cfg.projectId,
        entityType: cfg.entityType as WizardCompleteMeta['entityType'],
        entityId: cfg.entityId,
        purpose: cfg.purpose ?? '',
        entityLabel: cfg.entityLabel,
      };
      onComplete(file, meta);
    } else {
      onComplete?.(file, {
        companyId: '',
        entityType: 'floor',
        entityId: '',
        purpose: '',
      });
    }
  }, [onComplete, state.uploadConfig]);

  const handleClose = useCallback(() => {
    state.reset();
    setSelectedStorageFileId(null);
    setLoadingStorage(false);
    onClose();
  }, [state, onClose]);

  const handleConfirmLoad = useCallback(async () => {
    if (!selectedStorageFileId || !state.uploadConfig) return;
    const cfg = state.uploadConfig;
    const meta: WizardCompleteMeta = {
      companyId: cfg.companyId,
      projectId: cfg.projectId,
      entityType: cfg.entityType as WizardCompleteMeta['entityType'],
      entityId: cfg.entityId,
      purpose: cfg.purpose ?? '',
      entityLabel: cfg.entityLabel,
    };
    setLoadingStorage(true);
    try {
      await onLoad?.(selectedStorageFileId, meta);
      handleClose();
    } finally {
      setLoadingStorage(false);
    }
  }, [selectedStorageFileId, state.uploadConfig, onLoad, handleClose]);

  const getSelectedId = (): string | null => {
    switch (state.step) {
      case 1: return state.selection.companyId;
      case 2: return state.selection.projectId;
      case 3: return state.selection.buildingId;
      case 4: return state.selection.floorId;
      default: return null;
    }
  };

  // Determine if current step has a shortcut card and if it's enabled
  const shortcutConfig = STEP_SHORTCUT_CONFIG[state.step];
  const shortcutEnabled = !!shortcutConfig && !!getSelectedId();
  const shortcutLabelKey = shortcutConfig
    ? (mode === 'load' ? shortcutConfig.loadLabelKey : shortcutConfig.importLabelKey)
    : undefined;

  // Navigate to a completed step by clicking its number
  const handleStepClick = useCallback((targetStep: number) => {
    state.goToStep(targetStep);
  }, [state]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === 'load' ? t('floorplanImport.loadTitle') : t('floorplanImport.title')}
          </DialogTitle>
        </DialogHeader>

        {/* ── Step indicator ── */}
        <WizardProgress
          currentStep={state.step}
          totalSteps={TOTAL_STEPS}
          stepLabels={stepLabels}
          onStepClick={handleStepClick}
        />

        {/* ── Step content area ── */}
        <section className="min-h-[300px]">
          {/* Steps 1-4: Entity selection */}
          {state.step >= 1 && state.step <= 4 && (
            <StepEntitySelector
              items={state.currentStepItems}
              selectedId={getSelectedId()}
              onSelect={state.selectEntity}
              loading={state.currentStepLoading}
              placeholder={t(SELECT_PLACEHOLDER_KEYS[state.step] ?? '')}
              emptyMessage={t('floorplanImport.noItems')}
              shortcutLabel={shortcutEnabled && shortcutLabelKey ? t(shortcutLabelKey) : undefined}
              shortcutIcon={shortcutEnabled ? shortcutConfig.icon : undefined}
              onShortcutClick={shortcutEnabled ? () => state.jumpToUpload(shortcutConfig.type) : undefined}
            />
          )}

          {/* Step 5: Unit selector + levels */}
          {state.step === 5 && (
            <StepPropertySelector
              unitItems={state.unitItems}
              unitLoading={state.unitLoading}
              selectedPropertyId={state.selection.propertyId}
              onSelectProperty={state.selectProperty}
              isMultiLevel={state.selectedPropertyIsMultiLevel}
              levelItems={state.unitLevelItems}
              selectedLevelId={state.selection.levelFloorId}
              onSelectLevel={state.selectLevel}
            />
          )}

          {/* Step 6: Upload (import mode) */}
          {mode === 'import' && state.step === 6 && state.uploadConfig && (
            <StepUpload
              config={state.uploadConfig}
              onComplete={handleUploadComplete}
            />
          )}

          {/* Step 6: Pick from storage (load mode) */}
          {mode === 'load' && state.step === 6 && state.uploadConfig && (
            <StepStoragePicker
              uploadConfig={state.uploadConfig}
              selectedFileId={selectedStorageFileId}
              onFileSelected={setSelectedStorageFileId}
            />
          )}
        </section>

        {/* ── Footer navigation ── */}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            {t('floorplanImport.cancel')}
          </Button>

          <div className="flex gap-2">
            {state.step > 1 && (
              <Button variant="outline" onClick={state.handleBack}>
                {t('floorplanImport.back')}
              </Button>
            )}

            {state.step < 6 && (
              <Button onClick={state.handleNext} disabled={!state.canProceed}>
                {t('floorplanImport.next')}
              </Button>
            )}

            {mode === 'load' && state.step === 6 && (
              <>
                <Button
                  onClick={handleConfirmLoad}
                  disabled={!selectedStorageFileId || loadingStorage}
                >
                  {loadingStorage
                    ? t('floorplanImport.storagePicker.loading')
                    : t('floorplanImport.storagePicker.loadButton')}
                </Button>
                {state.canContinueDeeper && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedStorageFileId(null);
                      state.continueDeeper();
                    }}
                  >
                    {t('floorplanImport.next')}
                  </Button>
                )}
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
