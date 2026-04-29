'use client';

import { useCallback, useEffect, useState } from 'react';
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

export interface CreateInviteInput {
  vendorContactId: string;
  deliveryChannel: 'email' | 'copy_link';
  expiresInDays?: number;
  locale?: 'el' | 'en';
}

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

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/rfqs/${rfqId}/invites`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      setInvites((json.data ?? []) as VendorInvite[]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load invites');
    } finally {
      setLoading(false);
    }
  }, [rfqId]);

  const fetchContacts = useCallback(async () => {
    try {
      setContactsLoading(true);
      const res = await fetch(`/api/rfqs/${rfqId}/vendor-contacts`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      setVendorContacts((json.data ?? []) as VendorContactOption[]);
    } catch {
      // non-blocking — picker will show empty
    } finally {
      setContactsLoading(false);
    }
  }, [rfqId]);

  useEffect(() => {
    void refetch();
    void fetchContacts();
  }, [refetch, fetchContacts]);

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
      await refetch();
      return { inviteId: data.invite.id, portalUrl: data.portalUrl, delivery: data.delivery };
    },
    [rfqId, refetch],
  );

  const revokeInvite = useCallback(
    async (inviteId: string): Promise<void> => {
      const res = await fetch(`/api/rfqs/${rfqId}/invites/${inviteId}/revoke`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      await refetch();
    },
    [rfqId, refetch],
  );

  return { invites, vendorContacts, loading, contactsLoading, error, refetch, createInvite, revokeInvite };
}
