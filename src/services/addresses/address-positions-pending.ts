/**
 * @fileoverview **ΕΚΚΡΕΜΕΙΣ ΘΕΣΕΙΣ ΔΙΕΥΘΥΝΣΕΩΝ** — «γνωστά εκκρεμές», όχι «σιωπηλά μπαγιάτικο».
 * @module services/addresses/address-positions-pending
 * @enterprise ADR-332 D27 Ζ5 · D29
 *
 * 🔑 **Μία μνήμη για κάθε οντότητα με διευθύνσεις** (επαφή · έργο · κτίριο). Γεννήθηκε μέσα στο
 * `contact-address-advisories` με ονόματα «contact», αλλά το κλειδί της ήταν πάντα ένα σκέτο id —
 * και τα ids του έργου είναι καθολικά μοναδικά (`cont_…` · `proj_…` · `bldg_…`). Δεύτερη μνήμη για
 * τα έργα θα ήταν αντίγραφο με άλλα ονόματα.
 *
 * 🔑 **Γιατί store και όχι τιμή επιστροφής**: η αποθήκευση ξεκινά από πολλά σημεία (η δημιουργία
 * έργου από την καρτέλα «Γενικά»), ενώ η ένδειξη ανήκει στην καρτέλα **διευθύνσεων**. Τη γράφει
 * **ένας** γραφέας (η υπηρεσία πελάτη) και τη διαβάζει ο καταναλωτής, χωρίς props μέσα από
 * καλούντες που δεν την ξέρουν.
 *
 * 🔑 **Δύο φάσεις, επειδή σημαίνουν διαφορετικό πράγμα για τον άνθρωπο:**
 * - `locating` — ο διακομιστής **συνεχίζει** μετά την απάντηση· η θέση θα έρθει μόνη της (έργα · κτίρια).
 * - `deferred` — κανείς δεν συνεχίζει· θα υπολογιστεί στην **επόμενη αποθήκευση** (επαφές, και κάθε
 *   `locating` που δεν ολοκληρώθηκε στο παράθυρό του). Ένα αιώνιο «εντοπίζεται…» θα ήταν ψέμα.
 *
 * Ζει στη μνήμη της σελίδας: είναι γεγονός **της τελευταίας αποθήκευσης**, όχι κατάσταση του εγγράφου.
 */

import { useSyncExternalStore } from 'react';
import { createExternalStore } from '@/lib/state/createExternalStore';

export type AddressPositionPendingPhase = 'locating' | 'deferred';

export interface AddressPositionsPending {
  readonly ids: readonly string[];
  readonly phase: AddressPositionPendingPhase;
}

type PendingByEntity = ReadonlyMap<string, AddressPositionsPending>;

/** Σταθερή αναφορά — ένα νέο αντικείμενο στον selector θα έδινε βρόχο απόδοσης. */
const NONE_PENDING: AddressPositionsPending = { ids: [], phase: 'deferred' };

const store = createExternalStore<PendingByEntity>(new Map());

function write(entityId: string, pending: AddressPositionsPending | null): void {
  const next = new Map(store.get());
  if (pending && pending.ids.length > 0) next.set(entityId, pending);
  else next.delete(entityId);
  store.set(next);
}

/**
 * Ποιες διευθύνσεις δεν πρόλαβαν να λυθούν στην τελευταία αποθήκευση — **αντικαθιστά** την παλιά λίστα.
 *
 * Δημοσιεύεται **πάντα**, ακόμη και κενή: έτσι η ένδειξη της προηγούμενης αποθήκευσης σβήνει μόνη
 * της όταν η επόμενη προλάβει.
 */
export function publishAddressPositionsPending(
  entityId: string,
  addressIds: readonly string[],
  phase: AddressPositionPendingPhase,
): void {
  write(entityId, { ids: [...addressIds], phase });
}

/** Η θέση αυτών των διευθύνσεων **γράφτηκε** — φεύγουν από τη λίστα, οι υπόλοιπες μένουν. */
export function settleAddressPositionsPending(entityId: string, addressIds: readonly string[]): void {
  const current = store.get().get(entityId);
  if (!current) return;
  const settled = new Set(addressIds);
  write(entityId, { ...current, ids: current.ids.filter((id) => !settled.has(id)) });
}

/** Το παράθυρο αναμονής έκλεισε χωρίς θέση ⇒ «θα υπολογιστεί στην επόμενη αποθήκευση». */
export function deferAddressPositionsPending(entityId: string): void {
  const current = store.get().get(entityId);
  if (!current || current.phase === 'deferred') return;
  write(entityId, { ...current, phase: 'deferred' });
}

export function useAddressPositionsPending(entityId: string | undefined): AddressPositionsPending {
  const byEntity = useSyncExternalStore(store.subscribe, store.get, store.get);
  return (entityId ? byEntity.get(entityId) : undefined) ?? NONE_PENDING;
}

/** Μόνο για tests: καθαρή μνήμη ανάμεσα σε περιπτώσεις. */
export function resetAddressPositionsPendingForTests(): void {
  store.reset(new Map());
}
