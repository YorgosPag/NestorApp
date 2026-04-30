'use client';

import { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Detects Firestore server connectivity by monitoring snapshot metadata.
// Uses `config/app` (world-readable for authenticated users per Firestore rules).
// Starts optimistic (true) to avoid false offline on initial cached snapshot.
export function useFirestoreStatus(): boolean {
  const [connected, setConnected] = useState(true);
  const hasServerSnapshot = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sentinelRef = doc(db, 'config', 'app');
    const unsub = onSnapshot(
      sentinelRef,
      { includeMetadataChanges: true },
      (snap) => {
        if (!snap.metadata.fromCache) {
          hasServerSnapshot.current = true;
          setConnected(true);
        } else if (hasServerSnapshot.current) {
          setConnected(false);
        }
      },
      () => {
        setConnected(false);
      },
    );
    return unsub;
  }, []);

  return connected;
}
