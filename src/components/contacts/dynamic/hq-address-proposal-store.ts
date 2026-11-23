'use client';

/**
 * @fileoverview **Πρόταση έδρας από έξω** — η πρόθεση «διόρθωσε την έδρα με αυτές τις τιμές» (ADR-948 §8 Βήμα 7 · ADR-332).
 * @module components/contacts/dynamic/hq-address-proposal-store
 *
 * 🔑 **Η πρόταση πηγαίνει στον ιδιοκτήτη, δεν γράφει.** Ο γραφέας της έδρας είναι ο editor της
 *    (`AddressesSectionWithFullscreen` → `useHqAddressMutations`): μόνο εκεί τρέχει γεωκωδικοποίηση και
 *    επιβεβαίωση πινέζας. Μια πηγή εκτός editor (σήμερα: το πάνελ «Έλεγχος στο ΓΕΜΗ», σε άλλη καρτέλα) αφήνει
 *    εδώ την πρόταση· ο editor την **παραλαμβάνει** μία φορά όταν ανοίξει η καρτέλα του, και ο άνθρωπος
 *    επιβεβαιώνει ή αναιρεί. Καμία δεύτερη πόρτα εγγραφής.
 * 🔑 Μία πρόταση τη φορά, **δεμένη σε επαφή**: πρόταση για άλλη επαφή δεν παραλαμβάνεται ποτέ.
 * 🔑 Η παραλαβή την **αδειάζει** (`takeHqAddressProposal`) ⇒ δεύτερο mount δεν την ξαναεφαρμόζει (ιδεμπότητα).
 */

import { useSyncExternalStore } from 'react';

import type { SeatFields } from '@/lib/company/contact-registry-comparison';
import { createExternalStore } from '@/lib/state/createExternalStore';
import type { RegistrySource } from '@/types/company-registry';

export interface HqAddressProposal {
  readonly contactId: string;
  /** Από πού έρχεται — φαίνεται στη λωρίδα του editor. */
  readonly source: RegistrySource;
  /** Πότε το είπε η πηγή (`RegistryCheck.checkedAt`) — φαίνεται δίπλα της. */
  readonly observedAt: string;
  readonly seat: SeatFields;
}

const store = createExternalStore<HqAddressProposal | null>(null);

/** Αφήνει την πρόταση· αντικαθιστά όποια προηγούμενη δεν παραλήφθηκε. */
export function proposeHqAddress(proposal: HqAddressProposal): void {
  store.set(proposal);
}

/** Παραλαβή: αδειάζει **μόνο** αν είναι ακόμη η ίδια πρόταση (καμία σιωπηλή απώλεια νεότερης). */
export function takeHqAddressProposal(proposal: HqAddressProposal): void {
  if (store.get() === proposal) store.set(null);
}

/** Η πρόταση που περιμένει **αυτή** την επαφή — `null` αλλιώς. */
export function useHqAddressProposal(contactId: string | undefined): HqAddressProposal | null {
  const proposal = useSyncExternalStore(store.subscribe, store.get, store.get);
  return proposal !== null && contactId !== undefined && proposal.contactId === contactId ? proposal : null;
}
