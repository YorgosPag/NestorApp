'use client';

/**
 * 🏢 ENTERPRISE FLOATING PANEL SYSTEM
 *
 * Compound Component Pattern για draggable floating panels.
 *
 * @module FloatingPanel
 * @version 3.0.0 — ADR-723: αλλαγή μεγέθους, μόνιμη γεωμετρία, προσβάσιμο όνομα
 * @since 2025-01-02
 *
 * ── ΠΟΤΕ ΑΥΤΟ ΚΑΙ ΟΧΙ `Dialog` (η μία ερώτηση που κρίνει) ──
 *
 * «Πρέπει ο χρήστης να δουλεύει σε ό,τι βρίσκεται **πίσω** από το panel όσο αυτό είναι
 * ανοιχτό;» Αν ναι, **δεν είναι dialog** και καμία ρύθμιση δεν το κάνει να συμπεριφερθεί ως
 * τέτοιο: ακόμη και με `modal={false}`, ο Radix Dialog κλείνει στο πρώτο κλικ εκτός — δηλαδή τη
 * στιγμή που ο χρήστης αγγίζει ακριβώς αυτό για το οποίο μιλά το panel. Δες τη σημείωση στο
 * `@/components/ui/dialog`. Το `FloatingPanel` είναι η απάντηση: σύρσιμο, χωρίς backdrop, χωρίς
 * απόρριψη σε κλικ εκτός, `aria-modal="false"`, **καμία** παγίδα εστίασης.
 *
 * ── ΤΙ ΠΡΟΣΘΕΣΕ ΤΟ ADR-723 (και γιατί εδώ, όχι σε ένα panel) ──
 *
 * Ο Διαχειριστής Στρώσεων χρειαζόταν αλλαγή μεγέθους + μνήμη θέσης. Και τα δύο έλειπαν από
 * **όλες** τις 17 παλέτες. Υλοποιημένα μέσα στον Διαχειριστή θα ήταν το 18ο αντίγραφο λογικής
 * διάταξης· υλοποιημένα εδώ είναι **προαιρετικά** (`resizable`, `persistenceKey`) και οι 17
 * υπάρχουσες κλήσεις μένουν αναλλοίωτες — καμία τους δεν περνά τα νέα props.
 *
 * 🏆 ENTERPRISE FEATURES:
 * - Compound Component Pattern (FloatingPanel.Header / .Content / .Close / .DragHandle)
 * - Context-based state sharing, memoized
 * - Σύνθεση των SSoT `useDraggable` + `useResizable` μέσω `useFloatingPanelGeometry`
 * - Hydration-safe rendering
 * - Προσβάσιμο όνομα (`aria-labelledby`) — ADR-723
 * - Zero inline styles πλην της γεωμετρίας (που είναι εξ ορισμού δυναμική)
 */

import React, { useState, useEffect, useId, useMemo } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { type DraggableOptions } from '@/hooks/useDraggable';
import { useIconSizes } from '@/hooks/useIconSizes';
import { performanceMonitorUtilities } from '@/styles/design-tokens';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFloatingPanelGeometry } from './useFloatingPanelGeometry';
import { FloatingPanelResizeHandles } from './FloatingPanelResizeHandles';
import {
  DEFAULT_MIN_PANEL_SIZE,
  type PanelPosition,
  type PanelSize,
} from './floating-panel-geometry';
import type { FloatingPanelId } from './floating-panel-persistence';
import {
  FloatingPanelContext,
  useFloatingPanelContext,
  useFloatingPanelContextOptional,
  type FloatingPanelContextValue,
} from './floating-panel-context';

// ============================================================================
// TYPES & INTERFACES - Enterprise TypeScript Standards
// ============================================================================

/** Floating Panel position configuration */
export type FloatingPanelPosition = PanelPosition;

/** Floating Panel dimensions configuration */
export type FloatingPanelDimensions = PanelSize;

