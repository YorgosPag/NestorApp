'use client';

/**
 * @fileoverview **«Κράτα ορατή την επιλογή που περιφέρεται»** — ένα effect, ένα σημείο.
 * @related lib/a11y/reveal-in-scroll.ts · lib/a11y/roving-highlight.ts · CHECK 3.28
 * @module lib/a11y/use-reveal-highlighted-option
 *
 * 🔴 **ΜΕΤΡΗΜΕΝΟ ΔΙΔΥΜΟ** *(CHECK 3.28, 12 γραμμές / 64 tokens)*: το ίδιο effect ζούσε
 * αυτούσιο σε `searchable-combobox.tsx` και `PickerResultsList.tsx`.
 *
 * ⚠️ **`'incidental'` ΠΑΝΤΑ, και είναι ο λόγος που το effect αξίζει δικό του αρχείο.**
 * Η μετακίνηση εδώ είναι **παρενέργεια** της πλοήγησης με βελάκια, όχι αίτημα του
 * ανθρώπου: ομαλή κύλιση **συσσωρεύεται** — δέκα πατήματα δίνουν δέκα επικαλυπτόμενες
 * κινήσεις που καταλήγουν στο **λάθος σημείο**. Ένα από τα αντίγραφα που ενοποιήθηκαν
 * εδώ είχε ήδη γραφτεί `'requested'` κατά τη μετανάστευση — **ακριβώς** το λάθος που
 * ένα κοινό σημείο κάνει αδύνατο.
 */

import { useEffect } from 'react';

import { revealInScroll } from './reveal-in-scroll';

/**
 * Φέρνει στο οπτικό πεδίο το `[role="option"]` στη θέση {@link highlightedIndex}.
 *
 * @param listRef Το δοχείο που κρατά τις επιλογές.
 * @param highlightedIndex Η θέση του δείκτη· `< 0` σημαίνει «καμία» και δεν κινεί τίποτα.
 */
export function useRevealHighlightedOption(
  listRef: React.RefObject<HTMLElement | null>,
  highlightedIndex: number,
): void {
  useEffect(() => {
    if (highlightedIndex < 0) return;

    const container = listRef.current;
    if (container === null) return;

    // ⚠️ Ο δείκτης μετρά **επιλογές**, όχι παιδιά: ένα `children[i]` θα μετρούσε και
    //    τους διαχωριστές/επικεφαλίδες ομάδων, δηλαδή θα αποκάλυπτε λάθος γραμμή σε
    //    κάθε λίστα με ομαδοποίηση.
    revealInScroll(container.querySelectorAll('[role="option"]')[highlightedIndex], {
      urgency: 'incidental',
      block: 'nearest',
    });
  }, [listRef, highlightedIndex]);
}
