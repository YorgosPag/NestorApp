'use client';

/**
 * @fileoverview **Η ΣΧΕΣΗ ΤΗΣ ΕΣΤΙΑΣΗΣ ΜΕ ΤΟ ΟΠΤΙΚΟ ΠΕΔΙΟ** — μία ερώτηση, δύο απαντήσεις.
 * @related ADR-777 §7 (Α3) · lib/a11y/reveal-in-scroll.ts · lib/listings/listing-focus.ts
 * @module hooks/listings/useListingRevealTracking
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΔΥΟ ΑΙΤΙΕΣ, ΔΥΟ ΑΠΟΤΕΛΕΣΜΑΤΑ — ΚΑΙ Η ΔΙΑΦΟΡΑ ΕΙΝΑΙ ΜΕΤΡΗΜΕΝΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Αιτία | Πρόθεση | Τι επιτρέπεται |
 * |---|---|---|
 * | **κλικ** στην πινέζα (`selected`) | σκόπιμη, μία φορά | **κυλά** τη λίστα |
 * | **hover** πάνω στην πινέζα (`peeked`) | ακούσια, δεκάδες φορές | **ΠΟΤΕ** δεν κυλά — **το λέει** |
 *
 * 🏆 **Η δεύτερη γραμμή είναι το εύρημα της έρευνας.** Η **Figma** υλοποίησε auto-scroll
 * στο Layers panel και **το απέσυρε**: οι δοκιμαστές έχαναν τα συμφραζόμενά τους, *«σαν
 * χάρτης που πηδά σε άλλη τοποθεσία ενώ οδηγείς»*. Το **Cinema 4D** και το **Revit**
 * ποτέ δεν το έκαναν αυτόματο — έχουν **ρητή** εντολή (`S` · *Find in Project Browser*).
 *
 * ⇒ Πηγαίνοντας τον δείκτη από την Πάτρα στη Θεσσαλονίκη περνάς πάνω από τρεις πινέζες.
 * Με auto-scroll στο hover, η λίστα **πηδά τρεις φορές πριν φτάσεις**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΚΑΙ ΕΔΩ ΞΕΠΕΡΝΑΜΕ ΤΟΥΣ ΜΕΓΑΛΟΥΣ: ΤΟ ΤΡΙΤΟ ΣΚΕΛΟΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η Figma είχε **δύο** επιλογές — «πήδα» ή «μην κάνεις τίποτα» — και διάλεξε τη δεύτερη,
 * αφήνοντας τον άνθρωπο να **μη μάθει ποτέ** ότι το επιλεγμένο είναι 200px πιο κάτω.
 * Υπάρχει **τρίτη**: *«μην κουνηθείς, **πες του πού είναι**»*. Αυτό είναι το
 * {@link ListingRevealTracking.focusVisibility} — και τροφοδοτεί τον δείκτη άκρης.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { revealInScroll, visibilityWithinScroller, type ScrollVisibility } from '@/lib/a11y/reveal-in-scroll';
import { focusedListingId, type ListingFocus } from '@/lib/listings/listing-focus';

/** Το γνώρισμα με το οποίο κάθε κάρτα δηλώνει **ποια αγγελία είναι**. */
export const LISTING_CARD_ID_ATTRIBUTE = 'data-listing-id';

export interface ListingRevealTracking {
  /** Μπαίνει στο **δοχείο κύλισης** της λίστας. */
  readonly scrollerRef: React.RefObject<HTMLDivElement | null>;
  /** Πού βρίσκεται η εστιασμένη αγγελία σε σχέση με ό,τι βλέπει ο άνθρωπος **τώρα**. */
  readonly focusVisibility: ScrollVisibility;
  /** «Πήγαινέ με εκεί» — η **ρητή** πράξη, δεμένη στον δείκτη άκρης. */
  readonly revealFocused: () => void;
}

