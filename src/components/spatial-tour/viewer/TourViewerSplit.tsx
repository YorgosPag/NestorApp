'use client';

/**
 * @fileoverview **ΠΑΝΟΡΑΜΑ | ΣΤΗΛΗ ΚΑΤΟΨΕΩΝ, με συρόμενη διαχωριστική** (ADR-884 Φ2στ-γ Γ2 · §4.14 σημείο 3).
 * @related `@/components/ui/resizable` (ο ΕΝΑΣ wrapper της `react-resizable-panels`, ADR-724) ·
 *   `@/components/ui/resizable-persistence` (**πότε** γράφεται το πλάτος) · `tour-viewer-layout-store.ts` (**τι** και **πού**)
 * @module components/spatial-tour/viewer/TourViewerSplit
 *
 * 🏆 **Όπως η Zillow 3D Home**: η στήλη σέρνεται, και ένα κουμπί κάτω δεξιά στη σκηνή την κρύβει/φέρνει πίσω — το
 *   πανόραμα γεμίζει τότε όλη την επιφάνεια. Δωρεάν από τη βιβλιοθήκη: WAI-ARIA separator, βέλη/Home/End, `Enter` =
 *   σύμπτυξη, διπλό κλικ = επαναφορά στο αποθηκευμένο πλάτος.
 * 🔑 **px, όχι ποσοστά** + `preserve-pixel-size`: μεγαλώνει το παράθυρο ⇒ τον χώρο τον παίρνει το **πανόραμα**, η στήλη
 *   κρατά τα pixel της (Revit · VS Code · ADR-724 §5.2). Το πανόραμα δεν στενεύει κάτω από `STAGE_MIN_WIDTH`.
 * 🔑 **Σύρσιμο κάτω από το ελάχιστο ⇒ σύμπτυξη** (`collapsible`), ίδια κατάσταση με το κουμπί — ένας κάτοχος, το panel.
 * ⌨️ Τα βέλη του διαχωριστικού **δεν** τα «τρώει» το πανόραμα: ο χειριστής πληκτρολογίου του ζει στον **καμβά**
 *   (`useTourPanoramaInput`), όχι σε `window` — δεν χρειάζεται φύλακας (αντίθετα με τον DXF viewer, ADR-724 §5.2.1).
 */

import { type ReactNode, useCallback, useRef, useState } from 'react';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  THIN_SEPARATOR_CLASS, ResizableHandle, ResizablePanel, ResizablePanelGroup, usePanelRef, type PanelSize,
} from '@/components/ui/resizable';
import { usePanelWidthPersistence } from '@/components/ui/resizable-persistence';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import { SPATIAL_TOUR_NS } from '../spatial-tour-namespace';
import { TOUR_PLAN_COLUMN, readTourPlanColumn, writeTourPlanColumn } from './tour-viewer-layout-store';
import { TOUR_VIEWER_KEYS } from './tour-viewer-labels';

/** Σταθερά για πάντα — ταυτότητες των panels στη βιβλιοθήκη. */
const STAGE_PANEL_ID = 'tour-stage';
const COLUMN_PANEL_ID = 'tour-plan-column';
/** Το πανόραμα δεν στενεύει κάτω από αυτό (px) — υπερισχύει του `widthMax` της στήλης σε στενές οθόνες. */
const STAGE_MIN_WIDTH = 360;


export interface TourViewerSplitProps {
  /** Η σκηνή (πανόραμα + όνομα χώρου). */
  readonly stage: ReactNode;
  /** Η στήλη ορόφων/κατόψεων. */
  readonly column: ReactNode;
}

function ColumnToggle({ collapsed, onToggle }: { readonly collapsed: boolean; readonly onToggle: () => void }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const label = t(collapsed ? TOUR_VIEWER_KEYS.planColumnShow : TOUR_VIEWER_KEYS.planColumnHide);
  const Icon = collapsed ? PanelRightOpen : PanelRightClose;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" size="icon" variant="secondary" className="absolute bottom-3 right-3 h-9 w-9 shadow"
          onClick={onToggle} aria-label={label} aria-expanded={!collapsed} aria-controls={COLUMN_PANEL_ID}>
          <Icon aria-hidden className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function TourViewerSplit({ stage, column }: TourViewerSplitProps) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  // Διαβάζεται ΜΙΑ φορά: το `defaultSize` είναι αρχική τιμή — και στόχος του διπλού κλικ («επαναφορά στο αποθηκευμένο»).
  const [initial] = useState(readTourPlanColumn);
  const [collapsed, setCollapsed] = useState(initial.collapsed);
  const collapsedNow = useRef(initial.collapsed);
  const panel = usePanelRef();
  const persistence = usePanelWidthPersistence(writeTourPlanColumn, initial.width);

  // ~60/δευτ. κατά το σύρσιμο: μόνο `ref`· render **μόνο** όταν αλλάζει το «κρυμμένη;» (για το κουμπί).
  const onResize = useCallback((size: PanelSize) => {
    persistence.onResize(size);
    const now = size.inPixels < 1;
    if (now === collapsedNow.current) return;
    collapsedNow.current = now;
    setCollapsed(now);
  }, [persistence]);

  const toggle = useCallback(() => {
    const handle = panel.current;
    if (handle === null) return;
    if (handle.isCollapsed()) handle.resize(readTourPlanColumn().width);
    else handle.collapse();
    persistence.persistSoon();
  }, [panel, persistence]);

  return (
    <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1" onLayoutChanged={persistence.onLayoutChanged}>
      <ResizablePanel id={STAGE_PANEL_ID} minSize={STAGE_MIN_WIDTH} className="relative flex min-w-0 flex-col">
        {stage}
        <ColumnToggle collapsed={collapsed} onToggle={toggle} />
      </ResizablePanel>
      <ResizableHandle aria-label={t(TOUR_VIEWER_KEYS.resizeColumn)} className={THIN_SEPARATOR_CLASS} {...persistence.separatorProps} />
      <ResizablePanel id={COLUMN_PANEL_ID} panelRef={panel} elementRef={persistence.elementRef}
        defaultSize={initial.collapsed ? 0 : initial.width} minSize={TOUR_PLAN_COLUMN.widthMin} maxSize={TOUR_PLAN_COLUMN.widthMax}
        collapsible collapsedSize={0} groupResizeBehavior="preserve-pixel-size" onResize={onResize}
        className="min-w-0 overflow-y-auto border-l border-border bg-background">
        <aside className="p-3">{column}</aside>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
