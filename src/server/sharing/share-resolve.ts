import 'server-only';

/**
 * =============================================================================
 * SHARE RESOLVE — «τι βλέπει όποιος ανοίγει αυτόν τον σύνδεσμο;» (ADR-884 Φ0.12)
 * =============================================================================
 *
 * Διαδέχεται το σκέλος επικύρωσης του `useSharedFilePageState` (browser), που έκανε
 * **τα πάντα** στον πελάτη: αναζήτηση διακριτικού σε ανοιχτή συλλογή, σύγκριση κωδικού,
 * έλεγχο ορίου, αύξηση μετρητή — και ανάγνωση οντοτήτων που οι κανόνες τού αρνούνταν.
 *
 * Ροή: πύλη (`share-gate.ts`) → καταγραφή πρόσβασης (`share-access.ts`) → ανάγνωση
 * οντότητας (Admin SDK) → **καθαρή** προβολή του resolver. Ο επισκέπτης λαμβάνει **μόνο**
 * την προβολή — ποτέ `companyId`, `createdBy`, hash ή μετρητές.
 *
 * 🔑 **Πότε μετρά μια πρόσβαση** (πρότυπο Google Drive): **ένα άνοιγμα = μία πρόσβαση**,
 * για κάθε είδος. Το άνοιγμα εκδίδει **κουπόνι επίσκεψης** 15′ (`share-access-grant.ts`)·
 * μέσα σε αυτό, επαναφόρτωση, προεπισκόπηση, PDF και λήψη **δεν** ξαναμετρούν. Έτσι ένας
 * σύνδεσμος «1 πρόσβαση» δεν εξαντλείται επειδή ο παραλήπτης πάτησε και «Λήψη».
 * Για αρχεία επιστρέφεται και **υπογεγραμμένο URL προεπισκόπησης** — ποτέ το μόνιμο.
 *
 * @module server/sharing/share-resolve
 */

import type { Firestore } from 'firebase-admin/firestore';

import { ShareEntityRegistry } from '@/services/sharing/share-entity-registry';
import '@/services/sharing/resolvers';
import {
  isResolvableShareKind,
  type ResolvedSharePayload,
  type ShareResolveOutcome,
} from '@/services/sharing/share-resolve-contract';
import { recordShareAccess, type ShareAccessOutcome } from './share-access';
import { issueShareAccessGrant } from './share-access-grant';
import { signSharedFileUrl } from './share-download';
import { readSharedEntity } from './share-entity-access';
import { passShareGate, type ShareGateInput } from './share-gate';
import type { StoredShare } from './share-token-lookup';

export interface ShareResolveResult {
  readonly outcome: ShareResolveOutcome;
  /** Νέο κουπόνι πρόσβασης προς εγγραφή σε cookie (μόνο μετά από σωστό κωδικό). */
  readonly grant: { readonly shareId: string; readonly value: string } | null;
}

/** Αποτέλεσμα καταγραφής → άρνηση προς τον επισκέπτη. */
function refusalOfAccess(outcome: Exclude<ShareAccessOutcome, 'recorded'>): ShareResolveOutcome {
  return { status: 'refused', reason: outcome === 'gone' ? 'not-found' : outcome };
}

/**
 * Διαβάζει την οντότητα και εφαρμόζει την προβολή του resolver του είδους της.
 *
 * Η μετατροπή τύπου είναι **μία** και εδώ: το μητρώο κρατά `ShareEntityDefinition<unknown>`,
 * και το TypeScript δεν συσχετίζει `kind` με `data` μέσα από δυναμική αναζήτηση. Το ζεύγος
 * είναι σωστό κατασκευαστικά — ο resolver **του** `kind` παράγει τα δεδομένα **του** `kind`
 * (το ελέγχει η σουίτα `share-resolve.test.ts`).
 */
async function projectShare(
  adminDb: Firestore,
  share: StoredShare,
  token: string,
): Promise<ResolvedSharePayload | null> {
  const definition = ShareEntityRegistry.get(share.entityType);
  if (definition === null || !isResolvableShareKind(share.entityType)) return null;
  const entity = await readSharedEntity(adminDb, definition, share.id, share.entityId);
  const data = definition.project({ share, entity, token });
  return { kind: share.entityType, data } as ResolvedSharePayload;
}

/** Αρχείο ⇒ το URL προεπισκόπησης υπογράφεται **μετά** την κρίση και την καταγραφή. */
async function withPreviewUrl(adminDb: Firestore, payload: ResolvedSharePayload): Promise<ResolvedSharePayload> {
  if (payload.kind !== 'file') return payload;
  const previewUrl = await signSharedFileUrl(adminDb, payload.data.fileId, 'inline');
  return { kind: 'file', data: { ...payload.data, previewUrl } };
}

/** Το κουπόνι που γράφεται: του κωδικού, αλλιώς νέο κουπόνι επίσκεψης (αν δεν υπάρχει ήδη). */
function grantToWrite(shareId: string, fromPassword: string | null, inVisit: boolean): ShareResolveResult['grant'] {
  const value = fromPassword ?? (inVisit ? null : issueShareAccessGrant(shareId));
  return value === null ? null : { shareId, value };
}

/** Επίλυση συνδέσμου για τη σελίδα `/shared/[token]`. */
export async function resolvePublicShare(input: ShareGateInput): Promise<ShareResolveResult> {
  const verdict = await passShareGate(input);
  if (!verdict.pass) {
    const outcome: ShareResolveOutcome =
      verdict.reason === 'password-required'
        ? { status: 'password-required' }
        : { status: 'refused', reason: verdict.reason };
    return { outcome, grant: null };
  }

  const { share, newGrant } = verdict;
  const inVisit = input.hasGrant(share.id);
  if (!inVisit) {
    const access = await recordShareAccess(input.adminDb, share);
    if (access !== 'recorded') return { outcome: refusalOfAccess(access), grant: null };
  }

  const grant = grantToWrite(share.id, newGrant, inVisit);
  const payload = await projectShare(input.adminDb, share, input.token);
  if (payload === null) return { outcome: { status: 'refused', reason: 'not-found' }, grant };
  const served = await withPreviewUrl(input.adminDb, payload);
  return { outcome: { status: 'resolved', share: served, expiresAt: share.expiresAt }, grant };
}
