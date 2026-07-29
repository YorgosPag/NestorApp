/**
 * ADR-724 Φ3 — Η κύρια παλέτα **όταν αιωρείται**, μαζί με τις ζώνες αγκύρωσης (§7.1).
 *
 * ── ΤΙ ΔΕΝ ΥΠΑΡΧΕΙ ΕΔΩ, ΚΑΙ ΓΙΑΤΙ ──
 *
 * Μηδέν σύρσιμο, μηδέν λαβές αλλαγής μεγέθους, μηδέν clamp, μηδέν persistence. **Όλα** τα
 * κατέχει το ADR-723 (`FloatingPanel` + `useFloatingPanelGeometry`), που ήδη λύνει το
 * τεκμηριωμένο «palette lost off-screen» κάνοντας clamp σε κάθε ανάγνωση. Μια δεύτερη
 * υλοποίηση οποιουδήποτε από αυτά θα ήταν το ακριβές σχήμα που πιάνει το CHECK 3.28 (N.18).
 *
 * Αυτό το αρχείο προσθέτει **μόνο** ό,τι το ADR-723 δεν μπορεί να ξέρει: πού ξεκινά η παλέτα
 * την πρώτη φορά (§7) και πότε η απόθεση σημαίνει «αγκύρωσε» (§7.1).
 *
 * ── ΓΙΑΤΙ Η ΑΙΩΡΟΥΜΕΝΗ ΔΕΝ ΕΧΕΙ `maxSize` ──
 *
 * Το `WORKSPACE_DOCK.WIDTH_MAX` (720px) υπάρχει επειδή **αγκυρωμένη** η παλέτα τρώει από τον
 * καμβά· πάνω από ένα όριο ο καμβάς παύει να είναι ο πρωταγωνιστής. Αιωρούμενη **δεν τρώει
 * τίποτα** — επιπλέει. Επιβάλλοντας εδώ το ίδιο όριο θα μεταφέραμε έναν περιορισμό μαζί με το
 * όνομά του, χωρίς τον λόγο του. Το μόνο πάνω όριο είναι το viewport, και το επιβάλλει ήδη το
 * `clampPanelSize` του ADR-723.
 *
 * ⓘ Πρακτική συνέπεια, μετρημένη (ADR-724 §14.6.7.α): οι 8 καρτέλες χρειάζονται **795px** για
 * μία σειρά — περισσότερα από το αγκυρωμένο μέγιστο. Αιωρούμενη, η παλέτα τα φτάνει.
 */

'use client';

import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  FloatingPanel,
  useFloatingPanelContext,
  DEFAULT_MIN_PANEL_SIZE,
  type FloatingPanelId,
} from '@/components/ui/floating';
import { dxfZIndex } from '../styles/DxfZIndexSystem.styles';
import { getDockedWidth, getLastDockedSide, setDockMode } from '../systems/workspace/workspace-dock-store';
import {
  dockToFloatGeometry,
  resolveDropTarget,
  type WorkspaceRect,
} from '../systems/workspace/workspace-dock-geometry';
import type { WorkspaceDockedSide } from '../systems/workspace/workspace-dock-mode';

/**
 * Η ταυτότητα της παλέτας στο namespace του ADR-723 (`<subapp>.<panel>`).
 *
 * ⛔ **Σταθερή για πάντα.** Αλλαγή της ισοδυναμεί με «ξέχασε τη θέση όλων των χρηστών» — ίδια
 * σύμβαση με τα `SIDEBAR_PANEL_ID` / `CANVAS_PANEL_ID` του `WorkspaceSplitLayout`.
 */
export const WORKSPACE_PALETTE_PANEL_ID: FloatingPanelId = 'dxf.workspace-sidebar';

const PREVIEW_CLASS = 'fixed pointer-events-none rounded-lg border-2 border-dashed border-ring bg-ring/10';

// ============================================================================
// 1. Ο ΠΑΡΑΤΗΡΗΤΗΣ ΤΟΥ ΣΥΡΣΙΜΑΤΟΣ (§7.1)
// ============================================================================

