'use client';

/**
 * @fileoverview **Ο σύνδεσμος μιας πύλης χωρίς λογαριασμό, από το fragment** — ο ένας αναγνώστης στον browser.
 * @related lib/tokens/credential-fragment.ts (η γραμματική) · ADR-876 §5 · ADR-915 §28
 * @module lib/tokens/useFragmentCredential
 *
 * Εξήχθη από το `useVendorPortalLink` (ADR-915 §28) με την άφιξη της δεύτερης πύλης. Ο σύνδεσμος:
 *  1. διαβάζεται **μία** φορά (με τον αναλυτή της πύλης)·
 *  2. **σβήνεται** από τη γραμμή διευθύνσεων **και** το ιστορικό (`clearUrlFragment`): στιγμιότυπο ή αντιγραφή της
 *     διεύθυνσης δεν κουβαλούν πια το διαπιστευτήριο·
 *  3. κρατιέται στο `sessionStorage` της **καρτέλας** για να δουλεύει η ανανέωση· σβήνει με την καρτέλα. Κάθε πρόσβαση
 *     σε try/catch: ιδιωτικό παράθυρο ⇒ απλώς καμία επιβίωση σε reload, ποτέ σφάλμα·
 *  4. **και σε `hashchange`** (ADR-876 §5 Σ18): δεύτερος σύνδεσμος στην ΙΔΙΑ καρτέλα είναι πλοήγηση χωρίς mount.
 */

import { useEffect, useState } from 'react';

import { clearUrlFragment } from '@/lib/url-query-state';

import { readCredentialFragment } from './credential-fragment';

export type FragmentCredentialState<TExtras> =
  | { readonly phase: 'reading' }
  | { readonly phase: 'missing' }
  | { readonly phase: 'ready'; readonly token: string; readonly extras: TExtras | null };

function remember(key: string, token: string): void {
  try {
    window.sessionStorage.setItem(key, token);
  } catch {
    // Χωρίς αποθήκευση: η σελίδα δουλεύει, απλώς δεν επιβιώνει σε reload.
  }
}

function recall(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * @param storageKey το κλειδί της καρτέλας — **ένα ανά πύλη** (δύο πύλες δεν μοιράζονται διαπιστευτήριο).
 * @param readExtras τα επιπλέον πεδία της πύλης (π.χ. πρόθεση), από κλειστό σύνολο· `null` όταν δεν ήρθαν με τον σύνδεσμο.
 */
export function useFragmentCredential<TExtras>(
  storageKey: string,
  readExtras: (params: URLSearchParams) => TExtras | null,
): FragmentCredentialState<TExtras> {
  const [state, setState] = useState<FragmentCredentialState<TExtras>>({ phase: 'reading' });

  useEffect(() => {
    const adopt = (): void => {
      const fragment = readCredentialFragment(window.location.hash);
      if (window.location.hash) clearUrlFragment();
      if (fragment.token) {
        remember(storageKey, fragment.token);
        setState({ phase: 'ready', token: fragment.token, extras: readExtras(fragment.params) });
        return;
      }
      // Κενό fragment μετά από `hashchange` (π.χ. το δικό μας σβήσιμο) ⇒ ό,τι ήδη ισχύει μένει.
      setState((current) => {
        if (current.phase === 'ready') return current;
        const stored = recall(storageKey);
        return stored ? { phase: 'ready', token: stored, extras: null } : { phase: 'missing' };
      });
    };
    adopt();
    window.addEventListener('hashchange', adopt);
    return () => window.removeEventListener('hashchange', adopt);
    // ⚠️ Ο αναλυτής δίνεται **σε εμβέλεια module** από την πύλη — σταθερός, άρα δεν ξανατρέχει το effect.
  }, [storageKey, readExtras]);

  return state;
}
