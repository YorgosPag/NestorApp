'use client';

/**
 * @fileoverview **ScrollRail** — μία γραμμή που κυλά οριζόντια, με βελάκια ◀ ▶ μόνο όπου χρειάζονται.
 * @related ADR-896 §7Α.5 · ADR-777 §8.79 (useScrollEdges, σβήσιμο άκρης) · ADR-777 §8.84 (γεωμετρία σε CSS)
 * @module components/ui/scroll-rail
 *
 * 📚 Μπάρα κατηγοριών Airbnb · chip bar YouTube: **εγγενής** κύλιση (δάχτυλο, trackpad, Shift+τροχός
 * δουλεύουν χωρίς κώδικα), σβήσιμο όπου συνεχίζει, βελάκια μόνο με ποντίκι και μόνο προς πλευρά με
 * κρυμμένο περιεχόμενο. Καμία βιβλιοθήκη carousel: εκείνες παίρνουν το σύρσιμο και την εστίαση.
 *
 * ♿ **Τα βελάκια ΕΚΤΟΣ σειράς Tab** (`tabIndex={-1}`) — σχολή chip bar, όχι carousel: κάθε στοιχείο
 * φτάνεται με Tab και η λωρίδα κυλά μόνη της στο εστιασμένο. Βελάκι μέσα στη σειρά Tab που
 * **εξαφανίζεται** στην άκρη θα έριχνε την εστίαση στο `<body>`. Έχουν όμως όνομα (props) και
 * `aria-controls`: δεν είναι `aria-hidden`, γιατί πατιούνται.
 *
 * 🔑 **ΚΑΜΙΑ ΓΝΩΣΗ ΠΕΡΙΕΧΟΜΕΝΟΥ, ΚΑΝΕΝΑ ΚΕΙΜΕΝΟ.** Οι ετικέτες έρχονται από τον καταναλωτή (όπως
 * το `filter-chip.tsx`). Η ορατότητα των βελών είναι CSS πάνω στο `data-scroll-edges`.
 */