/** Main FloatingPanel props */
export interface FloatingPanelProps {
  /** Initial position of the panel */
  defaultPosition?: FloatingPanelPosition;
  /** Panel dimensions for bounds calculation (and for the size, when resizable) */
  dimensions?: FloatingPanelDimensions;
  /** Whether the panel is visible */
  isVisible?: boolean;
  /** Close handler */
  onClose?: () => void;
  /** Custom className for the root element */
  className?: string;
  /** Additional draggable options */
  draggableOptions?: Partial<DraggableOptions>;
  /** Children components */
  children: React.ReactNode;
  /** 🏢 ENTERPRISE: Test ID for Layout Mapper and testing */
  'data-testid'?: string;
  /**
   * ADR-723 — DOM `id` στη ρίζα. Απαραίτητο σε όποιον χρειάζεται να απαντήσει «είναι η εστίαση
   * **μέσα** σε αυτή την παλέτα;» (π.χ. handler του Escape bus) χωρίς να στηριχτεί σε
   * `data-testid` — τα testids είναι για tests, όχι για συμπεριφορά παραγωγής.
   */
  id?: string;
  /**
   * ADR-723 — ενεργοποιεί τις 8 λαβές αλλαγής μεγέθους και **καθηλώνει** το panel στο δηλωμένο
   * μέγεθος (width/height στη ρίζα, κυλιόμενο σώμα). Προεπιλογή `false`, ώστε οι υπάρχουσες
   * παλέτες να συνεχίσουν να παίρνουν ύψος από το περιεχόμενό τους.
   */
  resizable?: boolean;
  /** Κάτω όριο μεγέθους. Προεπιλογή {@link DEFAULT_MIN_PANEL_SIZE}. */
  minSize?: FloatingPanelDimensions;
  /** Προαιρετικό πάνω όριο — το viewport επιβάλλεται ούτως ή άλλως. */
  maxSize?: FloatingPanelDimensions;
  /**
   * ADR-723 — σταθερή ταυτότητα (`<subapp>.<panel>`) για διατήρηση θέσης/μεγέθους **ανά χρήστη**.
   * Όταν λείπει, τίποτα δεν αποθηκεύεται.
   */
  persistenceKey?: FloatingPanelId;
  /**
   * ADR-724 Φ3 — **στρώμα στοίβαξης** του panel. Προεπιλογή: `zIndex.toast` (1700).
   *
   * ⚠️ Η προεπιλογή είναι **σκόπιμα ψηλή αλλά και λανθασμένη για κάθε panel**: επιλέχθηκε ως
   * «πάνω από κάθε καμβά» και κατέληξε πάνω και από τα **μενού** (1000) και από τους
   * **διαλόγους** (1400). Ένα panel που κρύβει το μενού που ανοίγει το ίδιο δεν είναι panel —
   * είναι παγίδα (μετρημένο ζωντανά, ADR-724 §14.9).
   *
   * Δεν αλλάζει η προεπιλογή, ώστε οι 17 υπάρχοντες καταναλωτές να μείνουν **ακριβώς** ως έχουν.
   * Όποιος ξέρει σε ποιο στρώμα ανήκει, το δηλώνει — με τιμή από το SSoT (ADR-002), ποτέ ωμή.
   */
  zIndex?: number;
}

/** FloatingPanel Header props */
export interface FloatingPanelHeaderProps {
  /** Header title */
  title?: string;
  /** Icon element (from lucide-react or custom) */
  icon?: React.ReactNode;
  /** Show close button */
  showClose?: boolean;
  /** Additional actions to render */
  actions?: React.ReactNode;
  /** Custom className */
  className?: string;
  /** Children content (alternative to title) */
  children?: React.ReactNode;
}

/** FloatingPanel Content props */
export interface FloatingPanelContentProps {
  /** Custom className */
  className?: string;
  /** Children content */
  children: React.ReactNode;
}

/** FloatingPanel Close Button props */
export interface FloatingPanelCloseProps {
  /** Custom className */
  className?: string;
}

/** FloatingPanel Drag Handle props */
export interface FloatingPanelDragHandleProps {
  /** Custom className */
  className?: string;
}

// ============================================================================
// CONTEXT — μετακόμισε στο `floating-panel-context.ts` (ADR-724 Φ3, όριο N.7.1)
// ============================================================================
// Το αρχείο έφτασε τις 510 γραμμές· εξήχθη η **κατάσταση**, όχι κομμένη τεκμηρίωση.
// Τα ονόματα επανεξάγονται ώστε κανένας από τους 17 καταναλωτές να μην αλλάξει import.

