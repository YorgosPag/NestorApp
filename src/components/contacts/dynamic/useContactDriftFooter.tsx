'use client';

/**
 * @fileoverview Η ειδοποίηση **«Μετακίνησε / Κράτα»** στις κάρτες διευθύνσεων επαφής
 * (ADR-332 D27 Β-ΙΙ, Φ2β — ίδιο συστατικό με τα έργα, `AddressPositionDriftNotice`).
 * @module components/contacts/dynamic/useContactDriftFooter
 *
 * ⚠️ **Μόνο σε ΠΡΟΒΟΛΗ, ποτέ σε επεξεργασία.** Το «Μετακίνησε» γράφει αμέσως (μία εγγραφή, ο
 * ένας γραφέας). Αν γινόταν ενώ η φόρμα κρατά μη αποθηκευμένες αλλαγές διευθύνσεων, η επόμενη
 * αποθήκευση θα έστελνε την **παλιά** πινέζα ως `source: 'dragged'` και ο κανόνας 1 του γραφέα
 * θα **αναιρούσε** τη μετακίνηση — race που λύνεται μόνο αν δεν μπορεί να συμβεί.
 *
 * Πέρα από τους μεγάλους: το Salesforce Maps κρατά το Verified Location σε αλλαγή διεύθυνσης
 * **χωρίς να το πει** — εδώ η απόκλιση είναι **μετρημένη** και ο άνθρωπος αποφασίζει.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import { AddressPositionDriftNotice } from '@/components/shared/addresses/AddressPositionDriftNotice';
import { ContactsService } from '@/services/contacts.service';
import {
  dismissContactAddressAdvisory,
  useContactAddressAdvisories,
  useContactAddressPending,
} from '@/services/contacts/contact-address-advisories';
import type { CompanyAddress } from '@/types/ContactFormTypes';

/** Επιστρέφει τον αποδότη του υποσέλιδου κάρτας — `null` όταν δεν υπάρχει τίποτα να ειπωθεί. */
export function useContactDriftFooter(contactId: string | undefined, enabled: boolean) {
  const advisories = useContactAddressAdvisories(contactId);
  const pendingIds = useContactAddressPending(contactId);
  const { t } = useTranslation('addresses');
  const { notify } = useNotifications();
  const [busyId, setBusyId] = useState<string | null>(null);
  const driftById = useMemo(() => new Map(advisories.map((a) => [a.addressId, a])), [advisories]);

  const relocate = useCallback(async (addressId: string) => {
    if (!contactId) return;
    setBusyId(addressId);
    try {
      await ContactsService.relocateAddressPin(contactId, addressId);
    } catch {
      notify(t('editor.positionDrift.relocateFailed'), { type: 'error' });
    } finally {
      setBusyId(null);
    }
  }, [contactId, notify, t]);

  return useCallback((address: CompanyAddress | undefined): React.ReactNode => {
    const addressId = address?.id;
    if (!enabled || !contactId || !addressId) return null;

    const drift = driftById.get(addressId);
    if (drift) {
      return (
        <AddressPositionDriftNotice
          distanceMetres={drift.distanceMetres}
          busy={busyId === addressId}
          onRelocate={() => { void relocate(addressId); }}
          onKeep={() => dismissContactAddressAdvisory(contactId, addressId)}
        />
      );
    }

    /*
      ADR-332 D27 Ζ5 — **«γνωστά εκκρεμές», όχι σιωπή.**
      Η προθεσμία της αποθήκευσης τελείωσε πριν προλάβει να λυθεί αυτή η διεύθυνση. Τίποτα δεν σβήστηκε
      και η επόμενη αποθήκευση ξαναλύνει — αλλά ο άνθρωπος **το μαθαίνει**. Η Salesforce στην ίδια
      κατάσταση αφήνει τη συντεταγμένη κενή ή παλιά **χωρίς να πει τίποτα**.
      Χωρίς ενέργειες: δεν υπάρχει τίποτα να αποφασίσει — μόνο να ξέρει.
    */
    if (pendingIds.includes(addressId)) {
      return (
        <p role="status" className="mt-2 border-t pt-2 text-sm text-muted-foreground">
          {t('editor.positionPending.message')}
        </p>
      );
    }
    return null;
  }, [enabled, driftById, pendingIds, contactId, busyId, relocate, t]);
}
