import 'server-only';

/**
 * =============================================================================
 * SHARE TOKEN LOOKUP — «σε ποια κοινοποίηση ανήκει αυτό το διακριτικό;», ΜΙΑ φορά (ADR-884 Φ0.12)
 * =============================================================================
 *
 * 🔴 **Γιατί υπάρχει**: η ίδια ερώτηση ήταν γραμμένη **πέντε** φορές στον διακομιστή
 * (`public-share-lookup.ts` + τρία σημεία στο `api/showcase/[token]/*`), με τρία
 * διαφορετικά σχήματα ερωτήματος, δύο από τα οποία **κατέγραφαν το ωμό διακριτικό στο log**
 * — και **δύο** ακόμη στον browser (`UnifiedSharingService.validateShare`,
 * `FileShareService.validateShare`), πάνω σε συλλογή `allow read: if true`.
 *
 * ## Τι απαντά
 *
 * Ένα **κανονικοποιημένο** `StoredShare`, όποια από τις δύο συλλογές κι αν το κρατά:
 *   - `shares` (ADR-315 — το ενιαίο SSoT)
 *   - `file_shares` (παλιό, ADR-191/312 — κοινοποιήσεις αρχείων **και** property showcase)
 *
 * Ο καλών **δεν** ξέρει και δεν νοιάζεται από πού ήρθε· το `source` υπάρχει μόνο για
 * να ξέρει **ο γραφέας** (`share-access.ts`, `share-password-attempt.ts`) πού να γράψει.
 *
 * ## Μετάπτωση (μεταβατικό — αφαιρείται μετά το `migrate-share-token-hash --execute`)
 *
 * Πρώτα `tokenHash` (η νέα αλήθεια)· αν δεν βρεθεί, **και** ωμό `token` (έγγραφα που δεν
 * έχουν ακόμη μεταπέσει). Έτσι ο κώδικας αναπτύσσεται **πριν** τη μετάπτωση χωρίς να
 * σπάσει κανένας παλιός σύνδεσμος — και η μετάπτωση μπορεί να τρέξει οποτεδήποτε.
 *
 * ⚠️ **ΚΑΝΕΝΑ ωμό διακριτικό σε log**, ποτέ. Μόνο `shareId`.
 *
 * @module server/sharing/share-token-lookup
 * @see docs/centralized-systems/reference/adrs/ADR-698-public-showcase-token-surface-ssot.md
 */

