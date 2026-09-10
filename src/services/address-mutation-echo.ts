/**
 * @fileoverview **ΤΙ ΕΓΡΑΨΕ Ο ΔΙΑΚΟΜΙΣΤΗΣ ΓΙΑ ΤΙΣ ΔΙΕΥΘΥΝΣΕΙΣ** — η απήχηση μιας μετάλλαξης
 * έργου ή κτιρίου, γραμμένη μία φορά. ADR-332 D27 Βήμα Β (Β5 · Φ2β).
 * @module services/address-mutation-echo
 *
 * 🔴 Οι δύο clients (`projects-client.service` · `building-services`) χρειάστηκαν **την ίδια**
 * προσαρμογή — υιοθέτηση των διευθύνσεων που έγραψε ο διακομιστής, συμβουλές απόκλισης, και
 * διάδοση σε άλλες σελίδες **χωρίς** το αίτημα `relocateAddressIds`. Γραμμένη δύο φορές, ήταν
 * δύο κλώνοι 7 και 17 γραμμών (CHECK 3.28) — δηλαδή δύο σημεία όπου θα απέκλινε αύριο.
 */

import type { ProjectAddress } from '@/types/project/addresses';
import type { AddressPositionDrift } from '@/lib/geocoding/address-position';

/** Ό,τι επιστρέφει ο διακομιστής για τις διευθύνσεις — **όπως γράφτηκαν**. */
export interface ServerAddressEcho {
  addresses?: ProjectAddress[];
  /** Κρατημένες ανθρώπινες πινέζες που απέχουν από τη νέα τους διεύθυνση. */
  positionAdvisories?: AddressPositionDrift[];
}

/** Κρατά **μόνο** ό,τι έστειλε ο διακομιστής — ώστε ο καλών να το απλώσει στο αποτέλεσμά του. */
export function serverAddressEcho(response: ServerAddressEcho | null | undefined): ServerAddressEcho {
  return {
    ...(response?.addresses ? { addresses: response.addresses } : {}),
    ...(response?.positionAdvisories ? { positionAdvisories: response.positionAdvisories } : {}),
  };
}

/**
 * Τα πεδία που διαδίδονται σε **άλλες σελίδες** μετά από επιτυχή ενημέρωση.
 *
 * - **Όχι** `_v` (έκδοση) και **όχι** `relocateAddressIds` — το δεύτερο είναι αίτημα, όχι πεδίο.
 * - Οι διευθύνσεις είναι του **διακομιστή**, όχι του αιτήματος (μοτίβο Apollo / Relay).
 * - Μόνο ορισμένες τιμές: ένα `undefined` θα έσβηνε πεδίο στον ακροατή.
 */
/**
 * **Το κλείσιμο μιας επιτυχημένης μετάλλαξης**, γραμμένο μία φορά: απήχηση του διακομιστή →
 * διάδοση σε άλλες σελίδες → αποτέλεσμα για τον καλούντα. Κάθε client δίνει **μόνο** τη δική του
 * γραμμή διάδοσης (είδος συμβάντος, ταυτότητα) — το υπόλοιπο ήταν κλώνος 11 γραμμών (CHECK 3.28).
 */
export function settleEntityUpdate<
  T extends { readonly _v?: number; readonly relocateAddressIds?: readonly string[] },
>(
  response: ({ _v?: number } & ServerAddressEcho) | null | undefined,
  updates: T,
  dispatch: (fields: Record<string, unknown>) => void,
): { success: true; _v?: number } & ServerAddressEcho {
  const echo = serverAddressEcho(response);
  dispatch(realtimeUpdateFields(updates, echo));
  return { success: true, _v: response?._v, ...echo };
}

export function realtimeUpdateFields<
  T extends { readonly _v?: number; readonly relocateAddressIds?: readonly string[] },
>(updates: T, echo: ServerAddressEcho): Record<string, unknown> {
  const { _v: _version, relocateAddressIds: _relocateRequest, ...fields } = updates;
  const withServerAddresses: Record<string, unknown> = echo.addresses
    ? { ...fields, addresses: echo.addresses }
    : { ...fields };
  return Object.fromEntries(Object.entries(withServerAddresses).filter(([, value]) => value !== undefined));
}
