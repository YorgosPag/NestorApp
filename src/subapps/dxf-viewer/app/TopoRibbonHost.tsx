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
import { FloatingPanel } from '@/components/ui/floating';
import { Bell } from 'lucide-react';
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

/** QA panel size — width drives the bounds clamp; height is the max for the scroll list. */
const TOPO_QA_PANEL_DIMENSIONS = { width: 320, height: 460 };

/**
 * Default spot: right edge, BELOW the ViewCube / 3D toggle (both top-right) and clear of the left
 * layers panel — the same reasoning as `ClashReportPanel`'s default. Draggable from there.
 */
function getTopoQaPanelPosition(): { x: number; y: number } {
  const margin = 16;
  return { x: window.innerWidth - TOPO_QA_PANEL_DIMENSIONS.width - margin, y: 200 };
}

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
      {/* ADR-650 M5α.2 — the QA report is the ONE topo review surface that must NOT be a dialog at
          all. It is a *companion* to the canvas, not a detour from it: every row click zooms the
          view to its finding, and the engineer keeps editing entities while walking the list. A
          Radix dialog is the wrong primitive for that on three counts — it dims the canvas, it
          traps the keyboard, and (even with `modal={false}`) it closes on the first outside click,
          i.e. the moment you touch the very drawing it is talking about. So it uses the same
          `FloatingPanel` SSoT the clash report uses: draggable, no backdrop, no outside-click
          dismissal — closed only by its own ✕. */}
      {qaOpen && (
        <FloatingPanel
          defaultPosition={getTopoQaPanelPosition()}
          dimensions={TOPO_QA_PANEL_DIMENSIONS}
          onClose={() => setQaOpen(false)}
          draggableOptions={{ getClientPosition: getTopoQaPanelPosition }}
          className="z-[9999] w-80"
          data-testid="topo-qa-panel"
        >
          <FloatingPanel.Header showClose icon={<Bell className="text-[hsl(var(--text-warning))]" />}>
            <h3 className="m-0 flex-1 text-sm font-semibold text-foreground">
              {t('ribbon.commands.topo.qaRun.dialogTitle')}
            </h3>
          </FloatingPanel.Header>
          <FloatingPanel.Content className="flex max-h-[60vh] flex-col overflow-y-auto">
            <TopoQaSection />
          </FloatingPanel.Content>
        </FloatingPanel>
      )}
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
