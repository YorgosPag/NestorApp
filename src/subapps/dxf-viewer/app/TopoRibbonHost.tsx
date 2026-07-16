'use client';

/**
 * TOPO RIBBON HOST — ADR-662 Φάση 1 permanent «Τοπογραφικό» tab bridge.
 *
 * Lifecycle owner που κάνει τα ribbon topo commands να καλούν τα ΥΠΑΡΧΟΝΤΑ topo
 * hooks/stores — μηδέν νέα λογική:
 *   1. Mounts the topo authoring hooks (`useTopoContours`/`useTopoGrid`/`useNorthArrow`/
 *      `useTopoPointLabels`) ώστε τα bake/generate να τρέχουν με το τρέχον level context
 *      (τα hooks εξαρτώνται από `useLevels()` — γι' αυτό ζουν εδώ, εντός React tree).
 *   2. Listen σε `topo:ribbon-action` (ribbon action → dxf-special-actions → EventBus) →
 *      `runTopoRibbonAction` δρομολογεί το `topo.*` key στο ready hook/store call.
 *   3. Owns dialog state για τις form-heavy εντολές (import / γεωαναφορά / παραδοτέα):
 *      ανοίγει τα ΥΠΑΡΧΟΝΤΑ section components σε dialog (section-in-dialog = μηδέν νέα
 *      φόρμα, μέγιστο SSoT). Το `TopoImportWizard` είναι ήδη modal.
 *
 * Mounted ως always-on Suspense leaf στο `DxfViewerDialogs` (mirror του `BimScheduleHost`).
 * ADR-040: zero canvas subscriptions· τα mounted hooks είναι LOW-freq (level context μόνο).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-662-topography-ribbon-migration.md
 */

import * as React from 'react';
import { useTranslation } from '@/i18n';
import { useNotifications } from '@/providers/NotificationProvider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EventBus } from '../systems/events/EventBus';
import { useTopoContours } from '../systems/topography/useTopoContours';
import { useTopoGrid } from '../systems/topography/useTopoGrid';
import { useNorthArrow } from '../systems/topography/useNorthArrow';
import { useTopoPointLabels } from '../systems/topography/useTopoPointLabels';
import { useTopoSurfaceEntity } from '../systems/topography/useTopoSurfaceEntity';
import { TopoGeoReferenceSection } from '../ui/panels/topography/TopoGeoReferenceSection';
import { TopoDeliverablesSection } from '../ui/panels/topography/TopoDeliverablesSection';
import { TopoImportWizard } from '../ui/panels/topography/TopoImportWizard';
// ADR-662 Φ4 — τα review sections αποσύρθηκαν από το αριστερό panel → section-in-dialog εδώ
// (mirror γεωαναφορά/παραδοτέα). Τα ΙΔΙΑ components, χωρίς καμία αλλαγή (κρατούν τα δικά τους controls).
import { TopoQaSection } from '../ui/panels/topography/TopoQaSection';
import { TopoAutoBreaklineSection } from '../ui/panels/topography/TopoAutoBreaklineSection';
import { TopoCutFillSection } from '../ui/panels/topography/TopoCutFillSection';
import { TopoCloud3DSection } from '../ui/panels/topography/TopoCloud3DSection';
import { runTopoRibbonAction, type TopoRibbonDeps } from './topo-ribbon-actions';

export function TopoRibbonHost(): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-shell');
  const notifications = useNotifications();
  const contours = useTopoContours();
  const grid = useTopoGrid();
  const north = useNorthArrow();
  const pointLabels = useTopoPointLabels();
  const surface = useTopoSurfaceEntity();

  const [importOpen, setImportOpen] = React.useState(false);
  const [geoRefOpen, setGeoRefOpen] = React.useState(false);
  const [deliverablesOpen, setDeliverablesOpen] = React.useState(false);
  // ADR-662 Φ4 — review dialogs (QA / auto-breakline / cut-fill / cloud).
  const [qaOpen, setQaOpen] = React.useState(false);
  const [autoBreaklineOpen, setAutoBreaklineOpen] = React.useState(false);
  const [cutFillOpen, setCutFillOpen] = React.useState(false);
  const [cloudOpen, setCloudOpen] = React.useState(false);

  // Fresh deps snapshot every render → the once-registered EventBus listener always
  // reads the latest hook callbacks / dialog openers (useEventCallback identity pattern).
  const depsRef = React.useRef<TopoRibbonDeps>();
  depsRef.current = {
    contours, grid, north, pointLabels, surface,
    notify: { success: (m) => notifications.success(m), error: (m) => notifications.error(m) },
    t,
    openImport: () => setImportOpen(true),
    openGeoRef: () => setGeoRefOpen(true),
    openDeliverables: () => setDeliverablesOpen(true),
    openQa: () => setQaOpen(true),
    openAutoBreakline: () => setAutoBreaklineOpen(true),
    openCutFill: () => setCutFillOpen(true),
    openCloud: () => setCloudOpen(true),
  };

  React.useEffect(() => EventBus.on('topo:ribbon-action', ({ action }) => {
    if (depsRef.current) runTopoRibbonAction(action, depsRef.current);
  }), []);

  return (
    <>
      {importOpen && (
        <TopoImportWizard onClose={() => setImportOpen(false)} onImported={() => setImportOpen(false)} />
      )}
      <Dialog open={geoRefOpen} onOpenChange={setGeoRefOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('ribbon.commands.topo.geoRef.dialogTitle')}</DialogTitle>
          </DialogHeader>
          <TopoGeoReferenceSection />
        </DialogContent>
      </Dialog>
      <Dialog open={deliverablesOpen} onOpenChange={setDeliverablesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('ribbon.commands.topo.deliverables.dialogTitle')}</DialogTitle>
          </DialogHeader>
          <TopoDeliverablesSection />
        </DialogContent>
      </Dialog>
      <Dialog open={qaOpen} onOpenChange={setQaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('ribbon.commands.topo.qaRun.dialogTitle')}</DialogTitle>
          </DialogHeader>
          <TopoQaSection />
        </DialogContent>
      </Dialog>
      <Dialog open={autoBreaklineOpen} onOpenChange={setAutoBreaklineOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('ribbon.commands.topo.autoBreakline.dialogTitle')}</DialogTitle>
          </DialogHeader>
          <TopoAutoBreaklineSection />
        </DialogContent>
      </Dialog>
      <Dialog open={cutFillOpen} onOpenChange={setCutFillOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('ribbon.commands.topo.cutFill.dialogTitle')}</DialogTitle>
          </DialogHeader>
          <TopoCutFillSection />
        </DialogContent>
      </Dialog>
      <Dialog open={cloudOpen} onOpenChange={setCloudOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('ribbon.commands.topo.cloud.dialogTitle')}</DialogTitle>
          </DialogHeader>
          <TopoCloud3DSection />
        </DialogContent>
      </Dialog>
    </>
  );
}
