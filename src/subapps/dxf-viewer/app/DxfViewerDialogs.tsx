'use client';

/**
 * DxfViewerDialogs — Suspense-wrapped modal / host portals extracted from
 * DxfViewerContent. ADR-065 SRP split: presentational container for every
 * always-mounted dialog/host + the optional AI chat panel + perf dashboard.
 *
 * Growth sink: new modals/hosts land here, NOT in DxfViewerContent, so the
 * orchestrator stays under the 500-line Google SRP limit (N.7.1 / CHECK 4).
 *
 * Zero subscriptions to high-frequency stores: receives everything via props
 * (CHECK 6B/6C safe — orchestrator does not add useSyncExternalStore here).
 *
 * Related files:
 * - DxfViewerContent.tsx (main orchestrator)
 * - useDxfViewerUiState.ts (owns the toggle state passed in via `ui`)
 * - dxf-viewer-lazy-components.tsx (lazy children rendered here)
 */

import React from 'react';
// 🤖 ADR-185: AI Drawing Assistant feature flag
import { USE_AI_DRAWING_ASSISTANT } from '../config/feature-flags';
import { PerformanceCategory } from '@/core/performance/types/performance.types';
import { ClientOnlyPerformanceDashboard } from '@/core/performance/components/ClientOnlyPerformanceDashboard';
import { useLevels } from '../systems/levels';
import { buildDxfImportSaveContext } from './dxf-import-save-context';
import type { DxfViewerCallbacksReturn } from './useDxfViewerCallbacks';
import type { DxfViewerUiState } from './useDxfViewerUiState';
import {
  TestsModal, CreditsDialog, FloorplanBackgroundPanel, ReplaceConfirmDialog, CalibrationDialog,
  DxfImportModal, SimpleProjectDialog, FloorplanImportWizard, ConstructionLayerScaffoldDialog,
  DxfFindReplaceHost, DxfSymbolPickerHost, RenumberOpeningsHost, OpeningTagStyleHost,
  OpeningSchedulePdfHost, ThermalEnvelopeHost, BimScheduleHost, AdminLayerManagerDialogHost,
  DxfAiChatPanel, ColumnPerimeterConfirmDialog, PrintHost,
} from './dxf-viewer-lazy-components';

type LevelManager = ReturnType<typeof useLevels>;

export interface DxfViewerDialogsProps {
  readonly ui: DxfViewerUiState;
  readonly levelManager: LevelManager;
  readonly perfMonitorEnabled: boolean;
  readonly handleFileImportWithEncoding: DxfViewerCallbacksReturn['handleFileImportWithEncoding'];
  readonly showCopyableNotification: DxfViewerCallbacksReturn['showCopyableNotification'];
  // ADR-344/353 text-toolbar hosts (find & replace / symbol picker) — state owned by useDxfViewerState.
  readonly findReplaceOpen: boolean;
  readonly setFindReplaceOpen: (open: boolean) => void;
  readonly symbolPickerOpen: boolean;
  readonly setSymbolPickerOpen: (open: boolean) => void;
  // ADR-363 §6 Phase 8 — live canvas selection για το selection-only φίλτρο του «Πίνακα BIM».
  readonly selectionIds: readonly string[];
}

const hiddenFallback = <div className="hidden" />;

/**
 * Renders every always-mounted dialog/host portal for the DXF viewer shell.
 * Each child is independently lazy-loaded; this component only wires open/close
 * state + scope props (projectId / floorplanId) derived from the level manager.
 */
