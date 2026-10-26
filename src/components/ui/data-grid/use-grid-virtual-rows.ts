'use client';
/**
 * **Ποιες γραμμές αποδίδονται;** — virtualization γραμμών με `@tanstack/react-virtual` (MIT, ADR-923 §5.10.4 Β1).
 *
 * Κάτω από {@link VIRTUALIZE_ABOVE_ROWS} **καμία** virtualization: όλες οι γραμμές στο DOM ⇒ το `Ctrl+F` του browser
 * και οι αναγνώστες οθόνης βλέπουν τα πάντα (η ανησυχία του `ListingCard.module.css`: react-virtualized #1296 ·
 * TanStack #158). Πάνω από αυτό: ο πίνακας μένει **πραγματικός** `<table>` (sticky κεφαλίδα, πλάτη στηλών) με δύο
 * γραμμές-αποστάτες, και κάθε γραμμή δηλώνει `aria-rowindex` ⇒ ο αναγνώστης ξέρει «γραμμή 143 από 2.000» (APG grid).
 *
 * Τα ύψη των αποστατών γράφονται **προστακτικά** μέσω ref (ιδίωμα `use-drag-transform`, N.3: κανένα `style={{}}`).
 *
 * @module components/ui/data-grid/use-grid-virtual-rows
 */

import { useVirtualizer } from '@tanstack/react-virtual';
import { useLayoutEffect, useRef, type RefObject } from 'react';

/** Πάνω από τόσες γραμμές ενεργοποιείται η virtualization. */
export const VIRTUALIZE_ABOVE_ROWS = 60;
/** Το ύψος γραμμής (px) — **το ίδιο** με την κλάση `h-9` του CSS της γραμμής (άγκυρα στο test). */
export const DATA_GRID_ROW_PX = 36;
const OVERSCAN_ROWS = 12;
/**
 * Το ύψος που **υποθέτει** το πρώτο καρέ, πριν μετρηθεί το παράθυρο: χωρίς αυτό ο virtualizer αποδίδει **μηδέν**
 * γραμμές ως τη μέτρηση (κενό πρώτο καρέ στον browser, σκέτο κενό στο SSR — ADR-777 Α19 κανόνας 30).
 */
const INITIAL_VIEWPORT_ROWS = 20;

export interface GridVirtualRows {
  readonly virtual: boolean;
  /** Οι δείκτες που αποδίδονται, με σειρά. */
  readonly indexes: readonly number[];
  readonly scrollRef: RefObject<HTMLDivElement | null>;
  readonly topSpacerRef: RefObject<HTMLTableRowElement | null>;
  readonly bottomSpacerRef: RefObject<HTMLTableRowElement | null>;
  /** Φέρε τη γραμμή στο ορατό παράθυρο (ο δρομέας φεύγει εκτός με το πληκτρολόγιο). */
  readonly reveal: (index: number) => void;
  /** Γραμμές ανά «σελίδα» (PageUp/PageDown) — ό,τι χωρά στο ορατό ύψος. */
  readonly pageRows: number;
}

function allIndexes(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index);
}

export function useGridVirtualRows(count: number): GridVirtualRows {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const topSpacerRef = useRef<HTMLTableRowElement | null>(null);
  const bottomSpacerRef = useRef<HTMLTableRowElement | null>(null);
  const virtual = count > VIRTUALIZE_ABOVE_ROWS;
  const virtualizer = useVirtualizer({
    count: virtual ? count : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => DATA_GRID_ROW_PX,
    overscan: OVERSCAN_ROWS,
    initialRect: { width: 0, height: INITIAL_VIEWPORT_ROWS * DATA_GRID_ROW_PX },
  });
  const items = virtualizer.getVirtualItems();
  const top = items[0]?.start ?? 0;
  const bottom = virtual ? Math.max(virtualizer.getTotalSize() - (items[items.length - 1]?.end ?? 0), 0) : 0;

  useLayoutEffect(() => {
    if (topSpacerRef.current) topSpacerRef.current.style.height = `${top}px`;
    if (bottomSpacerRef.current) bottomSpacerRef.current.style.height = `${bottom}px`;
  }, [top, bottom]);

  const viewport = scrollRef.current?.clientHeight ?? 0;
  return {
    virtual,
    indexes: virtual ? items.map((item) => item.index) : allIndexes(count),
    scrollRef,
    topSpacerRef,
    bottomSpacerRef,
    reveal: (index) => { if (virtual) virtualizer.scrollToIndex(index, { align: 'auto' }); },
    pageRows: Math.max(1, Math.floor(viewport / DATA_GRID_ROW_PX) - 1),
  };
}
