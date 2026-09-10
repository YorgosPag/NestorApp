/**
 * @fileoverview Συμβουλές απόκλισης **κρατημένων** πινεζών επαφής (ADR-332 D27 Β-ΙΙ, Φ2β).
 * @module services/contacts/contact-address-advisories
 *
 * 🔑 **Γιατί store και όχι τιμή επιστροφής.** Η αποθήκευση επαφής ξεκινά από **τέσσερα**
 * σημεία (διάλογος δημιουργίας/επεξεργασίας, σελίδα λεπτομερειών, φύλακας μεταλλάξεων,
 * προμήθειες). Η συμβουλή όμως ανήκει στην **καρτέλα διευθύνσεων**. Αντί να περάσει μέσα από
 * τέσσερις καλούντες που δεν την ξέρουν, τη γράφει **ένας** γραφέας (η υπηρεσία θέσης) και
 * τη διαβάζει **ένας** καταναλωτής — ίδιο σχήμα με τα `positionAdvisories` των έργων.
 *
 * Ζει στη μνήμη της σελίδας, όπως και στα έργα: είναι γεγονός **της τελευταίας αποθήκευσης**,
 * όχι κατάσταση του εγγράφου.
 */

import { useSyncExternalStore } from 'react';
import { createExternalStore } from '@/lib/state/createExternalStore';
import type { AddressPositionDrift } from '@/lib/geocoding/address-position';

type AdvisoriesByContact = ReadonlyMap<string, readonly AddressPositionDrift[]>;

/** Σταθερή αναφορά — ένα `?? []` στον selector θα έδινε νέο πίνακα σε κάθε απόδοση (βρόχος). */
const NO_ADVISORIES: readonly AddressPositionDrift[] = [];

const store = createExternalStore<AdvisoriesByContact>(new Map());

/** Η υπηρεσία θέσης γράφει τη λογιστική **ολόκληρης** της αποθήκευσης — αντικαθιστά την παλιά. */
export function publishContactAddressAdvisories(
  contactId: string,
  advisories: readonly AddressPositionDrift[],
): void {
  const next = new Map(store.get());
  if (advisories.length > 0) next.set(contactId, [...advisories]);
  else next.delete(contactId);
  store.set(next);
}

/** «Κράτα την πινέζα» — ο άνθρωπος ξέρει καλύτερα· η συμβουλή φεύγει, η πινέζα μένει. */
export function dismissContactAddressAdvisory(contactId: string, addressId: string): void {
  const current = store.get().get(contactId);
  if (!current) return;
  publishContactAddressAdvisories(contactId, current.filter((a) => a.addressId !== addressId));
}

export function useContactAddressAdvisories(
  contactId: string | undefined,
): readonly AddressPositionDrift[] {
  const byContact = useSyncExternalStore(store.subscribe, store.get, store.get);
  return (contactId ? byContact.get(contactId) : undefined) ?? NO_ADVISORIES;
}
