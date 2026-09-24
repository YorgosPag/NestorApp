'use client';

/**
 * @fileoverview **Η ΣΧΕΣΗ ΤΗΣ ΕΣΤΙΑΣΗΣ ΜΕ ΤΟ ΟΠΤΙΚΟ ΠΕΔΙΟ** — μία ερώτηση, δύο απαντήσεις.
 * @related ADR-777 §7 (Α3) · §8.77 · lib/a11y/reveal-in-scroll.ts · lib/listings/listing-focus.ts
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
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🗺️ ΔΥΟ ΚΑΔΡΑ, ΜΙΑ ΜΕΤΡΗΣΗ (ADR-777 §8.77)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | κάδρο | πού | τι κυλά |
 * |---|---|---|
 * | `'container'` (προεπιλογή) | λίστα της οθόνης 2 | το **ίδιο** το δοχείο των καρτών |
 * | `'viewport'` | χαρτοφυλάκιο κατόχου (`/offers`, λίστα ‖ χάρτης) | **ολόκληρη η σελίδα** |
 *
 * Και στα δύο το δοχείο **βρίσκει** τις κάρτες· αλλάζει μόνο το κάδρο της μέτρησης. Δεύτερο
 * hook θα ήταν δεύτερη απάντηση στην ίδια ερώτηση.
 */

import { useCallback, useEffect, useState } from 'react';

import {
  revealInScroll,
  visibilityWithinScroller,
  type ScrollFrame,
  type ScrollVisibility,
} from '@/lib/a11y/reveal-in-scroll';
import { focusedListingId, type ListingFocus } from '@/lib/listings/listing-focus';

/** Το γνώρισμα με το οποίο κάθε κάρτα δηλώνει **ποια αγγελία είναι**. */
export const LISTING_CARD_ID_ATTRIBUTE = 'data-listing-id';

/** Ως προς τι μετράμε το «ορατό» — δες τον πίνακα στην κεφαλίδα. */
export type ListingRevealFrame = 'container' | 'viewport';

export interface ListingRevealTracking {
  /**
   * Μπαίνει στο στοιχείο που **περιέχει** τις κάρτες (με `'container'`: και κυλά).
   *
   * 🔑 **Callback ref, όχι `RefObject`**: το στοιχείο μπορεί να γεννηθεί **αργότερα** (το
   * χαρτοφυλάκιο περνά από `tabs` σε `split` όταν φαρδύνει ο χώρος). Ένα `RefObject` δεν
   * ειδοποιεί κανέναν· εδώ η άφιξη του στοιχείου **ξανατρέχει** μέτρηση και αποκάλυψη.
   */
  readonly containerRef: (element: HTMLElement | null) => void;
  /** Πού βρίσκεται η εστιασμένη αγγελία σε σχέση με ό,τι βλέπει ο άνθρωπος **τώρα**. */
  readonly focusVisibility: ScrollVisibility;
  /** «Πήγαινέ με εκεί» — η **ρητή** πράξη, δεμένη στον δείκτη άκρης. */
  readonly revealFocused: () => void;
}

function cardElement(container: HTMLElement | null, id: string | null): HTMLElement | null {
  if (!container || !id) return null;
  return container.querySelector<HTMLElement>(`[${LISTING_CARD_ID_ATTRIBUTE}="${CSS.escape(id)}"]`);
}

/**
 * **ΤΟ ΚΛΙΚ ΚΥΛΑ** — και μόνο αυτό. Το `scrollIntoView` ανεβαίνει ως τον πρώτο πρόγονο που κυλά,
 * άρα η ίδια γραμμή εξυπηρετεί και το δοχείο της οθόνης 2 και τη σελίδα του χαρτοφυλακίου.
 *
 * ⚠️ Η εξάρτηση είναι το `selected` **σκέτο**, ποτέ ολόκληρο το `focus`: με το αντικείμενο ως
 * εξάρτηση, κάθε κίνηση του ποντικιού πάνω από τον χάρτη θα ξανάτρεχε αυτό το effect — δηλαδή
 * θα **επανέφερε** το auto-scroll του hover από την πίσω πόρτα, ακριβώς αυτό που το αρχείο
 * υπάρχει για να αποτρέψει.
 */
