'use client';

import { useState, useEffect, useRef } from 'react';
import { query, where, collection, onSnapshot, type QueryConstraint } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { RealtimeUnit } from '../types';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('usePublicProperties');

export function usePublicProperties() {
  const [properties, setProperties] = useState<RealtimeUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    try {
      const constraints: QueryConstraint[] = [where('commercialStatus', 'in', ['for-sale', 'for-rent', 'for-sale-and-rent'])];
      const q = query(collection(db, 'properties'), ...constraints);

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const docs = snapshot.docs.map(doc => ({
            id: doc.id,
            name: (doc.data().name as string) || '',
            buildingId: (doc.data().buildingId as string) || null,
            type: doc.data().type as string | undefined,
            status: doc.data().status as string | undefined,
            area: doc.data().area as number | undefined,
            floor: doc.data().floor as number | undefined,
            createdAt: doc.data().createdAt as string | undefined,
            updatedAt: doc.data().updatedAt as string | undefined,
          } as RealtimeUnit));

          setProperties(docs);
          setLoading(false);
          logger.info('Public properties loaded', { count: docs.length });
        },
        (err: Error) => {
          logger.error('Public properties error', { error: err.message });
          setError(err.message);
          setLoading(false);
        }
      );

      unsubRef.current = unsubscribe;
      return () => unsubscribe();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Setup error', { error: msg });
      setError(msg);
      setLoading(false);
    }
  }, []);

  return { properties, loading, error };
}
