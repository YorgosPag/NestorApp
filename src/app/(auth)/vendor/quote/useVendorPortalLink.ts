'use client';

/**
 * **Ο σύνδεσμος της πύλης, από το fragment** (ADR-876 §5 · W3C TAG *Capability URLs*).
 *
 * Ο σύνδεσμος του email είναι `/vendor/quote#t=<διαπιστευτήριο>[&intent=decline]`. Ο browser **δεν στέλνει ποτέ** το
 * `#…` στον server. Ο μηχανισμός (μία ανάγνωση · σβήσιμο από διεύθυνση και ιστορικό · `sessionStorage` της καρτέλας ·
 * `hashchange`) ζει πλέον στο **κοινό** `useFragmentCredential` (ADR-915 §28, με την άφιξη της δεύτερης πύλης)· εδώ
 * μένει μόνο ό,τι είναι της πύλης προμηθευτή: το κλειδί της καρτέλας και η πρόθεση.
 *
 * @module app/(auth)/vendor/quote/useVendorPortalLink
 */

import { useFragmentCredential } from '@/lib/tokens/useFragmentCredential';

import { vendorPortalIntentOf, type VendorPortalIntent } from '@/subapps/procurement/services/vendor-portal-links';

const STORAGE_KEY = 'nestor.vendor-portal.link';

export type VendorPortalLinkState =
  | { readonly phase: 'reading' }
  | { readonly phase: 'missing' }
  | { readonly phase: 'ready'; readonly token: string; readonly intent: VendorPortalIntent | null };

export function useVendorPortalLink(): VendorPortalLinkState {
  const link = useFragmentCredential(STORAGE_KEY, vendorPortalIntentOf);
  return link.phase === 'ready' ? { phase: 'ready', token: link.token, intent: link.extras } : link;
}
