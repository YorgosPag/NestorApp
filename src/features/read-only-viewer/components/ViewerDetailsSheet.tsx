'use client';

/**
 * **ΤΟ ΒΟΗΘΗΤΙΚΟ ΠΑΝΕΛ ΣΕ ΣΤΕΝΗ ΟΘΟΝΗ** — φύλλο με στάσεις πάνω από την κάτοψη. ADR-912 §12.17 · ADR-777 §8.20 (αναθ.).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔄 ΑΝΑΘΕΩΡΗΣΗ 2026-10-18: ΑΠΟ MODAL ΣΕ ΜΗ-ΑΠΟΚΛΕΙΣΤΙΚΟ ΦΥΛΛΟ ΜΕ ΣΤΑΣΕΙΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ως τώρα ήταν **modal** `Sheet` (Radix Dialog), με το σκεπτικό ότι «καμία ανάγκη να δει κανείς κάτοψη και στοιχεία
 * στο ίδιο καρέ». Το στιγμιότυπο Giorgio (390×844) το διέψευσε δύο φορές:
 *  1. 🔴 **Δεν κυλούσε**: το φύλλο είχε μόνο `max-h`, άρα το `h-full` του πάνελ λυνόταν σε `auto` και το `overflow-hidden`
 *     έκοβε το περιεχόμενο — η «Πληρότητα καταχώρησης» μισή, καμία κύλιση.
 *  2. 🔴 **Η ανάγκη υπάρχει**: τα «Επίπεδα Ακινήτου → Μετάβαση» αλλάζουν την **κάτοψη** — με σκοτεινό στρώμα από πάνω, ο
 *     άνθρωπος πατούσε και δεν έβλεπε το αποτέλεσμα.
 *
 * 🏆 Η πρακτική: Apple Maps / Find My (detents medium + large, χωρίς στρώμα ⇒ αφή μέσα **και** έξω από το φύλλο) ·
 *   Google Maps (κάρτα τόπου) · Material 3 *standard bottom sheet*. Ο φόβος του παλιού σκεπτικού — «το σύρσιμο της
 *   κάτοψης θα κύλιε τη σελίδα» — λύνεται από τον ίδιο τον μηχανισμό: το δοχείο είναι `pointer-events-none`, άρα πάνω
 *   από το φύλλο κάθε χειρονομία πηγαίνει στην κάτοψη (pinch · pan), μέσα στο φύλλο στο φύλλο.
 *
 * 🔑 **Ένας μηχανισμός** (`SnapBottomSheet`, κοινός με το φύλλο αποτελεσμάτων)· εδώ μόνο η γεωμετρία (ματιά 0% =
 *   κλειστό), οι ετικέτες και η περιοχή κύλισης. Η κύλιση ζει στην **περιοχή** (`data-list-scroll`), όχι στο πάνελ —
 *   το πάνελ αποδίδεται με `scrollOwner="host"` — ώστε (α) να κυλά πάντα, (β) στο «μισό» το σύρσιμο να μεγαλώνει το
 *   φύλλο αντί να κυλά μια χαραμάδα (NN/g).
 * 🔑 **Το περιεχόμενο προσαρτάται μόνο όσο είναι ανοιχτό** — όπως και πριν (Radix): το ίδιο πάνελ ζει ως στήλη στο φαρδύ,
 *   και δύο ζωντανά αντίτυπα θα διπλασίαζαν αναγνώσεις και δέντρο προσβασιμότητας.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { SnapBottomSheet } from '@/components/ui/snap-bottom-sheet/SnapBottomSheet';
import { useSheetSnap, type SheetSnapController } from '@/hooks/media/useSheetSnap';
import type { ViewportClass } from '@/hooks/media/useViewportClass';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { BOTTOM_SHEET_DISMISS_STOP } from '@/lib/layout/bottom-sheet-stops';

import { VIEWER_DETAILS_SHEET_HISTORY_KEY } from '../viewer-panes';
import styles from './viewer-details-sheet.module.css';

export interface DetailsSheetState {
  readonly controller: SheetSnapController;
  /** Το περιεχόμενο είναι προσαρτημένο (ζητήθηκε και δεν έχει ξαναγυρίσει στο «κλειστό»). */
  readonly mounted: boolean;
  /** «Στοιχεία» — ανοίγει στο μισό (Apple medium detent). */
  readonly open: () => void;
  /**
   * Φεύγει από τη λεπτομέρεια με το φύλλο ίσως ανοιχτό: κλείνει ΠΡΩΤΑ το φύλλο (η καταχώριση ιστορικού του είναι η
   * επάνω) και ΜΕΤΑ εκτελεί το `then`. Αλλιώς θα έμενε ορφανή καταχώριση και το «πίσω» του τηλεφώνου θα έκανε άδειο βήμα.
   */
  readonly leave: (then: () => void) => void;
}

