import 'server-only';

/**
 * =============================================================================
 * SHARE LINKS LIST — οι ενεργοί σύνδεσμοι μιας οντότητας, για τον κάτοχο (ADR-315 §5 · Α12)
 * =============================================================================
 *
 * Τα `shares` / `file_shares` είναι `if false` για κάθε client (Α1): κρατούν `tokenHash` +
 * `passwordHash`. Η λίστα λοιπόν ζει **μόνο** εδώ, και φεύγει προς τον browser **μόνο** μέσα
 * από το `toShareLinkSummary` — ρητή λίστα πεδίων, **ποτέ** spread εγγράφου. Ένα νέο πεδίο στο
 * έγγραφο (π.χ. ένα μελλοντικό `recipientEmailHash`) **δεν** διαρρέει, γιατί κανείς δεν το ζήτησε.
 *
 * 🔑 **Ίδια ερώτηση εξουσιοδότησης με τη δημιουργία** (`mayShareEntity`): όποιος μπορεί να
 * κοινοποιήσει την οντότητα, βλέπει και διαχειρίζεται τους συνδέσμους της. Ξένη ή ανύπαρκτη
 * οντότητα ⇒ `null` (η διαδρομή απαντά 404 — Α10: δεν επιβεβαιώνουμε ids άλλου μισθωτή).
 *
 * 🔑 **Δύο συλλογές, ένα σχήμα**: η κανονικοποίηση είναι των **υπαρχόντων**
 * `normalizeUnifiedShare` / `normalizeLegacyFileShare` και ο χάρτης μετρητών του
 * `share-access.ts` — εδώ δεν ξαναγράφεται κανένα από τα δύο λεξιλόγια.
 *
 * @module server/sharing/share-links-list
 */

