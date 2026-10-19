'use client';

/**
 * @fileoverview **Λίστα + λεπτομέρειες** μιας σελίδας οντότητας: στήλες δίπλα-δίπλα στο desktop, λίστα **ή** φύλλο
 * λεπτομερειών στο κινητό.
 * @related ADR-912 §12.11 (αποθήκες · στάθμευση) · §12.17 (πλέγμα ⇒ side peek) · `MobileDetailsSlideIn` (η μπάρα του
 *   φύλλου είναι η μπάρα ενεργειών) · `DetailsPeekPanel` (η ίδια μπάρα, δίπλα στο πλέγμα)
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
import { DetailsPeekPanel } from './DetailsPeekPanel';
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
   * **Προβολή πλέγματος** (ADR-912 §12.17): η λίστα πιάνει όλο το πλάτος όσο δεν υπάρχει επιλογή· με επιλογή, στο desktop
   * οι λεπτομέρειες ανοίγουν **δίπλα** ως `DetailsPeekPanel` (side peek), στο κινητό ως φύλλο — όπως πάντα.
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

/** Πλέγμα + side peek: η ίδια γραμμή σε κάθε πλάτος· το panel υπάρχει μόνο στο desktop (`DetailsPeekPanel`). */
const PEEK_ROW = 'flex flex-1 gap-2 min-h-0 min-w-0 overflow-hidden [&>aside]:hidden md:[&>aside]:flex';
/**
 * Γραμμή (όχι στήλη), όπως το `ListContainer` που φιλοξενούσε ως τώρα το πλέγμα απευθείας: το παιδί τεντώνεται σε ύψος
 * και το δικό του `overflow-y-auto` κυλά. `min-w-0`: χωρίς αυτό το πλέγμα (auto-fill) δεν στενεύει όταν ανοίγει το panel.
 */
const PEEK_LIST = 'flex flex-1 min-h-0 min-w-0';

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
        <div className={PEEK_ROW}>
          <div className={PEEK_LIST}>{list}</div>
          {/* Το `PEEK_ROW` κρύβει το panel κάτω από `md` με CSS: το πρώτο καρέ (`useIsMobile` ⇒ false) δεν αναβοσβήνει στο κινητό. */}
          {!isMobile && sheetOpen && (
            <DetailsPeekPanel onClose={onCloseSheet} title={sheetTitle}>
              {details}
            </DetailsPeekPanel>
          )}
        </div>
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
