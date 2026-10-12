'use client';

/**
 * @fileoverview **Λίστα + λεπτομέρειες** μιας σελίδας οντότητας: στήλες δίπλα-δίπλα στο desktop, λίστα **ή** φύλλο
 * λεπτομερειών στο κινητό.
 * @related ADR-912 §12.11 (αποθήκες · στάθμευση) · `MobileDetailsSlideIn` (η μπάρα του φύλλου είναι η μπάρα ενεργειών)
 * @module core/layouts/ListDetailsSplit
 *
 * 🔴 **Η αφορμή** (μετρημένο 2026-10-12 στα 390px, `/spaces/parking`): η στήλη λεπτομερειών στηνόταν δίπλα στη λίστα και
 *   στο κινητό — ξεκινούσε στο x=391, δηλαδή **έξω από την οθόνη**, με τις ενέργειές της κρυμμένες. Ό,τι επέλεγε ο
 *   άνθρωπος δεν μπορούσε ούτε να το δει ούτε να το επεξεργαστεί.
 * 🔑 **Ένα αντίτυπο των λεπτομερειών, ποτέ δύο.** Οι δύο κλάδοι είναι αποκλειστικοί (`useIsMobile`): μια φόρμα που
 *   καταχωρεί την αποθήκευσή της σε κοινό ref (`useEntityCreateForm`) δεν πρέπει να υπάρχει και κρυμμένη στη στήλη του
 *   desktop — θα αποθήκευε το αόρατο αντίτυπο.
 */

import type { ReactNode } from 'react';

import { useIsMobile } from '@/hooks/useMobile';
import { ENTITY_LIST_TOKENS } from '@/styles/design-tokens';
import { MobileDetailsSlideIn } from './MobileDetailsSlideIn';

interface ListDetailsSplitProps {
  /** Η λίστα (ή το πλέγμα) των εγγραφών. */
  list: ReactNode;
  /** Οι λεπτομέρειες της επιλογής — ή η φόρμα δημιουργίας. Στο desktop αποδίδονται και χωρίς επιλογή (κενή κατάσταση). */
  details: ReactNode;
  /** Υπάρχει κάτι να δείξει το φύλλο του κινητού (επιλεγμένη εγγραφή ή φόρμα δημιουργίας); */
  sheetOpen: boolean;
  sheetTitle: string;
  onCloseSheet: () => void;
  /** Η λίστα πιάνει όλο το πλάτος και στο desktop (προβολή πλέγματος): οι λεπτομέρειες υπάρχουν μόνο ως φύλλο κινητού. */
  listOnly?: boolean;
}

const DESKTOP_SPLIT = 'hidden md:flex flex-1 gap-2 min-h-0 min-w-0 overflow-hidden';

export function ListDetailsSplit({
  list,
  details,
  sheetOpen,
  sheetTitle,
  onCloseSheet,
  listOnly = false,
}: ListDetailsSplitProps) {
  const isMobile = useIsMobile();
  const sheet = (
    <MobileDetailsSlideIn isOpen={isMobile && sheetOpen} onClose={onCloseSheet} title={sheetTitle}>
      {details}
    </MobileDetailsSlideIn>
  );

  if (listOnly) {
    return (
      <>
        {list}
        {sheet}
      </>
    );
  }

  return (
    <>
      {isMobile ? (
        <div className={sheetOpen ? ENTITY_LIST_TOKENS.mobileRegion.hidden : ENTITY_LIST_TOKENS.mobileRegion.shown}>
          {list}
        </div>
      ) : (
        <div className={DESKTOP_SPLIT}>
          {list}
          {details}
        </div>
      )}
      {sheet}
    </>
  );
}
