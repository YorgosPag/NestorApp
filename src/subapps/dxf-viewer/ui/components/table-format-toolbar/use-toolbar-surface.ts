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
 * ίδια απόφαση, και αποκλίνουν στην πρώτη αλλαγή εικονιδίου. **Γι' αυτό το §55 δεν χρειάστηκε
 * να αγγίξει καμία τιμή** όταν η γραμμή διπλασιάστηκε σε ύψος.
 *
 * ## 🔴 ΤΙ ΑΛΛΑΞΕ ΤΟ ΔΙΠΛΟ ΥΨΟΣ (§55) — και γιατί δεν ήταν «απλώς μεγαλύτερος αριθμός»
 * Εδώ έγραφε: «*το κόψιμο στο `EDGE_PAD_PX` είναι ασφαλές **επειδή** το toolbar κάθεται από
 * πάνω: ακόμη κι όταν σπρωχτεί στην κορυφή της οθόνης, μένει πάνω από το σημείο κλικ, άρα δεν
 * σκεπάζει ποτέ το μενού*». Η πρόταση ήταν **ήδη ψευδής**, σε μια στενή ζώνη: όταν
 * `anchorY < height + GAP + EDGE_PAD`, το κόψιμο φέρνει την **κάτω** ακμή της γραμμής κάτω από
 * το σημείο κλικ — κι επειδή το `z-index` της (10000) νικά το μενού (9999), σκεπάζει τα πρώτα
 * item του. Με μία σειρά η ζώνη ήταν ~42px· με δύο γίνεται ~74px, δηλαδή ολόκληρη η περιοχή
 * κάτω από τη γραμμή εργαλείων της εφαρμογής.
 *
 * Η λύση **δεν** είναι να μη γίνει το κόψιμο (η γραμμή θα έβγαινε εκτός οθόνης) ούτε να πάει
 * κάτω από τον δείκτη (εκεί ανοίγει το μενού). Είναι να **παραμεριστεί οριζόντια**: όταν δεν
 * χωρά από πάνω, η γραμμή κάθεται **αριστερά** του σημείου κλικ, ενώ το μενού ανοίγει προς τα
 * δεξιά-κάτω. Δεν επικαλύπτονται πια, και καμία άλλη περίπτωση δεν αλλάζει συμπεριφορά.
 *
 * ⚠️ Μία περίπτωση παραμένει: κλικ **πάνω αριστερά**, όπου δεν υπάρχει χώρος ούτε από πάνω
 * ούτε αριστερά. Τότε επιστρέφει η παλιά συμπεριφορά (επικάλυψη), γιατί η εναλλακτική θα ήταν
 * να μετακινηθεί το **μενού** — δηλαδή να αποφασίζει αυτό το hook για επιφάνεια που δεν του
 * ανήκει. Δηλωμένο ρητά αντί για σιωπηλό.
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

    const top = anchorY - GAP_PX - height;
    const fitsAbove = top >= EDGE_PAD_PX;
    const maxLeft = Math.max(EDGE_PAD_PX, window.innerWidth - width - EDGE_PAD_PX);
    const left = fitsAbove ? anchorX : besideAnchor(anchorX, width);

    el.style.left = `${Math.min(Math.max(EDGE_PAD_PX, left), maxLeft)}px`;
    el.style.top = `${Math.max(EDGE_PAD_PX, top)}px`;
  }, [surfaceRef, anchorX, anchorY]);
}

/**
 * Αριστερά από το σημείο κλικ — ή, αν δεν χωρά, η παλιά θέση (και η επικάλυψη γίνεται δεκτή).
 *
 * Αριστερά και όχι δεξιά: το μενού του Radix ανοίγει **δεξιά-κάτω** από τον δείκτη, οπότε
 * δεξιά είναι ακριβώς η μία πλευρά που δεν είναι ελεύθερη.
 */
function besideAnchor(anchorX: number, width: number): number {
  const left = anchorX - GAP_PX - width;
  return left >= EDGE_PAD_PX ? left : anchorX;
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