import React, { useCallback, useEffect, useId, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { useScrollEdges } from '@/hooks/useScrollEdges';
import { inlineViewOf, revealInlineWithin } from '@/lib/a11y/reveal-in-scroll';
import { motionSafeScrollBehavior } from '@/lib/a11y/reduced-motion';
import { cn } from '@/lib/utils';
import { ScrollRailContext } from './scroll-rail-context';
import { pageTargetOf, railInsetOf, railSpansOf, type RailDirection } from './scroll-rail-geometry';
import fadeStyles from './scroll-edge-fade.module.css';
import styles from './scroll-rail.module.css';

export interface ScrollRailProps {
  /** `ul` όταν τα παιδιά είναι `<li>` — η σημασιολογία λίστας μένει στον καταναλωτή. */
  readonly as?: 'ul' | 'div';
  /** Προσβάσιμο όνομα του ◀ (π.χ. «Προηγούμενες ειδικότητες»). */
  readonly prevLabel: string;
  /** Προσβάσιμο όνομα του ▶. */
  readonly nextLabel: string;
  /** Το στοιχείο που πρέπει να φαίνεται (π.χ. `[aria-pressed="true"]`). */
  readonly revealSelector?: string;
  /** Όταν αλλάζει, το `revealSelector` ξαναφέρνεται σε θέα (η τρέχουσα επιλογή). */
  readonly revealKey?: unknown;
  /** Κλάσεις της λωρίδας (π.χ. `gap-2`). */
  readonly className?: string;
  /**
   * Κλάσεις του **περιβλήματος** — η θέση της λωρίδας μέσα στη διάταξη του καταναλωτή (π.χ.
   * `min-w-0 flex-1` δίπλα σε καρφωμένα κουμπιά, ADR-896 §7Α.6). Χωρίς αυτό ο καταναλωτής θα
   * χρειαζόταν ένα επιπλέον `<div>` μόνο για να δώσει πλάτος.
   */
  readonly frameClassName?: string;
  readonly children: React.ReactNode;
}

export function ScrollRail({
  as: Scroller = 'div',
  prevLabel,
  nextLabel,
  revealSelector,
  revealKey,
  className,
  frameClassName,
  children,
}: ScrollRailProps): React.ReactElement {
  const scrollerId = useId();
  const { node, setNode, edges } = useRailNode();
  useRevealSelected(node, revealSelector, revealKey);

  const page = useCallback((direction: RailDirection) => {
    if (node === null || typeof node.scrollTo !== 'function') return;
    const target = pageTargetOf(direction, inlineViewOf(node), railSpansOf(node), railInsetOf(node));
    node.scrollTo({ left: target, behavior: motionSafeScrollBehavior() });
  }, [node]);

  const focusReveal = useFocusReveal(node);

  return (
    <div className={cn(styles.rail, frameClassName)}>
      <Scroller
        ref={setNode}
        id={scrollerId}
        data-scroll-edges={edges}
        {...focusReveal}
        // `flex flex-nowrap` ως ΔΗΛΩΣΗ κλάσης: το `shell-surface.css` κρίνει «λίστα διάταξης ή πρόζας;»
        // από το `[class*='flex']` — δες το σχόλιο στο `scroll-rail.module.css`.
        className={cn('flex flex-nowrap list-none', styles.scroller, fadeStyles.fade, className)}
      >
        {/* Τα παιδιά ξέρουν τη λωρίδα τους — π.χ. ένα τσιπ κλείνει το αναδυόμενό του όταν κυλά. */}
        <ScrollRailContext.Provider value={node}>{children}</ScrollRailContext.Provider>
      </Scroller>
      <RailArrow direction="prev" label={prevLabel} controls={scrollerId} onPage={page} />
      <RailArrow direction="next" label={nextLabel} controls={scrollerId} onPage={page} />
    </div>
  );
}

/**
 * Εστίαση σε στοιχείο κάτω από τη μάσκα ή έξω από το κάδρο ⇒ ολόκληρο ορατό. Η εγγενής κύλιση
 * εστίασης δεν ξέρει τη μάσκα· `incidental`: δέκα Tab δεν συσσωρεύουν ομαλές κινήσεις.
 *
 * 🔴 **ΜΕ ΔΕΙΚΤΗ, ΜΕΤΑ ΤΟ `click` — ΠΟΤΕ ΣΤΟ `mousedown`** (μετρημένο ζωντανά, `/search/results`,
 * ADR-896 §7Α.6): ο Chrome εστιάζει το κουμπί στο mousedown. Αν η λωρίδα κυλήσει εκεί, το μισοκρυμμένο
 * τσιπ φεύγει κάτω από τον δείκτη, το mouseup πέφτει σε άλλο στοιχείο και το `click` πηγαίνει στον
 * κοινό πρόγονο (`DIV`): το κλικ **χάνεται** (το αναδυόμενο δεν άνοιξε, scrollLeft 0 → 74). ⇒ Με
 * δείκτη η αποκάλυψη περιμένει το `click` και τρέχει μετά τον χειριστή του στοιχείου. Με Tab
 * μένει άμεση.
 *
 * 🔑 **Μόνο εστίαση που ΦΑΙΝΕΤΑΙ** (`:focus-visible`): όταν ένα αναδυόμενο κλείνει επειδή ο άνθρωπος
 * κύλησε τη λωρίδα (`useDismissOnRailScroll`), το Radix επιστρέφει την εστίαση στο κουμπί — που είναι
 * πια εκτός κάδρου. Η αποκάλυψη εκεί θα **ακύρωνε** την κύλιση του ανθρώπου. Ο browser ξέρει αν η
 * εστίαση έρχεται από πληκτρολόγιο· δεν το ξαναμαντεύουμε.
 */
function useFocusReveal(node: HTMLElement | null): {
  readonly onFocus: (event: React.FocusEvent<HTMLElement>) => void;
  readonly onPointerDown: () => void;
  readonly onClick: () => void;
} {
  const pointerHeld = useRef(false);
  const pendingItem = useRef<Element | undefined>(undefined);

  const reveal = useCallback((item: Element | undefined) => {
    if (node !== null) revealInlineWithin(node, item, { inset: railInsetOf(node), urgency: 'incidental' });
  }, [node]);

  const onFocus = useCallback((event: React.FocusEvent<HTMLElement>) => {
    if (node === null || event.target === node) return;
    const item = Array.from(node.children).find((child) => child.contains(event.target));
    if (pointerHeld.current) pendingItem.current = item;
    else if (isVisibleFocus(event.target)) reveal(item);
  }, [node, reveal]);

  const onPointerDown = useCallback(() => {
    pointerHeld.current = true;
    pendingItem.current = undefined;
    onPointerRelease(() => { pointerHeld.current = false; });
  }, []);

  // Ο χειριστής του τσιπ έχει ήδη τρέξει (bubbling: παιδί πρώτα) — τώρα η λωρίδα μπορεί να κυλήσει.
  const onClick = useCallback(() => {
    const item = pendingItem.current;
    pendingItem.current = undefined;
    if (item !== undefined) reveal(item);
  }, [reveal]);

  return { onFocus, onPointerDown, onClick };
}

/**
 * Μία φορά, όταν αφεθεί ο δείκτης. Ακούγεται στο `window`: ο δείκτης μπορεί να αφεθεί ΕΞΩ από τη
 * λωρίδα, και τότε ένα κολλημένο «κρατιέται» θα έκανε το επόμενο Tab να μην αποκαλύπτει (Λ11).
 */
function onPointerRelease(callback: () => void): void {
  const release = () => {
    callback();
    window.removeEventListener('pointerup', release, true);
    window.removeEventListener('pointercancel', release, true);
  };
  window.addEventListener('pointerup', release, true);
  window.addEventListener('pointercancel', release, true);
}

/** Ο browser κρίνει αν η εστίαση φαίνεται· παλιός browser χωρίς τον επιλογέα ⇒ «ναι» (η παλιά συμπεριφορά). */
function isVisibleFocus(target: Element): boolean {
  try {
    return target.matches(':focus-visible');
  } catch {
    return true;
  }
}

/** Ο κόμβος της λωρίδας, δεμένος και στο `useScrollEdges` — μία μέτρηση άκρων, όχι δεύτερη. */
function useRailNode(): {
  readonly node: HTMLElement | null;
  readonly setNode: (next: HTMLElement | null) => void;
  readonly edges: ReturnType<typeof useScrollEdges>['edges'];
} {
  const { ref: edgesRef, edges } = useScrollEdges<HTMLElement>();
  const [node, setNodeState] = React.useState<HTMLElement | null>(null);
  const setNode = useCallback((next: HTMLElement | null) => {
    setNodeState(next);
    edgesRef(next);
  }, [edgesRef]);
  return { node, setNode, edges };
}

/**
 * Η τρέχουσα επιλογή σε θέα. Πρώτη φορά **ακαριαία** (σελίδα που φορτώνει ήδη κυλισμένη, όχι
 * γλίστρημα)· μετά ομαλή, αν το επιτρέπει η ρύθμιση κίνησης. Κυλά **μόνο τη λωρίδα** — ποτέ τη
 * σελίδα — άρα δεν είναι μετατόπιση διάταξης (CLS).
 */
function useRevealSelected(node: HTMLElement | null, selector: string | undefined, key: unknown): void {
  const revealedOnce = useRef(false);
  useEffect(() => {
    if (node === null || selector === undefined) return undefined;
    const selected = node.querySelector(selector);
    if (selected === null) return undefined;
    const item = Array.from(node.children).find((child) => child.contains(selected)) ?? selected;
    revealInlineWithin(node, item, {
      inset: railInsetOf(node),
      urgency: revealedOnce.current ? 'requested' : 'incidental',
    });
    revealedOnce.current = true;
    return followResize(node, item);
  }, [node, selector, key]);
}

/** Οι πράξεις με τις οποίες ο άνθρωπος παίρνει ο ίδιος τον έλεγχο της λωρίδας. */
const USER_SCROLL_INTENT = ['wheel', 'pointerdown', 'touchstart', 'keydown'] as const;

/**
 * 🔴 **Η ΕΠΙΛΟΓΗ ΦΑΡΔΑΙΝΕΙ ΜΕΤΑ ΤΗΝ ΑΠΟΚΑΛΥΨΗ** (μετρημένο ζωντανά, `?occupation=family:landscaper`):
 * στην πρώτη απόδοση το τσιπ δεν έχει αριθμό (`pending`). Όταν έρθουν τα πλήθη, παίρνει «0» και «×»,
 * και η δεξιά του άκρη βγήκε έξω από το κάδρο (1367 > 1282). ⇒ Όσο το στοιχείο αλλάζει μέγεθος,
 * μένει σε θέα. Αυτό ισχύει **μέχρι** να κυλήσει ο άνθρωπος τη λωρίδα ο ίδιος: δεν τον τραβάμε πίσω.
 */
function followResize(node: HTMLElement, item: Element): (() => void) | undefined {
  if (typeof ResizeObserver === 'undefined') return undefined;
  const observer = new ResizeObserver(() =>
    revealInlineWithin(node, item, { inset: railInsetOf(node), urgency: 'incidental' }),
  );
  // Το περίβλημα, όχι μόνο η λωρίδα: και το πάτημα ◀ ▶ (αδέλφια της) είναι «ο άνθρωπος κυλά».
  const scope = node.parentElement ?? node;
  const release = () => observer.disconnect();
  observer.observe(item);
  for (const type of USER_SCROLL_INTENT) scope.addEventListener(type, release, { passive: true, once: true });
  return () => {
    release();
    for (const type of USER_SCROLL_INTENT) scope.removeEventListener(type, release);
  };
}

function RailArrow({
  direction,
  label,
  controls,
  onPage,
}: {
  readonly direction: RailDirection;
  readonly label: string;
  readonly controls: string;
  readonly onPage: (direction: RailDirection) => void;
}): React.ReactElement {
  const Icon = direction === 'prev' ? ChevronLeft : ChevronRight;
  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      tabIndex={-1}
      aria-label={label}
      aria-controls={controls}
      data-rail-arrow={direction}
      // Το πάτημα δεν κλέβει την εστίαση από το στοιχείο που την είχε.
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onPage(direction)}
      className={cn(
        styles.arrow,
        direction === 'prev' ? styles.prev : styles.next,
        'rounded-full shadow-sm',
        COLOR_BRIDGE.selectionControl.outline,
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </Button>
  );
}
