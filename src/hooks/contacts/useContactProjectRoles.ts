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
import { where } from 'firebase/firestore';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import { useCompanyId } from '@/hooks/useCompanyId';
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
  const companyId = useCompanyId()?.companyId;

  useEffect(() => {
    if (!contactId || !companyId) {
      setRoles([]);
      return;
    }

    setLoading(true);

    // 🏢 ADR-214 (C.5.33): subscribe via firestoreQueryService SSoT.
    // companyId auto-injected by buildTenantConstraints; only need the
    // landownerContactIds array-contains filter explicit.
    const unsubscribe = firestoreQueryService.subscribe<Record<string, unknown> & { id: string }>(
      'PROJECTS',
      (result) => {
        const projectRoles: ProjectRole[] = [];

        result.documents.forEach((data) => {
          const landowners = (data.landowners ?? []) as LandownerEntry[];
          const entry = landowners.find(l => l.contactId === contactId);

          if (entry) {
            projectRoles.push({
              projectId: data.id,
              projectName: (data.name as string) ?? data.id,
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
      {
        constraints: [where('landownerContactIds', 'array-contains', contactId)],
      },
    );

    return () => unsubscribe();
  }, [contactId, companyId]);

  return { roles, loading };
}
