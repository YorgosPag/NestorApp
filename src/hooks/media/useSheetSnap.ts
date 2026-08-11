'use client';

/**
 * @fileoverview **Ο ελεγκτής του φύλλου** — διαβάζει τη στάση από το DOM, δεν την κρατά.
 * @related ADR-777 §7 (Α3) · SPEC-777D §26.3 · lib/layout/bottom-sheet-stops
 * @module hooks/media/useSheetSnap
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΦΥΣΙΚΗ ΕΙΝΑΙ ΤΟΥ ΠΕΡΙΗΓΗΤΗ. ΕΔΩ ΜΕΝΕΙ ΜΟΝΟ Η ΑΝΑΦΟΡΑ.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το φύλλο **δεν σέρνεται με JavaScript**: είναι δοχείο `scroll-snap` με τρεις άγκυρες.
 * Την ορμή, την ταχύτητα εκτόξευσης, την προσγείωση στη στάση, την αντιστροφή στα άκρα
 * και τη συμπεριφορά της αφής τα κάνει ο **περιηγητής** — δηλαδή ο ίδιος κώδικας που
 * κάνει τα φύλλα του λειτουργικού να μοιάζουν σωστά.
 *
 * 🏆 **Πού ξεπερνά την πρακτική των μεγάλων.** Οι βιβλιοθήκες φύλλου (vaul, react-spring
 * bottom sheet) υλοποιούν τη φυσική **μόνες τους** πάνω σε `pointer` γεγονότα: κάθε μία
 * κουβαλά δικό της μοντέλο ορμής, δικό της κατώφλι «πέταξέ το», και **χάνει** τη
 * μεταβλητή ταχύτητα κύλισης του λειτουργικού. Εδώ δεν γράφεται καθόλου — και μαζί
 * έρχονται δωρεάν το **πληκτρολόγιο** (PageUp/PageDown, βελάκια μέσα σε δοχείο κύλισης)
 * και ο **αναγνώστης οθόνης**, που ξέρει να διαβάζει περιοχή κύλισης αλλά **δεν** ξέρει
 * τι σημαίνει `transform: translateY(…)` που άλλαξε από `pointermove`.
 *
 * ⚠️ **ΚΑΜΙΑ ΓΕΩΜΕΤΡΙΑ ΕΔΩ.** Η θέση κάθε στάσης είναι το `offsetTop` της άγκυρας της.
 * Οι άγκυρες είναι απολύτως τοποθετημένες μέσα στο δοχείο, άρα το `offsetTop` **είναι**
 * το `scrollTop` στο οποίο η `scroll-snap-align: start` τις προσγειώνει — η ίδια τιμή,
 * διαβασμένη αντί για υπολογισμένη.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  BOTTOM_SHEET_RESTING_STOP,
  BOTTOM_SHEET_STOPS,
  stopAnchorSelector,
  type BottomSheetStop,
} from '@/lib/layout/bottom-sheet-stops';

export interface SheetSnapController {
  /** Πηγαίνει στο δοχείο κύλισης — **αυτό** είναι το φύλλο, όχι η ορατή επιφάνεια. */
  readonly scrollerRef: React.RefObject<HTMLDivElement | null>;
  /** Πού κάθεται **τώρα**. Στο `active === false` είναι πάντα η στάση ηρεμίας. */
  readonly stop: BottomSheetStop;
  /** Στέλνει το φύλλο σε στάση. Σιωπηλά αδρανές αν το δοχείο δεν έχει προσαρτηθεί. */
  readonly snapTo: (stop: BottomSheetStop) => void;
}

/** Το `scrollTop` στο οποίο προσγειώνεται η στάση — ή `null` αν η άγκυρα δεν αποδίδεται. */
function anchorOffset(scroller: HTMLElement, stop: BottomSheetStop): number | null {
  const anchor = scroller.querySelector<HTMLElement>(stopAnchorSelector(stop));
  return anchor ? anchor.offsetTop : null;
}

/**
 * Ποια στάση περιγράφει την **τωρινή** θέση κύλισης.
 *
 * ⚠️ «Πλησιέστερη», όχι «ακριβής»: κατά το σύρσιμο η θέση είναι **ανάμεσα** σε στάσεις,
 * και η αναφορά οφείλει να απαντά και τότε. Η `scroll-snap-type: y mandatory` εγγυάται
 * ότι η **ηρεμία** πέφτει πάντα σε άγκυρα, άρα η προσέγγιση δεν διαρρέει σε τελική τιμή.
 */
function stopAtScroll(scroller: HTMLElement): BottomSheetStop | null {
  let best: BottomSheetStop | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const stop of BOTTOM_SHEET_STOPS) {
    const offset = anchorOffset(scroller, stop);
    if (offset === null) continue;
    const distance = Math.abs(offset - scroller.scrollTop);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = stop;
    }
  }

  return best;
}

/**
 * **Ο ελεγκτής των τριών στάσεων.**
 *
 * @param active `false` όταν η διάταξη δεν είναι φύλλο (ευρεία οθόνη ή «μετράω ακόμη»).
 *
 * ⚠️ **Το `active` δεν είναι σημαία απόδοσης — είναι ειλικρίνεια.** Σε ευρεία οθόνη το
 * ίδιο DOM είναι **στήλη**: δεν κυλίεται, δεν έχει στάσεις, και μια αναφορά «πλήρες»
 * από εκεί θα ήταν ισχυρισμός για κατάσταση που **δεν υπάρχει** — και θα κλείδωνε την
 * εσωτερική κύλιση της λίστας, που στη στήλη οφείλει να δουλεύει πάντα.
 */
export function useSheetSnap(active: boolean): SheetSnapController {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [stop, setStop] = useState<BottomSheetStop>(BOTTOM_SHEET_RESTING_STOP);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!active || !scroller) {
      setStop(BOTTOM_SHEET_RESTING_STOP);
      return;
    }

    // Ένα καρέ ανά κύλιση, όχι ένα ανά γεγονός: η αφή εκπέμπει δεκάδες ανά δευτερόλεπτο
    // και η κατάσταση αλλάζει το πολύ δύο φορές σε ολόκληρη τη χειρονομία.
    let frame = 0;
    const report = (): void => {
      frame = 0;
      const current = stopAtScroll(scroller);
      if (current) setStop((previous) => (previous === current ? previous : current));
    };
    const onScroll = (): void => {
      if (frame === 0) frame = window.requestAnimationFrame(report);
    };

    report();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, [active]);

  const snapTo = useCallback((target: BottomSheetStop): void => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const offset = anchorOffset(scroller, target);
    // ⚠️ Χωρίς `behavior`: την ομαλότητα την ορίζει το `scroll-behavior` του module, που
    // υπακούει στο «λιγότερη κίνηση» χωρίς να το ρωτά κανείς δεύτερη φορά.
    if (offset !== null) scroller.scrollTo({ top: offset });
  }, []);

  return { scrollerRef, stop, snapTo };
}