function useRevealSelectedListing(container: HTMLElement | null, selected: string | null): void {
  useEffect(() => {
    if (!container || !selected) return;
    const reveal = (card: HTMLElement): void => revealInScroll(card, {
      urgency: 'requested',
      // `'nearest'`: αν η κάρτα είναι ήδη ορατή — η **συνήθης** περίπτωση με 6-9
      // αποτελέσματα — δεν κουνιέται απολύτως τίποτα.
      block: 'nearest',
    });

    const card = cardElement(container, selected);
    if (card) {
      reveal(card);
      return;
    }
    /*
      🔴 **«ΔΕΝ ΤΗ ΒΡΙΣΚΩ» ≠ «ΔΕΝ ΥΠΑΡΧΕΙ»** (μάθημα ADR-332 D20.1 · μετρημένο ζωντανά, §8.77.6):
      ο σύνδεσμος `?selected=` φέρνει την επιλογή **πριν** φτάσουν οι κάρτες από το δίκτυο — και
      τίποτα από τις εξαρτήσεις δεν αλλάζει όταν φτάσουν. Περιμένουμε λοιπόν την **άφιξη της
      κάρτας** στο δοχείο, αποκαλύπτουμε **μία** φορά και σταματάμε να κοιτάμε.
    */
    const observer = new MutationObserver(() => {
      const arrived = cardElement(container, selected);
      if (!arrived) return;
      observer.disconnect();
      reveal(arrived);
    });
    observer.observe(container, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [container, selected]);
}

/**
 * **Η ΠΑΡΑΚΟΛΟΥΘΗΣΗ ΟΡΑΤΟΤΗΤΑΣ** — η είσοδος του δείκτη άκρης.
 *
 * ⚠️ **Ακούει και την κύλιση**, όχι μόνο την αλλαγή εστίασης: ο άνθρωπος μπορεί να κυλήσει
 * **ενώ** κρατά τον δείκτη πάνω σε πινέζα, και ένας δείκτης άκρης που δεν το προσέχει θα έλεγε
 * «πιο πάνω» για κάτι που μόλις έγινε ορατό — δηλαδή θα έλεγε **ψέματα**.
 *
 * 🔑 **`scroll` στο `document` με `capture`**: τα `scroll` δεν αναδύονται, αλλά **περνούν** από το
 * `document` στη φάση σύλληψης ⇒ **ένας** ακροατής ακούει το δοχείο, τη σελίδα **και** κάθε
 * πρόγονο που κυλά (π.χ. το φύλλο της στενής οθόνης). Συν `resize`: στενότερο παράθυρο μετακινεί
 * κάρτες χωρίς καμία κύλιση.
 *
 * ⛔ **Όχι `IntersectionObserver`** (απορρίφθηκε με λόγο): ειδοποιεί μόνο όταν **αλλάζει** η τομή.
 * Πήδημα από «πιο πάνω» σε «πιο κάτω» χωρίς να περάσει από το ορατό (`End`, `Home`, άγκυρα) δεν
 * διασχίζει κανένα κατώφλι ⇒ ο δείκτης θα έδειχνε **λάθος κατεύθυνση** ως την επόμενη κίνηση.
 *
 * 🔑 **`requestAnimationFrame`, όχι χρονόμετρο**: η μέτρηση **επιβάλλει διάταξη** — μία φορά ανά
 * καρέ, αλλιώς layout thrashing στο νήμα που κυλά την οθόνη. Και τρέχει **μόνο** όσο κάτι είναι
 * εστιασμένο.
 */
function useFocusVisibility(
  container: HTMLElement | null,
  focused: string | null,
  frame: ListingRevealFrame,
): ScrollVisibility {
  const [visibility, setVisibility] = useState<ScrollVisibility>('unknown');

  useEffect(() => {
    if (!container || !focused) {
      setVisibility('unknown');
      return;
    }
    const scrollFrame: ScrollFrame = frame === 'viewport' ? 'viewport' : container;

    let pending = 0;
    const measure = (): void => {
      pending = 0;
      setVisibility(visibilityWithinScroller(cardElement(container, focused), scrollFrame));
    };
    const schedule = (): void => {
      if (pending === 0) pending = requestAnimationFrame(measure);
    };

    measure();
    const listen = { capture: true, passive: true } as const;
    document.addEventListener('scroll', schedule, listen);
    window.addEventListener('resize', schedule, { passive: true });
    return () => {
      document.removeEventListener('scroll', schedule, listen);
      window.removeEventListener('resize', schedule);
      if (pending !== 0) cancelAnimationFrame(pending);
    };
  }, [container, focused, frame]);

  return visibility;
}

export function useListingRevealTracking(
  focus: ListingFocus,
  frame: ListingRevealFrame = 'container',
): ListingRevealTracking {
  const [container, containerRef] = useState<HTMLElement | null>(null);

  useRevealSelectedListing(container, focus.selected);
  const focusVisibility = useFocusVisibility(container, focusedListingId(focus), frame);

  const revealFocused = useCallback(() => {
    revealInScroll(cardElement(container, focusedListingId(focus)), {
      urgency: 'requested',
      // 🔑 **`'center'` ΕΔΩ, σε αντίθεση με το κλικ — και είναι το ίδιο σκεπτικό.**
      // Ο άνθρωπος πάτησε δείκτη που λέει «είναι πιο πάνω»: η πράξη του **είναι** «πήγαινέ
      // με εκεί». Το `'nearest'` θα το έφερνε οριακά στην άκρη, δηλαδή θα απαντούσε
      // τυπικά και θα άφηνε τη ματιά να ψάχνει.
      block: 'center',
    });
  }, [container, focus]);

  return { containerRef, focusVisibility, revealFocused };
}
