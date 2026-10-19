'use client';

/**
 * @fileoverview **Λίστα + λεπτομέρειες** μιας σελίδας οντότητας: στήλες δίπλα-δίπλα στο desktop, λίστα **ή** φύλλο
 * λεπτομερειών στο κινητό.
 * @related ADR-912 §12.11 (αποθήκες · στάθμευση) · §12.19 (πλέγμα ⇒ side peek) · `MobileDetailsSlideIn` (η μπάρα του
 *   φύλλου είναι η μπάρα ενεργειών) · `DetailsPeekSplit` (η ίδια μπάρα, δίπλα στο πλέγμα, σε στήλη που σέρνεται)
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
import { DetailsPeekSplit } from './details-peek-split';
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
  /**
   * **Προβολή πλέγματος** (ADR-912 §12.19): η λίστα πιάνει όλο το πλάτος όσο δεν υπάρχει επιλογή· με επιλογή, στο desktop
   * οι λεπτομέρειες ανοίγουν **δίπλα** ως `DetailsPeekPanel` (side peek, πλάτος που σέρνεται), στο κινητό ως φύλλο.
   * 🔴 Ως 2026-10-19 λεγόταν `listOnly` και σήμαινε «στο desktop οι λεπτομέρειες **δεν υπάρχουν**»: επιλογή χωρίς
   *   αποτέλεσμα, 0 κουμπιά «Επεξεργασία» στα 2400px.
   */
  peek?: boolean;
}

/**
 * Η γραμμή «λίστα + λεπτομέρειες» του desktop. 🔑 `min-w-0 overflow-hidden` είναι **όρος ορθότητας**, όχι στολίδι: χωρίς
 * αυτά το ελάχιστο πλάτος της γραμμής είναι το περιεχόμενό της, και η στήλη λεπτομερειών ταλαντεύεται μαζί με τη μετρημένη
 * υπερχείλιση ενεργειών (μετρημένο 2026-10-12 στα έργα, 1280px: 517 ↔ 1976px — ADR-777 §8.87.9ε).
 */
export const DESKTOP_SPLIT = 'hidden md:flex flex-1 gap-2 min-h-0 min-w-0 overflow-hidden';

export function ListDetailsSplit({
  list,
  details,
  sheetOpen,
  sheetTitle,
  onCloseSheet,
  peek = false,
}: ListDetailsSplitProps) {
  const isMobile = useIsMobile();
  const sheet = (
    <MobileDetailsSlideIn isOpen={isMobile && sheetOpen} onClose={onCloseSheet} title={sheetTitle}>
      {details}
    </MobileDetailsSlideIn>
  );

  if (peek) {
    return (
      <>
        {/* Η ίδια γραμμή σε κάθε πλάτος· το panel (συρόμενο, ADR-912 §12.19) υπάρχει μόνο στο desktop. Η ομάδα το κρύβει
            κάτω από `md` και με CSS: το πρώτο καρέ (`useIsMobile` ⇒ false) δεν αναβοσβήνει στο κινητό. */}
        <DetailsPeekSplit list={list} open={!isMobile && sheetOpen} title={sheetTitle} onClose={onCloseSheet}>
          {details}
        </DetailsPeekSplit>
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