import type { DocumentSnapshot, Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { hashShareToken, isPlausibleShareToken } from '@/lib/sharing/share-token';
import { createModuleLogger } from '@/lib/telemetry';
import type {
  ContactShareMeta,
  FileShareMeta,
  ShareEntityType,
  ShowcaseShareMeta,
} from '@/types/sharing';

const logger = createModuleLogger('ShareTokenLookup');

/** Σε ποια συλλογή ζει η κοινοποίηση — μόνο για τους γραφείς. */
export type StoredShareSource = 'shares' | 'file_shares';

/** Η κοινοποίηση όπως τη βλέπει ο διακομιστής — **ποτέ** δεν φεύγει ωμή προς τον πελάτη. */
export interface StoredShare {
  readonly id: string;
  readonly source: StoredShareSource;
  readonly entityType: ShareEntityType;
  readonly entityId: string;
  readonly companyId: string;
  readonly createdBy: string;
  readonly expiresAt: string;
  readonly requiresPassword: boolean;
  readonly passwordHash: string | null;
  readonly maxAccesses: number;
  readonly accessCount: number;
  readonly note: string | null;
  readonly showcaseMeta: ShowcaseShareMeta | null;
  readonly contactMeta: ContactShareMeta | null;
  readonly fileMeta: FileShareMeta | null;
  /** Αποτυχημένες προσπάθειες κωδικού στο τρέχον παράθυρο (κλείδωμα ανά σύνδεσμο). */
  readonly passwordFailures: number;
  readonly passwordFailureWindowStart: string | null;
  readonly passwordLockedUntil: string | null;
}

// =============================================================================
// ΚΑΝΟΝΙΚΟΠΟΙΗΣΗ
// =============================================================================

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function lockFields(d: Record<string, unknown>) {
  return {
    passwordFailures: num(d.passwordFailures),
    passwordFailureWindowStart: str(d.passwordFailureWindowStart),
    passwordLockedUntil: str(d.passwordLockedUntil),
  };
}

/** `shares` → `StoredShare`, ή `null` όταν λείπει κάτι χωρίς το οποίο δεν σερβίρεται. */
export function normalizeUnifiedShare(id: string, d: Record<string, unknown>): StoredShare | null {
  const entityType = str(d.entityType) as ShareEntityType | null;
  const entityId = str(d.entityId);
  const companyId = str(d.companyId);
  const expiresAt = str(d.expiresAt);
  if (!entityType || !entityId || !companyId || !expiresAt) return null;
  return {
    id,
    source: 'shares',
    entityType,
    entityId,
    companyId,
    createdBy: str(d.createdBy) ?? '',
    expiresAt,
    requiresPassword: d.requiresPassword === true,
    passwordHash: str(d.passwordHash),
    maxAccesses: num(d.maxAccesses),
    accessCount: num(d.accessCount),
    note: str(d.note),
    showcaseMeta: (d.showcaseMeta as ShowcaseShareMeta | undefined) ?? null,
    contactMeta: (d.contactMeta as ContactShareMeta | undefined) ?? null,
    fileMeta: (d.fileMeta as FileShareMeta | undefined) ?? null,
    ...lockFields(d),
  };
}

/**
 * `file_shares` → `StoredShare`. Το παλιό σχήμα μιλά άλλη γλώσσα:
 * `showcaseMode` ⇒ property showcase (`showcasePropertyId`, `pdfStoragePath`)· αλλιώς
 * αρχείο (`fileId`). `downloadCount`/`maxDownloads` ⇒ `accessCount`/`maxAccesses`.
 */
export function normalizeLegacyFileShare(id: string, d: Record<string, unknown>): StoredShare | null {
  const isShowcase = d.showcaseMode === true;
  const entityId = str(isShowcase ? d.showcasePropertyId : d.fileId);
  const companyId = str(d.companyId);
  const expiresAt = str(d.expiresAt);
  if (!entityId || !companyId || !expiresAt) return null;
  const pdfStoragePath = str(d.pdfStoragePath);
  return {
    id,
    source: 'file_shares',
    entityType: isShowcase ? 'property_showcase' : 'file',
    entityId,
    companyId,
    createdBy: str(d.createdBy) ?? '',
    expiresAt,
    requiresPassword: d.requiresPassword === true,
    passwordHash: str(d.passwordHash),
    maxAccesses: num(d.maxDownloads),
    accessCount: num(d.downloadCount),
    note: str(d.note),
    showcaseMeta: isShowcase && pdfStoragePath ? { pdfStoragePath, pdfRegeneratedAt: null } : null,
    contactMeta: null,
    fileMeta: null,
    ...lockFields(d),
  };
}

const NORMALIZERS: Record<StoredShareSource, (id: string, d: Record<string, unknown>) => StoredShare | null> = {
  shares: normalizeUnifiedShare,
  file_shares: normalizeLegacyFileShare,
};

const COLLECTION_OF: Record<StoredShareSource, string> = {
  shares: COLLECTIONS.SHARES,
  file_shares: COLLECTIONS.FILE_SHARES,
};

/** Η συλλογή Firestore μιας πηγής — για τους γραφείς. */
export function collectionOfShareSource(source: StoredShareSource): string {
  return COLLECTION_OF[source];
}

// =============================================================================
// ΑΝΑΖΗΤΗΣΗ
// =============================================================================

/** Ψάχνει ένα πεδίο σε μία συλλογή· `limit(2)` ώστε η ανωμαλία «δύο ενεργά» να φαίνεται. */
async function queryActive(
  adminDb: Firestore,
  source: StoredShareSource,
  field: 'tokenHash' | 'token',
  value: string,
): Promise<DocumentSnapshot | null> {
  const snap = await adminDb
    .collection(COLLECTION_OF[source])
    .where(field, '==', value) // companyId: N/A — ανώνυμη επίλυση διακριτικού, πριν υπάρξει μισθωτής
    .where('isActive', '==', true)
    .limit(2)
    .get();
  if (snap.empty) return null;
  if (snap.size > 1) {
    logger.warn('Share token resolved to more than one active share', {
      source,
      shareIds: snap.docs.map((doc) => doc.id),
    });
  }
  return snap.docs[0] ?? null;
}

/**
 * Διακριτικό → ενεργή κοινοποίηση, ή `null`.
 *
 * Σειρά: `shares` πριν από `file_shares` (το ενιαίο SSoT κερδίζει), `tokenHash` πριν από
 * `token` (η νέα αλήθεια κερδίζει). **Δεν** κρίνει λήξη/όριο/κωδικό — αυτά είναι
 * πολιτική του καλούντα (`share-resolve.ts`), που χρειάζεται να πει **ποιο** από αυτά.
 */
export async function findActiveShareByToken(adminDb: Firestore, token: string): Promise<StoredShare | null> {
  if (!isPlausibleShareToken(token)) return null;
  const tokenHash = await hashShareToken(token);

  for (const source of ['shares', 'file_shares'] as const) {
    const byHash = await queryActive(adminDb, source, 'tokenHash', tokenHash);
    // Μεταβατικό: έγγραφα πριν τη μετάπτωση φέρουν ακόμη ωμό `token`.
    const doc = byHash ?? (await queryActive(adminDb, source, 'token', token));
    if (!doc) continue;
    const share = NORMALIZERS[source](doc.id, (doc.data() ?? {}) as Record<string, unknown>);
    if (share === null) {
      logger.warn('Active share is missing required fields', { source, shareId: doc.id });
      return null;
    }
    return share;
  }
  return null;
}
