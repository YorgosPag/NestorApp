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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { WizardProgress } from '@/subapps/dxf-viewer/ui/components/WizardProgress';

import { useNotifications } from '@/providers/NotificationProvider';
import { useFloorplanImportState } from './hooks/useFloorplanImportState';
import type { FloorplanImportSelection } from './hooks/useFloorplanImportState';
import type { FloorplanUploadConfig } from '@/hooks/useFloorplanUpload';
import { StepEntitySelector } from './components/StepEntitySelector';
import { StepPropertySelector } from './components/StepPropertySelector';
import { StepUpload } from './components/StepUpload';
import { StepStoragePicker } from './components/StepStoragePicker';
import { StepCreateConfirm } from './components/StepCreateConfirm';
import type { FloorplanType } from './hooks/useFloorplanImportState';
import type { FloorplanFormat } from './hooks/useFloorplanSmartUpload';
import type { CadLinkableEntityType } from '@/config/domain-constants';
import type { SceneUnits } from '@/subapps/dxf-viewer/utils/scene-units';
import '@/lib/design-system';

// =============================================================================
// TYPES
// =============================================================================

/** Context passed to onComplete — lets callers configure auto-save with correct entity info */
export interface WizardCompleteMeta {
  companyId: string;
  projectId?: string;
  /**
   * The wizard's selection level — narrowed to the CAD-linkable subset, because
   * this value flows verbatim into `DxfSaveContext.entityType` and the
   * `/api/cad-files` payload, whose validator accepts exactly this set.
   */
  entityType: CadLinkableEntityType;
  entityId: string;
  /** ADR-399: building context of the selection (set for floor/building/property
   *  selections) — needed so floor-plan levels carry buildingId for the floor-tab strip. */
  buildingId?: string;
  /**
   * 🔑 **ADR-845 Ο-19 — ο ΟΡΟΦΟΣ ΤΟΥ ΚΤΗΡΙΟΥ που διάλεξε ο άνθρωπος** (`flr_*`,
   * IfcBuildingStorey), για **κάθε** επιλογή που πέρασε από το βήμα «Όροφος» —
   * δηλαδή και για επιλογή **μονάδας**, όπου το `entityId` είναι το ακίνητο.
   *
   * ⚠️ **ΔΕΝ είναι το `selection.levelFloorId`**: εκείνο απαντά *«ποιο επίπεδο της
   * πολυεπίπεδης μονάδας;»* (ADR-236) και είναι **άλλο πράγμα**.
   *
   * ## Γιατί προστέθηκε (μετρημένο 2026-09-09)
   *
   * Ο σωστός όροφος γραφόταν ήδη **στο αρχείο** (`uploadConfig.linkedTo`) και
   * **πεταγόταν** στον δρόμο προς τον viewer: το `entityId` μιας επιλογής μονάδας
   * είναι `prop_*`, οπότε ο `DxfSaveContext` έμενε **χωρίς** `floorId`, ο
   * εισαγωγέας έπεφτε στο **ενεργό** επίπεδο και του έγραφε το **νέο** κτήριο
   * αφήνοντας τον **παλιό** όροφο. Αποτέλεσμα: **3 στα 5** δεμένα επίπεδα δήλωναν
   * κτήριο που δεν περιέχει τον όροφό τους — και, επειδή το `floorId` είναι το
   * κλειδί εμβέλειας κάθε BIM οντότητας (ADR-420), **17 υποστυλώματα + 1 σκάλα**
   * αποθηκεύτηκαν σε ορόφους ξένων κτηρίων.
   */
  floorId?: string;
  /**
   * ADR-236 · ADR-914 — για **πολυεπίπεδη μονάδα**: ο όροφος του επιπέδου της που επιλέχθηκε
   * (π.χ. ο πάνω όροφος μιας μεζονέτας). Διαφέρει από το `floorId` (ο όροφος του βήματος 4).
   */
  levelFloorId?: string;
  purpose: string;
  /** Human-readable entity label (e.g., "Κτήριο Α", "ΣΟΦΙΤΑ") for displayName generation */
  entityLabel?: string;
  /** FileRecord ID created by wizard upload — needed for linkSceneToLevel after refresh */
  fileId?: string;
  /** ADR-340 Phase 4 reborn FOLLOW-UP: payload format — callers must NOT trigger DXF
   * scene wiring (linkSceneToLevel / cadFiles processor) when format !== 'dxf'. */
  format?: FloorplanFormat;
  /** ADR-368 — user-specified DXF coordinate units from the upload step unit selector.
   * Absent when user chose 'auto' or uploaded a non-DXF file. */
  userDrawingUnits?: SceneUnits;
  /** ADR-448 Phase 3 — when true (default), the importer creates viewer Levels for
   * ALL floors of the selected building, not only the targeted floor. No-op when
   * there is no building context (project-level imports). */
  loadAllFloors?: boolean;
}

