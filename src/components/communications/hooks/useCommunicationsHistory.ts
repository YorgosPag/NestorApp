'use client';
import { useState, useEffect, useCallback } from 'react';
// ADR-214 Phase 5: Relocated to client service (firestoreQueryService + auto tenant filter)
import { getCommunicationsByContact } from '@/services/communications-client.service';
import type { Communication } from '@/types/crm';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { RealtimeService } from '@/services/realtime';
import type { CommunicationCreatedPayload, CommunicationUpdatedPayload, CommunicationDeletedPayload } from '@/services/realtime';

export function useCommunicationsHistory(contactId?: string) {
  // 🏢 ENTERPRISE: Proper type instead of any[]
  const { t } = useTranslation('communications');
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);

  const fetchCommunications = useCallback(async () => {
    let isMounted = true;
    if (!contactId) {
      setLoading(false);
      setCommunications([]);
      return;
    }
    try {
      setLoading(true);
      const commsData = await getCommunicationsByContact(contactId);
      if (isMounted) {
        setCommunications(commsData);
        setError(null);
      }
    } catch (err) {
      // 🌐 i18n: Error message converted to i18n key - 2026-01-18
      if (isMounted) setError(t('history.loadError', { defaultValue: 'Failed to load communications history' }));
      // Error logging removed
    } finally {
      if (isMounted) setLoading(false);
    }
    return () => { isMounted = false; };
  }, [contactId, t]);

  useEffect(() => { fetchCommunications(); }, [fetchCommunications]);

  // 🏢 ENTERPRISE: Event bus subscribers for cross-tab communication sync (ADR-228 Tier 3)
  useEffect(() => {
    if (!contactId) return;

    const handleCreated = (payload: CommunicationCreatedPayload) => {
      if (payload.communication.contactId === contactId) {
        fetchCommunications();
      }
    };

    const handleUpdated = (payload: CommunicationUpdatedPayload) => {
      setCommunications(prev => prev.map(comm => {
        if (comm.id !== payload.communicationId) return comm;
        // Build type-safe partial update — realtime payload types are narrower than Communication
        const patch: Partial<Communication> = {};
        const u = payload.updates;
        if (u.type !== undefined) patch.type = u.type as Communication['type'];
        if (u.subject !== undefined) patch.subject = u.subject;
        if (u.content !== undefined) patch.content = u.content;
        if (u.contactId != null) patch.contactId = u.contactId;
        return { ...comm, ...patch };
      }));
    };

    const handleDeleted = (payload: CommunicationDeletedPayload) => {
      setCommunications(prev => prev.filter(c => c.id !== payload.communicationId));
    };

    const unsub1 = RealtimeService.subscribe('COMMUNICATION_CREATED', handleCreated);
    const unsub2 = RealtimeService.subscribe('COMMUNICATION_UPDATED', handleUpdated);
    const unsub3 = RealtimeService.subscribe('COMMUNICATION_DELETED', handleDeleted);

    return () => { unsub1(); unsub2(); unsub3(); };
  }, [contactId, fetchCommunications]);

  return { communications, loading, error, fetchCommunications };
}
