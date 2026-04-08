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

import React, { useCallback, useMemo } from 'react';
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
  onComplete?: (file: File, meta: WizardCompleteMeta) => void;
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

/** Shortcut floorplan card config for steps 2-4 */
const STEP_SHORTCUT_CONFIG: Record<number, { type: FloorplanType; labelKey: string; icon: React.ElementType }> = {
  2: { type: 'project', labelKey: 'floorplanImport.shortcuts.project', icon: FolderKanban },
  3: { type: 'building', labelKey: 'floorplanImport.shortcuts.building', icon: Building2 },
  4: { type: 'floor', labelKey: 'floorplanImport.shortcuts.floor', icon: Layers },
};

// =============================================================================
// COMPONENT
// =============================================================================

export function FloorplanImportWizard({
  isOpen,
  onClose,
  onComplete,
}: FloorplanImportWizardProps) {
  const { t, isNamespaceReady } = useTranslation('files');

  const state = useFloorplanImportState({ isOpen });

  const stepLabels = useMemo(
    () => STEP_LABEL_KEYS.map((key) => t(key)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, isNamespaceReady],
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
    onClose();
  }, [state, onClose]);

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

  // Navigate to a completed step by clicking its number
  const handleStepClick = useCallback((targetStep: number) => {
    state.goToStep(targetStep);
  }, [state]);

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
              shortcutLabel={shortcutEnabled ? t(shortcutConfig.labelKey) : undefined}
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