export function DxfViewerDialogs(props: DxfViewerDialogsProps): React.JSX.Element {
  const {
    ui, levelManager, perfMonitorEnabled,
    handleFileImportWithEncoding, showCopyableNotification,
    findReplaceOpen, setFindReplaceOpen, symbolPickerOpen, setSymbolPickerOpen,
    selectionIds,
  } = props;

  const projectId = levelManager.saveContext?.projectId ?? undefined;
  const floorplanId = levelManager.fileRecordId ?? undefined;

  return (
    <>
      <React.Suspense fallback={hiddenFallback}>
        <TestsModal
          isOpen={ui.testsModalOpen}
          onClose={() => ui.setTestsModalOpen(false)}
          showCopyableNotification={showCopyableNotification}
        />
      </React.Suspense>
      <React.Suspense fallback={hiddenFallback}>
        <CreditsDialog
          isOpen={ui.creditsModalOpen}
          onClose={() => ui.setCreditsModalOpen(false)}
        />
      </React.Suspense>
      <React.Suspense fallback={hiddenFallback}>
        <FloorplanBackgroundPanel
          isOpen={ui.pdfPanelOpen}
          onClose={() => ui.setPdfPanelOpen(false)}
        />
      </React.Suspense>
      <React.Suspense fallback={hiddenFallback}>
        <ReplaceConfirmDialog />
      </React.Suspense>
      {/* ADR-363 Φ3c — «Κολώνα από περίγραμμα» ενημερωτικό confirm (self-subscribing). */}
      <React.Suspense fallback={hiddenFallback}>
        <ColumnPerimeterConfirmDialog />
      </React.Suspense>
      <React.Suspense fallback={hiddenFallback}>
        <CalibrationDialog />
      </React.Suspense>
      {/* ADR-345 Fase 6: Import dialogs — SSOT owner (migrated from EnhancedDXFToolbar) */}
      <React.Suspense fallback={hiddenFallback}>
        <DxfImportModal
          isOpen={ui.showLegacyImport}
          onClose={() => ui.setShowLegacyImport(false)}
          onImport={async (file, encoding) => { await handleFileImportWithEncoding(file, encoding); }}
        />
      </React.Suspense>
      <React.Suspense fallback={hiddenFallback}>
        <SimpleProjectDialog
          isOpen={ui.showEnhancedImport}
          onClose={() => ui.setShowEnhancedImport(false)}
          onFileImport={(file: File) => handleFileImportWithEncoding(file)}
        />
      </React.Suspense>
      <React.Suspense fallback={hiddenFallback}>
        <FloorplanImportWizard
          isOpen={ui.showImportWizard}
          onClose={() => ui.setShowImportWizard(false)}
          onComplete={(file, meta) => {
            ui.setShowImportWizard(false);
            if (meta.format && meta.format !== 'dxf') return;
            void handleFileImportWithEncoding(file, undefined, buildDxfImportSaveContext(meta));
          }}
        />
      </React.Suspense>
      <React.Suspense fallback={hiddenFallback}><ConstructionLayerScaffoldDialog /></React.Suspense>
      <React.Suspense fallback={hiddenFallback}><DxfFindReplaceHost open={findReplaceOpen} onOpenChange={setFindReplaceOpen} /></React.Suspense>
      <React.Suspense fallback={hiddenFallback}><DxfSymbolPickerHost open={symbolPickerOpen} onOpenChange={setSymbolPickerOpen} /></React.Suspense>
      <React.Suspense fallback={hiddenFallback}><RenumberOpeningsHost projectId={projectId} floorplanId={floorplanId} /></React.Suspense>
      <React.Suspense fallback={hiddenFallback}><OpeningTagStyleHost projectId={projectId} /></React.Suspense>
      <React.Suspense fallback={hiddenFallback}><OpeningSchedulePdfHost getEntities={() => (levelManager.getLevelScene(levelManager.currentLevelId ?? '')?.entities ?? []) as unknown as ReadonlyArray<Record<string, unknown>>} levels={levelManager.levels} /></React.Suspense>
      {/* ADR-396 P6 — Thermal Envelope (ETICS) authoring dialog (opened via Analyze tab). */}
      <React.Suspense fallback={hiddenFallback}><ThermalEnvelopeHost currentLevelId={levelManager.currentLevelId} levels={levelManager.levels} getLevelScene={levelManager.getLevelScene} setLevelScene={levelManager.setLevelScene} projectId={projectId} /></React.Suspense>
      {/* ADR-363 §6 Phase 8 — BIM Schedule («Πίνακας BIM») dialog (opened via Analyze tab). */}
      <React.Suspense fallback={hiddenFallback}><BimScheduleHost selectionIds={selectionIds} /></React.Suspense>
      {/* ADR-453 — Print/Export («Εκτύπωση») dialog (opened via Analyze → Εκτύπωση). */}
      <React.Suspense fallback={hiddenFallback}><PrintHost /></React.Suspense>
      {/* ADR-391 — AdminLayerManager modal (opened via View tab button or Ctrl+L). */}
      <React.Suspense fallback={hiddenFallback}><AdminLayerManagerDialogHost projectId={levelManager.saveContext?.projectId ?? null} /></React.Suspense>
      {USE_AI_DRAWING_ASSISTANT && (
        <React.Suspense fallback={hiddenFallback}>
          <DxfAiChatPanel
            isOpen={ui.aiChatOpen}
            onClose={() => ui.setAiChatOpen(false)}
            getScene={levelManager.getLevelScene}
            setScene={levelManager.setLevelScene}
            levelId={levelManager.currentLevelId || '0'}
          />
        </React.Suspense>
      )}
      {perfMonitorEnabled && (
        <ClientOnlyPerformanceDashboard
          showDetails
          updateInterval={2000}
          categories={[
            PerformanceCategory.RENDERING,
            PerformanceCategory.MEMORY,
          ]}
        />
      )}
    </>
  );
}