import type { DocumentSnapshot, Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';

import { COLLECTIONS } from '@/config/firestore-collections';
import { resolveUserDisplayName } from '@/services/entity-audit.service';
import { ShareEntityRegistry } from '@/services/sharing/share-entity-registry';
import '@/services/sharing/resolvers';
import { isResolvableShareKind } from '@/services/sharing/share-resolve-contract';
import type {
  RevokeAllSharesRequest,
  ShareEntityType,
  ShareLinkState,
  ShareLinkSummary,
  ShareLinksListResult,
} from '@/types/sharing';
import { SHARE_COUNTER_FIELDS } from './share-access';
import { mayShareEntity } from './share-entity-access';
import { isSharePasswordLocked } from './share-password-attempt';
import {
  normalizeLegacyFileShare,
  normalizeUnifiedShare,
  type StoredShare,
  type StoredShareSource,
} from './share-token-lookup';

/** Μέγεθος σελίδας της λίστας — πάνω από αυτό, `hasMore`. */
export const SHARE_LINKS_PAGE_SIZE = 50;

/** Η οντότητα της οποίας τους συνδέσμους ζητάμε. */
export interface ShareEntityRef {
  readonly entityType: ShareEntityType;
  readonly entityId: string;
}

/** Ένα ενεργό έγγραφο κοινοποίησης, με την πηγή του — για λίστα **και** μαζική ανάκληση. */
export interface ActiveShareDoc {
  readonly source: StoredShareSource;
  readonly snap: DocumentSnapshot;
}

const ENTITY_REF = z.object({
  entityType: z.string().refine(isResolvableShareKind),
  entityId: z.string().trim().min(1).max(200),
});

const REVOKE_ALL = ENTITY_REF.extend({ exceptShareId: z.string().trim().min(1).max(200).optional() }).strict();

/** Ερώτημα λίστας (`?entityType&entityId`) → αναφορά οντότητας, ή `null`. */
export function parseShareEntityRef(input: Record<string, unknown>): ShareEntityRef | null {
  const parsed = ENTITY_REF.safeParse(input);
  return parsed.success ? { entityType: parsed.data.entityType as ShareEntityType, entityId: parsed.data.entityId } : null;
}

/** Σώμα «ανάκληση όλων» → αίτημα, ή `null`. */
export function parseRevokeAllRequest(body: unknown): RevokeAllSharesRequest | null {
  const parsed = REVOKE_ALL.safeParse(body);
  if (!parsed.success) return null;
  const { entityType, entityId, exceptShareId } = parsed.data;
  return { entityType: entityType as ShareEntityType, entityId, ...(exceptShareId ? { exceptShareId } : {}) };
}

// =============================================================================
// ΕΞΟΥΣΙΟΔΟΤΗΣΗ + ΑΝΑΖΗΤΗΣΗ (κοινά με τη μαζική ανάκληση)
// =============================================================================

/** Μπορεί ο μισθωτής να διαχειριστεί τους συνδέσμους αυτής της οντότητας; */
export async function mayManageEntityLinks(
  adminDb: Firestore,
  companyId: string,
  ref: ShareEntityRef,
): Promise<boolean> {
  const definition = ShareEntityRegistry.get(ref.entityType);
  if (definition === null) return false;
  return mayShareEntity(adminDb, definition, companyId, ref.entityId);
}

/**
 * Τα ενεργά έγγραφα κοινοποίησης της οντότητας, και στις δύο συλλογές, έως `limit` ανά συλλογή.
 * **Δεν** κρίνει εξουσιοδότηση — ο καλών έχει ήδη ρωτήσει το `mayManageEntityLinks`.
 */
export async function queryActiveShareDocs(
  adminDb: Firestore,
  companyId: string,
  ref: ShareEntityRef,
  limit: number,
): Promise<ActiveShareDoc[]> {
  const unified = await adminDb
    .collection(COLLECTIONS.SHARES)
    .where('companyId', '==', companyId)
    .where('entityType', '==', ref.entityType)
    .where('entityId', '==', ref.entityId)
    .where('isActive', '==', true)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();
  const docs: ActiveShareDoc[] = unified.docs.map((snap) => ({ source: 'shares', snap }));
  const legacy = await queryLegacyActive(adminDb, companyId, ref, limit);
  return docs.concat(legacy.map((snap) => ({ source: 'file_shares' as const, snap })));
}

/**
 * Το παλιό `file_shares` ονομάζει την οντότητα αλλιώς: `fileId` για αρχείο,
 * `showcasePropertyId` για showcase ακινήτου· άλλα είδη δεν ζουν εκεί.
 *
 * ⚠️ **Δύο ρητά ερωτήματα, όχι ένα με δυναμικό πεδίο**: με `where(field, …)` η πύλη 3.91 το
 * έγραφε «μη αναλύσιμο» — πράσινο που σημαίνει «δεν κοίταξα» (μετρημένο 2026-09-25). Έτσι ο
 * δείκτης κάθε σχήματος **ελέγχεται**.
 */
type LegacyQuery = (adminDb: Firestore, companyId: string, entityId: string, limit: number) => Promise<DocumentSnapshot[]>;

const LEGACY_QUERIES: Partial<Record<ShareEntityType, LegacyQuery>> = {
  file: async (adminDb, companyId, entityId, limit) => (await adminDb
    .collection(COLLECTIONS.FILE_SHARES)
    .where('companyId', '==', companyId)
    .where('fileId', '==', entityId)
    .where('isActive', '==', true)
    .limit(limit)
    .get()).docs,
  property_showcase: async (adminDb, companyId, entityId, limit) => (await adminDb
    .collection(COLLECTIONS.FILE_SHARES)
    .where('companyId', '==', companyId)
    .where('showcasePropertyId', '==', entityId)
    .where('isActive', '==', true)
    .limit(limit)
    .get()).docs,
};

async function queryLegacyActive(
  adminDb: Firestore,
  companyId: string,
  ref: ShareEntityRef,
  limit: number,
): Promise<DocumentSnapshot[]> {
  const query = LEGACY_QUERIES[ref.entityType];
  return query ? query(adminDb, companyId, ref.entityId, limit) : [];
}

// =============================================================================
// ΠΡΟΒΟΛΗ — η ΜΟΝΗ έξοδος προς τον browser
// =============================================================================

/** ISO string από string ή Firestore `Timestamp` (τα παλιά `file_shares`). */
function isoOf(value: unknown): string | null {
  if (typeof value === 'string' && value.trim() !== '') return value;
  if (value !== null && typeof value === 'object' && 'toDate' in value) {
    const toDate = (value as { toDate: unknown }).toDate;
    if (typeof toDate === 'function') return (toDate.call(value) as Date).toISOString();
  }
  return null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/** Καθαρή κρίση κατάστασης — δοκιμάσιμη χωρίς βάση. */
function shareLinkStateOf(share: StoredShare, nowMs: number): ShareLinkState {
  if (share.requiresPassword && isSharePasswordLocked(share, nowMs)) return 'locked';
  if (share.maxAccesses > 0 && share.accessCount >= share.maxAccesses) return 'exhausted';
  return 'active';
}

/**
 * Έγγραφο → σύνοψη για τον κάτοχο. **Ρητή** λίστα πεδίων — προσθήκη εδώ είναι απόφαση
 * ασφαλείας και θέλει test (`share-links-manage.test.ts` ελέγχει ότι δεν φεύγει hash).
 */
export function toShareLinkSummary(
  share: StoredShare,
  raw: Record<string, unknown>,
  creatorName: string | null,
  nowMs: number,
): ShareLinkSummary {
  // Προβολή για τον **κάτοχο** — ΟΧΙ η δημόσια `safePublicProjection` του resolver-core (SSoT
  // `share-resolver-core`), που δείχνει στον παραλήπτη άλλα πεδία για άλλο σκοπό.
  const { requiresPassword } = share;
  return {
    shareId: share.id,
    label: stringOrNull(raw.label),
    note: share.note,
    createdAt: isoOf(raw.createdAt),
    createdBy: { uid: share.createdBy, name: creatorName },
    expiresAt: share.expiresAt,
    requiresPassword,
    maxAccesses: share.maxAccesses,
    accessCount: share.accessCount,
    lastAccessedAt: isoOf(raw[SHARE_COUNTER_FIELDS[share.source].last]),
    lockedUntil: requiresPassword && isSharePasswordLocked(share, nowMs) ? share.passwordLockedUntil : null,
    state: shareLinkStateOf(share, nowMs),
  };
}

const NORMALIZERS: Record<StoredShareSource, (id: string, d: Record<string, unknown>) => StoredShare | null> = {
  shares: normalizeUnifiedShare,
  file_shares: normalizeLegacyFileShare,
};

/** Ένα ανάγνωσμα `users/{uid}` ανά **μοναδικό** δημιουργό. */
async function creatorNames(uids: readonly string[]): Promise<Map<string, string | null>> {
  const unique = [...new Set(uids.filter((uid) => uid !== ''))];
  const names = await Promise.all(unique.map((uid) => resolveUserDisplayName(uid, null)));
  return new Map(unique.map((uid, i) => [uid, names[i] ?? null]));
}

/** Ενεργά (μη ληγμένα) έγγραφα, κανονικοποιημένα, νεότερο πρώτο. */
function liveShares(docs: readonly ActiveShareDoc[], nowMs: number) {
  return docs
    .map(({ source, snap }) => {
      const raw = (snap.data() ?? {}) as Record<string, unknown>;
      return { share: NORMALIZERS[source](snap.id, raw), raw };
    })
    .filter((row): row is { share: StoredShare; raw: Record<string, unknown> } =>
      row.share !== null && Date.parse(row.share.expiresAt) > nowMs)
    .sort((a, b) => (isoOf(b.raw.createdAt) ?? '').localeCompare(isoOf(a.raw.createdAt) ?? ''));
}

/**
 * **Ένα** έγγραφο → σύνοψη (μετά από αλλαγή ρυθμίσεων, Α13). `null` όταν λείπει κάτι χωρίς
 * το οποίο ο σύνδεσμος δεν σερβίρεται.
 */
export async function summarizeShareDoc(
  source: StoredShareSource,
  shareId: string,
  raw: Record<string, unknown>,
  nowMs: number = Date.now(),
): Promise<ShareLinkSummary | null> {
  const share = NORMALIZERS[source](shareId, raw);
  if (share === null) return null;
  const names = await creatorNames([share.createdBy]);
  return toShareLinkSummary(share, raw, names.get(share.createdBy) ?? null, nowMs);
}

/**
 * Οι ενεργοί σύνδεσμοι της οντότητας για τον μισθωτή `companyId`, ή `null` όταν η οντότητα
 * δεν είναι δική του (ή δεν υπάρχει).
 */
export async function listActiveShareLinks(
  adminDb: Firestore,
  companyId: string,
  ref: ShareEntityRef,
  nowMs: number = Date.now(),
): Promise<ShareLinksListResult | null> {
  if (!(await mayManageEntityLinks(adminDb, companyId, ref))) return null;
  const docs = await queryActiveShareDocs(adminDb, companyId, ref, SHARE_LINKS_PAGE_SIZE + 1);
  const rows = liveShares(docs, nowMs);
  const page = rows.slice(0, SHARE_LINKS_PAGE_SIZE);
  const names = await creatorNames(page.map((row) => row.share.createdBy));
  return {
    links: page.map((row) => toShareLinkSummary(row.share, row.raw, names.get(row.share.createdBy) ?? null, nowMs)),
    hasMore: rows.length > SHARE_LINKS_PAGE_SIZE,
  };
}
