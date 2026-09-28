/**
 * ADR-724 Φ1/Φ2 — Ο **χώρος εργασίας** του viewer: παλέτα και καμβάδες εκατέρωθεν ενός
 * διαχωριστικού που αλλάζει το πλάτος και τους σέρνει και τους δύο μαζί. Η πλευρά της παλέτας
 * (Φ2) είναι το **μόνο** πράγμα που αλλάζει τη σειρά των παιδιών — δες τα `key` παρακάτω.
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

import React, { useRef, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
  THIN_SEPARATOR_CLASS,
} from '@/components/ui/resizable';
import { usePanelWidthPersistence } from '@/components/ui/resizable-persistence';
import { PANEL_LAYOUT } from '../config/panel-tokens';
import { getDockedWidth, setDockedWidth } from '../systems/workspace/workspace-dock-store';
import { useDockMode } from '../systems/workspace/useWorkspaceDock';
import { resolveWorkspaceLayout } from '../systems/workspace/workspace-dock-mode';
import { WorkspaceFloatingPalette } from './WorkspaceFloatingPalette';
import type { SidebarVariant } from './SidebarSection';

const { WIDTH_MIN, WIDTH_MAX, CANVAS_MIN_WIDTH } = PANEL_LAYOUT.WORKSPACE_DOCK;

/** Σταθερά για πάντα: αλλαγή τους ισοδυναμεί με «ξέχασε τη διάταξη όλων των χρηστών». */
const SIDEBAR_PANEL_ID = 'dxf-workspace-sidebar';
const CANVAS_PANEL_ID = 'dxf-workspace-canvas';

const GROUP_CLASS = 'flex-1 min-w-0 min-h-0';
const PANEL_CLASS = 'flex min-w-0';

interface WorkspaceSplitLayoutProps {
  /**
   * `false` ⇒ πλήρης παράκαμψη του split. Το dock system είναι **desktop-only** (ADR-724 §4.5):
   * σε tablet/mobile η παλέτα είναι συρτάρι (Sheet) και δεν έχει πλάτος να αλλάξει.
   */
  split: boolean;
  /**
   * Η κύρια παλέτα, ως **συνάρτηση της μορφής** που της αναλογεί (ADR-724 Φ3).
   *
   * ── ΓΙΑΤΙ ΣΥΝΑΡΤΗΣΗ ΚΑΙ ΟΧΙ `ReactNode` ──
   *
   * Στη Φ3 η παλέτα φοράει διαφορετικό «ένδυμα» ανά κατάσταση (§6.3): αγκυρωμένη είναι η ίδια
   * η κάρτα, αιωρούμενη κάθεται **μέσα** στην κάρτα του `FloatingPanel`. Κάποιος πρέπει να
   * μεταφράσει την κατάσταση σε ένδυμα.
   *
   * Αν το έκανε ο καλών (`DxfViewerContent`), θα έπρεπε να **συνδρομηθεί στην κατάσταση** — και
   * ο `DxfViewerContent` είναι ο κορυφαίος orchestrator του viewer: ένα render του σέρνει
   * ολόκληρο το υποδέντρο (ADR-040). Εδώ η συνδρομή **ήδη υπάρχει** (η σειρά των παιδιών
   * εξαρτάται από αυτήν) και το component είναι memoized. Μία συνδρομή, στο σωστό ύψος.
   */
  sidebar: (variant: SidebarVariant) => React.ReactNode;
  /** Οι καμβάδες 2D/3D, τυλιγμένοι στο fullscreen overlay τους. */
  children: React.ReactNode;
}

