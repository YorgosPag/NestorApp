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
} from '@/services/contacts/contact-address-advisories';
import type { CompanyAddress } from '@/types/ContactFormTypes';

/** Επιστρέφει τον αποδότη του υποσέλιδου κάρτας — `null` όταν δεν υπάρχει τίποτα να ειπωθεί. */
export function useContactDriftFooter(contactId: string | undefined, enabled: boolean) {
  const advisories = useContactAddressAdvisories(contactId);
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
    const drift = enabled && addressId ? driftById.get(addressId) : undefined;
    if (!drift || !contactId || !addressId) return null;
    return (
      <AddressPositionDriftNotice
        distanceMetres={drift.distanceMetres}
        busy={busyId === addressId}
        onRelocate={() => { void relocate(addressId); }}
        onKeep={() => dismissContactAddressAdvisory(contactId, addressId)}
      />
    );
  }, [enabled, driftById, contactId, busyId, relocate]);
}