interface DragObserverProps {
  /** Μετρημένο **μία φορά ανά χειρονομία** — δες γιατί παρακάτω. */
  readonly measureWorkspace: () => WorkspaceRect;
  readonly onPreviewChange: (side: WorkspaceDockedSide | null) => void;
  readonly onDrop: (side: WorkspaceDockedSide) => void;
}

/**
 * Μηδενικού μεγέθους παιδί του `FloatingPanel`, που μεταφράζει «σέρνεται» σε «θα αγκυρώσει».
 *
 * ── ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ COMPONENT ΚΑΙ ΟΧΙ ΛΟΓΙΚΗ ΣΤΟΝ ΓΟΝΕΑ ──
 *
 * Το `isDragging` ζει στο **context** του `FloatingPanel`. Μόνο απόγονος μπορεί να το
 * διαβάσει· ο γονέας που *στήνει* το panel είναι εξ ορισμού έξω από το context του. Ένα
 * component που δεν αποδίδει τίποτα είναι το φθηνότερο νόμιμο «καλώδιο» — και δεν προσθέτει
 * κόμβο στο DOM.
 *
 * ── ΓΙΑΤΙ Η ΔΕΣΜΕΥΣΗ ΓΙΝΕΤΑΙ ΣΕ `pointerup` ΚΑΙ ΟΧΙ ΣΤΟ CLEANUP ΤΟΥ EFFECT ──
 *
 * Ο πειρασμός είναι να δεσμεύσει κανείς την αγκύρωση στο cleanup (όταν το `isDragging` πέσει).
 * Είναι **λάθος**: το cleanup τρέχει επίσης σε κάθε αλλαγή εξάρτησης και στην αποπροσάρτηση —
 * δηλαδή ένα resize παραθύρου στη μέση του συρσίματος θα «άφηνε» την παλέτα μόνο του. Το
 * `pointerup` είναι το **γεγονός** που σημαίνει «ο χρήστης άφησε»· ο κύκλος ζωής του React δεν
 * είναι συνώνυμό του.
 *
 * ── ΓΙΑΤΙ Ο ΧΩΡΟΣ ΕΡΓΑΣΙΑΣ ΜΕΤΡΙΕΤΑΙ ΜΙΑ ΦΟΡΑ ΑΝΑ ΧΕΙΡΟΝΟΜΙΑ ──
 *
 * Μια `getBoundingClientRect()` ανά `pointermove` είναι ~60 αναγκαστικά reflow/δευτ. ενώ ο
 * χρήστης σέρνει — και θα μετρούσε **την ίδια** τιμή κάθε φορά: ο χώρος εργασίας δεν μπορεί να
 * αλλάξει όσο κρατιέται ο δείκτης (δεν υπάρχει άλλη χειρονομία σε εξέλιξη). Μία μέτρηση στην
 * αρχή, μηδέν στη συνέχεια.
 */
const WorkspaceDragObserver = React.memo<DragObserverProps>(({
  measureWorkspace,
  onPreviewChange,
  onDrop,
}) => {
  const { isDragging } = useFloatingPanelContext();

  // Οι callbacks σε ref ⇒ οι εξαρτήσεις του effect είναι **μόνο** το `isDragging`. Αν έμπαιναν
  // στις εξαρτήσεις, μια αλλαγή ταυτότητας συνάρτησης στον γονέα θα ξανάστηνε τους ακροατές
  // στη μέση της χειρονομίας — και μαζί θα μηδένιζε το `targetRef`.
  const latest = useRef({ measureWorkspace, onPreviewChange, onDrop });
  latest.current = { measureWorkspace, onPreviewChange, onDrop };

  useLayoutEffect(() => {
    if (!isDragging) return;

    const workspace = latest.current.measureWorkspace();
    let target: WorkspaceDockedSide | null = null;

    const handleMove = (event: PointerEvent): void => {
      const next = resolveDropTarget(event.clientX, workspace);
      if (next === target) return;
      target = next;
      latest.current.onPreviewChange(next);
    };

    const handleUp = (event: PointerEvent): void => {
      const dropped = resolveDropTarget(event.clientX, workspace);
      latest.current.onPreviewChange(null);
      if (dropped) latest.current.onDrop(dropped);
    };

    // Ακύρωση από το σύστημα (gesture του OS, εισερχόμενη κλήση, χαμένο pointer capture): η
    // χειρονομία **δεν** ολοκληρώθηκε ⇒ καμία αγκύρωση, αλλά το περίγραμμα-προεπισκόπηση δεν
    // επιτρέπεται να μείνει ζωγραφισμένο στην οθόνη.
    const handleCancel = (): void => {
      target = null;
      latest.current.onPreviewChange(null);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleCancel);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleCancel);
      latest.current.onPreviewChange(null);
    };
  }, [isDragging]);

  return null;
});
WorkspaceDragObserver.displayName = 'WorkspaceDragObserver';

