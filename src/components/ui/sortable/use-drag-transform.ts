'use client';

/**
 * **Η θέση του στοιχείου που σέρνεται, ανά καρέ — προστακτικά, όχι inline style** (N.3).
 *
 * Το `@dnd-kit` δίνει νέο `transform` σε **κάθε** κίνηση του δείκτη. Δύο δρόμοι απορρίφθηκαν:
 *  - `style={{ transform }}` — απαγορεύεται (N.3).
 *  - `getDynamicTransformClass` — εγχέει **έναν κανόνα CSS ανά διαφορετική τιμή**: σε σύρσιμο 60 fps, εκατοντάδες
 *    κανόνες που δεν φεύγουν ποτέ. Είναι για τιμές που επαναλαμβάνονται (χρώμα, πλάτος), όχι για κίνηση.
 * Ιδίωμα του έργου για κίνηση ανά καρέ (`spatial-tour/viewer/useTourFloorOverlay`): εγγραφή στο `el.style` του
 * κόμβου, σε layout effect — πριν τη ζωγραφική, χωρίς re-render.
 *
 * @module components/ui/sortable/use-drag-transform
 */

import { useCallback, useLayoutEffect, useRef } from 'react';
import type { Transform } from '@dnd-kit/utilities';
import { CSS } from '@dnd-kit/utilities';

/** Επιστρέφει ref-callback που **ενώνει** το ref του dnd-kit με τον δικό μας κόμβο. */
export function useDragTransform(
  setNodeRef: (node: HTMLElement | null) => void,
  transform: Transform | null,
  transition: string | undefined,
): (node: HTMLElement | null) => void {
  const nodeRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    node.style.transform = CSS.Translate.toString(transform) ?? '';
    node.style.transition = transition ?? '';
  }, [transform, transition]);

  return useCallback(
    (node: HTMLElement | null) => {
      nodeRef.current = node;
      setNodeRef(node);
    },
    [setNodeRef],
  );
}
