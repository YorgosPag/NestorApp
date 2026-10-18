'use client';

/**
 * @fileoverview **ΤΟ ΕΝΑ ΦΥΛΛΟ ΠΥΘΜΕΝΑ ΜΕ ΣΤΑΣΕΙΣ** — μη-αποκλειστικό, πάνω από επιφάνεια που μένει ζωντανή.
 * @related ADR-912 §12.17 · ADR-777 Α3 / §8.20 · SPEC-777D §26.3 · hooks/media/useSheetSnap · lib/layout/bottom-sheet-stops
 * @module components/ui/snap-bottom-sheet/SnapBottomSheet
 *
 * 🏆 Η πρακτική: Apple Maps / Find My (UISheetPresentationController, detents medium + large, χωρίς σκοτεινό στρώμα ώστε
 *   ο άνθρωπος να αγγίζει **και** μέσα **και** έξω από το φύλλο) · Google Maps (κάρτα τόπου) · Material 3 *standard
 *   bottom sheet* (χωρίς scrim, συνυπάρχει με το κύριο περιεχόμενο) · NN/g «Bottom Sheets».
 *
 * 🔑 **Η φυσική είναι του περιηγητή** (`scroll-snap`, βλ. `useSheetSnap`) — καμία βιβλιοθήκη ορμής, και δωρεάν
 *   πληκτρολόγιο + αναγνώστης οθόνης. Το δοχείο είναι `pointer-events-none`· μόνο η ορατή επιφάνεια ξανανάβει, άρα η
 *   επιφάνεια από κάτω (χάρτης, κάτοψη) **σέρνεται από το κενό**.
 * 🔑 **Δύο καταναλωτές, ένας μηχανισμός**: τα αποτελέσματα αναζήτησης (`ResultsSheet` — δεν κλείνει ποτέ, στήλη στο
 *   φαρδύ) και τα στοιχεία ακινήτου (`ViewerDetailsSheet` — κλείνει, ματιά 0%). Η γεωμετρία (ύψη στάσεων) ζει στο module
 *   **του καταναλωτή** (`geometryClassName`)· εδώ μόνο η σχέση «άγκυρα = στάση − ηρεμία».
 * 🔑 **NN/g κανόνας 1**: όσο το φύλλο δεν είναι πλήρες, η εσωτερική κύλιση (`[data-list-scroll]`) κρατιέται, ώστε το
 *   σύρσιμο να **μεγαλώνει το φύλλο** αντί να κυλά μια χαραμάδα.
 * 🔑 **`dismissible`**: η ματιά είναι «κλειστό» ⇒ η επιφάνεια είναι `inert` εκεί (εκτός οθόνης = εκτός Tab και
 *   αναγνώστη οθόνης), και υπάρχει ορατό ✕ (NN/g κανόνας 3: *visible, tappable dismiss*).
 *
 * ⚠️ Οι κλάσεις των αγκυρών είναι **γραμμένες ολόκληρες**: ο σαρωτής του Tailwind διαβάζει πηγαίο κείμενο, άρα κλάση
 *   συναρμολογημένη σε χρόνο εκτέλεσης δεν θα παραγόταν ποτέ (ιστορικό στο `ResultsSheet`).
 */

