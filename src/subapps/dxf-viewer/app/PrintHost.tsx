'use client';

/**
 * ADR-453 — Print/Export host (lifecycle owner for the «Εκτύπωση» dialog).
 *
 * Mirror of `BimScheduleHost`: subscribes to the ribbon EventBus signal, owns
 * the dialog open state, gathers live deps (current scene, drawing name, date)
 * and routes a submitted `PrintRequest` through the SSoT `runPrint` facade.
 *
 * **ADR-651 Φάση ΣΤ** — ο host δεν συνθέτει πια πινακίδα: (α) **προ-φορτώνει** το Firestore
 * scope μόλις ανοίξει ο διάλογος (ίδιο cache με το in-scene εργαλείο ⇒ owner/θέση/εργοδότης/
 * ΑΜ ΤΕΕ φτάνουν στο PDF, χωρίς `await` στο μονοπάτι εκτύπωσης), (β) περνά τη **γλώσσα**
 * του προτύπου, και (γ) ανιχνεύει αν το σχέδιο **δεν** έχει πινακίδα ώστε ο διάλογος να την
 * προτείνει (Απόφαση #10β). Ό,τι άλλο (preset/κορνίζα/δεδομένα) το διαβάζει το print engine
 * από τους ίδιους SSoT που τροφοδοτούν την οθόνη.
 *
 * Mounted as a React.Suspense leaf in `DxfViewerDialogs`. ADR-040: zero canvas
 * subscriptions, zero useSyncExternalStore.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-453-dxf-print-export-engine.md
 * @see docs/centralized-systems/reference/adrs/ADR-651-auto-title-block-generator.md
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { useEventGatedDialog } from './dialog-hosts/useEventGatedDialog';
import { useLevels } from '../systems/levels';
import { useProjectHierarchyOptional } from '../contexts/ProjectHierarchyContext';
import { useCurrentSceneModel } from '../ui/text-toolbar/hooks/useCurrentSceneModel';
import { nowISO } from '@/lib/date-local';
import { runPrint, runPrintSet, type PrintDeps, type PrintRequest } from '../print';
import { loadTitleBlockAssets } from '../text-engine/title-block/active-title-block';
import { sheetLevelUpdates } from '../text-engine/title-block/sheet-edits';
import {
  buildSheetRows,
  buildSheetSet,
  type SheetIdentityEdits,
  type SheetSetSource,
} from '../text-engine/title-block/sheet-set';
import { drawingExtentMmOf } from '../text-engine/title-block/suggest-paper';
import { hasTitleBlockEntity } from '../text-engine/title-block/title-block-def';
import { resolveSceneUnits } from '../utils/scene-units';
import { toTitleBlockLocale } from '../text-engine/title-block/title-block-presets';
import { getActiveSceneManager } from '../bim-3d/scene/active-scene-manager-registry';
import { captureCurrent3dView } from '../print/capture/capture-3d';
import { PrintDialog } from '../ui/components/print/PrintDialog';

/**
 * Thin gate (ADR-532 Stage 3): listens for «Εκτύπωση» and mounts the dialog body
 * ONLY while open. Closed → `null` (was re-rendering PrintDialog while closed).
 * Same SSoT gate as ExportHost — the two are mirrors (ADR-453/505).
 */
export function PrintHost(): React.ReactElement | null {
  const { open, close } = useEventGatedDialog('dxf:print-dialog-requested');
  if (!open) return null;
  return <PrintBody onClose={close} />;
}

