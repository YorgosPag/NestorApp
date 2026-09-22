/**
 * @fileoverview **Η ΜΙΑ φύλαξη `beforeunload`** — ρωτά το `unsaved-work-registry` και προειδοποιεί
 * τον άνθρωπο πριν κλείσει/ανανεώσει καρτέλα με δουλειά που θα χαθεί.
 * @related ADR-860 §Ε3γ · ADR-367 §2.6
 * @module lib/app-version/unsaved-work-guard
 *
 * 🔑 **ΕΝΑΣ listener για ΟΛΟΥΣ τους ιδιοκτήτες**: πριν, κάθε πηγή κρατούσε δικό της native
 * `beforeunload` (ο `DirtyFormProvider`), άρα το μητρώο ήξερε την απάντηση αλλά την **έλεγε μόνο
 * στην ανάκαμψη του deploy** — όχι στον άνθρωπο. Πλέον η απάντηση έχει μία χρήση και για τα δύο.
 *
 * 🔑 **Listener ΜΟΝΟ όσο υπάρχει δουλειά** (οδηγία Chrome Page Lifecycle API): στο Firefox ένας
 * μόνιμος `beforeunload` βγάζει τη σελίδα από το bfcache. Προστίθεται στη μετάβαση άδειο→μη-άδειο
 * και αφαιρείται στην αντίστροφη.
 *
 * ⚠️ Κείμενο δεν υπάρχει και δεν μπορεί να υπάρξει: όλοι οι σύγχρονοι browsers αγνοούν
 * προσαρμοσμένο μήνυμα και δείχνουν το δικό τους, στη γλώσσα του browser.
 */

import { hasUnsavedWork, subscribeUnsavedWork } from '@/lib/app-version/unsaved-work-registry';

let installed = false;

function warnBeforeUnload(event: BeforeUnloadEvent): void {
  event.preventDefault();
  // Παλαιότεροι Chromium (<119) απαιτούν και το legacy `returnValue`.
  event.returnValue = '';
}

/** Συγχρονίζει τον native listener με το μητρώο. Idempotent. */
export function installUnsavedWorkGuard(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  let attached = false;
  const sync = (): void => {
    const shouldAttach = hasUnsavedWork();
    if (shouldAttach === attached) return;
    attached = shouldAttach;
    if (shouldAttach) window.addEventListener('beforeunload', warnBeforeUnload);
    else window.removeEventListener('beforeunload', warnBeforeUnload);
  };

  subscribeUnsavedWork(sync);
  sync();
}
