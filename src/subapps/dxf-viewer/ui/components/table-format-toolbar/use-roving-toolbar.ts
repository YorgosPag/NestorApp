'use client';

/**
 * ADR-739 Φ.Ε βήμα 5 — **roving tabindex** για οριζόντια γραμμή εργαλείων, κατά WAI-ARIA APG.
 *
 * ## Τι λύνει
 * Ένα `role="toolbar"` με δέκα κουμπιά και φυσιολογική σειρά `Tab` σημαίνει **δέκα** στάσεις
 * πριν ο χρήστης βγει από αυτό. Το APG ορίζει το αντίθετο: **μία** στάση για όλη τη γραμμή,
 * και τα `←` / `→` μετακινούν μέσα της.
 *
 * ## 🔴 Γιατί δεν αρκεί το `tabIndex` — το `.focus()` είναι υποχρεωτικό
 * Το roving tabindex είναι **δύο** πράγματα ταυτόχρονα: ποιο στοιχείο δέχεται `Tab` (το
 * γνώρισμα) και ποιο έχει **τώρα** την εστίαση (το DOM). Αλλάζοντας μόνο το γνώρισμα, το
 * `document.activeElement` μένει στο παλιό κουμπί: τα βέλη «δουλεύουν» στο React DevTools και
 * δεν κάνουν **τίποτα** στην οθόνη. Το ίδιο σχήμα ακολουθεί το μόνο υπάρχον roving του έργου
 * (`dxf-settings/settings/shared/accordion-group.tsx`), εκεί κάθετα.
 *
 * ## 🔴 Γιατί `preventDefault` + `stopPropagation` — και γιατί αυτό είναι η ΛΥΣΗ του §28.10.4
 * Το ADR-739 §28.10.4 προειδοποιούσε ότι αυτό θα είναι το **πρώτο** toolbar του έργου όπου το
 * `document.activeElement` είναι `<button>`, οπότε το `consumesDirectionalKeys`
 * (`lib/a11y/keyboard-scope.ts`) **δεν** θα θεωρήσει τα βέλη καταναλωμένα και θα περάσουν στις
 * καθολικές συντομεύσεις — δηλαδή το `→` θα μετακινούσε την **επιλεγμένη οντότητα** ενώ ο
 * χρήστης πλοηγείται σε κουμπιά.
 *
 * ⚠️ Η προφανής «διόρθωση» — να μπει το `'toolbar'` στα `ARROW_NAVIGATION_ROLES` — είναι
 * **νεκρή εγγραφή**: εκείνο το σύνολο ελέγχεται πάνω στον ρόλο του **ίδιου** του εστιασμένου
 * στοιχείου (χωρίς `closest()`, επίτηδες O(1)), και το εστιασμένο στοιχείο εδώ είναι το
 * `<button>`, όχι το `[role="toolbar"]`. Θα άλλαζε ένα υπάρχον test σε πράσινο χωρίς να
 * καλύπτει τίποτα. Η σωστή λύση είναι να **μη φτάσει** το συμβάν ως εκεί: σταματά στο ίδιο το
 * toolbar. Γι' αυτό το `keyboard-scope.ts` **δεν** ακουμπιέται από αυτή τη δουλειά.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/use-roving-toolbar
 */

import { useCallback, useRef, useState, type KeyboardEvent } from 'react';

/** Ό,τι πρέπει να απλωθεί σε **κάθε** κουμπί της γραμμής. */
export interface RovingItemProps {
  readonly ref: (node: HTMLButtonElement | null) => void;
  readonly tabIndex: 0 | -1;
  readonly onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  readonly onFocus: () => void;
}

export interface RovingToolbar {
  /** Τα props του κουμπιού στη θέση `index`. */
  readonly itemProps: (index: number) => RovingItemProps;
}

/**
 * Ποια βέλη μετακινούν τον δείκτη.
 *
 * ADR-750 Φ3 — το dropdown περιγραμμάτων είναι **κατακόρυφη** λίστα εντολών (η μετρημένη
 * διάταξη του Excel, ADR-750 §8.1), δηλαδή ζητά τον ίδιο ακριβώς μηχανισμό με τον άλλο άξονα.
 * Δεύτερο hook θα ήταν sibling clone (N.18) και, με τον καιρό, δύο διαφορετικές απαντήσεις στο
 * ίδιο ερώτημα «τι κάνει το `Home`;».
 */
export type RovingOrientation = 'horizontal' | 'vertical';

const ARROW_KEYS: Readonly<Record<RovingOrientation, { readonly next: string; readonly prev: string }>> = {
  horizontal: { next: 'ArrowRight', prev: 'ArrowLeft' },
  vertical: { next: 'ArrowDown', prev: 'ArrowUp' },
};

/**
 * Roving tabindex για `count` κουμπιά, οριζόντια (προεπιλογή) ή κατακόρυφα.
 *
 * Ο δείκτης **κυκλώνει** (`→` στο τελευταίο πάει στο πρώτο), όπως ορίζει το APG για toolbar:
 * σε μια γραμμή 8 εικονιδίων η κυκλική κίνηση είναι φθηνότερη από το να καταλάβει ο χρήστης
 * ότι έφτασε στο τέρμα. Το APG ορίζει το ίδιο και για `menu`.
 */
