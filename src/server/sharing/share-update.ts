import 'server-only';

/**
 * =============================================================================
 * SHARE UPDATE — αλλαγή ρυθμίσεων ΧΩΡΙΣ αλλαγή URL (ADR-315 Α13)
 * =============================================================================
 *
 * 🔴 **Πριν**: «αλλαγή ρυθμίσεων» = ανάκληση + νέος σύνδεσμος. Το URL που **είχε ήδη σταλεί**
 * έσπαγε σιωπηλά — ο παραλήπτης έβλεπε «μη διαθέσιμο» επειδή ο κάτοχος άλλαξε τη λήξη.
 * **Τώρα** (πρότυπο Dropbox / Box «Link settings»): ίδιο έγγραφο, ίδιο διακριτικό, νέα πολιτική.
 *
 * - **Λήξη** από **τώρα**, στο ίδιο εύρος με τη δημιουργία (Α8) — ένας ορισμός (`SHARE_POLICY_FIELDS`).
 * - **Κωδικός**: ορισμός ⇒ scrypt (Α3) · `null` ⇒ αφαίρεση. Και στα δύο μηδενίζεται το κλείδωμα
 *   (Α4): οι αποτυχίες μετρούσαν απέναντι σε κωδικό που δεν υπάρχει πια.
 * - **Όριο ανοιγμάτων**: `0` (χωρίς όριο) ή ≥ όσα **ήδη** έγιναν — ένα όριο κάτω από τον μετρητή
 *   θα ήταν ψέμα στη λίστα («3 / 2»).
 * - **Ετικέτα** (Α14): εσωτερική, `null` ⇒ αφαίρεση.
 *
 * Μόνο **ενεργός** σύνδεσμος του μισθωτή· ανακληθείς ⇒ `not-found` (η ανάκληση είναι
 * μονόδρομη — αλλαγή ρυθμίσεων δεν είναι πίσω πόρτα επαναφοράς).
 *
 * ⚠️ Κουπόνια επίσκεψης 15′ (Α6) που εκδόθηκαν **πριν** την προσθήκη κωδικού ισχύουν μέχρι να
 * λήξουν — ίδια συμπεριφορά με το «ένα άνοιγμα = μία πρόσβαση». Για άμεσο κόψιμο: ανάκληση.
 *
 * @module server/sharing/share-update
 */

import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';

import { nowISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import { linkPolicyOf } from '@/services/sharing/share-resolve-contract';
import type { ShareLinkSummary, UpdateShareRequest } from '@/types/sharing';
import { SHARE_COUNTER_FIELDS } from './share-access';
import { SHARE_POLICY_FIELDS, shareExpiryFromNow, type ShareCreator } from './share-create';
import { summarizeShareDoc } from './share-links-list';
import { hashSharePassword } from './share-password';
import { findOwnedShare, type OwnedShare } from './share-revoke';

const logger = createModuleLogger('ShareUpdate');

const UPDATE_REQUEST = z.object({
  label: SHARE_POLICY_FIELDS.label.nullable().optional(),
  expiresInHours: SHARE_POLICY_FIELDS.expiresInHours.optional(),
  password: SHARE_POLICY_FIELDS.password.nullable().optional(),
  maxAccesses: SHARE_POLICY_FIELDS.maxAccesses.optional(),
}).strict().refine((body) => Object.keys(body).length > 0);

export type ShareUpdateRefusal = 'malformed' | 'invalid' | 'not-found';

export type ShareUpdateOutcome =
  | { readonly ok: true; readonly link: ShareLinkSummary }
  | { readonly ok: false; readonly refusal: ShareUpdateRefusal; readonly reason?: string };

/** Σώμα → αίτημα, ή `null` (άγνωστο πεδίο, κενό σώμα, τιμή εκτός εύρους). */
export function parseUpdateShareRequest(body: unknown): UpdateShareRequest | null {
  const parsed = UPDATE_REQUEST.safeParse(body);
  return parsed.success ? parsed.data : null;
}

const RESET_LOCK = { passwordFailures: 0, passwordFailureWindowStart: null, passwordLockedUntil: null } as const;

/** Αίτημα → πεδία εγγράφου, στο λεξιλόγιο της **πηγής** (το παλιό `file_shares` μετρά «λήψεις»). */
async function patchOf(request: UpdateShareRequest, owned: OwnedShare): Promise<Record<string, unknown>> {
  const patch: Record<string, unknown> = {};
  if (request.label !== undefined) patch.label = request.label;
  if (request.expiresInHours !== undefined) patch.expiresAt = shareExpiryFromNow(request.expiresInHours);
  if (request.maxAccesses !== undefined) patch[SHARE_COUNTER_FIELDS[owned.source].max] = request.maxAccesses;
  if (request.password === null) Object.assign(patch, { requiresPassword: false, passwordHash: null }, RESET_LOCK);
  if (typeof request.password === 'string') {
    Object.assign(patch, { requiresPassword: true, passwordHash: await hashSharePassword(request.password) }, RESET_LOCK);
  }
  return patch;
}

/** Όριο κάτω από όσα ανοίγματα **ήδη** έγιναν ⇒ άρνηση (όχι σιωπηλή «διόρθωση»). */
function limitBelowCount(request: UpdateShareRequest, owned: OwnedShare): boolean {
  if (request.maxAccesses === undefined || request.maxAccesses === 0) return false;
  const count = owned.data[SHARE_COUNTER_FIELDS[owned.source].count];
  return typeof count === 'number' && request.maxAccesses < count;
}

/** Αλλάζει τις ρυθμίσεις του ενεργού συνδέσμου `shareId` του μισθωτή του καλούντα. */
export async function updateShareOnServer(
  adminDb: Firestore,
  actor: ShareCreator,
  shareId: string,
  request: UpdateShareRequest,
): Promise<ShareUpdateOutcome> {
  const owned = await findOwnedShare(adminDb, actor.companyId, shareId);
  if (owned === null || owned.data.isActive !== true) return { ok: false, refusal: 'not-found' };
  if (limitBelowCount(request, owned)) return { ok: false, refusal: 'invalid', reason: 'max-below-count' };
  // ADR-884 Κ3β — ίδια πολιτική με τη δημιουργία: η αλλαγή ρυθμίσεων δεν είναι πίσω πόρτα για κωδικό/κενό «για ποιον».
  const policy = linkPolicyOf(String(owned.data.entityType ?? ''));
  if (!policy.password && typeof request.password === 'string') return { ok: false, refusal: 'invalid', reason: 'password-not-allowed' };
  if (policy.labelRequired && request.label !== undefined && !request.label?.trim()) {
    return { ok: false, refusal: 'invalid', reason: 'label-required' };
  }

  const patch = await patchOf(request, owned);
  await owned.ref.update({ ...patch, updatedAt: nowISO(), updatedBy: actor.uid });
  logger.info('Share settings updated', { shareId, source: owned.source, fields: Object.keys(request), by: actor.uid });

  const fresh = await owned.ref.get();
  const link = await summarizeShareDoc(owned.source, shareId, (fresh.data() ?? {}) as Record<string, unknown>);
  return link === null ? { ok: false, refusal: 'not-found' } : { ok: true, link };
}
