import 'server-only';

/**
 * =============================================================================
 * SHARE ACTIVE LOOKUP — «είναι αυτός ο σύνδεσμος ΑΚΟΜΗ ενεργός, και δείχνει ΑΥΤΗ την οντότητα;»
 * =============================================================================
 *
 * Η δεύτερη κρίση κάθε αιτήματος **συνέχειας** μετά το άνοιγμα ενός συνδέσμου (ADR-884 Κ3β · ADR-ACC-018 §16).
 * Το αίτημα φέρει το κουπόνι επίσκεψης (`share-access-grant.ts`: ο browser **άνοιξε** τον σύνδεσμο μέσα στα
 * τελευταία 15′). Εδώ ελέγχεται, με ανάγνωση **με id**, ότι ο σύνδεσμος δεν ανακλήθηκε ή έληξε στο μεταξύ και ότι
 * δείχνει **την ίδια** οντότητα του **ίδιου** είδους. Ανάκληση ⇒ καμία νέα απάντηση, ακόμη και μέσα στο κουπόνι.
 *
 * Ως τις 2026-11-11 ζούσε ως `activeTourShareId` μέσα στη συνεδρία θέασης περιήγησης. Το τιμολόγιο χρειάστηκε
 * την ίδια ερώτηση, οπότε έγινε μία.
 *
 * @module server/sharing/share-active-lookup
 */

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { ResolvableShareKind } from '@/services/sharing/share-resolve-contract';

import { normalizeUnifiedShare, type StoredShare } from './share-token-lookup';

export interface ActiveShareQuery {
  readonly shareId: string;
  readonly kind: ResolvableShareKind;
  /** `null` ⇒ οποιαδήποτε οντότητα (ο καλών κρίνει μετά). Ποτέ για εμβέλεια, μόνο όταν ο στόχος δεν είναι γνωστός. */
  readonly entityId: string | null;
  readonly nowMs: number;
}

/** Ο σύνδεσμος, αν είναι ενεργός, δεν έληξε και δείχνει το ζητούμενο είδος/οντότητα. Αλλιώς `null`. */
export async function findActiveShareOf(db: Firestore, query: ActiveShareQuery): Promise<StoredShare | null> {
  const snap = await db.collection(COLLECTIONS.SHARES).doc(query.shareId).get();
  const raw = (snap.data() ?? null) as Record<string, unknown> | null;
  if (raw === null || raw.isActive !== true) return null;
  const share = normalizeUnifiedShare(snap.id, raw);
  if (share === null || share.entityType !== query.kind) return null;
  if (query.entityId !== null && share.entityId !== query.entityId) return null;
  return Date.parse(share.expiresAt) > query.nowMs ? share : null;
}
