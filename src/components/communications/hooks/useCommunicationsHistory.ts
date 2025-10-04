'use client';
import { useState, useEffect, useCallback } from 'react';
import { getCommunicationsByContact } from '@/services/communications.service';

export function useCommunicationsHistory(contactId?: string) {
  const [communications, setCommunications] = useState<any[]>([]);
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
      if (isMounted) setError('Σφάλμα κατά τη φόρτωση επικοινωνιών');
      console.error('Error fetching communications:', err);
    } finally {
      if (isMounted) setLoading(false);
    }
    return () => { isMounted = false; };
  }, [contactId]);

  useEffect(() => { fetchCommunications(); }, [fetchCommunications]);

  return { communications, loading, error, fetchCommunications };
}