/**
 * **Ο ΕΝΑΣ κάτοχος του κύκλου ζωής του φύλλου.** Ζητήθηκε ⇒ το περιεχόμενο προσαρτάται ΠΡΙΝ από την κίνηση (αλλιώς το
 * φύλλο θα ανέβαινε άδειο ώσπου η στάση να αλλάξει όνομα στη μέση της διαδρομής) ⇒ κίνηση στο «μισό». Ξαναγύρισε στο
 * «κλειστό» — με ✕, σύρσιμο, ή «πίσω» του τηλεφώνου — ⇒ αποπροσάρτηση. Φαρδιά οθόνη ⇒ τίποτα (το πάνελ είναι στήλη).
 */
export function useDetailsSheet(viewport: ViewportClass): DetailsSheetState {
  const narrow = viewport === 'narrow';
  const controller = useSheetSnap(narrow);
  const [requested, setRequested] = useState(false);
  const { stop, snapTo } = controller;
  const wasOpen = useRef(false);
  const afterClose = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!narrow) setRequested(false);
  }, [narrow]);
  useEffect(() => {
    if (requested && narrow && stop === BOTTOM_SHEET_DISMISS_STOP && !wasOpen.current) snapTo('half');
  }, [requested, narrow, stop, snapTo]);
  useEffect(() => {
    if (stop !== BOTTOM_SHEET_DISMISS_STOP) wasOpen.current = true;
    else if (wasOpen.current) {
      wasOpen.current = false;
      setRequested(false);
      const then = afterClose.current;
      afterClose.current = null;
      then?.();
    }
  }, [stop]);

  const open = useCallback(() => setRequested(true), []);
  const leave = useCallback((then: () => void) => {
    if (!wasOpen.current) {
      setRequested(false);
      then();
      return;
    }
    afterClose.current = then;
    snapTo(BOTTOM_SHEET_DISMISS_STOP);
  }, [snapTo]);
  return { controller, mounted: requested && narrow, open, leave };
}

interface ViewerDetailsSheetProps {
  readonly state: DetailsSheetState;
  readonly viewport: ViewportClass;
  readonly children: React.ReactNode;
}

export function ViewerDetailsSheet({ state, viewport, children }: ViewerDetailsSheetProps) {
  const { t } = useTranslation(['properties-viewer']);
  const { controller } = state;

  return (
    <SnapBottomSheet
      controller={controller}
      viewport={viewport}
      historyKey={VIEWER_DETAILS_SHEET_HISTORY_KEY}
      geometryClassName={styles.geometry}
      dismissible
      title={t('properties-viewer:viewer.narrow.detailsTitle')}
      labels={{
        sheet: t('properties-viewer:viewer.narrow.detailsTitle'),
        less: t('properties-viewer:viewer.narrow.lessDetails'),
        more: t('properties-viewer:viewer.narrow.moreDetails'),
        close: t('properties-viewer:viewer.narrow.closeDetails'),
      }}
      className="md:hidden"
    >
      {/* `overscroll-contain`: η κύλιση στο άκρο δεν διαρρέει στο φύλλο/κάτοψη. `min-h-0`: αλλιώς το flex παιδί δεν
          συρρικνώνεται και η περιοχή δεν κυλά ποτέ. */}
      <div data-list-scroll="" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {state.mounted && children}
      </div>
    </SnapBottomSheet>
  );
}
