'use client';

/**
 * Resolves Firebase UIDs to display names via the `users` Firestore collection.
 * Batches lookups and caches results for the component lifetime.
 *
 * @module hooks/useUserDisplayNames
 */

import { useEffect, useState, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';

type NameMap = Map<string, string>;

const sessionCache = new Map<string, string>();

async function resolveUid(uid: string): Promise<string> {
  if (sessionCache.has(uid)) return sessionCache.get(uid)!;
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.USERS, uid));
    const data = snap.data();
    const name: string =
      data?.displayName ||
      (data?.givenName && data?.familyName ? `${data.givenName} ${data.familyName}` : '') ||
      data?.email ||
      uid;
    sessionCache.set(uid, name);
    return name;
  } catch {
    return uid;
  }
}

export function useUserDisplayNames(uids: string[]): NameMap {
  const [names, setNames] = useState<NameMap>(new Map());
  const resolvedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const pending = uids.filter(uid => uid && !resolvedRef.current.has(uid));
    if (pending.length === 0) return;

    pending.forEach(uid => resolvedRef.current.add(uid));

    Promise.all(pending.map(async uid => ({ uid, name: await resolveUid(uid) }))).then(results => {
      setNames(prev => {
        const next = new Map(prev);
        results.forEach(({ uid, name }) => next.set(uid, name));
        return next;
      });
    });
  }, [uids]);

  return names;
}