// ============================================================================
// CONSTANTS - Enterprise Design Tokens
// ============================================================================

const DEFAULT_DIMENSIONS: FloatingPanelDimensions = { width: 340, height: 400 } as const;

const DEFAULT_POSITION: FloatingPanelPosition = { x: 100, y: 100 } as const;

// ============================================================================
// ROOT COMPONENT - FloatingPanel
// ============================================================================

/**
 * 🏢 FloatingPanel Root Component
 *
 * @example
 * ```tsx
 * <FloatingPanel defaultPosition={{ x: 100, y: 100 }} onClose={() => {}}>
 *   <FloatingPanel.Header title="My Panel" icon={<Activity />} />
 *   <FloatingPanel.Content>Panel content here</FloatingPanel.Content>
 * </FloatingPanel>
 * ```
 */
const FloatingPanelRoot: React.FC<FloatingPanelProps> = ({
  defaultPosition = DEFAULT_POSITION,
  dimensions = DEFAULT_DIMENSIONS,
  isVisible = true,
  onClose,
  className,
  draggableOptions,
  children,
  'data-testid': dataTestId,
  id,
  resizable = false,
  minSize = DEFAULT_MIN_PANEL_SIZE,
  maxSize,
  persistenceKey,
  zIndex,
}) => {
  // ✅ ENTERPRISE: Hydration safety
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // `useId` σε δική του γραμμή: κλήση hook μέσα σε template literal είναι έγκυρη αλλά κρύβει
  // από τον αναγνώστη (και από τον έλεγχο rules-of-hooks) ότι πρόκειται για hook.
  const reactId = useId();
  const titleId = `${reactId}-title`;

  // Ρητό width/height επιβάλλεται ΜΟΝΟ όταν το panel αλλάζει μέγεθος ή θυμάται γεωμετρία.
  // Διαφορετικά οι 17 υπάρχουσες παλέτες θα άλλαζαν διάταξη (παίρνουν ύψος από το περιεχόμενο).
  const isSizeControlled = resizable || persistenceKey !== undefined;

  const {
    position,
    size,
    isDragging,
    isResizing,
    elementRef,
    handleMouseDown,
    startResize,
  } = useFloatingPanelGeometry({
    isVisible,
    defaultPosition,
    defaultSize: dimensions,
    resizable,
    minSize,
    maxSize,
    persistenceKey,
    draggableOptions,
  });

  const contextValue = useMemo<FloatingPanelContextValue>(
    () => ({
      position,
      isDragging,
      isResizing,
      isMounted,
      handleMouseDown,
      startResize,
      onClose,
      elementRef,
      titleId,
      isSizeControlled,
    }),
    [
      position, isDragging, isResizing, isMounted, handleMouseDown,
      startResize, onClose, elementRef, titleId, isSizeControlled,
    ],
  );

  // Η γεωμετρία είναι εξ ορισμού δυναμική (pixel τιμές από χειρονομία) — δεν εκφράζεται με
  // κλάσεις Tailwind. Είναι η μοναδική εξαίρεση στον κανόνα N.3 σε αυτό το αρχείο.
  const panelStyles: React.CSSProperties | undefined = isMounted
    ? {
        left: position.x,
        top: position.y,
        ...(isSizeControlled ? { width: size.width, height: size.height } : {}),
        // Καμία μετάβαση όσο κρατιέται ο δείκτης: η μετάβαση θα «κυνηγούσε» τη χειρονομία
        // κατά ένα frame και θα έμοιαζε με υστέρηση.
        transition: isDragging || isResizing ? 'none' : 'left 0.2s ease, top 0.2s ease',
        ...performanceMonitorUtilities.getOverlayContainerStyles(),
        // ΜΕΤΑ το spread: η ρητή δήλωση του καλούντος υπερισχύει της προεπιλογής των tokens.
        ...(zIndex === undefined ? {} : { zIndex }),
      }
    : undefined;

  // ✅ ENTERPRISE: Prevent hydration mismatch
  if (!isMounted) return null;

  return (
    <FloatingPanelContext.Provider value={contextValue}>
      <Card
        ref={elementRef}
        id={id}
        className={cn(
          performanceMonitorUtilities.getOverlayContainerClasses(),
          (isDragging || isResizing) && 'select-none',
          isDragging && 'cursor-grabbing',
          // `flex-col` + `overflow-hidden` ώστε το σώμα να κυλά ΜΕΣΑ στο επιβεβλημένο ύψος
          // αντί να το ξεχειλίζει.
          //
          // ⚠️ ΚΑΜΙΑ κλάση `relative` εδώ. Η ρίζα φέρει ήδη `fixed` (από τα design tokens), που
          // **από μόνο του** ορίζει containing block για τις απόλυτα τοποθετημένες λαβές. Το
          // `relative` δεν θα ήταν απλώς περιττό — θα έσπαγε το panel: στο Tailwind οι
          // utilities θέσης παράγονται με σταθερή σειρά (static, fixed, absolute, relative,
          // sticky) και **νικά η τελευταία στο CSS**, όχι η τελευταία στο className. Δηλαδή το
          // `relative` θα υπερίσχυε του `fixed` και το panel θα επέστρεφε στη ροή της σελίδας.
          isSizeControlled && 'flex flex-col overflow-hidden',
          className,
        )}
        style={panelStyles}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        data-testid={dataTestId}
      >
        {children}
        {resizable && <FloatingPanelResizeHandles onStartResize={startResize} />}
      </Card>
    </FloatingPanelContext.Provider>
  );
};

