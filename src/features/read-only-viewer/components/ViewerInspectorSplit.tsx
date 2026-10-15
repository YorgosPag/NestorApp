'use client';

/**
 * @fileoverview **ΘΕΑΤΗΣ | ΕΠΙΘΕΩΡΗΤΗΣ, με συρόμενη διαχωριστική** — ADR-840 Σ3 (§7.8), η λύση του §7.5.
 * @related `@/components/ui/resizable` (ο ΕΝΑΣ wrapper της `react-resizable-panels`) ·
 *   `@/components/ui/resizable-persistence` (**πότε** γράφεται) · `@/components/ui/resizable-column-store` (**τι** · **πού**) ·
 *   πρότυπο: `spatial-tour/viewer/TourViewerSplit.tsx`
 * @module features/read-only-viewer/components/ViewerInspectorSplit
 *
 * 🔴 **Το §7.5**: η στήλη λεπτομερειών ήταν καρφωμένη `w-[360px]` ⇒ η δίστηλη φόρμα επεξεργασίας **κοβόταν** ⇒ η στήλη
 *   κλειδωνόταν read-only για **όλους**. 🏆 **Όπως ο επιθεωρητής της Figma, η παλέτα Properties του Revit και το
 *   side-peek της Notion**: ο άνθρωπος δίνει στη φόρμα όσο χώρο θέλει, το πλάτος **θυμάται** (px ανά συσκευή), διπλό
 *   κλικ στη διαχωριστική = επαναφορά, σύρσιμο κάτω από το ελάχιστο = απόκρυψη, κουμπί = εμφάνιση/απόκρυψη.
 *   Δωρεάν από τη βιβλιοθήκη: WAI-ARIA separator, βέλη/Home/End, `Enter` = σύμπτυξη.
 * 🔑 **px, όχι ποσοστά** + `preserve-pixel-size`: μεγαλώνει το παράθυρο ⇒ τον χώρο τον παίρνει ο **θεατής**.
 * 🔑 **Στη στενή οθόνη ΔΕΝ υπάρχει επιθεωρητής-στήλη** — μόνο CSS: το ορατό panel μόνο του παίρνει όλο το πλάτος
 *   (μοναδικό flex item ⇒ όλος ο ελεύθερος χώρος). Η γεωμετρία **δεν** ρωτά το `useViewportClass` (κανόνας 1 του
 *   `ListLayout`)· οι λεπτομέρειες εκεί ταξιδεύουν στο φύλλο (`ViewerDetailsSheet`).
 * ⚠️ **ΔΥΟ παγίδες της `react-resizable-panels@4`, μετρημένες στο `dist`** — καθεμία θα άφηνε τον επιθεωρητή ορατό
 *   στο κινητό, με όλα τα tests «πράσινα» αν κοίταζαν μόνο κλάσεις:
 *   1. γράφει **inline** `display: flex` σε group **και** panel ⇒ το inline νικά κάθε κλάση χωρίς `!important`·
 *   2. το `className` του `Panel` πηγαίνει σε **εσωτερικό** div — το εξωτερικό (με το πλάτος) δεν παίρνει κλάση.
 *   ⇒ Η ομάδα (ένα div, παίρνει κλάση) κρύβει τον επιθεωρητή με `max-md:[&>#…]:!hidden`· η σκηνή κρύβεται με την
 *   ομάδα ολόκληρη.
 */

import type { ReactNode } from 'react';

import { ColumnToggleButton, useCollapsibleColumn } from '@/components/ui/collapsible-column';
import {
  THIN_SEPARATOR_CLASS, ResizableHandle, ResizablePanel, ResizablePanelGroup,
} from '@/components/ui/resizable';
import { createColumnLayoutStore } from '@/components/ui/resizable-column-store';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { STORAGE_KEYS } from '@/lib/storage';
import { cn } from '@/lib/utils';

