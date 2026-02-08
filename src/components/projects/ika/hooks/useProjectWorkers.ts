'use client';

/**
 * =============================================================================
 * useProjectWorkers — Hook for fetching workers linked to a project
 * =============================================================================
 *
 * Uses existing AssociationService + Contacts system.
 * NO new collections — reads from contact_links + contacts + contact_relationships.
 *
 * @module components/projects/ika/hooks/useProjectWorkers
 * @enterprise ADR-090 — IKA/EFKA Labor Compliance System
 */

import { useState, useEffect, useCallback } from 'react';
import { AssociationService } from '@/services/association.service';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { ProjectWorker } from '../contracts';
import type { IndividualContact } from '@/types/contacts/contracts';
import type { ContactRelationship } from '@/types/contacts/relationships/interfaces/relationship';
// 🎭 ENTERPRISE: Contact Persona System (ADR-121) — enrich workers from persona data
import { isConstructionWorkerPersona } from '@/types/contacts/personas';

interface UseProjectWorkersReturn {
  workers: ProjectWorker[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Fetches workers linked to a project via contact_links.
 * Enriches with contact details and relationship data.
 */
export function useProjectWorkers(projectId: string | undefined): UseProjectWorkersReturn {
  const [workers, setWorkers] = useState<ProjectWorker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadWorkers() {
      if (!projectId) {
        setWorkers([]);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // 1. Get all contact links for this project
        const links = await AssociationService.listContactLinks({
          targetEntityType: 'project',
          targetEntityId: projectId,
          status: 'active',
        });

        if (!mounted) return;

        if (links.length === 0) {
          setWorkers([]);
          setIsLoading(false);
          return;
        }

        // 2. Batch fetch contacts
        const contactIds = links.map((link) => link.sourceContactId);
        const enrichedWorkers: ProjectWorker[] = [];

        for (const link of links) {
          try {
            // Fetch contact document
            const contactRef = doc(db, COLLECTIONS.CONTACTS, link.sourceContactId);
            const contactSnap = await getDoc(contactRef);

            if (!contactSnap.exists()) continue;

            const contactData = contactSnap.data() as IndividualContact;

            // Only include individual contacts (workers)
            if (contactData.type !== 'individual') continue;

            // Fetch relationship (employee/contractor)
            let relationship: ContactRelationship | null = null;
            try {
              const relQuery = query(
                collection(db, COLLECTIONS.CONTACT_RELATIONSHIPS),
                where('sourceContactId', '==', link.sourceContactId),
                where('status', '==', 'active')
              );
              const relSnap = await getDocs(relQuery);
              if (!relSnap.empty) {
                relationship = relSnap.docs[0].data() as ContactRelationship;
              }
            } catch {
              // Relationship fetch is optional — continue without it
            }

            // Build company name from relationship target
            let companyName: string | null = null;
            let companyContactId: string | null = null;
            if (relationship?.targetContactId) {
              try {
                const companyRef = doc(db, COLLECTIONS.CONTACTS, relationship.targetContactId);
                const companySnap = await getDoc(companyRef);
                if (companySnap.exists()) {
                  const companyData = companySnap.data();
                  companyName = (companyData as { name?: string }).name ?? null;
                  companyContactId = relationship.targetContactId;
                }
              } catch {
                // Company fetch is optional
              }
            }

            const firstName = contactData.firstName ?? '';
            const lastName = contactData.lastName ?? '';

            // 🎭 ENTERPRISE: Enrich from construction_worker persona if available (ADR-121)
            const workerPersona = contactData.personas
              ?.find(p => p.status === 'active' && isConstructionWorkerPersona(p));
            const personaInsuranceClassId = workerPersona && isConstructionWorkerPersona(workerPersona)
              ? workerPersona.insuranceClassId
              : null;
            const personaSpecialty = workerPersona && isConstructionWorkerPersona(workerPersona)
              ? workerPersona.specialtyCode
              : null;

            enrichedWorkers.push({
              contactId: link.sourceContactId,
              name: `${firstName} ${lastName}`.trim() || 'Χωρίς Όνομα',
              specialty: personaSpecialty ?? contactData.specialty ?? null,
              company: companyName,
              companyContactId,
              insuranceClassId: personaInsuranceClassId != null ? String(personaInsuranceClassId) : null,
              amka: contactData.amka ?? null,
              afm: contactData.vatNumber ?? null,
              employmentStatus: relationship?.employmentStatus ?? null,
              employmentType: relationship?.employmentType ?? null,
              position: relationship?.position ?? null,
              hireDate: relationship?.startDate ?? null,
              terminationDate: relationship?.endDate ?? null,
              linkId: link.id,
              relationship,
            });
          } catch {
            // Skip individual worker errors — continue with others
            console.warn(`[useProjectWorkers] Failed to enrich worker ${link.sourceContactId}`);
          }
        }

        if (mounted) {
          setWorkers(enrichedWorkers);
        }
      } catch (err) {
        if (mounted) {
          const message = err instanceof Error ? err.message : 'Failed to load workers';
          setError(message);
          console.error('[useProjectWorkers] Error:', message);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadWorkers();
    return () => { mounted = false; };
  }, [projectId, refreshKey]);

  return { workers, isLoading, error, refetch };
}
