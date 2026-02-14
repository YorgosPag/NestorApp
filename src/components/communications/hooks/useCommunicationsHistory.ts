'use client';
import { useState, useEffect, useCallback } from 'react';
import { getCommunicationsByContact } from '@/services/communications.service';
import type { Communication } from '@/types/crm';
import { useTranslation } from '@/i18n/hooks/useTranslation';

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

  return { communications, loading, error, fetchCommunications };
}
