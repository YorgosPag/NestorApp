'use client';

/**
 * @fileoverview ADR-923 §5.15.2 (Θ.2α-3) — **Η λίστα μικρογραφιών** του πλευρικού πάνελ.
 * @module components/file-manager/PdfThumbnailList
 *
 * 🔑 Virtualization με `@tanstack/react-virtual` (το SSoT του `use-grid-virtual-rows`): στο DOM μόνο όσες φαίνονται +
 *    περιθώριο, με αποστάτες που γράφονται **προστακτικά** (N.3). Τα ορατά τα δίνει ο virtualizer — κανένας
 *    IntersectionObserver.
 * 🔑 Αίτημα απόδοσης **όταν ηρεμήσει η κύλιση** (`PDF_RENDER_SETTLE_MS`, η ίδια τιμή με τον ζωγράφο): σε γρήγορη
 *    κύλιση τίποτα δεν ζητείται, και ό,τι βγήκε εκτός ακυρώνεται από το store.
 * 🔑 Πριν έρθει η εικόνα, κάθε θέση έχει το σχήμα της τρέχουσας σελίδας (pdf.js) — καμία αναπήδηση· μετά μετριέται.
 * ⌨️ Roving tabindex: στο Tab μόνο η τρέχουσα σελίδα· ↑/↓/Home/End αλλάζουν σελίδα από τη **μία** πόρτα (`goToPage`).
 */

import React, { useEffect, useLayoutEffect, useRef, useSyncExternalStore, type KeyboardEvent, type RefObject } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';

import { PDF_RENDER_SETTLE_MS } from './pdf-canvas-config';
import { THUMB_CSS_WIDTH, type PdfThumbnail, type PdfThumbnailStore } from './pdf-thumbnail-store';

/** Ετικέτα + κενά γύρω από την εικόνα (px) — η εκτίμηση πριν από τη μέτρηση. */
const THUMB_CHROME_PX = 36;
const THUMB_OVERSCAN = 4;

export interface PdfThumbnailListProps {
  readonly store: PdfThumbnailStore | null;
  readonly numPages: number;
  readonly currentPage: number;
  readonly rotation: number;
  /** Λόγος ύψους/πλάτους της τρέχουσας σελίδας (με τη στροφή) — το σχήμα κάθε θέσης πριν έρθει η εικόνα. */
  readonly defaultAspect: number;
  readonly pageLabels: readonly string[] | null;
  readonly onNavigate: (page: number) => void;
}

const NO_SUBSCRIPTION = () => () => undefined;
const NO_VERSION = () => 0;

/** Ξαναζωγραφίζει τη λίστα όταν το store αποκτήσει νέα μικρογραφία (σήμα έκδοσης του `createExternalStore`). */
function useStoreVersion(store: PdfThumbnailStore | null): void {
  useSyncExternalStore(store?.subscribe ?? NO_SUBSCRIPTION, store?.version ?? NO_VERSION, NO_VERSION);
}

/** Τα ύψη γράφονται προστακτικά (N.3: κανένα `style={{}}` στο JSX). */
function useImperativeHeight<T extends HTMLElement>(height: number) {
  const ref = useRef<T | null>(null);
  useLayoutEffect(() => { if (ref.current) ref.current.style.height = `${Math.max(0, height)}px`; }, [height]);
  return ref;
}

function ThumbImage({ url, aspect }: { readonly url: string | null; readonly aspect: number }) {
  const height = Math.round(THUMB_CSS_WIDTH * aspect);
  const frameRef = useImperativeHeight<HTMLSpanElement>(height);
  return (
    // `w-[120px]` ≡ `THUMB_CSS_WIDTH` (η ανάλυση της εικόνας) — το ύψος από τον λόγο της σελίδας.
    <span ref={frameRef} className="block w-[120px] overflow-hidden rounded-sm bg-white shadow-sm ring-1 ring-border">
      {/* eslint-disable-next-line @next/next/no-img-element -- blob URL τοπικής απόδοσης, όχι εικόνα για βελτιστοποίηση */}
      {url !== null && <img src={url} alt="" width={THUMB_CSS_WIDTH} height={height} className="block h-full w-full" draggable={false} />}
    </span>
  );
}

