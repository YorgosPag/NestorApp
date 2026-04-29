'use client';

import { useCallback, useEffect, useState } from 'react';
import { where } from 'firebase/firestore';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import type { VendorInvite } from '../types/vendor-invite';

export interface VendorContactOption {
  id: string;
  displayName: string;
  email: string | null;
}

interface UseVendorInvitesResult {
  invites: VendorInvite[];
  vendorContacts: VendorContactOption[];
  loading: boolean;
  contactsLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createInvite: (dto: CreateInviteInput) => Promise<CreateInviteOutput>;
  revokeInvite: (inviteId: string) => Promise<void>;
}

interface CreateInviteBaseInput {
  deliveryChannel: 'email' | 'copy_link';
  expiresInDays?: number;
  locale?: 'el' | 'en';
}

export type CreateInviteInput =
  | (CreateInviteBaseInput & { vendorContactId: string; manualEmail?: undefined; manualName?: undefined })
  | (CreateInviteBaseInput & { vendorContactId?: undefined; manualEmail: string; manualName: string });

export interface CreateInviteOutput {
  inviteId: string;
  portalUrl: string;
  delivery: { success: boolean; errorReason: string | null };
}

export function useVendorInvites(rfqId: string): UseVendorInvitesResult {
  const [invites, setInvites] = useState<VendorInvite[]>([]);
  const [vendorContacts, setVendorContacts] = useState<VendorContactOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!rfqId) {
      setInvites([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = firestoreQueryService.subscribe<VendorInvite>(
      'VENDOR_INVITES',
      (result) => {
        setInvites(result.documents as VendorInvite[]);
        setLoading(false);
      },
      (err) => {
        setError(err.message ?? 'Failed to subscribe to vendor invites');
        setLoading(false);
      },
      { constraints: [where('rfqId', '==', rfqId)] },
    );

    return () => unsubscribe();
  }, [rfqId]);

  const fetchContacts = useCallback(async () => {
    try {
      setContactsLoading(true);
      const res = await fetch(`/api/rfqs/${rfqId}/vendor-contacts`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      setVendorContacts((json.data ?? []) as VendorContactOption[]);
    } catch {
      // non-blocking — picker shows empty
    } finally {
      setContactsLoading(false);
    }
  }, [rfqId]);

  useEffect(() => {
    void fetchContacts();
  }, [fetchContacts]);

  const refetch = useCallback(async () => {
    /* onSnapshot is live — no manual refetch (kept for API compat) */
  }, []);

  const createInvite = useCallback(
    async (dto: CreateInviteInput): Promise<CreateInviteOutput> => {
      const res = await fetch(`/api/rfqs/${rfqId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      const data = json.data as {
        invite: { id: string };
        portalUrl: string;
        delivery: CreateInviteOutput['delivery'];
      };
      return { inviteId: data.invite.id, portalUrl: data.portalUrl, delivery: data.delivery };
    },
    [rfqId],
  );

  const revokeInvite = useCallback(
    async (inviteId: string): Promise<void> => {
      const res = await fetch(`/api/rfqs/${rfqId}/invites/${inviteId}/revoke`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
    },
    [rfqId],
  );

  return { invites, vendorContacts, loading, contactsLoading, error, refetch, createInvite, revokeInvite };
}
