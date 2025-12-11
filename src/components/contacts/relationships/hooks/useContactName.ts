// ============================================================================
// USE CONTACT NAME HOOK
// ============================================================================
//
// 🪝 Custom hook for fetching and managing contact names
// Centralized logic to avoid duplication between RelationshipCard and RelationshipsSummary
//
// ============================================================================

import { useState, useEffect } from 'react';
import { ContactsService } from '@/services/contacts.service';

/**
 * 🪝 useContactName Hook
 *
 * Fetches and manages a contact's display name by contact ID
 *
 * @param contactId - The ID of the contact to fetch
 * @returns Object with contactName and loading state
 */
export const useContactName = (contactId: string | undefined) => {
  const [contactName, setContactName] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchContactName = async () => {
      if (!contactId) {
        setContactName('');
        return;
      }

      try {
        setLoading(true);
        console.log(`🔍 CONTACT NAME HOOK: Fetching contact name for ID:`, contactId);

        const contact = await ContactsService.getContact(contactId);

        if (contact) {
          // Try different name fields με προτεραιότητα στο πλήρες όνομα
          let contactName = 'Άγνωστη Επαφή';

          if (contact.name) {
            // Primary name field (πλήρες όνομα)
            contactName = contact.name;
          } else if (contact.firstName && contact.lastName) {
            // Συνδυασμός ονόματος και επωνύμου
            contactName = `${contact.firstName} ${contact.lastName}`;
          } else if (contact.companyName) {
            // Company name
            contactName = contact.companyName;
          } else if (contact.serviceName) {
            // Service name
            contactName = contact.serviceName;
          } else if (contact.firstName) {
            // Μόνο το όνομα αν δεν υπάρχει επώνυμο
            contactName = contact.firstName;
          }

          setContactName(contactName);
        } else {
          console.warn(`⚠️ CONTACT NAME HOOK: Contact not found for ID:`, contactId);
          setContactName('Όνομα μη διαθέσιμο');
        }
      } catch (error) {
        console.error(`❌ CONTACT NAME HOOK: Error fetching contact name:`, error);
        setContactName('Σφάλμα φόρτωσης ονόματος');
      } finally {
        setLoading(false);
      }
    };

    fetchContactName();
  }, [contactId]);

  return { contactName, loading };
};