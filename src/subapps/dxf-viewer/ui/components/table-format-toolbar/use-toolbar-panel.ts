'use client';

/**
 * 🔴 ADR-755 — **ο κύκλος ζωής ενός πτυσσόμενου πάνελ του mini toolbar**, σε ένα σημείο.
 *
 * ## Πώς βρέθηκε (CHECK 3.28, μετρημένο)
 * Το `TableMergeMenu` γεννήθηκε ως **τρίτο** πτυσσόμενο της γραμμής και αντέγραψε — χωρίς να το
 * θέλει — τα ίδια τέσσερα πράγματα από τα δύο προηγούμενα: την κατάσταση `isOpen`, το `useId`
 * του πάνελ, το «εκτέλεσε → κλείσε → γύρνα την εστίαση στον trigger», και το `Escape` που
 * κλείνει **ένα** επίπεδο. Το jscpd το μέτρησε σε 10 γραμμές / 53 tokens.
 *
 * ## Οι δύο αποφάσεις που κωδικοποιεί — και γιατί ΔΕΝ είναι λεπτομέρειες
 * 1. **Η εστίαση γυρίζει στον trigger** μετά από κάθε εντολή. Χωρίς αυτό, ο χρήστης
 *    πληκτρολογίου μένει σε στοιχείο που μόλις ξεμόνταρε — δηλαδή η εστίαση πέφτει στο `body`
 *    και το επόμενο `Tab` ξεκινά από την αρχή της σελίδας.
 * 2. **`stopPropagation` στο `Escape`**: ένα `Escape` = ένα επίπεδο. Χωρίς αυτό, ο γονέας θα
 *    έβλεπε το ίδιο πλήκτρο και θα έκλεινε **και** το μενού από κάτω — δύο επιφάνειες με ένα
 *    πάτημα, ενώ ο χρήστης ζήτησε να φύγει μόνο η λίστα που μόλις άνοιξε.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/use-toolbar-panel
 */

import { useCallback, useId, useRef, useState, type KeyboardEvent, type RefObject } from 'react';

export interface ToolbarPanelController {
  readonly isOpen: boolean;
  /** Για το `aria-controls` του trigger και το `id` του πάνελ. */
  readonly panelId: string;
  /** Ο trigger, ώστε να επιστρέφει εκεί η εστίαση στο κλείσιμο. */
  readonly triggerRef: RefObject<HTMLButtonElement | null>;
  readonly toggle: () => void;
  /** Εκτελεί την εντολή, κλείνει το πάνελ και επιστρέφει την εστίαση στον trigger. */
  readonly runAndClose: (action: () => void) => void;
  /** `Escape` ⇒ κλείνει **μόνο** αυτό το πάνελ (δες την κεφαλίδα). */
  readonly onPanelKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  readonly close: () => void;
}

export function useToolbarPanel(): ToolbarPanelController {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelId = useId();

  const close = useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus();
  }, []);

  const toggle = useCallback(() => setIsOpen((open) => !open), []);

  const runAndClose = useCallback((action: () => void) => {
    action();
    close();
  }, [close]);

  const onPanelKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    close();
  }, [close]);

  return { isOpen, panelId, triggerRef, toggle, runAndClose, onPanelKeyDown, close };
}
