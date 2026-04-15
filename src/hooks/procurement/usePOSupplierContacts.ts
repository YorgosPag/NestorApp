'use client';

/**
 * usePOSupplierContacts — Lightweight supplier contacts hook for PO form
 *
 * Subscribes to contacts with personaTypes array-contains 'supplier'.
 * Filters active contacts only. Uses ADR-300 stale-while-revalidate cache.
 *
 * @module hooks/procurement/usePOSupplierContacts
 * @see ADR-267 §Phase D — Entity Selectors
 * @see ADR-300 — Stale-while-revalidate
 * @see ADR-214 — Contact Query Service
 */

import { useState, useEffect } from 'react';
import { where } from 'firebase/firestore';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import type { Contact } from '@/types/contacts';
import { createModuleLogger } from '@/lib/telemetry';
import { createStaleCache } from '@/lib/stale-cache';
import { useAuth } from '@/hooks/useAuth';

const logger = createModuleLogger('usePOSupplierContacts');

// ADR-300: Module-level cache survives React unmount/remount (navigation)
const suppliersCache = createStaleCache<Contact[]>('po-supplier-contacts');

interface UsePOSupplierContactsReturn {
  suppliers: Contact[];
  loading: boolean;
  error: string | null;
}

export function usePOSupplierContacts(): UsePOSupplierContactsReturn {
  const { user, loading: authLoading } = useAuth();

  // ADR-300: Seed from cache → zero flash on re-navigation
  const [suppliers, setSuppliers] = useState<Contact[]>(
    suppliersCache.get() ?? []
  );
  const [loading, setLoading] = useState(!suppliersCache.hasLoaded());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Auth-ready gating (same pattern as useFirestoreBuildings)
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      setError('AUTH_REQUIRED');
      return;
    }

    setLoading(!suppliersCache.hasLoaded());

    const unsubscribe = firestoreQueryService.subscribe<Record<string, unknown>>(
      'CONTACTS',
      (result) => {
        const contacts = result.documents
          .map((d) => d as unknown as Contact)
          .filter(
            (c) =>
              Array.isArray(c.personaTypes) &&
              c.personaTypes.includes('supplier') &&
              c.status === 'active'
          );

        suppliersCache.set(contacts);
        setSuppliers(contacts);
        setLoading(false);
        setError(null);

        logger.info('Supplier contacts loaded', { count: contacts.length });
      },
      (err) => {
        logger.error('Supplier contacts subscription error', { error: err.message });
        setError('SUBSCRIPTION_ERROR');
        setLoading(false);
      },
      {
        constraints: [
          where('personaTypes', 'array-contains', 'supplier'),
        ],
      }
    );

    return unsubscribe;
  }, [authLoading, user]);

  return { suppliers, loading, error };
}