// ============================================================================
// 2. ΤΟ ΠΕΡΙΓΡΑΜΜΑ-ΠΡΟΕΠΙΣΚΟΠΗΣΗ (§7.1)
// ============================================================================

interface DropPreviewProps {
  readonly side: WorkspaceDockedSide;
  readonly workspace: WorkspaceRect;
  readonly width: number;
}

/**
 * Δείχνει **πού** θα κάτσει η παλέτα αν αφεθεί τώρα — ο κανόνας του Revit: ποτέ αγκύρωση χωρίς
 * προεπισκόπηση. Χωρίς αυτό, η αγκύρωση είναι έκπληξη· με αυτό, είναι εντολή.
 *
 * Οι τιμές θέσης/μεγέθους είναι **δυναμική γεωμετρία** ⇒ η ρητή εξαίρεση του N.3 (ίδιο
 * προηγούμενο με το `FloatingPanel` του ADR-723). Ό,τι είναι στατικό ζει σε κλάσεις.
 *
 * `z-index` από το **SSoT** του subapp (`dxfZIndex.ui.sidebar` = 1110): πάνω από κάθε καμβά,
 * κάτω από την ίδια την παλέτα που σέρνεται (1700) — αλλιώς η προεπισκόπηση θα σκέπαζε το
 * αντικείμενο που περιγράφει.
 */
const WorkspaceDropPreview = React.memo<DropPreviewProps>(({ side, workspace, width }) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const left = side === 'docked-right'
    ? workspace.left + workspace.width - width
    : workspace.left;

  return (
    <aside
      className={PREVIEW_CLASS}
      style={{ left, top: workspace.top, width, height: workspace.height, zIndex: dxfZIndex.ui.sidebar }}
      aria-live="polite"
      aria-label={t(side === 'docked-right' ? 'workspaceDock.dropPreviewRight' : 'workspaceDock.dropPreviewLeft')}
    />
  );
});
WorkspaceDropPreview.displayName = 'WorkspaceDropPreview';

// ============================================================================
// 3. Η ΑΙΩΡΟΥΜΕΝΗ ΠΑΛΕΤΑ
// ============================================================================

interface WorkspaceFloatingPaletteProps {
  /** Το στοιχείο που ορίζει τον χώρο εργασίας — η αναφορά για τις ζώνες απόθεσης. */
  readonly workspaceRef: React.RefObject<HTMLElement | null>;
  /** Η παλέτα (ίδιο component με την αγκυρωμένη, `variant="floating"`). */
  readonly children: React.ReactNode;
}

/** Εφεδρεία όταν ο χώρος εργασίας δεν έχει προσαρτηθεί: ολόκληρο το παράθυρο. */
function readViewportRect(): WorkspaceRect {
  if (typeof window === 'undefined') return { left: 0, top: 0, width: 0, height: 0 };
  return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
}