/**
 * Τι κάνει το βήμα 6: `'import'` = ανέβασμα αρχείου · `'load'` = επιλογή αποθηκευμένου ·
 * `'create'` = επιβεβαίωση νέας ΚΕΝΗΣ κάτοψης (ADR-914).
 */
export type FloorplanWizardMode = 'import' | 'load' | 'create';

interface FloorplanImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  /** Default: `'import'`. */
  mode?: FloorplanWizardMode;
  /** import mode: called when file upload completes */
  onComplete?: (file: File, meta: WizardCompleteMeta) => void;
  /** load mode: called when user picks a saved floorplan. Throws on failure. */
  onLoad?: (fileId: string, meta: WizardCompleteMeta) => Promise<void>;
  /** create mode: called when the user confirms the empty floorplan. Throws on failure. */
  onCreate?: (meta: WizardCompleteMeta) => Promise<void>;
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
  labelKeys: Record<FloorplanWizardMode, string>;
  icon: React.ElementType;
}> = {
  2: {
    type: 'project',
    icon: FolderKanban,
    labelKeys: {
      import: 'floorplanImport.shortcuts.project',
      load: 'floorplanImport.shortcuts.loadProject',
      create: 'floorplanImport.shortcuts.createProject',
    },
  },
  3: {
    type: 'building',
    icon: Building2,
    labelKeys: {
      import: 'floorplanImport.shortcuts.building',
      load: 'floorplanImport.shortcuts.loadBuilding',
      create: 'floorplanImport.shortcuts.createBuilding',
    },
  },
  4: {
    type: 'floor',
    icon: Layers,
    labelKeys: {
      import: 'floorplanImport.shortcuts.floor',
      load: 'floorplanImport.shortcuts.loadFloor',
      create: 'floorplanImport.shortcuts.createFloor',
    },
  },
};

/** Ό,τι αλλάζει στο κέλυφος του οδηγού ανά mode: τίτλος και ετικέτα του τελευταίου βήματος. */
const MODE_CHROME_KEYS: Record<FloorplanWizardMode, { title: string; lastStep: string }> = {
  import: { title: 'floorplanImport.title', lastStep: 'floorplanImport.steps.upload' },
  load: { title: 'floorplanImport.loadTitle', lastStep: 'floorplanImport.steps.select' },
  create: { title: 'floorplanImport.createTitle', lastStep: 'floorplanImport.steps.create' },
};

// =============================================================================
// COMPONENT
// =============================================================================