function PrintBody({ onClose }: { readonly onClose: () => void }): React.JSX.Element {
  const { i18n } = useTranslation();
  const scene = useCurrentSceneModel();
  const { currentLevelId, levels, getLevelScene, updateLevelContext } = useLevels();
  const hierarchy = useProjectHierarchyOptional();
  const projectId = hierarchy?.selectedProject?.id;

  // ADR-651 Φάση Ζ — το σετ φύλλων παράγεται από τα levels που έχουν φορτωμένο scene
  // (ίδιο μοτίβο με το ExportHost). Ταξινομημένα σταθερά (`Level.order`) ⇒ ντετερμινιστική
  // αρίθμηση Α-1/Α-2… στη σειρά που ο χρήστης βλέπει τους ορόφους.
  const sheetSources = React.useMemo<SheetSetSource[]>(() => {
    return [...levels]
      .sort((a, b) => a.order - b.order)
      .map((level) => ({ level, scene: getLevelScene(level.id) }))
      .filter((entry): entry is SheetSetSource => entry.scene !== null);
  }, [levels, getLevelScene]);

  // 3D source is available only while a 3D scene is mounted (read at open-time).
  const sceneManager3d = getActiveSceneManager();
  const canPrint3d = sceneManager3d !== null;

  // Filename identity — stays drawing-scoped (level name), unchanged behaviour.
  const projectName = React.useMemo(() => {
    const level = levels.find((l) => l.id === currentLevelId);
    return level?.name ?? level?.sceneFileName ?? 'drawing';
  }, [levels, currentLevelId]);

  // Zero-config auto-fill (Απόφαση #4): στοιχεία έργου **και** εικόνα σφραγίδας (Φάση Ε)
  // φορτώνονται ΜΙΑ φορά με το άνοιγμα του διαλόγου (idempotent cache) ⇒ το «Εκτύπωση»
  // λύνει το πρότυπο και ζωγραφίζει τη σφραγίδα **σύγχρονα**, χωρίς `await` στο PDF path.
  React.useEffect(() => {
    void loadTitleBlockAssets(projectId);
  }, [projectId]);

  // Απόφαση #10β — «λείπει πινακίδα»: ο διάλογος το λέει και την προσθέτει (checkbox ναι).
  const titleBlockMissing = !hasTitleBlockEntity(scene?.entities ?? []);

  // ADR-651 §8 #9 — «ποιο φύλλο χρειάζεται αυτό το σχέδιο;»: το bbox σε **mm μοντέλου** (το scene
  // μπορεί να είναι σε μέτρα — ADR-368/462), ώστε ο διάλογος να προτείνει χαρτί με την ΙΔΙΑ καθαρή
  // συνάρτηση που χρησιμοποιεί ήδη το in-scene εργαλείο πινακίδας. Μία φορά ανά άνοιγμα διαλόγου.
  const drawingExtentMm = React.useMemo(
    () => (scene ? drawingExtentMmOf(scene.entities ?? [], resolveSceneUnits(scene)) : null),
    [scene],
  );
  const titleBlockLocale = toTitleBlockLocale(i18n.language);

  // ADR-651 Φάση Ι — οι γραμμές του πίνακα φύλλων (αριθμός/τίτλος ανά όροφο). Ίδια πηγή,
  // ίδια σειρά με το σετ που θα τυπωθεί ⇒ ό,τι βλέπει ο χρήστης είναι ό,τι τυπώνεται.
  const sheetRows = React.useMemo(
    () => buildSheetRows(sheetSources, { locale: titleBlockLocale }),
    [sheetSources, titleBlockLocale],
  );

  /**
   * ADR-651 Φάση Ι — οι αλλαγές ταυτότητας φύλλων **persist-άρουν στους ορόφους** (ο τίτλος στο
   * `entityLabel`, ο αριθμός στο `sheetNumberOverride`) μέσω του ΥΠΑΡΧΟΝΤΟΣ `updateLevelContext`
   * (ADR-286 gateway· ένα write ανά **όντως** αλλαγμένο όροφο ⇒ idempotent). `await` ΠΡΙΝ την
   * εκτύπωση: το PDF τυπώνεται με τα edits ρητά περασμένα, οπότε δεν εξαρτάται ποτέ από το
   * πότε θα γυρίσει το Firestore snapshot (N.7.2 #2 — μηδέν race).
   */
  const persistSheetEdits = React.useCallback(
    async (edits: SheetIdentityEdits): Promise<void> => {
      const updates = sheetLevelUpdates(sheetRows, edits);
      await Promise.all(
        updates.map(({ levelId, entityLabel, sheetNumberOverride }) =>
          updateLevelContext(levelId, { entityLabel, sheetNumberOverride }),
        ),
      );
    },
    [sheetRows, updateLevelContext],
  );

  const handleSubmit = React.useCallback(
    async (request: PrintRequest, edits: SheetIdentityEdits) => {
      const manager = getActiveSceneManager();
      const deps: PrintDeps = {
        scene,
        projectName,
        dateStr: nowISO().slice(0, 10),
        capture3d: manager
          ? async (raster) => captureCurrent3dView(manager, raster)
          : undefined,
        titleBlockLocale,
      };
      // ADR-651 Φάση Ζ — «όλο το σετ»: ένα πολυσέλιδο PDF, ένα φύλλο ανά όροφο, με
      // αρίθμηση + ίδια πινακίδα (2Δ μόνο· ο διάλογος δεν το προσφέρει για 3Δ).
      if (request.wholeSet && sheetSources.length >= 2) {
        await persistSheetEdits(edits);
        const set = buildSheetSet(sheetSources, { locale: titleBlockLocale, edits });
        await runPrintSet(request, deps, set.sheets);
        return;
      }
      await runPrint(request, deps);
    },
    [scene, projectName, titleBlockLocale, sheetSources, persistSheetEdits],
  );

  const handleOpenChange = React.useCallback(
    (next: boolean) => { if (!next) onClose(); },
    [onClose],
  );

  return (
    <PrintDialog
      open
      onOpenChange={handleOpenChange}
      canPrint3d={canPrint3d}
      titleBlockMissing={titleBlockMissing}
      sheetCount={sheetSources.length}
      sheetRows={sheetRows}
      drawingExtentMm={drawingExtentMm}
      onSubmit={handleSubmit}
    />
  );
}
