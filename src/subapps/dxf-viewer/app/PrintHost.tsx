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
import { buildSheetSet, type SheetSetSource } from '../text-engine/title-block/sheet-set';
import { hasTitleBlockEntity } from '../text-engine/title-block/title-block-def';
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
  const { currentLevelId, levels, getLevelScene } = useLevels();
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
  const titleBlockLocale = toTitleBlockLocale(i18n.language);

  const handleSubmit = React.useCallback(
    async (request: PrintRequest) => {
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
      // αυτόματη αρίθμηση + ίδια πινακίδα (2Δ μόνο· ο διάλογος δεν το προσφέρει για 3Δ).
      if (request.wholeSet && sheetSources.length >= 2) {
        const set = buildSheetSet(sheetSources, { locale: titleBlockLocale });
        await runPrintSet(request, deps, set.sheets);
        return;
      }
      await runPrint(request, deps);
    },
    [scene, projectName, titleBlockLocale, sheetSources],
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
      onSubmit={handleSubmit}
    />
  );
}