function useRequestVisible(store: PdfThumbnailStore | null, pages: readonly number[], rotation: number): void {
  const signature = pages.join(',');
  useEffect(() => {
    if (!store) return;
    const timer = window.setTimeout(() => store.request(signature === '' ? [] : signature.split(',').map(Number), rotation), PDF_RENDER_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [store, signature, rotation]);
  useEffect(() => () => store?.request([], rotation), [store, rotation]);
}

function ThumbButton({ page, label, current, currentRef, thumb, defaultAspect, onNavigate }: {
  readonly page: number;
  readonly label: string;
  readonly current: boolean;
  readonly currentRef: RefObject<HTMLButtonElement | null>;
  readonly thumb: PdfThumbnail | null;
  readonly defaultAspect: number;
  readonly onNavigate: (page: number) => void;
}) {
  const { t } = useTranslation('files');
  return (
    <button
      ref={current ? currentRef : undefined}
      type="button"
      tabIndex={current ? 0 : -1}
      aria-current={current ? 'page' : undefined}
      aria-label={t('pdf.sidebar.pageThumb', { label })}
      onClick={() => onNavigate(page)}
      className={cn(
        'flex flex-col items-center gap-1 rounded-md p-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring',
        current ? 'bg-accent' : 'hover:bg-muted',
      )}
    >
      <ThumbImage url={thumb?.url ?? null} aspect={thumb?.aspect ?? defaultAspect} />
      <span className={cn('text-xs tabular-nums', current ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{label}</span>
    </button>
  );
}

const NAV_KEYS: Record<string, (current: number, last: number) => number> = {
  ArrowDown: (current, last) => Math.min(last, current + 1),
  ArrowUp: (current) => Math.max(1, current - 1),
  Home: () => 1,
  End: (_, last) => last,
};

function useThumbVirtualizer(props: PdfThumbnailListProps) {
  const scrollRef = useRef<HTMLElement | null>(null);
  const estimate = Math.round(THUMB_CSS_WIDTH * props.defaultAspect) + THUMB_CHROME_PX;
  const virtualizer = useVirtualizer({
    count: props.numPages,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimate,
    overscan: THUMB_OVERSCAN,
  });
  const items = virtualizer.getVirtualItems();
  const top = items[0]?.start ?? 0;
  const bottom = Math.max(virtualizer.getTotalSize() - (items[items.length - 1]?.end ?? 0), 0);
  // Η τρέχουσα σελίδα στο ορατό — αλλαγή από μπάρα, πλήκτρα, σύνδεσμο ή περιεχόμενα.
  useEffect(() => {
    if (props.numPages > 0) virtualizer.scrollToIndex(props.currentPage - 1, { align: 'auto' });
  }, [virtualizer, props.currentPage, props.numPages]);
  return { scrollRef, virtualizer, items, top, bottom };
}

export function PdfThumbnailList(props: PdfThumbnailListProps) {
  const { store, numPages, currentPage, rotation, pageLabels, onNavigate } = props;
  const { t } = useTranslation('files');
  useStoreVersion(store);
  const { scrollRef, virtualizer, items, top, bottom } = useThumbVirtualizer(props);
  const topRef = useImperativeHeight<HTMLLIElement>(top);
  const bottomRef = useImperativeHeight<HTMLLIElement>(bottom);
  useRequestVisible(store, items.map((item) => item.index + 1), rotation);

  const currentRef = useRef<HTMLButtonElement | null>(null);
  const focusFollows = useRef(false);
  useEffect(() => { if (focusFollows.current) { currentRef.current?.focus(); focusFollows.current = false; } }, [currentPage, items]);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const move = NAV_KEYS[event.key];
    if (!move) return;
    event.preventDefault(); // ο θεατής (`usePdfKeyboard`) δεν ξαναχειρίζεται το ίδιο πλήκτρο
    focusFollows.current = true;
    onNavigate(move(currentPage, numPages));
  };

  return (
    <nav ref={scrollRef} aria-label={t('pdf.sidebar.thumbnails')} className="h-full overflow-y-auto overscroll-contain" onKeyDown={onKeyDown}>
      <ol className="m-0 flex list-none flex-col items-center p-0">
        <li ref={topRef} aria-hidden className="w-full shrink-0" />
        {items.map((item) => (
          <li key={item.key} data-index={item.index} ref={virtualizer.measureElement} className="py-1.5">
            <ThumbButton
              page={item.index + 1}
              label={pageLabels?.[item.index] ?? String(item.index + 1)}
              current={item.index + 1 === currentPage}
              currentRef={currentRef}
              thumb={store?.get(item.index + 1, rotation) ?? null}
              defaultAspect={props.defaultAspect}
              onNavigate={onNavigate}
            />
          </li>
        ))}
        <li ref={bottomRef} aria-hidden className="w-full shrink-0" />
      </ol>
    </nav>
  );
}
