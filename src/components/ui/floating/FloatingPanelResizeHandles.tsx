'use client';

/**
 * ADR-723 — Οι 8 λαβές αλλαγής μεγέθους μιας αιωρούμενης παλέτας.
 *
 * ── ΓΙΑΤΙ `aria-hidden` ΚΑΙ ΟΧΙ `role="separator"` ΜΕ `tabIndex` ──
 *
 * Ο πειρασμός είναι να γίνουν εστιάσιμα «splitters» κατά WAI-ARIA. Είναι λάθος εδώ, για δύο
 * μετρήσιμους λόγους:
 *
 *  1. **Οκτώ** νέες στάσεις στη σειρά `Tab` **ανά παλέτα**, πριν καν φτάσει ο χρήστης στο
 *     περιεχόμενο. Το `separator` του APG περιγράφει διαχωριστικό **μεταξύ δύο περιοχών** με
 *     `aria-valuenow` (VS Code sash, split view) — όχι περίγραμμα παραθύρου. Τα ίδια τα
 *     native περιγράμματα παραθύρων του λειτουργικού δεν εκτίθενται ως controls.
 *  2. Η αλλαγή μεγέθους **δεν είναι λειτουργικότητα που φράζει περιεχόμενο**: το σώμα της
 *     παλέτας κυλά (`overflow-auto`), άρα κάθε γραμμή είναι προσβάσιμη και στο προεπιλεγμένο
 *     μέγεθος. Κατά WCAG 2.1.1 απαιτείται να είναι με πληκτρολόγιο λειτουργική η **λειτουργία**,
 *     όχι κάθε βοήθημα δείκτη. Ίδια στάση με τις παλέτες Revit / AutoCAD, που επίσης δεν
 *     προσφέρουν αλλαγή μεγέθους με πληκτρολόγιο.
 *
 * Άρα: καθαρά βοηθήματα δείκτη, αόρατα στην υποστηρικτική τεχνολογία — και ρητά τεκμηριωμένο
 * γιατί, ώστε να μην «διορθωθεί» σιωπηλά σε 8 tab stops.
 *
 * ── ΓΙΑΤΙ ΧΩΡΙΣ `title` ──
 *
 * CHECK 3.23 (native HTML tooltip ratchet): `title=` σε στοιχεία JSX μπλοκάρει το commit. Οι
 * λαβές είναι ούτως ή άλλως `aria-hidden` — ένα tooltip θα ήταν αντιφατικό.
 */

import React, { useCallback } from 'react';
import { cn } from '@/lib/utils';
import { performanceMonitorUtilities } from '@/styles/design-tokens';
import { RESIZE_EDGES, type ResizeEdge } from '@/hooks/useResizable';

export interface FloatingPanelResizeHandlesProps {
  /** Σύνδεση στο `startResize` του {@link useFloatingPanelGeometry}. */
  readonly onStartResize: (edge: ResizeEdge, event: React.PointerEvent) => void;
}

/**
 * Θέση + δρομέας ανά άκρη, από τα **κεντρικά design tokens** — την ίδια πηγή με το κέλυφος και
 * την επικεφαλίδα του panel (`getOverlayContainerClasses` / `getOverlayHeaderClasses`). Καμία
 * κλάση δεν γεννιέται εδώ (κανόνες N.3 + design-system lint).
 */
const EDGE_CLASSES = performanceMonitorUtilities.getOverlayResizeHandleClasses();

const SingleHandle: React.FC<{
  readonly edge: ResizeEdge;
  readonly onStartResize: FloatingPanelResizeHandlesProps['onStartResize'];
}> = ({ edge, onStartResize }) => {
  const handlePointerDown = useCallback(
    (event: React.PointerEvent): void => onStartResize(edge, event),
    [edge, onStartResize],
  );

  return (
    <span
      aria-hidden="true"
      data-resize-edge={edge}
      className={cn('absolute select-none touch-none', EDGE_CLASSES[edge])}
      onPointerDown={handlePointerDown}
    />
  );
};

/**
 * Και οι 8 λαβές. Αποδίδονται ως **αδέλφια του περιεχομένου** μέσα στη ρίζα της παλέτας.
 *
 * ⚠️ Ο γονέας ΔΕΝ φέρει (και δεν πρέπει να φέρει) κλάση `relative`: η ρίζα είναι ήδη `fixed`,
 * που **από μόνο του** ορίζει containing block για απόλυτη τοποθέτηση. Προσθήκη `relative` θα
 * έσπαγε το panel — στο Tailwind οι utilities θέσης παράγονται με σταθερή σειρά και νικά η
 * τελευταία **στο CSS** (relative μετά το fixed), όχι η τελευταία στο `className`.
 */
export const FloatingPanelResizeHandles: React.FC<FloatingPanelResizeHandlesProps> = ({
  onStartResize,
}) => (
  <>
    {RESIZE_EDGES.map((edge) => (
      <SingleHandle key={edge} edge={edge} onStartResize={onStartResize} />
    ))}
  </>
);
