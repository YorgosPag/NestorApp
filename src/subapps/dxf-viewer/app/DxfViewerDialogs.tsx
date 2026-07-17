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
import { useLevels } from '../systems/levels';
import { useSelectedEntityIds } from '../systems/selection';
import { resolveActiveBuildingId } from '../systems/levels/level-floor-resolution';
import { EventBus } from '../systems/events/EventBus';
import { buildDxfImportSaveContext } from './dxf-import-save-context';
// ADR-652 M6 — «Δημιουργία Block» host (always-mounted outer reads the light request store;
// the heavy inner mounts only while a create is requested — gate-at-mount).
import { CreateBlockDialogHost } from '../ui/panels/block-library/CreateBlockDialogHost';
import type { DxfViewerCallbacksReturn } from './useDxfViewerCallbacks';
import type { DxfViewerUiState } from './useDxfViewerUiState';
import {
  TestsModal, CreditsDialog, FloorplanBackgroundPanel, ReplaceConfirmDialog, CalibrationDialog,
  DxfImportModal, SimpleProjectDialog, FloorplanImportWizard, ConstructionLayerScaffoldDialog,
  DxfFindReplaceHost, DxfSymbolPickerHost, RenumberOpeningsHost, OpeningTagStyleHost,
  OpeningSchedulePdfHost, ThermalEnvelopeHost, BimScheduleHost, TopoRibbonHost, AdminLayerManagerDialogHost,
  DxfAiChatPanel, ColumnPerimeterConfirmDialog, GapCloseConfirmDialog, ColumnAdoptSizeDialog, ColumnBecomesWallDialog, ShearWallExtentDialog, SectionRelationshipDialog, ColumnBatchFillConfirmDialog, AutoDimensionOptionsDialog, DxfSymbolDetectConfirmDialog, ColumnPromoteConfirmDialog, HatchOverlapConfirmDialog, PrintHost, ExportHost, StampHost, AiTitleBlockHost, RevisionsHost, TitleBlockLibraryDialogHost, ColumnDetailHost, FoundationDetailHost, BeamDetailHost,
  SlabDetailHost, FloorManagementDialogHost, MatchPropertiesDialogHost,
} from './dxf-viewer-lazy-components';

type LevelManager = ReturnType<typeof useLevels>;

export interface DxfViewerDialogsProps {
  readonly ui: DxfViewerUiState;
  readonly levelManager: LevelManager;
  readonly handleFileImportWithEncoding: DxfViewerCallbacksReturn['handleFileImportWithEncoding'];
  readonly showCopyableNotification: DxfViewerCallbacksReturn['showCopyableNotification'];
  // ADR-344/353 text-toolbar hosts (find & replace / symbol picker) — state owned by useDxfViewerState.
  readonly findReplaceOpen: boolean;
  readonly setFindReplaceOpen: (open: boolean) => void;
  readonly symbolPickerOpen: boolean;
  readonly setSymbolPickerOpen: (open: boolean) => void;
}

const hiddenFallback = <div className="hidden" />;

/**
 * ADR-532 Stage B5 — leaf that owns the live-selection subscription for the
 * «Πίνακα BIM» selection-only filter. Isolating `useSelectedEntityIds()` here
 * means a click-selection re-renders THIS wrapper only, not the whole
 * `DxfViewerDialogs` portal tree (28 hosts) nor the orchestrator.
 */
const BimScheduleHostLeaf = React.memo(function BimScheduleHostLeaf() {
  const selectionIds = useSelectedEntityIds();
  return <BimScheduleHost selectionIds={selectionIds} />;
});

/**
 * Renders every always-mounted dialog/host portal for the DXF viewer shell.
 * Each child is independently lazy-loaded; this component only wires open/close
 * state + scope props (projectId / floorplanId) derived from the level manager.
 */
