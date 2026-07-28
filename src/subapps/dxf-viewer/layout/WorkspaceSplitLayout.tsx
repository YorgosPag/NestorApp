/**
 * ADR-724 Φ1 — Ο **χώρος εργασίας** του viewer: παλέτα αριστερά, καμβάδες δεξιά, διαχωριστικό
 * που αλλάζει το πλάτος και τους σέρνει και τους δύο μαζί.
 *
 * ── ΤΟ ΜΟΝΑΔΙΚΟ ΣΗΜΕΙΟ ΤΟΥ SUBAPP ΠΟΥ ΞΕΡΕΙ ΑΠΟ SPLIT PANES ──
 *
 * Η μηχανική (WAI-ARIA splitter, πληκτρολόγιο, pointer capture, όρια σε pixels) έρχεται από το
 * `react-resizable-panels@4` **μέσω** του κοινού wrapper `@/components/ui/resizable` — του ίδιου
 * που ήδη χρησιμοποιούν τρεις σελίδες. Το subapp δεν εισάγει ποτέ τη βιβλιοθήκη απευθείας: αν
 * αύριο αλλάξει, αλλάζει ένα αρχείο.
 *
 * ── ΠΟΙΟΣ ΚΑΤΕΧΕΙ ΤΟ ΠΛΑΤΟΣ (ADR-040) ──
 *
 * Κατά το σύρσιμο το πλάτος αλλάζει ~60 φορές/δευτ. **Δεν** μπαίνει σε React state και **δεν**
 * μπαίνει σε store με συνδρομητές — θα ξαναρενδάριζε ~426 fibers ανά pixel (τεκμηριωμένο
 * ADR-040 Φ XXII.B). Κατά τη χειρονομία ζει αποκλειστικά στο DOM (η βιβλιοθήκη γράφει
 * `flex-grow`)· εδώ κρατιέται μόνο σε `ref`. Το store το μαθαίνει **μία φορά**, στο
 * `onLayoutChanged` — που η βιβλιοθήκη καλεί **μετά** την απελευθέρωση του δείκτη.
 *
 * ── ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΦΥΛΑΚΑΣ «ΠΡΟΘΕΣΗΣ ΧΡΗΣΤΗ» ──
 *
 * Το `onLayoutChanged` πυροδοτείται για **κάθε** αλλαγή διάταξης, όχι μόνο για σύρσιμο: π.χ.
 * όταν το παράθυρο στενέψει τόσο ώστε το κάτω όριο του καμβά να συμπιέσει την παλέτα. Αν
 * γράφαμε και τότε, το προτιμώμενο πλάτος του χρήστη θα **ξεχνιόταν** επειδή σμίκρυνε το
 * παράθυρο — και δεν θα επανερχόταν ποτέ. Γράφουμε μόνο όταν προηγήθηκε πραγματική χειρονομία
 * (δείκτης ή πλήκτρο) πάνω στο διαχωριστικό.
 *
 * ── FULLSCREEN (ADR-241) ──
 *
 * Ο `FullscreenOverlay` κάνει `createPortal` στο `document.body`: μετακινείται το **περιεχόμενο**
 * του δεύτερου panel, όχι το panel. Τα άμεσα παιδιά του `Group` παραμένουν ακριβώς
 * `Panel · Separator · Panel`, άρα ο δομικός περιορισμός της βιβλιοθήκης (ADR-724 §4.7) δεν
 * παραβιάζεται σε καμία κατάσταση.
 *
 * @see ../systems/workspace/workspace-dock-store — ο ΕΝΑΣ κάτοχος του αποθηκευμένου πλάτους
 */

'use client';

import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
  type PanelSize,
} from '@/components/ui/resizable';
import { PANEL_LAYOUT } from '../config/panel-tokens';
import { getDockedWidth, setDockedWidth } from '../systems/workspace/workspace-dock-store';

const { WIDTH_MIN, WIDTH_MAX, CANVAS_MIN_WIDTH } = PANEL_LAYOUT.WORKSPACE_DOCK;

/** Σταθερά για πάντα: αλλαγή τους ισοδυναμεί με «ξέχασε τη διάταξη όλων των χρηστών». */
const SIDEBAR_PANEL_ID = 'dxf-workspace-sidebar';
const CANVAS_PANEL_ID = 'dxf-workspace-canvas';

/** Τα πλήκτρα που το WAI-ARIA splitter της βιβλιοθήκης μεταφράζει ΟΝΤΩΣ σε αλλαγή πλάτους. */
const RESIZE_KEYS: ReadonlySet<string> = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End',
]);

/**
 * Το διαχωριστικό: **8px** περιοχή στόχευσης (όσο το παλιό `gap-2` ⇒ μηδενική μετατόπιση της
 * διάταξης) με **1px** ορατή γραμμή στο κέντρο. Η κατάσταση έρχεται από το `data-separator`
 * της v4 (`inactive` / `hover` / `active` / `disabled`).
 */
const SEPARATOR_CLASS = [
  'w-2 bg-transparent',
  'after:w-px after:bg-border after:transition-colors',
  'data-[separator=hover]:after:bg-ring',
  'data-[separator=active]:after:bg-ring data-[separator=active]:after:w-0.5',
].join(' ');

const GROUP_CLASS = 'flex-1 min-w-0 min-h-0';
const PANEL_CLASS = 'flex min-w-0';