function cardElement(scroller: HTMLElement | null, id: string | null): HTMLElement | null {
  if (!scroller || !id) return null;
  return scroller.querySelector<HTMLElement>(`[${LISTING_CARD_ID_ATTRIBUTE}="${CSS.escape(id)}"]`);
}

export function useListingRevealTracking(focus: ListingFocus): ListingRevealTracking {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [focusVisibility, setFocusVisibility] = useState<ScrollVisibility>('unknown');

  const focused = focusedListingId(focus);
  const { selected } = focus;

  /**
   * **ΤΟ ΚΛΙΚ ΚΥΛΑ** — και μόνο αυτό.
   *
   * ⚠️ Η εξάρτηση είναι το `focus.selected` **σκέτο**, ποτέ ολόκληρο το `focus`: με το
   * αντικείμενο ως εξάρτηση, κάθε κίνηση του ποντικιού πάνω από τον χάρτη θα ξανάτρεχε
   * αυτό το effect — δηλαδή θα **επανέφερε** το auto-scroll του hover από την πίσω πόρτα,
   * ακριβώς αυτό που το αρχείο υπάρχει για να αποτρέψει.
   */
  useEffect(() => {
    if (!selected) return;
    revealInScroll(cardElement(scrollerRef.current, selected), {
      urgency: 'requested',
      // `'nearest'`: αν η κάρτα είναι ήδη ορατή — η **συνήθης** περίπτωση με 6-9
      // αποτελέσματα — δεν κουνιέται απολύτως τίποτα.
      block: 'nearest',
    });
  }, [selected]);

  /**
   * **Η ΠΑΡΑΚΟΛΟΥΘΗΣΗ ΟΡΑΤΟΤΗΤΑΣ** — η είσοδος του δείκτη άκρης.
   *
   * ⚠️ **Ακούει και την κύλιση**, όχι μόνο την αλλαγή εστίασης: ο άνθρωπος μπορεί να
   * κυλήσει τη λίστα **ενώ** κρατά τον δείκτη πάνω σε πινέζα, και ένας δείκτης άκρης
   * που δεν το προσέχει θα έλεγε «πιο πάνω» για κάτι που μόλις έγινε ορατό — δηλαδή θα
   * έλεγε **ψέματα**, που είναι χειρότερο από το να σιωπά.
   *
   * 🔑 **`requestAnimationFrame`, όχι χρονόμετρο**: η μέτρηση είναι `getBoundingClientRect`,
   * δηλαδή **επιβάλλει διάταξη**. Σε καρέ κύλισης πρέπει να συμβαίνει **μία** φορά ανά
   * καρέ, αλλιώς είναι layout thrashing στο ίδιο νήμα που κυλά η οθόνη.
   */
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !focused) {
      setFocusVisibility('unknown');
      return;
    }

    let frame = 0;
    const measure = (): void => {
      frame = 0;
      setFocusVisibility(visibilityWithinScroller(cardElement(scroller, focused), scroller));
    };
    const schedule = (): void => {
      if (frame === 0) frame = requestAnimationFrame(measure);
    };

    measure();
    scroller.addEventListener('scroll', schedule, { passive: true });
    return () => {
      scroller.removeEventListener('scroll', schedule);
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, [focused]);

  const revealFocused = useCallback(() => {
    revealInScroll(cardElement(scrollerRef.current, focusedListingId(focus)), {
      urgency: 'requested',
      // 🔑 **`'center'` ΕΔΩ, σε αντίθεση με το κλικ — και είναι το ίδιο σκεπτικό.**
      // Ο άνθρωπος πάτησε δείκτη που λέει «είναι πιο πάνω»: η πράξη του **είναι** «πήγαινέ
      // με εκεί». Το `'nearest'` θα το έφερνε οριακά στην άκρη, δηλαδή θα απαντούσε
      // τυπικά και θα άφηνε τη ματιά να ψάχνει.
      block: 'center',
    });
  }, [focus]);

  return { scrollerRef, focusVisibility, revealFocused };
}
