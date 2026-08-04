'use client';

/**
 * 🔴 ADR-755 — **ο φύλακας «μην κλείσεις: το πάτημα ήταν πάνω στη γραμμή εργαλείων»**.
 *
 * ## Γιατί υπάρχει καθόλου
 * Το mini toolbar ζει σε **δικό του** portal (μόνο έτσι κάθεται *πάνω* από το μενού με κενό,
 * απόφαση Α7 του ADR-739), άρα κάθε πάτημα κουμπιού φτάνει στο μενού ως `pointerDownOutside`.
 *
 * ⚠️ **Ο φύλακας ΔΕΝ έγινε περιττός όταν ο ιδιοκτήτης ζήτησε «να κλείνει το μενού»** — έγινε
 * **προϋπόθεση** για να δουλέψει αυτό ακριβώς. Το `DismissableLayer` κλείνει στο `pointerdown`,
 * δηλαδή **πριν** το `click`: αν το αφήναμε, το toolbar θα ξεμόνταρε ενδιάμεσα και το `onClick`
 * του κουμπιού **δεν θα έτρεχε ποτέ**. Θα κλείναμε το μενού χωρίς να έχει γίνει η εντολή.
 *
 * ## Γιατί εξήχθη (ADR-755)
 * Το ADR-755 φέρνει το mini toolbar **και** πάνω από το μενού των κελιών, δηλαδή ο φύλακας
 * χρειάζεται σε **δύο** μενού. Ο τύπος `OutsideInteraction` μαζί με τις τέσσερις γραμμές του
 * ελέγχου είναι ακριβώς το σχήμα που έχει ήδη πιάσει δύο φορές το CHECK 3.28 σε αυτόν τον
 * κώδικα (δες `use-anchored-context-menu.ts`).
 *
 * Ο έλεγχος γίνεται στο `originalEvent.target`: το `target` του **συνθετικού** συμβάντος είναι
 * το ίδιο το περιεχόμενο του μενού, όχι ό,τι πάτησε ο χρήστης. Είναι το ένα σημείο όπου μια
 * αντιγραφή «απλοποιεί» και ο φύλακας γίνεται σιωπηλά ανενεργός.
 *
 * @module subapps/dxf-viewer/ui/components/dxf-context-menu/use-keep-open-on-surface
 * @see ui/components/table-format-toolbar/TableFormatToolbar.tsx — η επιφάνεια που προστατεύεται
 */

import { useCallback, type RefObject } from 'react';

/**
 * Το σχήμα ενός συμβάντος «αλληλεπίδραση **έξω** από το μενού» του Radix, στο ελάχιστο που
 * χρειαζόμαστε.
 *
 * Δηλώνεται τοπικά αντί να εισαχθεί ο τύπος του `DismissableLayer`: εκείνος δεν εξάγεται από
 * το wrapper μας, και η μόνη εναλλακτική θα ήταν `any` — απαγορευμένο (N.2). Η παράμετρος
 * είναι σκόπιμα **ευρύτερη** από την πραγματική (`Event` αντί `PointerEvent`), ώστε να δέχεται
 * και τα δύο συμβάντα (`pointerDownOutside` και `focusOutside`) με έναν φύλακα.
 */
export interface OutsideInteraction {
  readonly detail: { readonly originalEvent: Event };
  readonly target: EventTarget | null;
  preventDefault: () => void;
}

/**
 * Επιστρέφει χειριστή για `onPointerDownOutside` / `onFocusOutside`, που **ακυρώνει** το
 * κλείσιμο όταν η αλληλεπίδραση συνέβη μέσα στην `surfaceRef`.
 */
export function useKeepOpenOnSurface(
  surfaceRef: RefObject<HTMLElement | null>,
): (event: OutsideInteraction) => void {
  return useCallback((event: OutsideInteraction) => {
    const node = (event.detail.originalEvent.target ?? event.target) as Node | null;
    if (node && surfaceRef.current?.contains(node)) event.preventDefault();
  }, [surfaceRef]);
}