export function DxfViewerDialogs(props: DxfViewerDialogsProps): React.JSX.Element {
  const {
    ui, levelManager,
    handleFileImportWithEncoding, showCopyableNotification,
    findReplaceOpen, setFindReplaceOpen, symbolPickerOpen, setSymbolPickerOpen,
  } = props;

  const projectId = levelManager.saveContext?.projectId ?? undefined;
  const floorplanId = levelManager.fileRecordId ?? undefined;
  // Ενεργό buildingId από τα levels (SSoT helper, ίδια πηγή με το LevelPanel) — για
  // το Floor Management modal που ανοίγει την καρτέλα «Όροφοι» μέσα στον viewer.
  const buildingId = resolveActiveBuildingId(levelManager.levels);

  // ADR-526 — Tekton .tek import: ribbon action emits the event; we open a native
  // file picker and route the file through the SAME import path as DXF (level
  // resolution + scene-load + stair persist live in useSceneState.handleFileImport).
  const tekInputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => EventBus.on('dxf:import-tek-requested', () => tekInputRef.current?.click()), []);

  return (
    <>
      <input
        ref={tekInputRef}
        type="file"
        accept=".tek,.txt"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = ''; // allow re-picking the same file
          if (file) await handleFileImportWithEncoding(file);
        }}
      />
      <React.Suspense fallback={hiddenFallback}>
        <TestsModal
          isOpen={ui.testsModalOpen}
          onClose={() => ui.setTestsModalOpen(false)}
          showCopyableNotification={showCopyableNotification}
        />
      </React.Suspense>
      {/* Gate-at-mount: closed dialogs must NOT re-render on every selection
          commit (Root B amplifier). CreditsDialog filters its credit list on
          every render (un-memoized) — unmount it while closed. */}
      {ui.creditsModalOpen && (
        <React.Suspense fallback={hiddenFallback}>
          <CreditsDialog
            isOpen={ui.creditsModalOpen}
            onClose={() => ui.setCreditsModalOpen(false)}
          />
        </React.Suspense>
      )}
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
      {/* ADR-419 §gap-close — «Να κλείσω το κενό;» confirm (self-subscribing). */}
      <React.Suspense fallback={hiddenFallback}>
        <GapCloseConfirmDialog />
      </React.Suspense>
      {/* ADR-398 §3.17 — «Υιοθέτηση μεγέθους ορθογωνίου» confirm (self-subscribing). */}
      <React.Suspense fallback={hiddenFallback}>
        <ColumnAdoptSizeDialog />
      </React.Suspense>
      {/* ADR-363 §5.6 — «Οι διαστάσεις δημιουργούν τοιχίο» edit-time warn (self-subscribing). */}
      <React.Suspense fallback={hiddenFallback}>
        <ColumnBecomesWallDialog />
      </React.Suspense>
      {/* ADR-363 §5.6b — «Ασυνήθιστες διαστάσεις τοιχίου» (πάχος/μήκος) edit-time warn (self-subscribing). */}
      <React.Suspense fallback={hiddenFallback}>
        <ShearWallExtentDialog />
      </React.Suspense>
      {/* ADR-363 §5.6c — «Σχέσεις διατομής εκτός εύρους» ΓΕΝΙΚΟ edit-time warn (όλοι οι τύποι, self-subscribing). */}
      <React.Suspense fallback={hiddenFallback}>
        <SectionRelationshipDialog />
      </React.Suspense>
      {/* ADR-524 — «Πολλαπλή πλήρωση όμοιων πλαισίων» confirm (self-subscribing). */}
      <React.Suspense fallback={hiddenFallback}>
        <ColumnBatchFillConfirmDialog />
      </React.Suspense>
      {/* ADR-563 — «Αυτόματη Διαστασιολόγηση» options dialog (self-subscribing). */}
      <React.Suspense fallback={hiddenFallback}>
        <AutoDimensionOptionsDialog />
      </React.Suspense>
      {/* ADR-533 — «Ανίχνευση συμβόλου κουφώματος σε τοίχο» confirm (self-subscribing). */}
      <React.Suspense fallback={hiddenFallback}>
        <DxfSymbolDetectConfirmDialog />
      </React.Suspense>
      {/* ADR-529 — «Προαγωγή γωνιακής κολόνας σε Γ (boundary element)» confirm (self-subscribing). */}
      <React.Suspense fallback={hiddenFallback}>
        <ColumnPromoteConfirmDialog />
      </React.Suspense>
      {/* ADR-507 Φ3 — «η περιοχή έχει ήδη γραμμοσκίαση» confirm (warn+allow, self-subscribing). */}
      <React.Suspense fallback={hiddenFallback}>
        <HatchOverlapConfirmDialog />
      </React.Suspense>
      <React.Suspense fallback={hiddenFallback}>
        <CalibrationDialog />
      </React.Suspense>
      {/* ADR-345 Fase 6: Import dialogs — SSOT owner (migrated from EnhancedDXFToolbar).
          🚀 PERF (2026-06-28): gate-at-mount (same pattern as CreditsDialog/FindReplace above) —
          these are purely controlled (open flag owned by `ui`), and the import modal/wizard are
          heavy trees that otherwise re-rendered on every scene/level commit while closed. */}
      {ui.showLegacyImport && (
        <React.Suspense fallback={hiddenFallback}>
          <DxfImportModal
            isOpen={ui.showLegacyImport}
            onClose={() => ui.setShowLegacyImport(false)}
            onImport={async (file, encoding) => { await handleFileImportWithEncoding(file, encoding); }}
          />
        </React.Suspense>
      )}
      {ui.showEnhancedImport && (
        <React.Suspense fallback={hiddenFallback}>
          <SimpleProjectDialog
            isOpen={ui.showEnhancedImport}
            onClose={() => ui.setShowEnhancedImport(false)}
            onFileImport={(file: File) => handleFileImportWithEncoding(file)}
          />
        </React.Suspense>
      )}
      {ui.showImportWizard && (
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
      )}
      <React.Suspense fallback={hiddenFallback}><ConstructionLayerScaffoldDialog /></React.Suspense>
      {/* Gate-at-mount: both are purely controlled (open flag owned by parent,
          no internal EventBus listener). DxfFindReplaceHost scans the whole
          scene for text entities — unmount it while closed so it stays out of
          the per-selection re-render tree. */}
      {findReplaceOpen && <React.Suspense fallback={hiddenFallback}><DxfFindReplaceHost open={findReplaceOpen} onOpenChange={setFindReplaceOpen} /></React.Suspense>}
      {symbolPickerOpen && <React.Suspense fallback={hiddenFallback}><DxfSymbolPickerHost open={symbolPickerOpen} onOpenChange={setSymbolPickerOpen} /></React.Suspense>}
      <React.Suspense fallback={hiddenFallback}><RenumberOpeningsHost projectId={projectId} floorplanId={floorplanId} /></React.Suspense>
      <React.Suspense fallback={hiddenFallback}><OpeningTagStyleHost projectId={projectId} /></React.Suspense>
      <React.Suspense fallback={hiddenFallback}><OpeningSchedulePdfHost getEntities={() => (levelManager.getLevelScene(levelManager.currentLevelId ?? '')?.entities ?? []) as unknown as ReadonlyArray<Record<string, unknown>>} levels={levelManager.levels} /></React.Suspense>
      {/* ADR-396 P6 — Thermal Envelope (ETICS) authoring dialog (opened via Analyze tab). */}
      <React.Suspense fallback={hiddenFallback}><ThermalEnvelopeHost currentLevelId={levelManager.currentLevelId} levels={levelManager.levels} getLevelScene={levelManager.getLevelScene} setLevelScene={levelManager.setLevelScene} projectId={projectId} /></React.Suspense>
      {/* ADR-363 §6 Phase 8 — BIM Schedule («Πίνακας BIM») dialog (opened via Analyze tab). */}
      <React.Suspense fallback={hiddenFallback}><BimScheduleHostLeaf /></React.Suspense>
      {/* ADR-453 — Print/Export («Εκτύπωση») dialog (opened via Analyze → Εκτύπωση). */}
      <React.Suspense fallback={hiddenFallback}><PrintHost /></React.Suspense>
      {/* ADR-662 Φάση 1 — «Τοπογραφικό» ribbon bridge (mounts topo hooks + section-in-dialog). */}
      <React.Suspense fallback={hiddenFallback}><TopoRibbonHost /></React.Suspense>
      {/* ADR-505 — Export («Εξαγωγή») dialog (opened via Analyze → Εξαγωγή). */}
      <React.Suspense fallback={hiddenFallback}><ExportHost projectId={projectId} buildingId={buildingId ?? undefined} /></React.Suspense>
      {/* ADR-651 Φάση Ε — engineer-stamp dialog (opened via «Πινακίδα Σχεδίου» → «Σφραγίδα…»). */}
      <React.Suspense fallback={hiddenFallback}><StampHost /></React.Suspense>

      <React.Suspense fallback={hiddenFallback}><AiTitleBlockHost projectId={projectId} /></React.Suspense>
      {/* ADR-651 Φάση Η — revisions dialog (opened via «Πινακίδα Σχεδίου» → «Αναθεωρήσεις…»). */}
      <React.Suspense fallback={hiddenFallback}><RevisionsHost projectId={projectId} /></React.Suspense>
      {/* ADR-651 Φάση Θ — βιβλιοθήκη προτύπων πινακίδας (αποθήκευση/δημοσίευση/απόσπαση/pull). */}
      <React.Suspense fallback={hiddenFallback}><TitleBlockLibraryDialogHost projectId={projectId} /></React.Suspense>
      {/* ADR-457 — Column Reinforcement Detail Sheet (opened via column contextual tab). */}
      <React.Suspense fallback={hiddenFallback}><ColumnDetailHost levelManager={levelManager} /></React.Suspense>
      {/* ADR-463 — Footing Reinforcement Detail Sheet (opened via foundation contextual tab). */}
      <React.Suspense fallback={hiddenFallback}><FoundationDetailHost levelManager={levelManager} /></React.Suspense>
      {/* ADR-471 — Beam Reinforcement Detail Sheet (opened via beam contextual tab). */}
      <React.Suspense fallback={hiddenFallback}><BeamDetailHost levelManager={levelManager} /></React.Suspense>
      {/* ADR-476 — Slab Reinforcement Detail Sheet (opened via slab contextual tab). */}
      <React.Suspense fallback={hiddenFallback}><SlabDetailHost levelManager={levelManager} /></React.Suspense>
      {/* ADR-391 — AdminLayerManager modal (opened via View tab button or Ctrl+L). */}
      <React.Suspense fallback={hiddenFallback}><AdminLayerManagerDialogHost projectId={levelManager.saveContext?.projectId ?? null} /></React.Suspense>
      {/* «Όροφοι Κτιρίου» modal (opened from Levels panel ⚙️ or floor-tab right-click). */}
      <React.Suspense fallback={hiddenFallback}><FloorManagementDialogHost buildingId={buildingId} /></React.Suspense>
      {/* ADR-581 — «Αντιγραφή Ιδιοτήτων» modal (opened from multi-selection contextual tab). */}
      <React.Suspense fallback={hiddenFallback}><MatchPropertiesDialogHost levelManager={levelManager} /></React.Suspense>
      {/* ADR-652 M6 — «Δημιουργία Block» dialog (opened από Home→Modify με ενεργή επιλογή). */}
      <CreateBlockDialogHost levelManager={levelManager} projectId={projectId} />
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
    </>
  );
}
