/**
 * useContactProjectRoles — Query projects where a contact is a landowner or buyer.
 *
 * Derived view (NOT SSoT): The SSoT for landowners is `project.landowners[]`.
 * This hook queries Firestore using the denormalized `landownerContactIds` array.
 *
 * Uses onSnapshot for real-time updates — no page refresh needed.
 *
 * @module hooks/contacts/useContactProjectRoles
 * @enterprise ADR-244 (Multi-Buyer Co-Ownership)
 */

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { LandownerEntry } from '@/types/ownership-table';

// ============================================================================
// TYPES
// ============================================================================

export interface ProjectRole {
  /** Project Firestore document ID */
  projectId: string;
  /** Project display name */
  projectName: string;
  /** Role in this project */
  role: 'landowner';
  /** Ownership percentage (for landowners) */
  ownershipPct: number;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Returns all project roles for a given contact.
 * Real-time via onSnapshot — updates instantly when project data changes.
 */
export function useContactProjectRoles(contactId: string | undefined): {
  roles: ProjectRole[];
  loading: boolean;
} {
  const [roles, setRoles] = useState<ProjectRole[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!contactId) {
      setRoles([]);
      return;
    }

    setLoading(true);

    // Query projects where this contact is a landowner
    const q = query(
      collection(db, COLLECTIONS.PROJECTS),
      where('landownerContactIds', 'array-contains', contactId),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const projectRoles: ProjectRole[] = [];

        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          const landowners = (data.landowners ?? []) as LandownerEntry[];
          const entry = landowners.find(l => l.contactId === contactId);

          if (entry) {
            projectRoles.push({
              projectId: doc.id,
              projectName: (data.name as string) ?? doc.id,
              role: 'landowner',
              ownershipPct: entry.landOwnershipPct,
            });
          }
        });

        setRoles(projectRoles);
        setLoading(false);
      },
      () => {
        // Firestore index may not exist yet — degrade gracefully
        setRoles([]);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [contactId]);

  return { roles, loading };
}
