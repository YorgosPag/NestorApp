'use client';

/**
 * Resolves Firebase UIDs to display names via the `users` Firestore collection.
 * Module-level session cache avoids repeated reads across components.
 *
 * @module hooks/useUserDisplayNames
 */

import { useEffect, useState, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';

type NameMap = Map<string, string>;

const sessionCache = new Map<string, string>();

/** Pre-seed the cache with a known UID→name pair (e.g. current user). */
export function seedUserNameCache(uid: string, name: string): void {
  if (uid && name) sessionCache.set(uid, name);
}

async function resolveUid(uid: string): Promise<string> {
  if (sessionCache.has(uid)) return sessionCache.get(uid)!;
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.USERS, uid));
    const data = snap.data();
    const name: string =
      data?.displayName ||
      (data?.givenName && data?.familyName ? `${data.givenName} ${data.familyName}` : '') ||
      data?.email ||
      '';
    if (name) sessionCache.set(uid, name);
    return name;
  } catch {
    return '';
  }
}

export function useUserDisplayNames(uids: string[]): NameMap {
  const [names, setNames] = useState<NameMap>(() => {
    // Populate immediately from session cache (e.g. current user pre-seeded)
    const initial = new Map<string, string>();
    uids.forEach(uid => {
      if (uid && sessionCache.has(uid)) initial.set(uid, sessionCache.get(uid)!);
    });
    return initial;
  });
  const resolvedRef = useRef<Set<string>>(new Set(names.keys()));

  useEffect(() => {
    const pending = uids.filter(uid => uid && !resolvedRef.current.has(uid));
    if (pending.length === 0) return;

    pending.forEach(uid => resolvedRef.current.add(uid));

    Promise.all(pending.map(async uid => ({ uid, name: await resolveUid(uid) }))).then(results => {
      const withName = results.filter(r => r.name);
      if (withName.length === 0) return;
      setNames(prev => {
        const next = new Map(prev);
        withName.forEach(({ uid, name }) => next.set(uid, name));
        return next;
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uids.join(',')]);

  return names;
}
