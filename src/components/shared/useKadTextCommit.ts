'use client';

/**
 * @fileoverview **Δέσμευση ΚΑΔ από ΚΕΙΜΕΝΟ** — όταν ο άνθρωπος επικολλά ή πληκτρολογεί ΟΛΟΚΛΗΡΟ κωδικό
 * (`41000000`, `41.00.11`), χωρίς να διαλέξει γραμμή από τη λίστα.
 * @related components/shared/KadCodePicker.tsx · lib/kad/kad-resolve.ts
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ**: με `allowFreeText` το `SearchableCombobox` εκπέμπει **σε κάθε πάτημα**· ο κύριος
 * ΚΑΔ άνοιγε επιβεβαίωση «Αλλαγή κύριου ΚΑΔ από X σε Y» σε κάθε χαρακτήρα, και οι δευτερεύοντες
 * αποθήκευαν σιωπηλά μισογραμμένο κείμενο. Τώρα η πληκτρολόγηση **μόνο φιλτράρει**· δέσμευση γίνεται
 * (α) με επιλογή γραμμής ή (β) εδώ, σε **επικόλληση / Enter / έξοδο** — και μόνο αν το κείμενο επιλύεται
 * **ακριβώς** σε επιλέξιμη γραμμή (`resolveKad` + `isSelectableKad`). Το κοινό combobox δεν αλλάζει:
 * τα γεγονότα πιάνονται στη φάση capture του περιέκτη.
 *
 * 🔑 **Μία δέσμευση ανά κείμενο.** Το Enter ανοίγει (για τον κύριο ΚΑΔ) διάλογο επιβεβαίωσης, που παίρνει
 * την εστίαση ⇒ `blur` με το ΙΔΙΟ κείμενο. Χωρίς τη μνήμη `lastCommitted`, ο ίδιος κωδικός θα ζητούσε
 * δεύτερη επιβεβαίωση. Η μνήμη σβήνει όταν το πεδίο ξαναπάρει εστίαση.
 */

import { useCallback, useRef } from 'react';
import { isSelectableKad, resolveKad } from '@/lib/kad/kad-resolve';
import type { KadCatalog, KadCatalogEntry } from '@/lib/kad/kad-types';

export interface KadTextCommitHandlers {
  readonly onPasteCapture: (event: React.ClipboardEvent<HTMLElement>) => void;
  readonly onKeyDownCapture: (event: React.KeyboardEvent<HTMLElement>) => void;
  readonly onBlurCapture: (event: React.FocusEvent<HTMLElement>) => void;
  readonly onFocusCapture: () => void;
}

function inputOf(target: EventTarget): HTMLInputElement | null {
  return target instanceof HTMLInputElement ? target : null;
}

/**
 * @param catalog ο φορτωμένος κατάλογος
 * @param isCurrent «αυτή η γραμμή είναι ΗΔΗ η αποθηκευμένη τιμή;» — τότε καμία δέσμευση
 * @param commit η δέσμευση (ίδια με την επιλογή από τη λίστα)
 */
export function useKadTextCommit(
  catalog: KadCatalog,
  isCurrent: (entry: KadCatalogEntry) => boolean,
  commit: (entry: KadCatalogEntry) => void,
): KadTextCommitHandlers {
  const lastCommitted = useRef<string | null>(null);

  const tryCommit = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (trimmed === '' || trimmed === lastCommitted.current) return;
      const entry = resolveKad(catalog, trimmed);
      if (entry === null || !isSelectableKad(entry) || isCurrent(entry)) return;
      lastCommitted.current = trimmed;
      commit(entry);
    },
    [catalog, isCurrent, commit],
  );

  const onPasteCapture = useCallback(
    (event: React.ClipboardEvent<HTMLElement>) => {
      if (inputOf(event.target)) tryCommit(event.clipboardData.getData('text'));
    },
    [tryCommit],
  );

  const onKeyDownCapture = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      const input = inputOf(event.target);
      // Με επισημασμένη γραμμή, το Enter ανήκει στο combobox (επιλογή γραμμής) — όχι σε εμάς.
      if (event.key !== 'Enter' || !input || input.getAttribute('aria-activedescendant')) return;
      tryCommit(input.value);
    },
    [tryCommit],
  );

  const onBlurCapture = useCallback(
    (event: React.FocusEvent<HTMLElement>) => {
      const input = inputOf(event.target);
      if (input) tryCommit(input.value);
    },
    [tryCommit],
  );

  const onFocusCapture = useCallback(() => {
    lastCommitted.current = null;
  }, []);

  return { onPasteCapture, onKeyDownCapture, onBlurCapture, onFocusCapture };
}
