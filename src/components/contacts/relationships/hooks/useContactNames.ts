// ============================================================================
// USE CONTACT NAMES HOOK (BULK)
// ============================================================================
//
// 🪝 Custom hook for fetching multiple contact names efficiently
// Used by RelationshipsSummary for bulk operations
//
// ============================================================================

import { useState, useEffect } from 'react';
import { createModuleLogger } from '@/lib/telemetry';
import { ContactsService } from '@/services/contacts.service';
import type { ContactRelationship } from '@/types/contacts/relationships';

const logger = createModuleLogger('useContactNames');

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
  const [orphanContactIds, setOrphanContactIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchContactNames = async () => {
      if (relationships.length === 0) {
        setContactNames({});
        setOrphanContactIds([]);
        return;
      }

      try {
        setLoading(true);
        logger.info('Fetching contact names for relationships', { count: relationships.length });
        logger.info('Current contactId', { currentContactId });

        const names: Record<string, string> = {};
        const orphans: string[] = [];

        // Fetch contact names για κάθε relationship
        for (const relationship of relationships) {
          // Για κάθε relationship, φέρνω το target contact (την άλλη επαφή)
          const targetContactId = relationship.targetContactId === currentContactId
            ? relationship.sourceContactId  // Αν είμαι target, φέρνω το source
            : relationship.targetContactId; // Αν είμαι source, φέρνω το target

          logger.info('Processing relationship', {
            id: relationship.id,
            sourceId: relationship.sourceContactId,
            targetId: relationship.targetContactId,
            type: relationship.relationshipType,
            resolvedTargetId: targetContactId
          });

          if (!names[targetContactId]) {
            try {
              logger.info('Fetching contact', { targetContactId });
              const contact = await ContactsService.getContact(targetContactId);

              if (contact) {
                logger.info('Contact object loaded', { contactId: targetContactId });

                // Try different name fields με προτεραιότητα στο πλήρες όνομα (improved from RelationshipsSummary)
                let contactName = 'Άγνωστη Επαφή';

                if (contact.name) {
                  contactName = contact.name;
                } else if (contact.firstName && contact.lastName) {
                  contactName = `${contact.firstName} ${contact.lastName}`;
                } else if (contact.companyName) {
                  contactName = contact.companyName;
                } else if (contact.serviceName) {
                  contactName = contact.serviceName;
                } else if (contact.firstName) {
                  contactName = contact.firstName;
                }

                names[targetContactId] = contactName;
                logger.info('Contact found', { targetContactId, name: contactName });
              } else {
                // Contact not found in Firestore — stale relationship (cascade delete orphan)
                orphans.push(targetContactId);
                logger.warn('Orphan contact detected — related contact no longer exists', { targetContactId, relationshipId: relationship.id });
              }
            } catch (error) {
              names[targetContactId] = 'Σφάλμα φόρτωσης ονόματος';
              logger.error('Error fetching contact', { targetContactId, error });
            }
          }
        }

        setContactNames(names);
        setOrphanContactIds(orphans);
        logger.info('All contact names fetched', { count: Object.keys(names).length, orphans: orphans.length });
      } catch (error) {
        logger.error('Error in bulk fetch', { error });
        setContactNames({});
        setOrphanContactIds([]);
      } finally {
        setLoading(false);
      }
    };

    fetchContactNames();
  }, [relationships, currentContactId]);

  return { contactNames, orphanContactIds, loading };
};