'use client';

/**
 * ADR-711 — Επαναφορά focus μετά το κλείσιμο modal (ελάττωμα Ε2).
 *
 * ── Η ΡΙΖΑ, ΕΠΑΛΗΘΕΥΜΕΝΗ ΣΤΟΝ ΕΓΚΑΤΕΣΤΗΜΕΝΟ RADIX ──
 *
 * `@radix-ui/react-dialog/dist/index.mjs:146-149` — το **modal** Content κάνει:
 *
 *   onCloseAutoFocus: composeEventHandlers(props.onCloseAutoFocus, (event) => {
 *     event.preventDefault();               // σκοτώνει τη γενική επαναφορά του FocusScope
 *     context.triggerRef.current?.focus();  // εστιάζει ΜΟΝΟ τον <Trigger>
 *   })
 *
 * Ο γενικός μηχανισμός του `FocusScope` (`focus(previouslyFocusedElement ?? body)`)
 * τρέχει μόνο αν το AUTOFOCUS_ON_UNMOUNT ΔΕΝ έχει `defaultPrevented` — και το Dialog το
 * κάνει πάντα. Άρα η **μοναδική** διαδρομή επαναφοράς είναι το `triggerRef`.
 *
 * Μετρημένο μέγεθος στο δέντρο Νέστωρ: **161 από 170** αρχεία χρησιμοποιούν
 * `DialogContent` **χωρίς** `DialogTrigger` (ελεγχόμενο `open` από τον γονέα) ⇒
 * `triggerRef.current === null` ⇒ `?.focus()` = no-op ⇒ **μηδέν** κλήσεις focus στο
 * κλείσιμο και το `activeElement` καταλήγει `BODY`. Καθολικό a11y κενό, όχι bug ενός
 * component.
 *
 * ── Η ΔΙΟΡΘΩΣΗ ──
 *
 * Το επίσημα αναγνωρισμένο pattern (radix-ui/primitives Discussion #3319): κρατάμε
 * ποιος κρατούσε το focus τη στιγμή του ανοίγματος και τον επαναφέρουμε εμείς.
 * Επειδή ο δικός μας handler περνιέται ως **prop**, ο Radix τον τρέχει ΠΡΩΤΟ, και το
 * δικό μας `preventDefault()` παρακάμπτει το `triggerRef` μονοπάτι.
 *
 * Όταν **υπάρχει** `<DialogTrigger>` το αποτέλεσμα είναι ταυτόσημο (ο opener ΕΙΝΑΙ ο
 * trigger) — μηδέν παλινδρόμηση για τα 31 αρχεία που τον έχουν.
 */

import * as React from 'react';

/** Οι δύο handlers που πρέπει να περαστούν στο Radix `Content`. */
export interface DialogAutoFocusHandlers {
  readonly onOpenAutoFocus: (event: Event) => void;
  readonly onCloseAutoFocus: (event: Event) => void;
}

/** Ό,τι μπορεί να έχει περάσει ο καταναλωτής — συντίθεται, δεν αντικαθίσταται. */
export interface ConsumerAutoFocusHandlers {
  readonly onOpenAutoFocus?: (event: Event) => void;
  readonly onCloseAutoFocus?: (event: Event) => void;
}

function resolveOpener(): HTMLElement | null {
  if (typeof document === 'undefined' || typeof HTMLElement === 'undefined') return null;
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return null;
  // `body` σημαίνει «κανείς δεν κρατούσε το focus» (π.χ. προγραμματικό άνοιγμα χωρίς
  // κλικ). Επαναφορά εκεί δεν προσφέρει τίποτα — αφήνουμε τον Radix να αποφασίσει.
  return active === document.body ? null : active;
}

export function useDialogFocusRestore(
  consumer: ConsumerAutoFocusHandlers = {},
): DialogAutoFocusHandlers {
  const { onOpenAutoFocus, onCloseAutoFocus } = consumer;
  const openerRef = React.useRef<HTMLElement | null>(null);

  const handleOpenAutoFocus = React.useCallback(
    (event: Event) => {
      // Το `FocusScope` εκπέμπει AUTOFOCUS_ON_MOUNT **πριν** μετακινήσει το focus, άρα
      // εδώ το `activeElement` είναι ακόμη αυτός που άνοιξε τον διάλογο. Γι' αυτό η
      // καταγραφή γίνεται εδώ και ΟΧΙ σε render/effect του `Content`: η συνάρτηση του
      // `Content` τρέχει και με κλειστό διάλογο, οπότε θα κατέγραφε λάθος στοιχείο.
      openerRef.current = resolveOpener();
      onOpenAutoFocus?.(event);
    },
    [onOpenAutoFocus],
  );

  const handleCloseAutoFocus = React.useCallback(
    (event: Event) => {
      onCloseAutoFocus?.(event);
      // Ο καταναλωτής έχει τον πρώτο λόγο: αν διεκδίκησε το focus, δεν τον ακυρώνουμε.
      if (event.defaultPrevented) return;

      const opener = openerRef.current;
      openerRef.current = null;
      // Χάθηκε από το DOM (π.χ. ο διάλογος διέγραψε τη γραμμή που τον άνοιξε): δεν
      // κάνουμε `preventDefault`, ώστε να τρέξει η προεπιλεγμένη διαδρομή του Radix.
      if (!opener || !opener.isConnected) return;

      event.preventDefault();
      opener.focus();
    },
    [onCloseAutoFocus],
  );

  return { onOpenAutoFocus: handleOpenAutoFocus, onCloseAutoFocus: handleCloseAutoFocus };
}