export function useRovingToolbar(
  count: number,
  orientation: RovingOrientation = 'horizontal',
  columns?: number,
): RovingToolbar {
  const [activeIndex, setActiveIndex] = useState(0);
  const nodes = useRef<(HTMLButtonElement | null)[]>([]);

  const focusAt = useCallback((index: number) => {
    setActiveIndex(index);
    nodes.current[index]?.focus();
  }, []);

  const itemProps = useCallback(
    (index: number): RovingItemProps => ({
      ref: (node) => {
        nodes.current[index] = node;
      },
      // Ο δείκτης μπορεί να δείχνει σε κουμπί που ξεμοντάρισε (αλλαγή άξονα ⇒ άλλα κουμπιά).
      // Χωρίς το `>= count`, η γραμμή θα έμενε **χωρίς καμία** στάση `Tab` — μη προσβάσιμη.
      tabIndex: index === Math.min(activeIndex, count - 1) ? 0 : -1,
      onFocus: () => setActiveIndex(index),
      onKeyDown: (event) => {
        const target = columns && columns > 0
          ? gridTarget(event.key, index, count, columns)
          : lineTarget(event.key, index, count, orientation);
        if (target === null) return;

        // Και τα δύο, με αυτή τη σειρά: το `preventDefault` σταματά την κύλιση της σελίδας,
        // το `stopPropagation` κρατά το βέλος μακριά από το Radix `role="menu"` (που έχει δικό
        // του roving) **και** από τις καθολικές συντομεύσεις του καμβά (δες την κεφαλίδα).
        event.preventDefault();
        event.stopPropagation();
        focusAt(target);
      },
    }),
    [activeIndex, count, columns, focusAt, orientation],
  );

  return { itemProps };
}

// ──────────────────────────────────────────────────────────────────────────────
// Ιδιωτικά — πού πάει το βέλος
// ──────────────────────────────────────────────────────────────────────────────

/** Μονοδιάστατη σειρά: ένας άξονας κινείται, ο άλλος αγνοείται. `Home`/`End` = τα άκρα. */
function lineTarget(
  key: string,
  index: number,
  count: number,
  orientation: RovingOrientation,
): number | null {
  const arrows = ARROW_KEYS[orientation];
  const delta = key === arrows.next ? 1 : key === arrows.prev ? -1 : 0;
  if (delta !== 0) return (index + delta + count) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}

/**
 * ADR-739 Φ.Ε/Φ4 — **πλέγμα**: το χρωματολόγιο είναι 13 στήλες × 6 σειρές, όχι σειρά.
 *
 * Μια μονοδιάστατη σειρά πάνω σε 78 δείγματα σημαίνει ότι το `↓` δεν κάνει τίποτα και ότι για
 * να πας μια σειρά κάτω πατάς `→` δεκατρείς φορές. Το APG ορίζει `grid` ακριβώς γι' αυτό, και
 * το Excel πλοηγεί το δικό του χρωματολόγιο και στους δύο άξονες.
 *
 * ## Δύο αποφάσεις που δεν είναι αυθαίρετες
 * - **`←/→` κυκλώνουν ΣΥΝΟΛΙΚΑ, όχι μέσα στη σειρά**: το `→` στο τελευταίο δείγμα μιας σειράς
 *   πάει στο **πρώτο της επόμενης**, όπως γυρίζει η γραμμή σε ένα κείμενο. Κύκλωση μέσα στη
 *   σειρά θα παγίδευε τον χρήστη σε 13 δείγματα χωρίς να το δηλώνει τίποτα.
 * - **`↑/↓` κυκλώνουν μέσα στη ΣΤΗΛΗ**: εκεί η στήλη *έχει* νόημα — είναι η ίδια απόχρωση σε
 *   έξι φωτεινότητες. Ένα `↓` που ξεχειλίζει στη διπλανή απόχρωση θα έσπαγε ακριβώς τη σχέση
 *   που η στήλη υπάρχει για να δείξει.
 *
 * `Home`/`End` = αρχή/τέλος **της σειράς** (APG για grid)· τα άκρα όλου του πλέγματος είναι
 * `Ctrl+Home`/`Ctrl+End` στο APG και δεν χρειάζονται εδώ — το πλέγμα χωρά ολόκληρο στην οθόνη.
 */
function gridTarget(key: string, index: number, count: number, columns: number): number | null {
  const row = Math.floor(index / columns);
  const column = index % columns;
  const rows = Math.ceil(count / columns);

  if (key === 'ArrowRight') return (index + 1) % count;
  if (key === 'ArrowLeft') return (index - 1 + count) % count;
  if (key === 'ArrowDown' || key === 'ArrowUp') {
    const step = key === 'ArrowDown' ? 1 : -1;
    // Η κύκλωση γίνεται πάνω στις **υπαρκτές** σειρές αυτής της στήλης: σε μη γεμάτη τελευταία
    // σειρά, ένα `↓` στην προτελευταία δεν επιτρέπεται να δείξει σε κενή θέση.
    const columnRows = column < count % columns || count % columns === 0 ? rows : rows - 1;
    return ((row + step + columnRows) % columnRows) * columns + column;
  }
  if (key === 'Home') return row * columns;
  if (key === 'End') return Math.min(row * columns + columns - 1, count - 1);
  return null;
}