interface WorkspaceSplitLayoutProps {
  /**
   * `false` ⇒ πλήρης παράκαμψη του split. Το dock system είναι **desktop-only** (ADR-724 §4.5):
   * σε tablet/mobile η παλέτα είναι συρτάρι (Sheet) και δεν έχει πλάτος να αλλάξει.
   */
  split: boolean;
  /** Η κύρια παλέτα (αγκυρωμένη ή συρτάρι — το αποφασίζει ο καλών). */
  sidebar: React.ReactNode;
  /** Οι καμβάδες 2D/3D, τυλιγμένοι στο fullscreen overlay τους. */
  children: React.ReactNode;
}

export const WorkspaceSplitLayout = React.memo<WorkspaceSplitLayoutProps>(({
  split,
  sidebar,
  children,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');

  // Διαβάζεται ΜΙΑ φορά: το `defaultSize` είναι αρχική τιμή, όχι ελεγχόμενη ιδιότητα. Αν
  // άλλαζε ανά render, κάθε render θα ξαναέστηνε τη διάταξη πάνω από τον χρήστη.
  const [initialWidth] = useState(getDockedWidth);

  const measuredWidthRef = useRef<number>(initialWidth);
  const userIntentRef = useRef<boolean>(false);

  // ~60 κλήσεις/δευτ. κατά το σύρσιμο — εγγραφή σε ref μόνο, μηδέν render, μηδέν localStorage.
  const handleSidebarResize = useCallback((size: PanelSize): void => {
    measuredWidthRef.current = size.inPixels;
  }, []);

  const handleLayoutChanged = useCallback((): void => {
    if (!userIntentRef.current) return;
    userIntentRef.current = false;
    setDockedWidth(measuredWidthRef.current);
  }, []);

  /**
   * Σημειώνει «ο χρήστης άγγιξε το διαχωριστικό» — για **σύρσιμο** (pointerdown) και για
   * **διπλό κλικ**.
   *
   * ⚠️ Το διπλό κλικ (επαναφορά πλάτους — VS Code / Sublime / Atom) το **εκτελεί η
   * βιβλιοθήκη**, όχι εμείς: έχει δικό της listener σε **capture** φάση στο `document`, που
   * επαναφέρει το panel στο `defaultSize` του. Άρα το `defaultSize` **είναι** ο στόχος της
   * επαναφοράς — εδώ, το πλάτος με το οποίο άνοιξε η συνεδρία (*revert to saved*).
   *
   * Μια δεύτερη, δική μας `resize()` θα ήταν **δεύτερος ιδιοκτήτης** της ίδιας χειρονομίας:
   * η βιβλιοθήκη τρέχει πρώτη (capture) και δεν προλαβαίνει να ακυρωθεί, οπότε το panel θα
   * άλλαζε μέγεθος **δύο φορές** ανά διπλό κλικ. Γι' αυτό εδώ σημειώνεται **μόνο** η πρόθεση,
   * ώστε το store να ακολουθήσει ό,τι εφάρμοσε η βιβλιοθήκη και να μην αποκλίνουν.
   */
  const markUserIntent = useCallback((): void => {
    userIntentRef.current = true;
  }, []);

  const handleSeparatorKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>): void => {
    // Μόνο τα πλήκτρα αλλαγής μεγέθους μετρούν ως πρόθεση — ένα `Tab` δεν είναι χειρονομία.
    if (RESIZE_KEYS.has(event.key)) userIntentRef.current = true;
  }, []);

  if (!split) {
    return <>{sidebar}{children}</>;
  }

  return (
    <ResizablePanelGroup
      orientation="horizontal"
      className={GROUP_CLASS}
      onLayoutChanged={handleLayoutChanged}
    >
      <ResizablePanel
        id={SIDEBAR_PANEL_ID}
        // Διπλή σημασία by design (βλ. handleSeparatorDoubleClick): αρχικό πλάτος **και**
        // στόχος του διπλού κλικ στο διαχωριστικό.
        defaultSize={initialWidth}
        minSize={WIDTH_MIN}
        maxSize={WIDTH_MAX}
        // Μεγαλώνει το παράθυρο ⇒ τον χώρο τον παίρνει ο ΚΑΜΒΑΣ· η παλέτα κρατά τα pixels της.
        // Ακριβώς η συμπεριφορά Revit / VS Code — και ο λόγος που τα όρια είναι σε px, όχι %.
        groupResizeBehavior="preserve-pixel-size"
        onResize={handleSidebarResize}
        className={PANEL_CLASS}
      >
        {sidebar}
      </ResizablePanel>
      <ResizableHandle
        aria-label={t('workspaceDock.separatorLabel')}
        className={SEPARATOR_CLASS}
        onPointerDown={markUserIntent}
        onKeyDown={handleSeparatorKeyDown}
        onDoubleClick={markUserIntent}
      />
      {/*
        Το κάτω όριο του καμβά ζει ΕΔΩ και μόνο εδώ: είναι το μόνο σημείο που γνωρίζει το
        διαθέσιμο πλάτος τη στιγμή του συρσίματος. Υπερισχύει του `WIDTH_MAX` σε στενές οθόνες.
      */}
      <ResizablePanel id={CANVAS_PANEL_ID} minSize={CANVAS_MIN_WIDTH} className={PANEL_CLASS}>
        {children}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
});

WorkspaceSplitLayout.displayName = 'WorkspaceSplitLayout';
