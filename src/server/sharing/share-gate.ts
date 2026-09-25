import 'server-only';

/**
 * =============================================================================
 * SHARE GATE — η ΜΙΑ κρίση «περνά αυτός ο επισκέπτης;» (ADR-884 Φ0.12)
 * =============================================================================
 *
 * Διακριτικό → ενεργό → λήξη → όριο → κωδικός/κουπόνι, **με αυτή τη σειρά** και **μία**
 * φορά. Την καλούν η επίλυση (`share-resolve.ts`), η λήψη αρχείου (`share-download.ts`)
 * **και** οι δημόσιες διαδρομές showcase (payload/PDF) — τρεις πόρτες, ένας φύλακας.
 *
 * 🔑 **Η σειρά είναι ασφάλεια, όχι στυλ**:
 *   - λήξη/όριο **πριν** τον κωδικό ⇒ σύνδεσμος που έληξε δεν γίνεται μαντείο κωδικών·
 *   - κλείδωμα **πριν** το scrypt ⇒ ο κλειδωμένος σύνδεσμος δεν καίει CPU.
 *
 * ⚠️ Το όριο εδώ είναι **προέλεγχος** (για σωστό μήνυμα)· η **δεσμευτική** κρίση είναι η
 * συναλλαγή του `recordShareAccess`, πάνω σε φρέσκο ανάγνωσμα.
 *
 * @module server/sharing/share-gate
 */

import type { Firestore } from 'firebase-admin/firestore';

import type { ShareResolveRefusal } from '@/services/sharing/share-resolve-contract';
import { issueShareAccessGrant } from './share-access-grant';
import { attemptSharePassword } from './share-password-attempt';
import { findActiveShareByToken, type StoredShare } from './share-token-lookup';

export interface ShareGateInput {
  readonly adminDb: Firestore;
  readonly token: string;
  /** Κωδικός που έστειλε ο επισκέπτης — μόνο η επίλυση τον δέχεται. */
  readonly password?: string;
  /** Έχει ήδη το αίτημα έγκυρο κουπόνι για αυτή την κοινοποίηση; */
  readonly hasGrant: (shareId: string) => boolean;
}

export type ShareGateVerdict =
  | { readonly pass: true; readonly share: StoredShare; readonly newGrant: string | null }
  | { readonly pass: false; readonly reason: ShareResolveRefusal | 'password-required' };

/**
 * Λήξη + όριο πάνω στο ανάγνωσμα της αναζήτησης — καθαρό.
 *
 * ⚠️ **Μέσα σε επίσκεψη (`inVisit`) το όριο ΔΕΝ ξανακρίνεται**: η πρόσβαση αυτής της
 * επίσκεψης **έχει ήδη μετρηθεί** — ένας σύνδεσμος «1 πρόσβαση» που μόλις άνοιξε έχει
 * `accessCount == maxAccesses`, και χωρίς αυτή την εξαίρεση θα αρνιόταν τη λήψη στον ίδιο
 * άνθρωπο ένα δευτερόλεπτο μετά. Η **λήξη** κρίνεται πάντα.
 */
export function preliminaryRefusal(share: StoredShare, nowMs: number, inVisit: boolean): ShareResolveRefusal | null {
  const expiresAt = Date.parse(share.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt < nowMs) return 'expired';
  if (!inVisit && share.maxAccesses > 0 && share.accessCount >= share.maxAccesses) return 'exhausted';
  return null;
}

async function passwordVerdict(input: ShareGateInput, share: StoredShare): Promise<ShareGateVerdict> {
  if (input.hasGrant(share.id)) return { pass: true, share, newGrant: null };
  if (input.password === undefined) return { pass: false, reason: 'password-required' };

  const attempt = await attemptSharePassword(input.adminDb, share, input.password);
  if (attempt !== 'ok') return { pass: false, reason: attempt };

  const grant = issueShareAccessGrant(share.id);
  if (grant === null) return { pass: false, reason: 'unavailable' };
  return { pass: true, share, newGrant: grant };
}

/** Η πύλη. Δεν γράφει τίποτα πλην του μετρητή κωδικού — η πρόσβαση καταγράφεται αλλού. */
export async function passShareGate(input: ShareGateInput): Promise<ShareGateVerdict> {
  const share = await findActiveShareByToken(input.adminDb, input.token);
  if (share === null) return { pass: false, reason: 'not-found' };

  const refusal = preliminaryRefusal(share, Date.now(), input.hasGrant(share.id));
  if (refusal !== null) return { pass: false, reason: refusal };

  if (!share.requiresPassword) return { pass: true, share, newGrant: null };
  return passwordVerdict(input, share);
}
