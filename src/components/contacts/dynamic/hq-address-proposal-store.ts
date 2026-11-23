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
import type { RegistrySeatApplication } from '@/lib/company/registry-form-acceptance';
import { createExternalStore } from '@/lib/state/createExternalStore';
import type { RegistrySource } from '@/types/company-registry';

/**
 * **Από πού** έρχεται η πρόταση — φαίνεται στη λωρίδα του editor. Διακριτή ένωση (ADR-950 §4.5): το μητρώο (ADR-948)
 * ή ένα ανεβασμένο **έγγραφο** της επαφής· η λωρίδα λέει ποιο, ώστε ο άνθρωπος να ξέρει τι επιβεβαιώνει.
 */
export type HqAddressProposalOrigin =
  | { readonly kind: 'registry'; readonly source: RegistrySource }
  | { readonly kind: 'document'; readonly fileId: string; readonly fileName: string };

export interface HqAddressProposal {
  readonly contactId: string;
  readonly origin: HqAddressProposalOrigin;
  /** Πότε το είπε η πηγή (`RegistryCheck.checkedAt` · ώρα ανάγνωσης του εγγράφου) — φαίνεται δίπλα της. */
  readonly observedAt: string;
  readonly seat: SeatFields;
  /**
   * Συμπλήρωση της **ίδιας** διεύθυνσης ή αντικατάσταση από **άλλη** (ADR-948 §8.7.4) — την κρίνει ο παραγωγός,
   * που έχει τη σύγκριση τη στιγμή της πρότασης· ο editor δεν την ξαναμαντεύει.
   */
  readonly application: RegistrySeatApplication;
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