// ============================================================================
// COMPOUND COMPONENTS
// ============================================================================

/**
 * 🎯 FloatingPanel Header — draggable header with title, icon, and close button.
 */
const FloatingPanelHeader: React.FC<FloatingPanelHeaderProps> = ({
  title,
  icon,
  showClose = true,
  actions,
  className,
  children,
}) => {
  const { handleMouseDown, onClose, isDragging, titleId, isSizeControlled } =
    useFloatingPanelContext();
  const iconSizes = useIconSizes();

  return (
    <CardHeader
      className={cn(
        performanceMonitorUtilities.getOverlayHeaderClasses(),
        isDragging && 'cursor-grabbing',
        isSizeControlled && 'shrink-0',
        className,
      )}
      onMouseDown={handleMouseDown}
    >
      {/* 🏢 ENTERPRISE: Single row flex - title and close button on same line */}
      <div className="flex items-center gap-2 w-full">
        {icon && (
          <span className={cn(iconSizes.sm, 'text-primary flex-shrink-0')}>{icon}</span>
        )}

        {/* Ο τίτλος φέρει ΠΑΝΤΑ το `titleId`: είναι το προσβάσιμο όνομα του `role="dialog"`.
            Στο μονοπάτι `children` ο καταναλωτής δίνει δικό του περιεχόμενο — τυλίγεται σε
            στοιχείο με το id ώστε το `aria-labelledby` να μη δείχνει ποτέ στο κενό. */}
        {children ? (
          <span id={titleId} className="flex-1 min-w-0">
            {children}
          </span>
        ) : (
          <h3 id={titleId} className="text-sm font-semibold text-foreground m-0 flex-1">
            {title}
          </h3>
        )}

        {actions}

        <FloatingPanelDragHandle />

        {showClose && onClose && <FloatingPanelClose />}
      </div>
    </CardHeader>
  );
};

/**
 * 📦 FloatingPanel Content — content area wrapper.
 */
const FloatingPanelContent: React.FC<FloatingPanelContentProps> = ({ className, children }) => {
  const { isSizeControlled } = useFloatingPanelContext();

  return (
    // 🏢 ENTERPRISE: Override default CardContent padding (p-6) — `!p-2` = 8px.
    // `min-h-0` είναι απαραίτητο: flex item με προεπιλογή `min-height:auto` ΔΕΝ συρρικνώνεται
    // κάτω από το περιεχόμενό του, οπότε το `overflow-auto` δεν θα ενεργοποιούνταν ποτέ και το
    // panel θα ξεχείλιζε αντί να κυλά. Κλασική παγίδα flexbox.
    <CardContent
      className={cn(
        '!p-2 space-y-2',
        isSizeControlled && 'flex-1 min-h-0 overflow-auto',
        className,
      )}
    >
      {children}
    </CardContent>
  );
};

