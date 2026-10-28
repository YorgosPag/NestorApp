'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { captureFocusReturnTarget, returnFocus, type FocusReturnTarget } from '@/lib/a11y/focus-return';
import { enterModalSurface } from '@/lib/a11y/modal-surface';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { DirtyFormProvider } from '@/providers/DirtyFormProvider';
import { useViewportClass } from '@/hooks/media/useViewportClass';
import { cn } from '@/lib/utils';
import { DetailsSheetFrame } from './details-sheet-frame';

interface MobileDetailsSlideInProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  /** ⚠️ Χωρίς θυρίδα για κουμπιά (ADR-912 §12): οι ενέργειες δηλώνονται στο `EntityDetailsHeader` του περιεχομένου και φτάνουν στην μπάρα μόνες τους. */
  children: React.ReactNode;
}

/**
 * 📱 **Το φύλλο λεπτομερειών του κινητού** — πλήρης οθόνη, μπάρα 48px (κλείσιμο · τίτλος · ενέργειες), περιεχόμενο.
 *
 * 🔑 Η μπάρα είναι **η** μπάρα ενεργειών της οντότητας (ADR-912 §12): κάθε `EntityDetailsHeader` που ζει στο
 *   περιεχόμενο αποδίδει τις ενέργειές του στη θυρίδα της, μέσω `details-sheet-actions`.
 */
export function MobileDetailsSlideIn({ isOpen, ...sheet }: MobileDetailsSlideInProps) {
  // 🔑 **Μόνο σε στενή οθόνη ΥΠΑΡΧΕΙ** (ADR-912 §12.20). Οι ξενιστές αποδίδουν ΚΑΙ τη διάταξη desktop ΚΑΙ αυτό το
  //   φύλλο· με σκέτο `md:hidden` το περιεχόμενο **προσαρτιόταν δύο φορές** σε φαρδιά οθόνη — μετρημένο 2026-10-28 στις
  //   Επαφές: δύο `<input id="taxOffice">` (το `<label htmlFor>` ονομάζει μόνο το πρώτο ⇒ ανώνυμο combobox, ADR-598
  //   G11), διπλή φόρμα `inline-contact-form`, διπλές συνδρομές Firestore. «Κρυμμένο» ≠ «δεν υπάρχει».
  //   `measuring` (διακομιστής + καρέ ενυδάτωσης) ⇒ τίποτα — η ίδια απάντηση που έδινε το παλιό `useCanPortal`.
  const viewport = useViewportClass();
  if (!isOpen || viewport !== 'narrow') return null;
  // Το ανοιχτό φύλλο είναι δικό του component: οι παρατηρητές του δένονται σε στοιχεία που υπάρχουν από το πρώτο render.
  // `DirtyFormProvider`: η εμβέλεια όπου οι φόρμες του φύλλου δηλώνουν αν έχουν αλλαγές — ο ✕ ρωτά ΑΥΤΗΝ (ADR-912 §12.5).
  // 🔑 Portal στο `body` (όπως κάθε Radix Dialog/Sheet): ένα `fixed inset-0` είναι πλήρης οθόνη ΜΟΝΟ αν κανένας πρόγονος
  //   δεν έχει `transform` / `filter` / `backdrop-filter` / `container-type`. Μετρημένο 2026-10-17 (ADR-912 §12.15): μέσα
  //   στην καρτέλα «Έγγραφα» το `backdrop-blur-sm` του δοχείου καρτελών έκανε το φύλλο 356×5153 στη μέση της σελίδας.
  //   Το context και τα γεγονότα της React ακολουθούν το δέντρο της React, όχι του DOM — τίποτα άλλο δεν αλλάζει.
  return createPortal(<DirtyFormProvider><OpenDetailsSheet {...sheet} /></DirtyFormProvider>, document.body);
}

/**
 * 🔑 **Όσο το φύλλο είναι ανοιχτό, η σελίδα από κάτω δεν υπάρχει** (ADR-912 §12.16 — Drive / iOS: ο θεατής είναι modal).
 *   Στιγμιότυπο Giorgio 2026-10-17 23:08: η κάτω μπάρα της σελίδας [⋯][Προσθήκη Αρχείων] φαινόταν πάνω από τον θεατή —
 *   το φύλλο απλώς **σκέπαζε**, άρα η σωστή στρώση z ήταν η ΜΟΝΗ άμυνα. Τώρα τα από κάτω είναι `inert` (ούτε κλικ, ούτε
 *   Tab, ούτε αναγνώστης οθόνης) και δεν κυλούν — ό,τι κι αν λέει το z.
 * ⚠️ **Μόνο όσο το φύλλο ΦΑΙΝΕΤΑΙ**: είναι `md:hidden`, και κάποιοι ξενιστές το ανοίγουν χωρίς έλεγχο πλάτους· αδράνεια
 *   πίσω από αόρατη επιφάνεια θα πάγωνε όλη τη σελίδα. Το «φαίνεται;» το απαντά ο browser (`display`) — όχι δεύτερο
 *   κατώφλι πλάτους δίπλα στο CSS, που θα μπορούσε να αποκλίνει.
 */
function useSheetModality(): (surface: HTMLElement | null) => void {
  const [surface, setSurface] = React.useState<HTMLElement | null>(null);
  const shown = useIsDisplayed(surface);
  const openerRef = React.useRef<FocusReturnTarget | null>(null);
  React.useLayoutEffect(() => {
    if (!surface || !shown) return undefined;
    openerRef.current ??= captureFocusReturnTarget(); // πριν πάρει το focus το φύλλο
    const release = enterModalSurface(surface);
    return () => {
      release();
      const active = document.activeElement;
      const focusLost = !active || active === document.body || surface.contains(active);
      if (focusLost && openerRef.current) returnFocus(openerRef.current, { preventScroll: true });
    };
  }, [surface, shown]);
  return setSurface;
}

/** `display !== 'none'` του στοιχείου, ξαναρωτημένο σε κάθε αλλαγή μεγέθους παραθύρου (εκεί αλλάζει το `md:hidden`). */
function useIsDisplayed(el: HTMLElement | null): boolean {
  const [displayed, setDisplayed] = React.useState(false);
  React.useLayoutEffect(() => {
    if (!el) return undefined;
    const sync = () => setDisplayed(getComputedStyle(el).display !== 'none');
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, [el]);
  return displayed;
}

function OpenDetailsSheet({ onClose, title, children }: Omit<MobileDetailsSlideInProps, 'isOpen'>) {
  const colors = useSemanticColors();
  const surfaceRef = useSheetModality();

  return (
    <DetailsSheetFrame
      onClose={onClose}
      title={title}
      surface={({ titleId }, body) => (
        // Η στρώση των Radix Sheet/Dialog (ADR-780): πάνω από την κάτω μπάρα (`sticky`)· ό,τι ανοίγει ΑΠΟ το φύλλο (μενού,
        // διάλογος) μπαίνει αργότερα στο `body` στην ίδια στρώση ⇒ από πάνω. Το παλιό `z-50` ήταν κάτω από τη μπάρα (1040).
        <div
          ref={surfaceRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className={cn('md:hidden fixed inset-0 z-[var(--z-index-transient-stack)] flex flex-col outline-none animate-in slide-in-from-right duration-300', colors.bg.primary)}
        >
          {body}
        </div>
      )}
    >
      {children}
    </DetailsSheetFrame>
  );
}
