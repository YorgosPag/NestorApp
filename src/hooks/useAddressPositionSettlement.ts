'use client';

/**
 * @fileoverview **Η ΘΕΣΗ ΠΟΥ ΓΡΑΦΕΤΑΙ ΜΕΤΑ ΤΗΝ ΑΠΟΘΗΚΕΥΣΗ ΦΤΑΝΕΙ ΣΤΗΝ ΟΘΟΝΗ** — ADR-332 D29.
 * @related services/addresses/address-positions-pending · services/listings/address-position-completion
 *
 * Ο διακομιστής απαντά στην «Αποθήκευση» μέσα στην προθεσμία και ολοκληρώνει τη θέση **μετά** την
 * απάντηση. Κανείς όμως δεν ειδοποιεί τον πελάτη όταν γραφτεί: τα έργα διαβάζονται από API + μνήμη,
 * όχι από ζωντανό ακροατή. Χωρίς αυτό το hook ο άνθρωπος έβλεπε διεύθυνση χωρίς πινέζα ως την
 * επόμενη επαναφόρτωση.
 *
 * 🏆 **Πρακτική**: long-running operations (Google AIP-151) — ο πελάτης ξαναδιαβάζει με **αυξανόμενη,
 * φραγμένη** αναμονή. Η Salesforce στην ίδια θέση δεν λέει τίποτα και δεν ανανεώνει τίποτα.
 *
 * 🔑 **Ένα κριτήριο «γράφτηκε»**: η θέση της διεύθυνσης στον διακομιστή **διαφέρει** από αυτήν που
 * κρατά η οθόνη (χωρίς τη στιγμή επαλήθευσης). Καλύπτει και τις τρεις εκβάσεις — καμία→θέση,
 * παλιά→νέα, παλιά→σβησμένη — χωρίς να χρειάζεται ο διακομιστής να δηλώσει κατάσταση.
 *
 * 🔑 **Υιοθετείται ΜΟΝΟ η θέση, ΜΟΝΟ των διευθύνσεων που περίμεναν.** Ολόκληρη η λίστα του
 * διακομιστή θα μπορούσε να πατήσει κάτι που άλλαξε ο άνθρωπος στο μεταξύ.
 *
 * ⚠️ **Το παράθυρο κλείνει**: ό,τι δεν ήρθε ως το τέλος γίνεται `deferred` («θα υπολογιστεί στην
 * επόμενη αποθήκευση»). Ένα αιώνιο «εντοπίζεται…» για διεύθυνση που δεν υπάρχει θα ήταν ψέμα.
 */

import { useEffect, useRef } from 'react';
import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import {
  deferAddressPositionsPending,
  settleAddressPositionsPending,
  useAddressPositionsPending,
  type AddressPositionsPending,
} from '@/services/addresses/address-positions-pending';
import type { StoredAddressPosition } from '@/types/address-position';
import {
  storedPositionSignature,
  withStoredAddressPosition,
} from '@/utils/address/stored-address-position';

type PositionedAddress = StoredAddressPosition & { readonly id?: string };

export interface AddressPositionSettlementOptions<T extends PositionedAddress> {
  /** Η οντότητα που φέρει τις διευθύνσεις· `undefined` ⇒ αδρανές (π.χ. πρόχειρο χωρίς ταυτότητα). */
  readonly entityId: string | undefined;
  /** Οι διευθύνσεις όπως τις κρατά **τώρα** η οθόνη. */
  readonly addresses: readonly T[];
  /** Διαβάζει τις διευθύνσεις της οντότητας από τον διακομιστή. Αποτυχία ⇒ απλώς ξαναδοκιμάζεται. */
  readonly read: (entityId: string) => Promise<readonly PositionedAddress[]>;
  /** Οι διευθύνσεις της οθόνης, με τις θέσεις που μόλις γράφτηκαν. */
  readonly onSettled: (addresses: T[]) => void;
}

/** Οι θέσεις των εκκρεμών διευθύνσεων που **διαφέρουν** πλέον από ό,τι κρατά η οθόνη. */
function settledPositions<T extends PositionedAddress>(
  pendingIds: readonly string[],
  local: readonly T[],
  fresh: readonly PositionedAddress[],
): Map<string, PositionedAddress> {
  const freshById = new Map(fresh.flatMap((address) => (address.id ? [[address.id, address] as const] : [])));
  const settled = new Map<string, PositionedAddress>();
  for (const address of local) {
    if (!address.id || !pendingIds.includes(address.id)) continue;
    const written = freshById.get(address.id);
    if (written && storedPositionSignature(written) !== storedPositionSignature(address)) {
      settled.set(address.id, written);
    }
  }
  return settled;
}

/**
 * Παρακολουθεί τις εκκρεμείς θέσεις μιας οντότητας και τις φέρνει στην οθόνη μόλις γραφτούν.
 *
 * @returns Η τρέχουσα εκκρεμότητα (ποιες διευθύνσεις, σε ποια φάση) — για την ένδειξη ανά κάρτα.
 */
export function useAddressPositionSettlement<T extends PositionedAddress>(
  options: AddressPositionSettlementOptions<T>,
): AddressPositionsPending {
  const { entityId } = options;
  const pending = useAddressPositionsPending(entityId);
  // Οι τιμές που αλλάζουν σε κάθε απόδοση διαβάζονται τη στιγμή της ανάγνωσης, όχι της εγγραφής του
  // effect — αλλιώς κάθε πληκτρολόγηση θα ξανάρχιζε το παράθυρο αναμονής από την αρχή.
  const latest = useRef(options);
  latest.current = options;

  const waiting = pending.phase === 'locating' && pending.ids.length > 0;
  const pendingKey = pending.ids.join('|');

  useEffect(() => {
    if (!entityId || !waiting) return undefined;
    const pendingIds = pendingKey.split('|');
    const delays = GEOGRAPHIC_CONFIG.GEOCODING.COMPLETION_POLL_DELAYS_MS;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const attempt = (index: number): void => {
      if (index >= delays.length) {
        deferAddressPositionsPending(entityId);
        return;
      }
      timer = setTimeout(async () => {
        const fresh = await latest.current.read(entityId).catch(() => null);
        if (cancelled) return;
        const settled = fresh ? settledPositions(pendingIds, latest.current.addresses, fresh) : null;
        if (settled && settled.size > 0) {
          latest.current.onSettled(
            latest.current.addresses.map((address) => {
              const written = address.id ? settled.get(address.id) : undefined;
              return written ? withStoredAddressPosition(address, written) : address;
            }),
          );
          // Η αλλαγή της λίστας ξαναστήνει το effect για όσες **απομένουν** — με φρέσκο παράθυρο.
          settleAddressPositionsPending(entityId, [...settled.keys()]);
          return;
        }
        attempt(index + 1);
      }, delays[index]);
    };
    attempt(0);

    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [entityId, waiting, pendingKey]);

  return pending;
}
