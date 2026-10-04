'use client';

/**
 * @fileoverview **Η ΘΕΣΗ ΕΚΚΡΕΜΕΙ** — «γνωστά εκκρεμές», όχι σιωπή. ADR-332 D27 Ζ5 · D29.
 * @related services/addresses/address-positions-pending · AddressPositionDriftNotice · AddressPositionStaleNotice
 *
 * Η προθεσμία της αποθήκευσης τελείωσε πριν προλάβει να λυθεί αυτή η διεύθυνση. Τίποτα δεν σβήστηκε —
 * αλλά ο άνθρωπος **το μαθαίνει**. Η Salesforce στην ίδια κατάσταση αφήνει τη συντεταγμένη κενή ή παλιά
 * **χωρίς να πει τίποτα**.
 *
 * 🔑 **Χωρίς ενέργειες**: δεν υπάρχει τίποτα να αποφασίσει ο άνθρωπος — μόνο να ξέρει. Γι' αυτό
 * διαφέρει από τις δύο αδελφές ειδοποιήσεις, που ζητούν απόφαση.
 *
 * 🔑 **Η φάση αλλάζει τη διατύπωση, όχι το συστατικό**: `locating` ⇒ «εντοπίζεται, θα εμφανιστεί»·
 * `deferred` ⇒ «θα υπολογιστεί στην επόμενη αποθήκευση». Ήταν inline `<p>` στις επαφές· με τα έργα και
 * τα κτίρια θα γινόταν τρία αντίγραφα της ίδιας γραμμής.
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { AddressPositionPendingPhase } from '@/services/addresses/address-positions-pending';

export interface AddressPositionPendingNoticeProps {
  readonly phase: AddressPositionPendingPhase;
}

export function AddressPositionPendingNotice({ phase }: AddressPositionPendingNoticeProps) {
  const { t } = useTranslation('addresses');

  return (
    <p
      role="status"
      aria-live="polite"
      aria-busy={phase === 'locating'}
      className="mt-2 border-t pt-2 text-sm text-muted-foreground"
    >
      {phase === 'locating' ? t('editor.positionPending.locating') : t('editor.positionPending.message')}
    </p>
  );
}
