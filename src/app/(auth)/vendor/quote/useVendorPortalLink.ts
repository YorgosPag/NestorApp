'use client';

/**
 * **Ο σύνδεσμος της πύλης, από το fragment** (ADR-876 §5 · W3C TAG *Capability URLs*).
 *
 * Ο σύνδεσμος του email είναι `/vendor/quote#t=<διαπιστευτήριο>[&intent=decline]`. Ο browser
 * **δεν στέλνει ποτέ** το `#…` στον server — ούτε σε access log, ούτε σε `Referer`, ούτε στα
 * Safe Links που «πατούν» τον σύνδεσμο πριν τον άνθρωπο. Εδώ:
 *
 *  1. διαβάζεται **μία** φορά (γραμματική: `readVendorPortalFragment`, δίπλα στον κατασκευαστή)·
 *  2. **σβήνεται** από τη γραμμή διευθύνσεων **και** από το ιστορικό (`history.replaceState`):
 *     στιγμιότυπο οθόνης ή αντιγραφή της διεύθυνσης δεν κουβαλούν πια το διαπιστευτήριο·
 *  3. κρατιέται στο `sessionStorage` της **καρτέλας**, ώστε η ανανέωση της σελίδας να δουλεύει·
 *     σβήνει όταν κλείσει η καρτέλα. Κάθε πρόσβαση σε try/catch: ιδιωτικό παράθυρο ή μπλοκαρισμένα
 *     δεδομένα ⇒ απλώς καμία επιβίωση σε reload, ποτέ σφάλμα.
 *  4. **και σε `hashchange`** (ADR-876 §5 Σ18): δεύτερος σύνδεσμος επικολλημένος στην ΙΔΙΑ καρτέλα
 *     είναι πλοήγηση στο ίδιο έγγραφο — χωρίς mount. Επαληθευμένο στον browser: η σελίδα έδειχνε
 *     την ΠΡΟΗΓΟΥΜΕΝΗ πρόσκληση και το νέο `#t=` έμενε ορατό στη γραμμή διευθύνσεων.
 *
 * @module app/(auth)/vendor/quote/useVendorPortalLink
 */

import { useEffect, useState } from 'react';

import { clearUrlFragment } from '@/lib/url-query-state';

import {
  readVendorPortalFragment,
  type VendorPortalIntent,
} from '@/subapps/procurement/services/vendor-portal-links';

const STORAGE_KEY = 'nestor.vendor-portal.link';

export type VendorPortalLinkState =
  | { readonly phase: 'reading' }
  | { readonly phase: 'missing' }
  | { readonly phase: 'ready'; readonly token: string; readonly intent: VendorPortalIntent | null };

function remember(token: string): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, token);
  } catch {
    // Χωρίς αποθήκευση: η σελίδα δουλεύει, απλώς δεν επιβιώνει σε reload.
  }
}

function recall(): string | null {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function useVendorPortalLink(): VendorPortalLinkState {
  const [state, setState] = useState<VendorPortalLinkState>({ phase: 'reading' });

  useEffect(() => {
    const adopt = (): void => {
      const fragment = readVendorPortalFragment(window.location.hash);
      if (window.location.hash) clearUrlFragment();
      if (fragment.token) {
        remember(fragment.token);
        setState({ phase: 'ready', token: fragment.token, intent: fragment.intent });
        return;
      }
      // Κενό fragment μετά από `hashchange` (π.χ. το δικό μας σβήσιμο) ⇒ ό,τι ήδη ισχύει μένει.
      setState((current) => {
        if (current.phase === 'ready') return current;
        const stored = recall();
        return stored ? { phase: 'ready', token: stored, intent: null } : { phase: 'missing' };
      });
    };
    adopt();
    window.addEventListener('hashchange', adopt);
    return () => window.removeEventListener('hashchange', adopt);
  }, []);

  return state;
}