export const WorkspaceSplitLayout = React.memo<WorkspaceSplitLayoutProps>(({
  split,
  sidebar,
  children,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');

  // Η ΜΟΝΑΔΙΚΗ αντιδραστική συνδρομή αυτού του component — χαμηλής συχνότητας (κλικ μενού).
  // Το πλάτος σκόπιμα ΔΕΝ έχει αντίστοιχη (ADR-040): ζει στο DOM κατά τη χειρονομία.
  const mode = useDockMode();
  /*
    ⚠️ ΜΙΑ ΟΛΙΚΗ ΕΡΩΤΗΣΗ, ΟΧΙ ΔΥΟ ΔΥΑΔΙΚΕΣ (ADR-724 Φ3).

    Μέχρι τη Φ2 εδώ υπήρχε `isDockedRight(mode) ? … : …`. Με την προσθήκη του `'floating'` αυτό
    το predicate **δεν σπάει** — απλώς απαντά «όχι δεξιά» και η αιωρούμενη παλέτα θα
    ζωγραφιζόταν αγκυρωμένη αριστερά. Σφάλμα που κανένας compiler και κανένα υπάρχον test δεν
    μπορούσε να δει. Το `resolveWorkspaceLayout` είναι εξαντλητικό: τέταρτη κατάσταση χωρίς
    `case` ⇒ σφάλμα μεταγλώττισης.
  */
  const layout = resolveWorkspaceLayout(mode);
  /** Ο χώρος εργασίας — η αναφορά των ζωνών αγκύρωσης όταν η παλέτα αιωρείται (§7.1). */
  const workspaceRef = useRef<HTMLDivElement | null>(null);

  // Διαβάζεται ΜΙΑ φορά: το `defaultSize` είναι αρχική τιμή, όχι ελεγχόμενη ιδιότητα. Αν
  // άλλαζε ανά render, κάθε render θα ξαναέστηνε τη διάταξη πάνω από τον χρήστη.
  const [initialWidth] = useState(getDockedWidth);

  // Πότε γράφεται το πλάτος: μία φορά ανά χειρονομία, μετά το flush της διάταξης — πρόθεση χρήστη, αναβολή ενός
  // καρέ, πληκτρολόγιο που γράφει μόνο του (ADR-724 §5.2 / §14.2). Η μηχανική ζει στο ΕΝΑ σημείο της.
  const persistence = usePanelWidthPersistence(setDockedWidth, initialWidth);

  /*
    ⚠️ ΤΡΕΙΣ ΚΛΑΔΟΙ, ΟΧΙ ΔΥΟ — ΚΑΙ ΤΟ «ΟΧΙ DESKTOP» ΕΙΝΑΙ ΑΛΛΟ ΕΡΩΤΗΜΑ ΑΠΟ ΤΟ «ΑΙΩΡΕΙΤΑΙ».

    Ο πειρασμός της Φ3 είναι `split={mode !== 'floating'}` — δηλαδή να περάσει η αιώρηση από τον
    **υπάρχοντα** κλάδο του κινητού. Θα «δούλευε» και θα ήταν λάθος: εκείνος ο κλάδος υπάρχει
    επειδή σε tablet/mobile η παλέτα είναι **συρτάρι** (Sheet) και δεν έχει πλάτος να αλλάξει.
    Συγχωνεύοντάς τα, μια μελλοντική αλλαγή στη συμπεριφορά του κινητού θα άλλαζε σιωπηλά τη
    συμπεριφορά της αιώρησης — δύο άσχετες απαιτήσεις σε έναν διακόπτη.
  */
  if (!split) {
    return <>{sidebar('drawer')}{children}</>;
  }

  /*
    ΑΙΩΡΟΥΜΕΝΗ: ο καμβάς παίρνει **όλο** τον χώρο εργασίας και η παλέτα επιπλέει από πάνω.

    Ο `<div ref={workspaceRef}>` δεν είναι διακοσμητικός: είναι η **αναφορά** των ζωνών
    αγκύρωσης (§7.1). Χωρίς αυτόν, οι ζώνες θα μετρούσαν από την ακμή του **παραθύρου** και η
    αριστερή θα έπεφτε πάνω στη ράγα πλοήγησης της εφαρμογής.

    ⓘ Ο καμβάς δεν χρειάζεται ειδοποίηση εδώ: η μετάβαση **αλλάζει το πλάτος** του (ο
    ResizeObserver ξυπνά) **και** αλλάζει το `mode` (το `useViewportManager` είναι ήδη
    συνδρομητής του `subscribeDockMode` από τη Φ2). Δύο ανεξάρτητα μονοπάτια, N.7.2 #4.
  */
  if (layout === 'floating') {
    return (
      <>
        <div ref={workspaceRef} className={`flex ${GROUP_CLASS}`}>
          {children}
        </div>
        <WorkspaceFloatingPalette workspaceRef={workspaceRef}>
          {sidebar('floating')}
        </WorkspaceFloatingPalette>
      </>
    );
  }

  /*
    ⚠️ ΤΑ `key` ΕΙΝΑΙ ΛΕΙΤΟΥΡΓΙΚΑ, ΟΧΙ ΤΥΠΙΚΟΤΗΤΑ (ADR-724 Φ2).

    Η αλλαγή πλευράς αντιστρέφει τη σειρά αυτού του πίνακα. Χωρίς σταθερά `key`, ο React
    ταιριάζει τα παιδιά **κατά θέση**: το πρώτο παιδί ήταν η παλέτα και τώρα είναι ο καμβάς
    ⇒ ξαναφτιάχνει και τα δύο υποδέντρα. Για τον καμβά αυτό σημαίνει **απώλεια του WebGL
    context**, πλήρες ξαναχτίσιμο σκηνής και ακύρωση του bitmap cache — δηλαδή δευτερόλεπτα
    παγώματος για μια εντολή που οφείλει να είναι ακαριαία.

    Με `key`, ο React **μετακινεί** τους ίδιους κόμβους (`insertBefore`). Ένας μετακινούμενος
    `<canvas>` κρατά το περιεχόμενο και το context του — μόνο η επανεκχώρηση `width`/`height`
    τα σβήνει, και αυτή δεν συμβαίνει εδώ. Καλύπτεται από test ταυτότητας.
  */
  const sidebarPanel = (
    <ResizablePanel
      key={SIDEBAR_PANEL_ID}
      id={SIDEBAR_PANEL_ID}
      elementRef={persistence.elementRef}
      // Διπλή σημασία by design (βλ. `resizable-persistence`, διπλό κλικ): αρχικό πλάτος **και**
      // στόχος του διπλού κλικ στο διαχωριστικό.
      defaultSize={initialWidth}
      minSize={WIDTH_MIN}
      maxSize={WIDTH_MAX}
      // Μεγαλώνει το παράθυρο ⇒ τον χώρο τον παίρνει ο ΚΑΜΒΑΣ· η παλέτα κρατά τα pixels της.
      // Ακριβώς η συμπεριφορά Revit / VS Code — και ο λόγος που τα όρια είναι σε px, όχι %.
      // Ισχύει αναλλοίωτο και στις δύο πλευρές: η ιδιότητα ακολουθεί την παλέτα, όχι τη θέση.
      groupResizeBehavior="preserve-pixel-size"
      onResize={persistence.onResize}
      className={PANEL_CLASS}
    >
      {sidebar('inline')}
    </ResizablePanel>
  );

  const separator = (
    <ResizableHandle
      key="workspace-separator"
      aria-label={t('workspaceDock.separatorLabel')}
      className={THIN_SEPARATOR_CLASS}
      {...persistence.separatorProps}
    />
  );

  /*
    Το κάτω όριο του καμβά ζει ΕΔΩ και μόνο εδώ: είναι το μόνο σημείο που γνωρίζει το
    διαθέσιμο πλάτος τη στιγμή του συρσίματος. Υπερισχύει του `WIDTH_MAX` σε στενές οθόνες.
  */
  const canvasPanel = (
    <ResizablePanel
      key={CANVAS_PANEL_ID}
      id={CANVAS_PANEL_ID}
      minSize={CANVAS_MIN_WIDTH}
      className={PANEL_CLASS}
    >
      {children}
    </ResizablePanel>
  );

  return (
    <ResizablePanelGroup
      orientation="horizontal"
      className={GROUP_CLASS}
      onLayoutChanged={persistence.onLayoutChanged}
    >
      {layout === 'canvas-first'
        ? [canvasPanel, separator, sidebarPanel]
        : [sidebarPanel, separator, canvasPanel]}
    </ResizablePanelGroup>
  );
});

WorkspaceSplitLayout.displayName = 'WorkspaceSplitLayout';