/**
 * Όρια σε px. Το ελάχιστο είναι το παλιό σταθερό πλάτος (τίποτα δεν στενεύει σε σχέση με πριν)· η προεπιλογή χωρά
 * τη φόρμα σε **μία** άνετη στήλη· το μέγιστο τη χωρά σε **δύο** (≈ 2 × 20rem του `PropertyFieldsEditForm`).
 */
export const PROPERTY_INSPECTOR_COLUMN = {
  widthMin: 360,
  widthDefault: 460,
  widthMax: 880,
} as const;

/** Ο θεατής δεν στενεύει κάτω από αυτό (px) — υπερισχύει του `widthMax` της στήλης σε μικρότερες οθόνες. */
const STAGE_MIN_WIDTH = 360;
const STAGE_PANEL_ID = 'property-viewer-stage';
const INSPECTOR_PANEL_ID = 'property-viewer-inspector';
/**
 * Στη στενή οθόνη ο επιθεωρητής **δεν υπάρχει ως στήλη** (ταξιδεύει στο φύλλο). Πάνω στην **ομάδα**, γιατί το
 * εξωτερικό div του panel δεν δέχεται κλάση (βλ. επικεφαλίδα). Literal, όχι template: το Tailwind σαρώνει κείμενο.
 */
export const NARROW_HIDES_INSPECTOR = 'max-md:[&>#property-viewer-inspector]:!hidden';

const inspectorStore = createColumnLayoutStore(STORAGE_KEYS.PROPERTY_INSPECTOR_COLUMN, PROPERTY_INSPECTOR_COLUMN);

export interface ViewerInspectorSplitProps {
  /** Ο θεατής μέσων (κάτοψη · φωτογραφίες · βίντεο). */
  readonly stage: ReactNode;
  /** Ο επιθεωρητής (λεπτομέρειες ακινήτου). */
  readonly inspector: ReactNode;
  /** Στη στενή οθόνη η σκηνή φαίνεται **μόνο** με επιλογή (αλλιώς τη θέση έχει η λίστα) — κατάσταση, όχι μέτρηση. */
  readonly narrowStageVisible: boolean;
}

export function ViewerInspectorSplit({ stage, inspector, narrowStageVisible }: ViewerInspectorSplitProps) {
  const { t } = useTranslation('properties-viewer');
  // Η μηχανική (πλάτος · απόκρυψη · εγγραφή) είναι κοινή με τη στήλη κατόψεων της περιήγησης.
  const { initial, collapsed, panel, persistence, onResize, toggle } = useCollapsibleColumn(inspectorStore);

  return (
    <ResizablePanelGroup orientation="horizontal" onLayoutChanged={persistence.onLayoutChanged}
      className={cn('min-h-0 min-w-0 flex-1', NARROW_HIDES_INSPECTOR, !narrowStageVisible && 'max-md:!hidden')}>
      <ResizablePanel id={STAGE_PANEL_ID} minSize={STAGE_MIN_WIDTH} className="relative flex min-h-0 min-w-0 flex-col">
        {stage}
        <ColumnToggleButton collapsed={collapsed} onToggle={toggle} controls={INSPECTOR_PANEL_ID}
          label={t(collapsed ? 'viewer.inspector.show' : 'viewer.inspector.hide')}
          className="right-3 top-3 z-10 hidden h-8 w-8 md:inline-flex" />
      </ResizablePanel>
      <ResizableHandle aria-label={t('viewer.inspector.resize')} className={cn(THIN_SEPARATOR_CLASS, 'hidden md:flex')}
        {...persistence.separatorProps} />
      <ResizablePanel id={INSPECTOR_PANEL_ID} panelRef={panel} elementRef={persistence.elementRef}
        defaultSize={initial.collapsed ? 0 : initial.width} minSize={PROPERTY_INSPECTOR_COLUMN.widthMin}
        maxSize={PROPERTY_INSPECTOR_COLUMN.widthMax} collapsible collapsedSize={0}
        groupResizeBehavior="preserve-pixel-size" onResize={onResize}
        className="flex min-h-0 min-w-0 flex-col">
        {inspector}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
