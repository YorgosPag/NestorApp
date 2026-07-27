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
 *   3. Owns την κατάσταση εμφάνισης των ΥΠΑΡΧΟΝΤΩΝ section components (μηδέν νέα φόρμα,
 *      μέγιστο SSoT) — σε δύο ΔΙΑΦΟΡΕΤΙΚΑ κελύφη, και ο διαχωρισμός είναι σημασιολογικός:
 *        • **modal `Dialog`** για τις ΦΟΡΜΕΣ (import / γεωαναφορά / παραδοτέα): συμπληρώνεις,
 *          πατάς, τελείωσες — δεν μιλούν για ό,τι είναι από πίσω.
 *        • **`TopoReviewPanel`** (floating, ADR-650 M5α.2/M8β/Γ) για τα REVIEW surfaces
 *          (QA / αυτόματες ασυνέχειες / όγκοι / νέφος): καθένα τους χρειάζεται τον καμβά
 *          ΖΩΝΤΑΝΟ όσο είναι ανοιχτό — βλ. το docblock του `TopoReviewPanel` για το γιατί.
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
import { Bell, Cloud, Mountain, Sparkles } from 'lucide-react';
import { EventBus } from '../systems/events/EventBus';
import { useTopoContours } from '../systems/topography/useTopoContours';
import { useTopoGrid } from '../systems/topography/useTopoGrid';
import { useNorthArrow } from '../systems/topography/useNorthArrow';
import { useTopoPointLabels } from '../systems/topography/useTopoPointLabels';
import { useTopoSurfaceEntity } from '../systems/topography/useTopoSurfaceEntity';
import { TopoGeoReferenceSection } from '../ui/panels/topography/TopoGeoReferenceSection';
// ADR-650 §M10g — το ορατό μισό του fail-closed: ψημένα προϊόντα άγνωστου πλαισίου.
import { TopoFrameNotice } from '../ui/panels/topography/TopoFrameNotice';
import { TopoDeliverablesSection } from '../ui/panels/topography/TopoDeliverablesSection';
import { TopoImportWizard } from '../ui/panels/topography/TopoImportWizard';
// ADR-662 Φ4 — τα review sections αποσύρθηκαν από το αριστερό panel → εδώ.
// ADR-650 M5α.2/M8β/Γ — και τα ΤΕΣΣΕΡΑ πλέον ως `TopoReviewPanel` (floating), όχι modal dialog:
// καθένα τους μιλά για τον καμβά ΠΟΥ ΕΙΝΑΙ ΑΠΟ ΠΙΣΩ και τον χρειάζεται ζωντανό όσο είναι ανοιχτό
// (zoom σε εύρημα · έμφαση υποψήφιας · επιλογή ορίου με κλικ στο σχέδιο · έλεγχος του νέφους).
// Οι φόρμες (εισαγωγή/γεωαναφορά/παραδοτέα) ΜΕΝΟΥΝ modal: δεν μιλούν για ό,τι είναι από πίσω.
import { TopoQaSection } from '../ui/panels/topography/TopoQaSection';
import { TopoAutoBreaklineSection } from '../ui/panels/topography/TopoAutoBreaklineSection';
import { TopoCutFillSection } from '../ui/panels/topography/TopoCutFillSection';
import { TopoCloud3DSection } from '../ui/panels/topography/TopoCloud3DSection';
import { TopoReviewPanel } from '../ui/panels/topography/TopoReviewPanel';
import { runTopoRibbonAction, type TopoRibbonDeps } from './topo-ribbon-actions';

/**
 * Cascade slots for the review panels. Fixed per panel (not «order opened»): a panel must reopen
 * where the engineer last saw it, and a slot that shuffled with the open order would move it.
 */
const REVIEW_SLOT = { qa: 0, autoBreakline: 1, cutFill: 2, cloud: 3 } as const;

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
          <TopoFrameNotice />
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
      {qaOpen && (
        <TopoReviewPanel
          title={t('ribbon.commands.topo.qaRun.dialogTitle')}
          icon={<Bell className="text-[hsl(var(--text-warning))]" />}
          onClose={() => setQaOpen(false)}
          stackIndex={REVIEW_SLOT.qa}
          testId="topo-qa-panel"
        >
          <TopoQaSection />
        </TopoReviewPanel>
      )}
      {autoBreaklineOpen && (
        <TopoReviewPanel
          title={t('ribbon.commands.topo.autoBreakline.dialogTitle')}
          icon={<Sparkles />}
          onClose={() => setAutoBreaklineOpen(false)}
          stackIndex={REVIEW_SLOT.autoBreakline}
          testId="topo-auto-breakline-panel"
        >
          <TopoAutoBreaklineSection />
        </TopoReviewPanel>
      )}
      {cutFillOpen && (
        <TopoReviewPanel
          title={t('ribbon.commands.topo.cutFill.dialogTitle')}
          icon={<Mountain />}
          onClose={() => setCutFillOpen(false)}
          stackIndex={REVIEW_SLOT.cutFill}
          testId="topo-cut-fill-panel"
        >
          <TopoCutFillSection />
        </TopoReviewPanel>
      )}
      {cloudOpen && (
        <TopoReviewPanel
          title={t('ribbon.commands.topo.cloud.dialogTitle')}
          icon={<Cloud />}
          onClose={() => setCloudOpen(false)}
          stackIndex={REVIEW_SLOT.cloud}
          testId="topo-cloud-panel"
        >
          <TopoCloud3DSection />
        </TopoReviewPanel>
      )}
    </>
  );
}
