'use client';

/**
 * ADR-739 Φ.Ε βήμα 5 — **η επιφάνεια του mini toolbar**: πού κάθεται, και πώς μένει ορατή στον
 * αναγνώστη οθόνης.
 *
 * Εξήχθη από το `TableFormatToolbar.tsx` (ADR-755, N.7.1: 445/500 γραμμές με τρίτο διαμέρισμα
 * να έρχεται). Δύο hooks, μία ευθύνη: «η γραμμή ως **επιφάνεια**», ανεξάρτητα από το τι
 * κουμπιά έχει μέσα.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/use-toolbar-surface
 */

import { useLayoutEffect, type RefObject } from 'react';

/** Απόσταση από το σημείο κλικ — το «ξεκομμένο» της Α7, σε px. */
const GAP_PX = 6;
/** Ελάχιστη απόσταση από την άκρη του παραθύρου. */
const EDGE_PAD_PX = 4;

/**
 * Τοποθετεί τη γραμμή **πάνω** από το σημείο κλικ, πριν το βάψιμο.
 *
 * Το ύψος δεν είναι σταθερά σε δύο αρχεία: μετριέται από το ίδιο το στοιχείο. Ένα
 * `TOOLBAR_HEIGHT_PX` σε TypeScript δίπλα σε ένα `padding` στο CSS είναι δύο πηγές για την
 * ίδια απόφαση, και αποκλίνουν στην πρώτη αλλαγή εικονιδίου.
 *
 * Το κόψιμο στο `EDGE_PAD_PX` είναι ασφαλές **επειδή** το toolbar κάθεται από πάνω: ακόμη κι
 * όταν σπρωχτεί στην κορυφή της οθόνης, μένει πάνω από το σημείο κλικ, άρα δεν σκεπάζει ποτέ
 * το μενού που ανοίγει από κάτω.
 */
export function useToolbarPlacement(
  surfaceRef: RefObject<HTMLDivElement | null>,
  anchorX: number,
  anchorY: number,
): void {
  useLayoutEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const { height, width } = el.getBoundingClientRect();
    const maxLeft = Math.max(EDGE_PAD_PX, window.innerWidth - width - EDGE_PAD_PX);
    el.style.left = `${Math.min(Math.max(EDGE_PAD_PX, anchorX), maxLeft)}px`;
    el.style.top = `${Math.max(EDGE_PAD_PX, anchorY - GAP_PX - height)}px`;
  }, [surfaceRef, anchorX, anchorY]);
}

/**
 * Κρατά τη γραμμή **έξω** από το `aria-hidden` που απλώνει το modal μενού — και **μετά**.
 *
 * ## 🔴 ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΚΛΕΙΝΕΙ (ζωντανή μέτρηση 2026-08-03)
 * Εδώ υπήρχε σκέτο `el.removeAttribute('aria-hidden')` μέσα στο `useLayoutEffect` της θέσης.
 * Ήταν **νεκρή εγγραφή**: μετρήθηκε στον browser `aria-hidden="true"` σε **κάθε** άνοιγμα.
 *
 * Η αιτία είναι **σειρά**, όχι λογική. Το `hideOthers()` (πακέτο `aria-hidden`, το καλεί το
 * modal `DropdownMenu`) διατρέχει τα παιδιά του `body` **τη στιγμή που τρέχει το δικό του
 * effect** — και το περιεχόμενο του Radix mount-άρει **μετά** από αυτό εδώ το portal. Δηλαδή
 * η σειρά ήταν πάντα: αφαιρώ → με προσπερνά → μου το ξαναγράφει. Ένα `removeAttribute` που
 * τρέχει **πριν** από τον γραφέα δεν μπορεί να νικήσει ποτέ, όσο σωστό κι αν είναι.
 *
 * Ο παρατηρητής δεν εξαρτάται από σειρά mount: όποτε κι αν γραφτεί το attribute, φεύγει.
 * Δεν βρόχεται — το `removeAttribute` γεννά νέα μεταβολή, αλλά τότε το `hasAttribute` είναι
 * ήδη ψευδές και ο φύλακας δεν ξαναγράφει.
 *
 * ## Γιατί ΟΧΙ οι δύο «προφανείς» εναλλακτικές
 * · `modal={false}` στο μενού — ξεκλειδώνει και τα outside pointer events, αλλάζοντας
 *   συμπεριφορά που δεν ζήτησε κανείς (και θα έσπαγε τον φύλακα `keepOpenOnSurface`).
 * · `aria-live` στο δοχείο — είναι το **επίσημο** escape hatch της `hideOthers()` (εξαιρεί
 *   ρητά `[aria-live], script`), αλλά θα δήλωνε τη γραμμή ως live region: ο αναγνώστης θα
 *   ανακοίνωνε **ολόκληρη** τη γραμμή σε κάθε αλλαγή `aria-pressed`. Θεραπεία χειρότερη από
 *   την ασθένεια — δανειζόμαστε σημασιολογία που δεν ισχύει, για να πετύχουμε παρενέργεια.
 *
 * ⚠️ Αυτό επαναφέρει τον **αναγνώστη οθόνης** (browse mode), όχι την **εστίαση**: όσο το
 * μενού είναι modal, το `FocusScope` του Radix επαναφέρει κάθε εστίαση πίσω στο `role="menu"`,
 * άρα τα βέλη του `useRovingToolbar` δεν είναι προσπελάσιμα με πληκτρολόγιο. Μετρημένο
 * ζωντανά (και με `Tab`, και με άμεσο `focus()`) — δες ADR-739 §28.12.
 */
export function useAriaHiddenGuard(surfaceRef: RefObject<HTMLDivElement | null>): void {
  useLayoutEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;

    const strip = (): void => {
      if (el.hasAttribute('aria-hidden')) el.removeAttribute('aria-hidden');
    };

    strip();
    const observer = new MutationObserver(strip);
    observer.observe(el, { attributes: true, attributeFilter: ['aria-hidden'] });
    return () => { observer.disconnect(); };
  }, [surfaceRef]);
}
