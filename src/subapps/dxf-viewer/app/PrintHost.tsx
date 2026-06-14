'use client';

/**
 * ADR-453 — Print/Export host (lifecycle owner for the «Εκτύπωση» dialog).
 *
 * Mirror of `BimScheduleHost`: subscribes to the ribbon EventBus signal, owns
 * the dialog open state, gathers live deps (current scene, drawing name, date)
 * and routes a submitted `PrintRequest` through the SSoT `runPrint` facade.
 *
 * 3D capture wiring is added in Slice 3 (`canPrint3d` + `deps.capture3d`).
 *
 * Mounted as a React.Suspense leaf in `DxfViewerDialogs`. ADR-040: zero canvas
 * subscriptions, zero useSyncExternalStore.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-453-dxf-print-export-engine.md
 */

import * as React from 'react';

import { EventBus } from '../systems/events/EventBus';
import { useLevels } from '../systems/levels';
import { useCurrentSceneModel } from '../ui/text-toolbar/hooks/useCurrentSceneModel';
import { nowISO } from '@/lib/date-local';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { runPrint, type PrintDeps, type PrintRequest } from '../print';
import { getActiveSceneManager } from '../bim-3d/scene/active-scene-manager-registry';
import { captureCurrent3dView } from '../print/capture/capture-3d';
import { PrintDialog } from '../ui/components/print/PrintDialog';

export function PrintHost(): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-shell');
  const [open, setOpen] = React.useState(false);
  const scene = useCurrentSceneModel();
  const { currentLevelId, levels } = useLevels();

  // Ribbon «Εκτύπωση» → action 'open-print-dialog' → EventBus → open.
  React.useEffect(() => EventBus.on('dxf:print-dialog-requested', () => setOpen(true)), []);

  // 3D source is available only while a 3D scene is mounted. Read at render time
  // (re-evaluated each time the dialog opens via setOpen → re-render).
  const sceneManager3d = getActiveSceneManager();
  const canPrint3d = sceneManager3d !== null;

  const projectName = React.useMemo(() => {
    const level = levels.find((l) => l.id === currentLevelId);
    return level?.name ?? level?.sceneFileName ?? 'drawing';
  }, [levels, currentLevelId]);

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
        titleBlock: {
          project: projectName,
          labels: {
            scale: t('print.titleBlock.scale'),
            date: t('print.titleBlock.date'),
            sheet: t('print.titleBlock.sheet'),
          },
        },
      };
      await runPrint(request, deps);
    },
    [scene, projectName, t],
  );

  return (
    <PrintDialog open={open} onOpenChange={setOpen} canPrint3d={canPrint3d} onSubmit={handleSubmit} />
  );
}