/**
 * **ΤΑ ΚΛΕΙΔΙΑ ΕΜΒΕΛΕΙΑΣ ΤΟΥ ΟΔΗΓΟΥ — ΜΙΑ ΓΡΑΦΗ** *(ADR-845 Ο-19)*.
 *
 * 🔴 **ΕΞΗΧΘΗ ΕΠΕΙΔΗ ΤΟ ΜΕΤΡΗΣΕ ΠΥΛΗ** *(CHECK 3.28 / jscpd)*: οι **δύο** διαδρομές του
 * οδηγού — *«ανέβασε νέο»* και *«φόρτωσε αποθηκευμένο»* — έχτιζαν το **ίδιο**
 * `WizardCompleteMeta` χωριστά.
 *
 * ⚠️ **Και δεν είναι υποθετικός ο κίνδυνος: ΕΧΕΙ ΗΔΗ ΣΥΜΒΕΙ.** Το ίδιο το σχόλιο της
 * δεύτερης διαδρομής κατέγραφε ότι *«έχανε ΚΑΙ ΤΑ ΔΥΟ κλειδιά εμβέλειας — το ίδιο κλικ,
 * δεύτερο μονοπάτι, ίδια σιωπή»*. Δύο αντίγραφα σημαίνουν ότι το **επόμενο** κλειδί
 * εμβέλειας θα ξεχαστεί ξανά στη μία από τις δύο, και η αστοχία θα είναι πάλι **σιωπηλή**:
 * κάτοψη προσαρτημένη σε λάθος κτήριο δεν βγάζει σφάλμα, βγάζει **λάθος όροφο**.
 */
function scopedWizardMeta(
  cfg: FloorplanUploadConfig,
  selection: FloorplanImportSelection,
): WizardCompleteMeta {
  return {
    companyId: cfg.companyId,
    projectId: cfg.projectId,
    entityType: cfg.entityType as WizardCompleteMeta['entityType'],
    entityId: cfg.entityId,
    // ADR-399 · ADR-845 Ο-19: κτήριο και όροφος ταξιδεύουν ΜΑΖΙ — ποτέ το ένα χωρίς το άλλο.
    buildingId: selection.buildingId ?? undefined,
    floorId: selection.floorId ?? undefined,
    levelFloorId: selection.levelFloorId ?? undefined,
    purpose: cfg.purpose ?? '',
    entityLabel: cfg.entityLabel,
  };
}

