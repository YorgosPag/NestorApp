/**
 * Bim3DPreferencesService — per-user 3D viewport UI preferences.
 * ADR-366 Phase 4.3. Collection: bim_3d_preferences. IDs via b3dpref_* (N.6).
 */

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateBim3DPrefId } from '@/services/enterprise-id.service';

export interface EntityCardTabPrefs {
  readonly lastActive: string;
}

export interface Bim3DPrefs {
  readonly userId: string;
  readonly compassRingVisible: boolean;
  readonly entityCardTabs?: Readonly<Record<string, EntityCardTabPrefs>>;
  readonly updatedAt: unknown;
}

const DEFAULTS: Omit<Bim3DPrefs, 'userId' | 'updatedAt'> = {
  compassRingVisible: true,
};

export const Bim3DPreferencesService = {
  async load(userId: string): Promise<Bim3DPrefs | null> {
    const ref = doc(db, COLLECTIONS.BIM_3D_PREFERENCES, generateBim3DPrefId(userId));
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data() as Bim3DPrefs;
  },

  async save(userId: string, partial: Partial<Omit<Bim3DPrefs, 'userId' | 'updatedAt'>>): Promise<void> {
    const ref = doc(db, COLLECTIONS.BIM_3D_PREFERENCES, generateBim3DPrefId(userId));
    await setDoc(ref, {
      userId,
      ...DEFAULTS,
      ...partial,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  },
} as const;
