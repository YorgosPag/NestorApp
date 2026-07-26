'use client';

/**
 * @module useSelectedContactAvatarRefresh
 * @description Σπάει την cache της φωτογραφίας όταν αλλάζουν τα δεδομένα της
 * **ανοιχτής** επαφής.
 *
 * ## Γιατί υπάρχει χωριστά
 * Ζούσε μέσα σε ένα effect του `useContactsPageState` που έκανε **δύο** δουλειές:
 * (α) ξανάγραφε την επιλεγμένη επαφή όταν ανανεωνόταν η λίστα και (β) έστελνε αυτό
 * το event. Με το URL ως πηγή αλήθειας (ADR-332 D21) η επαφή **παράγεται** από τη
 * λίστα, οπότε το (α) έπαψε να υπάρχει — έμεινε μόνο το (β), και η θέση του δεν
 * είναι πια μέσα σε έναν συγχρονιστή που δεν συγχρονίζει τίποτα.
 *
 * ## Συμβόλαιο
 * - Πυροδοτεί **μόνο** όταν η ίδια επαφή μένει ανοιχτή και τα δεδομένα της άλλαξαν.
 *   Αλλαγή επιλογής **δεν** είναι αλλαγή δεδομένων: εκεί το `<ContactDetails>`
 *   ξαναχτίζεται έτσι κι αλλιώς.
 * - Καμία εγγραφή σε state ⇒ κανένας επιπλέον κύκλος render, κανένας βρόχος.
 *
 * @see ADR-332 — D21 (γιατί ο συγχρονισμός της επιλογής καταργήθηκε)
 */

import { useEffect, useRef } from 'react';
import { createModuleLogger } from '@/lib/telemetry';
import type { Contact, IndividualContact } from '@/types/contacts';

const logger = createModuleLogger('useSelectedContactAvatarRefresh');

/** Επαφή με πολλαπλές φωτογραφίες — μόνο τα φυσικά πρόσωπα έχουν το πεδίο. */
function hasMultiplePhotoURLs(
  contact: Contact,
): contact is IndividualContact & { multiplePhotoURLs: string[] } {
  return (
    'multiplePhotoURLs' in contact &&
    Array.isArray((contact as IndividualContact).multiplePhotoURLs)
  );
}

/** Πόσες φωτογραφίες έχει η επαφή (0 όταν το πεδίο δεν υπάρχει). */
function photoCountOf(contact: Contact): number {
  return hasMultiplePhotoURLs(contact) ? contact.multiplePhotoURLs.length : 0;
}

/**
 * Στέλνει `forceAvatarRerender` όταν αλλάξουν τα δεδομένα της ανοιχτής επαφής.
 *
 * @param selectedContact - Η ανοιχτή επαφή, ή `null`.
 */
export function useSelectedContactAvatarRefresh(selectedContact: Contact | null): void {
  /** Τι είχαμε δει τελευταία φορά — id μαζί με αποτύπωμα περιεχομένου. */
  const seenRef = useRef<{ id: string; snapshot: string } | null>(null);

  useEffect(() => {
    const contactId = selectedContact?.id;
    if (!selectedContact || !contactId) {
      seenRef.current = null;
      return;
    }

    const snapshot = JSON.stringify(selectedContact);
    const previous = seenRef.current;
    seenRef.current = { id: contactId, snapshot };

    // Πρώτη θέαση ή αλλαγή επιλογής ⇒ δεν υπάρχει «πριν» για να συγκριθεί.
    if (!previous || previous.id !== contactId || previous.snapshot === snapshot) return;

    const photoCount = photoCountOf(selectedContact);
    logger.info('Selected contact data changed — busting avatar cache', {
      contactId,
      photoCount,
    });
    window.dispatchEvent(
      new CustomEvent('forceAvatarRerender', {
        detail: { contactId, photoCount, timestamp: Date.now() },
      }),
    );
  }, [selectedContact]);
}