import React, { useCallback, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { SheetSnapController } from '@/hooks/media/useSheetSnap';
import { useSheetBackDismiss } from '@/hooks/media/useSheetBackDismiss';
import type { ViewportClass } from '@/hooks/media/useViewportClass';
import {
  BOTTOM_SHEET_DISMISS_STOP,
  BOTTOM_SHEET_STOPS,
  BOTTOM_SHEET_STOP_ATTRIBUTE,
  stepStop,
  type BottomSheetStop,
} from '@/lib/layout/bottom-sheet-stops';
import { cn } from '@/lib/utils';

import styles from './snap-bottom-sheet.module.css';

/** Πού κάθεται η άγκυρα κάθε στάσης, **σε σχέση με τη στάση ηρεμίας** (= `scrollTop 0`). */
const STOP_ANCHOR_CLASS: Readonly<Record<BottomSheetStop, string>> = {
  peek: 'top-0',
  half: 'top-[calc(var(--sheet-half)-var(--sheet-peek))]',
  full: 'top-[calc(var(--sheet-full)-var(--sheet-peek))]',
};

export interface SnapBottomSheetLabels {
  /** Όνομα της επιφάνειας (`section`). */
  readonly sheet: string;
  /** «Μικρότερο φύλλο» — περισσότερη επιφάνεια από κάτω. */
  readonly less: string;
  /** «Μεγαλύτερο φύλλο». */
  readonly more: string;
  /** ✕ — μόνο σε `dismissible`. */
  readonly close?: string;
}

export interface SnapBottomSheetProps {
  /** Ο ελεγκτής (`useSheetSnap`) — τον κρατά ο καταναλωτής, ώστε να ανοίγει το φύλλο από δικό του κουμπί. */
  readonly controller: SheetSnapController;
  /** Η **μία** ερώτηση της οθόνης. Οδηγεί **συμπεριφορά** (στάσεις, «πίσω»), ποτέ σχήμα — το σχήμα είναι CSS `md:`. */
  readonly viewport: ViewportClass;
  /** Η καταχώριση ιστορικού που ανήκει σε αυτό το φύλλο — **δική του**, ποτέ κοινή. */
  readonly historyKey: string;
  readonly labels: SnapBottomSheetLabels;
  /** Δηλώνει `--sheet-peek` / `--sheet-half` / `--sheet-full` (module του καταναλωτή). */
  readonly geometryClassName: string;
  /** Η ματιά είναι «κλειστό». */
  readonly dismissible?: boolean;
  /** Αριστερά στη γραμμή της λαβής (π.χ. τίτλος). */
  readonly title?: ReactNode;
  /** Επιπλέον κλάσεις του δοχείου — π.χ. η φαρδιά συμπεριφορά (`md:static …`) ή `md:hidden`. */
  readonly className?: string;
  /** Επιπλέον κλάσεις της επιφάνειας. */
  readonly surfaceClassName?: string;
  readonly children: ReactNode;
}

export function SnapBottomSheet(props: SnapBottomSheetProps) {
  const { controller, viewport, historyKey, dismissible = false } = props;
  const { scrollerRef, stop, snapTo } = controller;
  const isSheet = viewport === 'narrow';

  const dismiss = useCallback(() => snapTo(BOTTOM_SHEET_DISMISS_STOP), [snapTo]);
  useSheetBackDismiss({ historyKey, active: isSheet, expanded: stop !== BOTTOM_SHEET_DISMISS_STOP, dismiss });

  // Η αναφορά λέει «δεν ξέρω» όταν δεν ξέρει — ποτέ «στήλη» πριν τη μέτρηση (Ζ12).
  const reportedState = viewport === 'measuring' ? 'measuring' : isSheet ? stop : 'column';
  // Κρίνεται ΜΟΝΟ η στάση, ποτέ η κλάση πλάτους: ίδιες κλάσεις σε κάθε κατάσταση μέτρησης ⇒ CLS 0 (Ζ4).
  const holdInnerScroll = stop !== 'full';
  const closed = dismissible && isSheet && stop === BOTTOM_SHEET_DISMISS_STOP;

  return (
    <div
      ref={scrollerRef}
      data-sheet-state={reportedState}
      className={cn(
        styles.scroller,
        props.geometryClassName,
        'pointer-events-none absolute inset-0 z-10 snap-y snap-mandatory overflow-y-scroll overscroll-y-contain',
        props.className,
      )}
    >
      {BOTTOM_SHEET_STOPS.map((anchorStop) => (
        <i
          key={anchorStop}
          aria-hidden="true"
          {...{ [BOTTOM_SHEET_STOP_ATTRIBUTE]: anchorStop }}
          className={cn('absolute h-px w-px snap-start md:hidden', STOP_ANCHOR_CLASS[anchorStop])}
        />
      ))}

      {/* ΤΟ ΔΙΑΚΕΝΟ — εδώ φαίνεται και σέρνεται η επιφάνεια από κάτω. Ύψος από τη στάση ηρεμίας: `scrollTop 0` = ματιά. */}
      <div aria-hidden="true" className="h-[calc(100%-var(--sheet-peek))] md:hidden" />

      <section
        aria-label={props.labels.sheet}
        inert={closed || undefined}
        className={cn(
          'pointer-events-auto flex h-[var(--sheet-full)] flex-col overflow-hidden',
          'rounded-t-2xl border-x border-t border-border bg-card shadow-lg',
          props.surfaceClassName,
          holdInnerScroll && '[&_[data-list-scroll]]:overflow-y-hidden md:[&_[data-list-scroll]]:overflow-y-auto',
        )}
      >
        <SheetChrome {...props} stop={stop} snapTo={snapTo} />
        {props.children}
      </section>
    </div>
  );
}

interface SheetChromeProps extends SnapBottomSheetProps {
  readonly stop: BottomSheetStop;
  readonly snapTo: (stop: BottomSheetStop) => void;
}

/**
 * Λαβή + κουμπιά στάσεων (+ ✕). Η λαβή είναι **σήμα, όχι χειριστήριο** (`aria-hidden`)· τα κουμπιά είναι ο **μόνος**
 * δρόμος σε κάθε στάση για όποιον δεν σέρνει (NN/g κανόνας 3). Αποδίδεται ΠΑΝΤΑ, κρύβεται με `md:hidden` (CLS 0).
 */
function SheetChrome({ stop, snapTo, labels, title, dismissible }: SheetChromeProps) {
  const iconSizes = useIconSizes();
  const more = stepStop(stop, 1);
  const less = stepStop(stop, -1);

  return (
    <header className="relative flex shrink-0 items-center justify-end gap-1 px-2 py-2 md:hidden">
      <span aria-hidden="true" className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-border" />
      {title && <span className="mr-auto min-w-0 truncate pl-2 pt-2 text-sm font-semibold">{title}</span>}
      <Button type="button" variant="ghost" size="icon" disabled={less === null} onClick={() => less && snapTo(less)} aria-label={labels.less}>
        <ChevronDown className={iconSizes.sm} aria-hidden="true" />
      </Button>
      <Button type="button" variant="ghost" size="icon" disabled={more === null} onClick={() => more && snapTo(more)} aria-label={labels.more}>
        <ChevronUp className={iconSizes.sm} aria-hidden="true" />
      </Button>
      {dismissible && labels.close && (
        <Button type="button" variant="ghost" size="icon" onClick={() => snapTo(BOTTOM_SHEET_DISMISS_STOP)} aria-label={labels.close}>
          <X className={iconSizes.sm} aria-hidden="true" />
        </Button>
      )}
    </header>
  );
}