export function FloorplanImportWizard({
  isOpen,
  onClose,
  mode = 'import',
  onComplete,
  onLoad,
  onCreate,
}: FloorplanImportWizardProps) {
  const { t, isNamespaceReady } = useTranslation(['files', 'files-media']);

  const state = useFloorplanImportState({ isOpen });

  const notifications = useNotifications();

  // ADR-309 Phase 5: selection state for load mode step 6
  const [selectedStorageFileId, setSelectedStorageFileId] = useState<string | null>(null);
  const [loadingStorage, setLoadingStorage] = useState(false);
  const [creating, setCreating] = useState(false);
  const [corruptFileIds, setCorruptFileIds] = useState<Set<string>>(new Set());

  // ADR-448 Phase 3: import every floor of the selected building (default ON).
  const [loadAllFloors, setLoadAllFloors] = useState(true);

  const stepLabels = useMemo(
    () => [
      ...STEP_LABEL_KEYS.slice(0, 5).map((key) => t(key)),
      t(MODE_CHROME_KEYS[mode].lastStep),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, isNamespaceReady, mode],
  );

  const handleUploadComplete = useCallback((file: File, fileId?: string, format?: FloorplanFormat, userDrawingUnits?: SceneUnits) => {
    // 🏢 ADR-240: Build WizardCompleteMeta from uploadConfig so callers can configure auto-save
    const cfg = state.uploadConfig;
    if (cfg && onComplete) {
      const meta: WizardCompleteMeta = {
        ...scopedWizardMeta(cfg, state.selection),
        fileId,
        format,
        userDrawingUnits,
        loadAllFloors,
      };
      onComplete(file, meta);
    } else {
      onComplete?.(file, {
        companyId: '',
        entityType: 'floor',
        entityId: '',
        purpose: '',
        format,
        userDrawingUnits,
        loadAllFloors,
      });
    }
  }, [onComplete, state.uploadConfig, state.selection.buildingId, state.selection.floorId, loadAllFloors]);

  const handleClose = useCallback(() => {
    state.reset();
    setSelectedStorageFileId(null);
    setLoadingStorage(false);
    setCreating(false);
    setCorruptFileIds(new Set());
    setLoadAllFloors(true);
    onClose();
  }, [state, onClose]);

  const handleConfirmLoad = useCallback(async () => {
    if (!selectedStorageFileId || !state.uploadConfig) return;
    const cfg = state.uploadConfig;
    const meta: WizardCompleteMeta = scopedWizardMeta(cfg, state.selection);
    setLoadingStorage(true);
    try {
      await onLoad?.(selectedStorageFileId, meta);
      handleClose();
    } catch {
      setCorruptFileIds((prev) => new Set(prev).add(selectedStorageFileId));
      setSelectedStorageFileId(null);
      notifications.error(t('floorplanImport.storagePicker.corruptFile'));
    } finally {
      setLoadingStorage(false);
    }
  }, [
    selectedStorageFileId, state.uploadConfig, state.selection.buildingId,
    state.selection.floorId, onLoad, handleClose, notifications, t,
  ]);

  // ADR-914 — mode 'create': το ίδιο `scopedWizardMeta` με τις άλλες δύο διαδρομές, χωρίς αρχείο.
  const handleConfirmCreate = useCallback(async () => {
    if (!state.uploadConfig || !onCreate) return;
    const meta: WizardCompleteMeta = scopedWizardMeta(state.uploadConfig, state.selection);
    setCreating(true);
    try {
      await onCreate(meta);
      handleClose();
    } catch {
      notifications.error(t('floorplanImport.create.error'));
      setCreating(false);
    }
  }, [state.uploadConfig, state.selection, onCreate, handleClose, notifications, t]);

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
  const shortcutLabelKey = shortcutConfig?.labelKeys[mode];

  // Navigate to a completed step by clicking its number
  const handleStepClick = useCallback((targetStep: number) => {
    state.goToStep(targetStep);
  }, [state]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-2xl" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{t(MODE_CHROME_KEYS[mode].title)}</DialogTitle>
          <DialogDescription className="sr-only">{t(MODE_CHROME_KEYS[mode].title)}</DialogDescription>
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

          {/* ADR-448 Phase 3: building step → import every floor of the building */}
          {mode === 'import' && state.step === 3 && !!state.selection.buildingId && (
            <label className="mt-4 flex items-start gap-2 cursor-pointer">
              <Checkbox
                checked={loadAllFloors}
                onCheckedChange={(checked) => setLoadAllFloors(checked === true)}
                className="mt-0.5"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{t('floorplanImport.allFloors.label')}</span>
                <span className="text-xs text-muted-foreground">{t('floorplanImport.allFloors.hint')}</span>
              </span>
            </label>
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
              onComplete={(file, fileId, format, userDrawingUnits) => handleUploadComplete(file, fileId, format, userDrawingUnits)}
            />
          )}

          {/* Step 6: Pick from storage (load mode) */}
          {mode === 'load' && state.step === 6 && state.uploadConfig && (
            <StepStoragePicker
              uploadConfig={state.uploadConfig}
              selectedFileId={selectedStorageFileId}
              onFileSelected={setSelectedStorageFileId}
              corruptFileIds={corruptFileIds}
            />
          )}

          {/* Step 6: Confirm the empty floorplan (create mode, ADR-914) */}
          {mode === 'create' && state.step === 6 && state.uploadConfig && (
            <StepCreateConfirm selection={state.selection} />
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

            {mode === 'create' && state.step === 6 && (
              <Button onClick={handleConfirmCreate} disabled={!state.uploadConfig || creating}>
                {creating ? t('floorplanImport.create.creating') : t('floorplanImport.create.confirm')}
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
