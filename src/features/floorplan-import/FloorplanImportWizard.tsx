'use client';

/**
 * =============================================================================
 * SPEC-237D: Floorplan Import Wizard
 * =============================================================================
 *
 * 6-step horizontal wizard for importing floorplans into the system.
 * Company → Project → Building → Floor → Type → Upload
 *
 * Reuses:
 * - WizardProgress (step indicator)
 * - Dialog (Radix modal)
 * - useFloorplanUpload (upload pipeline)
 * - FileUploadZone (drag & drop)
 * - enterprise-api-client (cascading data)
 *
 * @module features/floorplan-import/FloorplanImportWizard
 */

import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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
import { StepFloorplanType } from './components/StepFloorplanType';
import { StepUpload } from './components/StepUpload';

// =============================================================================
// TYPES
// =============================================================================

interface FloorplanImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const TOTAL_STEPS = 6;

// Step label keys for WizardProgress
const STEP_LABEL_KEYS = [
  'floorplanImport.steps.company',
  'floorplanImport.steps.project',
  'floorplanImport.steps.building',
  'floorplanImport.steps.floor',
  'floorplanImport.steps.type',
  'floorplanImport.steps.upload',
] as const;

// Select placeholder keys per step
const SELECT_PLACEHOLDER_KEYS: Record<number, string> = {
  1: 'floorplanImport.select.company',
  2: 'floorplanImport.select.project',
  3: 'floorplanImport.select.building',
  4: 'floorplanImport.select.floor',
};

// =============================================================================
// COMPONENT
// =============================================================================

export function FloorplanImportWizard({
  isOpen,
  onClose,
  onComplete,
}: FloorplanImportWizardProps) {
  const { t } = useTranslation('files');

  const state = useFloorplanImportState();

  // ── Step labels (translated) ──
  const stepLabels = useMemo(
    () => STEP_LABEL_KEYS.map((key) => t(key)),
    [t],
  );

  // ── Upload completion handler ──
  const handleUploadComplete = useCallback(() => {
    onComplete?.();
  }, [onComplete]);

  // ── Close + reset ──
  const handleClose = useCallback(() => {
    state.reset();
    onClose();
  }, [state, onClose]);

  // ── Get selected ID for current step ──
  const getSelectedId = (): string | null => {
    switch (state.step) {
      case 1: return state.selection.companyId;
      case 2: return state.selection.projectId;
      case 3: return state.selection.buildingId;
      case 4: return state.selection.floorId;
      default: return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('floorplanImport.title')}</DialogTitle>
        </DialogHeader>

        {/* ── Step indicator ── */}
        <WizardProgress
          currentStep={state.step}
          totalSteps={TOTAL_STEPS}
          stepLabels={stepLabels}
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
              autoSelectedMessage={t('floorplanImport.autoSelected')}
            />
          )}

          {/* Step 5: Floorplan type */}
          {state.step === 5 && (
            <StepFloorplanType
              selectedType={state.selection.floorplanType}
              onSelectType={state.selectFloorplanType}
              unitItems={state.unitItems}
              unitLoading={state.unitLoading}
              selectedUnitId={state.selection.unitId}
              onSelectUnit={state.selectUnit}
            />
          )}

          {/* Step 6: Upload */}
          {state.step === 6 && state.uploadConfig && (
            <StepUpload
              config={state.uploadConfig}
              onComplete={handleUploadComplete}
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
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
