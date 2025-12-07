// ============================================================================
// USE CONTACT NAMES HOOK (BULK)
// ============================================================================
//
// 🪝 Custom hook for fetching multiple contact names efficiently
// Used by RelationshipsSummary for bulk operations
//
// ============================================================================

import { useState, useEffect } from 'react';
import { ContactsService } from '@/services/contacts.service';
import type { ContactRelationship } from '@/types/contacts/relationships';

/**
 * 🪝 useContactNames Hook
 *
 * Fetches and manages multiple contact names from relationships
 *
 * @param relationships - Array of relationships to extract contact IDs from
 * @param currentContactId - The ID of the current contact (to determine target vs source)
 * @returns Object with contactNames record and loading state
 */
export const useContactNames = (relationships: ContactRelationship[], currentContactId: string) => {
  const [contactNames, setContactNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchContactNames = async () => {
      if (relationships.length === 0) {
        setContactNames({});
        return;
      }

      try {
        setLoading(true);
        console.log('🔍 CONTACT NAMES HOOK: Fetching contact names for relationships:', relationships.length);
        console.log('🔍 CONTACT NAMES HOOK: Current contactId:', currentContactId);

        const names: Record<string, string> = {};

        // Fetch contact names για κάθε relationship
        for (const relationship of relationships) {
          // Για κάθε relationship, φέρνω το target contact (την άλλη επαφή)
          const targetContactId = relationship.targetContactId === currentContactId
            ? relationship.sourceContactId  // Αν είμαι target, φέρνω το source
            : relationship.targetContactId; // Αν είμαι source, φέρνω το target

          console.log('🔍 CONTACT NAMES HOOK: Processing relationship:', {
            id: relationship.id,
            sourceId: relationship.sourceContactId,
            targetId: relationship.targetContactId,
            type: relationship.relationshipType,
            resolvedTargetId: targetContactId
          });

          if (!names[targetContactId]) {
            try {
              console.log('🔍 CONTACT NAMES HOOK: Fetching contact for ID:', targetContactId);
              const contact = await ContactsService.getContact(targetContactId);

              if (contact) {
                console.log('🔍 CONTACT NAMES HOOK: Contact object structure:', contact);

                // Try different name fields με προτεραιότητα στο πλήρες όνομα (improved from RelationshipsSummary)
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

                names[targetContactId] = contactName;
                console.log('✅ CONTACT NAMES HOOK: Contact found:', { targetContactId, name: contactName });
              } else {
                names[targetContactId] = 'Όνομα μη διαθέσιμο';
                console.warn('⚠️ CONTACT NAMES HOOK: Contact not found:', targetContactId);
              }
            } catch (error) {
              names[targetContactId] = 'Σφάλμα φόρτωσης ονόματος';
              console.error('❌ CONTACT NAMES HOOK: Error fetching contact:', targetContactId, error);
            }
          }
        }

        setContactNames(names);
        console.log('✅ CONTACT NAMES HOOK: All contact names fetched:', Object.keys(names).length);
      } catch (error) {
        console.error('❌ CONTACT NAMES HOOK: Error in bulk fetch:', error);
        setContactNames({});
      } finally {
        setLoading(false);
      }
    };

    fetchContactNames();
  }, [relationships, currentContactId]);

  return { contactNames, loading };
};