/**
 * ✖️ FloatingPanel Close Button — accessible close button.
 */
const FloatingPanelClose: React.FC<FloatingPanelCloseProps> = ({ className }) => {
  const { onClose } = useFloatingPanelContext();
  const iconSizes = useIconSizes();
  // Ίδια πηγή με το `DialogClose` (`@/components/ui/dialog`) — ένα «Κλείσιμο» για όλη την
  // εφαρμογή. Μέχρι το ADR-723 ήταν ωμό αγγλικό literal (κανόνας N.11).
  const { t } = useTranslation(COMMON_NAMESPACES);

  if (!onClose) return null;

  return (
    <button
      type="button"
      onClick={onClose}
      className={cn(
        'p-1 rounded transition-colors',
        'hover:bg-muted text-muted-foreground hover:text-foreground',
        className,
      )}
      aria-label={t('buttons.close')}
    >
      <X className={iconSizes.xs} />
    </button>
  );
};

/**
 * 🖱️ FloatingPanel Drag Handle — οπτική ένδειξη «από εδώ σέρνεται».
 *
 * ── ΓΙΑΤΙ ΕΠΑΨΕ ΝΑ ΕΙΝΑΙ `role="button"` + `tabIndex={0}` (ADR-723) ──
 *
 * Ήταν εστιάσιμο κουμπί **χωρίς κανέναν χειριστή πληκτρολογίου**: ο χρήστης έφτανε σε αυτό με
 * `Tab`, πατούσε `Enter`, δεν συνέβαινε τίποτα. Δηλαδή μία ψεύτικη στάση στη σειρά πλοήγησης
 * **σε καθεμία από τις 17 παλέτες** — χειρότερο από το να μην υπάρχει, γιατί υπόσχεται
 * λειτουργία που δεν υπάρχει (WAI-ARIA: μη υλοποιήσιμο όνομα/ρόλος είναι ελάττωμα, όχι κενό).
 *
 * Το σύρσιμο είναι χειρονομία δείκτη, όπως και οι λαβές αλλαγής μεγέθους — και οι δύο είναι
 * τώρα `aria-hidden`, με τον ίδιο συλλογισμό (δες `FloatingPanelResizeHandles`). Ολόκληρη η
 * επικεφαλίδα παραμένει συρόμενη· αυτό εδώ είναι η **ένδειξη**, όχι ο μηχανισμός.
 */
const FloatingPanelDragHandle: React.FC<FloatingPanelDragHandleProps> = ({ className }) => {
  const { handleMouseDown } = useFloatingPanelContext();

  return (
    <span
      aria-hidden="true"
      className={cn(
        'ml-auto cursor-grab transition-colors text-xs select-none',
        'text-muted-foreground hover:text-foreground',
        className,
      )}
      // Το `useDraggable` ψάχνει ρητά αυτό το attribute ώστε το σύρσιμο να ξεκινά ακόμη κι όταν
      // η λαβή βρίσκεται μέσα σε διαδραστικό στοιχείο. ΜΗΝ το αφαιρέσεις.
      data-drag-handle="true"
      onMouseDown={handleMouseDown}
    >
      ⋮⋮
    </span>
  );
};

// ============================================================================
// COMPOUND COMPONENT ASSEMBLY
// ============================================================================

export const FloatingPanel = Object.assign(FloatingPanelRoot, {
  Header: FloatingPanelHeader,
  Content: FloatingPanelContent,
  Close: FloatingPanelClose,
  DragHandle: FloatingPanelDragHandle,
});

export {
  FloatingPanelRoot,
  FloatingPanelHeader,
  FloatingPanelContent,
  FloatingPanelClose,
  FloatingPanelDragHandle,
  // Επανεξαγωγή από το `floating-panel-context` ⇒ μηδέν αλλαγή για τους 17 καταναλωτές.
  useFloatingPanelContext,
  useFloatingPanelContextOptional,
};
export type { FloatingPanelContextValue };

export default FloatingPanel;
