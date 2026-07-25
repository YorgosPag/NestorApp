/**
 * Shared label resolver for ADR-319 contact address types.
 *
 * Rules:
 *   - `other` with a non-empty `customLabel` → the custom text (trimmed)
 *   - everything else → `addresses.types.<key>` via the caller's `t` fn
 *
 * Callers pass their already-instantiated `tAddr` to keep the hook graph flat.
 */

import { isValidContactAddressType, type ContactAddressType } from '@/types/contacts/address-types';

type TFn = (key: string) => string;

export function resolveContactAddressLabel(
  type: ContactAddressType,
  customLabel: string | undefined,
  tAddr: TFn,
): string {
  if (type === 'other' && customLabel?.trim()) return customLabel.trim();
  return tAddr(`types.${type}`);
}

/**
 * Ασφαλής απόδοση ενός **αποθηκευμένου** `AddressInfo.label`.
 *
 * Το `label` στη βάση είναι είτε σημασιολογικό slug (`home`, `headquarters`, …)
 * είτε ελεύθερο κείμενο χρήστη (μόνο όταν ο τύπος είναι `other`). Ποτέ i18n key.
 *
 * Ιστορικές εγγραφές όμως αποθήκευαν raw key (`contacts.address.primary`). Μέχρι
 * να τρέξει το migration, τέτοιες τιμές ΔΕΝ πρέπει να εμφανίζονται ωμές στον
 * χρήστη — επιστρέφεται `null` και ο καλών πέφτει πίσω στον τύπο διεύθυνσης.
 *
 * SSoT: μοναδικό σημείο απόδοσης· μην αντιγράψεις τη λογική σε components.
 *
 * @returns κείμενο προς εμφάνιση, ή `null` όταν δεν υπάρχει τίποτα αξιοποιήσιμο.
 */
export function renderStoredAddressLabel(
  label: string | undefined,
  tAddr: TFn,
): string | null {
  const trimmed = label?.trim();
  if (!trimmed) return null;

  // Σημασιολογικό slug → μετάφραση στο render (η βάση μένει γλωσσικά ουδέτερη).
  if (isValidContactAddressType(trimmed)) return tAddr(`types.${trimmed}`);

  // Legacy raw i18n key (π.χ. `contacts.address.primary`) — δεν εμφανίζεται ποτέ.
  if (/^[a-z0-9_]+(\.[a-z0-9_]+)+$/i.test(trimmed)) return null;

  // Ελεύθερο κείμενο χρήστη.
  return trimmed;
}
