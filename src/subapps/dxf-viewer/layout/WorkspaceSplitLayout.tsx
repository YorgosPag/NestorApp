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
 * ── ΓΙΑΤΙ ΔΟΥΛΕΥΕΙ ΤΟ ΠΛΗΚΤΡΟΛΟΓΙΟ (ADR-724 §5.2 — μη το χαλάσεις κατά λάθος) ──
 *
 * Το splitter είναι εστιάσιμο και η βιβλιοθήκη υλοποιεί τα βέλη. Αυτό **δεν αρκούσε**: ο
 * handler της (`Te`) είναι element-level, φάση **bubble**, και ξεκινά με
 * `if (e.defaultPrevented) return;` — ενώ οι global accelerators του viewer τρέχουν σε
 * **window capture**, δηλαδή πρώτοι. Μετρημένο ζωντανά: τα βέλη έκαναν pan στον καμβά
 * (~80px/πάτημα) και `preventDefault()`, οπότε το splitter δεν έβλεπε ποτέ το συμβάν.
 *
 * Η ιδιοκτησία λύνεται στον **ΕΝΑΝ** τόπο της, το `@/lib/a11y/keyboard-scope`
 * (ADR-711/ADR-364): ο ρόλος `separator` ανήκει στο `ARROW_NAVIGATION_ROLES`, οπότε το
 * `shouldGlobalShortcutYield` κάνει τους accelerators να **παραιτούνται** από τα πλοηγικά
 * πλήκτρα όσο το διαχωριστικό έχει την εστίαση.
 *
 * ⛔ **Καμία τοπική άμυνα εδώ** — ούτε `stopPropagation`, ούτε δεύτερος έλεγχος ρόλου. Ένα
 * `stopPropagation` στο διαχωριστικό δεν θα έλυνε τίποτα: ο accelerator έχει ήδη τρέξει
 * (capture) πριν φτάσει το συμβάν σε αυτό το element.
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

import React, { useCallback, useEffect, useRef, useState } from 'react';
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

/**
 * Τα πλήκτρα που το WAI-ARIA splitter της βιβλιοθήκης μεταφράζει ΟΝΤΩΣ σε αλλαγή πλάτους —
 * επαληθευμένα στον handler `Te` του `react-resizable-panels@4.7.2`.
 *
 * ⚠️ **Υποσύνολο** του `isDirectionalKey` (ADR-724 §5.2), όχι αντίγραφό του: εκεί η ερώτηση
 * είναι «ποιος κατέχει το πλήκτρο;» και περιλαμβάνει `PageUp`/`PageDown`· εδώ είναι «ήταν
 * αυτό πρόθεση αλλαγής πλάτους, άρα αξίζει εγγραφή στο store;» — και η βιβλιοθήκη **δεν**
 * χειρίζεται `PageUp`/`PageDown`. Το `F6` (μετακίνηση εστίασης) και το `Enter` (σύμπτυξη —
 * ανενεργό, δεν δηλώνουμε `collapsible`) επίσης δεν αλλάζουν πλάτος.
 */
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
  /** Το ίδιο το στοιχείο του panel — η **αλήθεια** για το πλάτος (βλ. `handleLayoutChanged`). */
  const sidebarElementRef = useRef<HTMLDivElement | null>(null);
  /** Η εκκρεμής αναβολή εγγραφής· `null` = καμία (βλ. `handleLayoutChanged`). */
  const persistFrameRef = useRef<number | null>(null);

  // ~60 κλήσεις/δευτ. κατά το σύρσιμο — εγγραφή σε ref μόνο, μηδέν render, μηδέν localStorage.
  const handleSidebarResize = useCallback((size: PanelSize): void => {
    measuredWidthRef.current = size.inPixels;
  }, []);

  /**
   * ⚠️ Η ΕΓΓΡΑΦΗ ΑΝΑΒΑΛΛΕΤΑΙ ΕΝΑ ΚΑΡΕ — μετρημένο, όχι προληπτικό.
   *
   * Το `onLayoutChanged` καλείται **πριν** εφαρμοστεί το νέο layout: εκείνη τη στιγμή
   * **και** το `measuredWidthRef` (το `onResize` δεν έχει τρέξει ακόμη) **και** το ίδιο το
   * DOM είναι **ένα βήμα πίσω**. Μετρημένο ζωντανά 2026-07-28 με προσωρινό diagnostic:
   * `getBoundingClientRect().width` = **487.2** ενώ το τελικό πλάτος ήταν **603.6**.
   *
   * Στο **σύρσιμο** το ελάττωμα ήταν αόρατο — το `onResize` έχει ήδη τρέξει ~60 φορές πριν
   * σηκωθεί ο δείκτης, άρα η προηγούμενη τιμή τύχαινε να είναι η σωστή. Με το
   * **πληκτρολόγιο** κάθε πάτημα είναι μία διακριτή αλλαγή, οπότε το σφάλμα γίνεται γυμνό:
   * ο χρήστης ρύθμιζε την παλέτα και μετά το reload έπαιρνε το **προτελευταίο** πλάτος.
   *
   * ⛔ Δεν διορθώνεται με «διάβασε από αλλού»: **καμία** πηγή δεν είναι ενημερωμένη τη
   * στιγμή της κλήσης. Χρειάζεται ο browser να κάνει flush τη διάταξη — γι' αυτό ένα
   * `requestAnimationFrame`. **Ένα** ανά χειρονομία (το `onLayoutChanged` καλείται μετά την
   * απελευθέρωση του δείκτη, εξ ορισμού), άρα μηδέν κόστος στο ζεστό μονοπάτι.
   *
   * ⛔ Και **δεν** είναι δεύτερος scheduler: είναι μία αναβολή, όχι βρόχος καρέ. Ο
   * `UnifiedFrameScheduler` (ADR-040) κατέχει τα καρέ **του καμβά** — ένα layout component
   * δεν έχει δουλειά να μπει στην ουρά απόδοσης.
   */
  const handleLayoutChanged = useCallback((): void => {
    if (!userIntentRef.current) return;
    userIntentRef.current = false;
    if (persistFrameRef.current !== null) cancelAnimationFrame(persistFrameRef.current);
    persistFrameRef.current = requestAnimationFrame(() => {
      persistFrameRef.current = null;
      // Μετά το flush, το DOM είναι η αλήθεια· το ref μένει εφεδρεία για αποπροσαρτημένο
      // στοιχείο (N.7.2 #4 — δύο ανεξάρτητα μονοπάτια για την ίδια τιμή).
      const element = sidebarElementRef.current;
      setDockedWidth(element ? element.getBoundingClientRect().width : measuredWidthRef.current);
    });
  }, []);

  // Η αναβολή δεν επιτρέπεται να επιζήσει του component: ένα `setDockedWidth` μετά την
  // αποπροσάρτηση θα έγραφε το πλάτος μιας διάταξης που δεν υπάρχει πια.
  useEffect(() => () => {
    if (persistFrameRef.current !== null) cancelAnimationFrame(persistFrameRef.current);
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
        elementRef={sidebarElementRef}
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
