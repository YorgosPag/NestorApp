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
  readonly children: React.ReactNode;
}

export function ScrollRail({
  as: Scroller = 'div',
  prevLabel,
  nextLabel,
  revealSelector,
  revealKey,
  className,
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

  // Εστίαση με Tab σε στοιχείο κάτω από τη μάσκα ή έξω από το κάδρο ⇒ ολόκληρο ορατό. Η εγγενής
  // κύλιση εστίασης δεν ξέρει τη μάσκα· `incidental`: δέκα Tab δεν συσσωρεύουν ομαλές κινήσεις.
  const onFocus = useCallback((event: React.FocusEvent<HTMLElement>) => {
    if (node === null || event.target === node) return;
    const item = Array.from(node.children).find((child) => child.contains(event.target));
    revealInlineWithin(node, item, { inset: railInsetOf(node), urgency: 'incidental' });
  }, [node]);

  return (
    <div className={styles.rail}>
      <Scroller
        ref={setNode}
        id={scrollerId}
        data-scroll-edges={edges}
        onFocus={onFocus}
        // `flex flex-nowrap` ως ΔΗΛΩΣΗ κλάσης: το `shell-surface.css` κρίνει «λίστα διάταξης ή πρόζας;»
        // από το `[class*='flex']` — δες το σχόλιο στο `scroll-rail.module.css`.
        className={cn('flex flex-nowrap list-none', styles.scroller, fadeStyles.fade, className)}
      >
        {children}
      </Scroller>
      <RailArrow direction="prev" label={prevLabel} controls={scrollerId} onPage={page} />
      <RailArrow direction="next" label={nextLabel} controls={scrollerId} onPage={page} />
    </div>
  );
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