function measureElement(element: HTMLElement | null): WorkspaceRect {
  if (!element) return readViewportRect();
  const rect = element.getBoundingClientRect();
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

export const WorkspaceFloatingPalette = React.memo<WorkspaceFloatingPaletteProps>(({
  workspaceRef,
  children,
}) => {
  const [preview, setPreview] = useState<WorkspaceDockedSide | null>(null);

  /**
   * ⚠️ Η ΜΕΤΡΗΣΗ ΠΡΕΠΕΙ ΝΑ ΠΡΟΗΓΗΘΕΙ ΤΟΥ ΠΡΩΤΟΥ RENDER ΤΟΥ `FloatingPanel`.
   *
   * Το `useFloatingPanelGeometry` διαβάζει `defaultPosition`/`defaultSize` σε **lazy `useState`
   * initializer** — δηλαδή στο **πρώτο** του render, μια για πάντα. Ένα `defaultPosition` που
   * φτάνει σωστό στο δεύτερο render δεν θα εφαρμοστεί ποτέ.
   *
   * Ο ίδιος ο χώρος εργασίας όμως δεν έχει `ref` πριν το commit. Άρα: `useLayoutEffect`
   * (μετά την προσάρτηση, **πριν** τη ζωγραφική) θέτει το rect, και μέχρι τότε δεν αποδίδεται
   * panel. Κόστος: ένα render. Οπτικό κόστος: **μηδέν** — το `FloatingPanel` επιστρέφει
   * ούτως ή άλλως `null` μέχρι το δικό του `isMounted`.
   */
  const [workspace, setWorkspace] = useState<WorkspaceRect | null>(null);
  useLayoutEffect(() => {
    setWorkspace(measureElement(workspaceRef.current));
  }, [workspaceRef]);

  const measureWorkspace = useCallback(
    (): WorkspaceRect => measureElement(workspaceRef.current),
    [workspaceRef],
  );

  const handleDrop = useCallback((side: WorkspaceDockedSide): void => {
    // Η αποθηκευμένη **αιωρούμενη** γεωμετρία μένει ανέπαφη σκοπίμως: ο χρήστης αγκύρωσε την
    // παλέτα, δεν δήλωσε ότι θέλει να την ξαναβρεί κολλητά στην ακμή την επόμενη φορά που θα
    // την αιωρήσει. Ίδια συμπεριφορά με το Revit.
    setDockMode(side);
  }, []);

  const seed = useMemo(() => {
    if (!workspace) return null;
    return dockToFloatGeometry({
      side: getLastDockedSide(),
      dockedWidth: getDockedWidth(),
      workspace,
      // Το **παράθυρο**, όχι ο χώρος εργασίας: η παλέτα είναι `position: fixed`, άρα τα όρια
      // «πόσο επιτρέπεται να βγει εκτός» (ADR-723) κρίνονται σε συντεταγμένες viewport. Ένα
      // clamp ως προς τον χώρο εργασίας θα την κλείδωνε μέσα του — δηλαδή θα την έκανε
      // αγκυρωμένη με άλλο όνομα.
      viewport: readViewportRect(),
    });
  }, [workspace]);

  if (!workspace || !seed) return null;

  return (
    <>
      {preview !== null && (
        <WorkspaceDropPreview side={preview} workspace={workspace} width={getDockedWidth()} />
      )}

      <FloatingPanel
        id={WORKSPACE_PALETTE_PANEL_ID}
        persistenceKey={WORKSPACE_PALETTE_PANEL_ID}
        resizable
        defaultPosition={{ x: seed.x, y: seed.y }}
        dimensions={{ width: seed.width, height: seed.height }}
        // Το ελάχιστο του ADR-723 **είναι** το `WORKSPACE_DOCK.WIDTH_MIN` (280px): μία έννοια
        // «στενότερο λειτουργικό πλάτος παλέτας» σε όλη την εφαρμογή. Ρητή επανάληψη εδώ θα
        // δημιουργούσε δεύτερο ιδιοκτήτη της ίδιας τιμής.
        minSize={DEFAULT_MIN_PANEL_SIZE}
      >
        <WorkspaceDragObserver
          measureWorkspace={measureWorkspace}
          onPreviewChange={setPreview}
          onDrop={handleDrop}
        />
        {children}
      </FloatingPanel>
    </>
  );
});

WorkspaceFloatingPalette.displayName = 'WorkspaceFloatingPalette';
