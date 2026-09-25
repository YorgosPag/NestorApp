import 'server-only';

/**
 * =============================================================================
 * SHARE CREATE — γέννηση συνδέσμου κοινοποίησης, ΜΟΝΟ στον διακομιστή (ADR-884 Φ0.12)
 * =============================================================================
 *
 * 🔴 **Πριν**: ο browser έγραφε το έγγραφο κοινοποίησης μόνος του — με το διακριτικό σε
 * καθαρό κείμενο, με SHA-256 κωδικό χωρίς salt, με `companyId`/`createdBy` **που δήλωνε
 * ο ίδιος** (ο κανόνας έλεγχε μόνο ότι ταιριάζουν με το claim), και με τον έλεγχο
 * «μπορώ να το κοινοποιήσω;» να τρέχει **στον browser**, όπου παρακάμπτεται.
 *
 * **Τώρα**: μισθωτής και συντάκτης από την **επαληθευμένη συνεδρία** · επικύρωση του
 * resolver + ιδιοκτησία οντότητας **στον διακομιστή** · διακριτικό 256 bit · αποθήκευση
 * **μόνο** του `tokenHash` · scrypt για τον κωδικό · **υποχρεωτική** λήξη 1 ώρα–30 ημέρες.
 * Το ωμό διακριτικό επιστρέφεται **μία** φορά και δεν ξαναβγαίνει από πουθενά.
 *
 * @module server/sharing/share-create
 */

import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';

import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import { generateShareToken, hashShareToken } from '@/lib/sharing/share-token';
import { createModuleLogger } from '@/lib/telemetry';
import { generateShareId } from '@/services/enterprise-id-convenience';
import { recordFileAudit } from '@/services/file-audit-admin.service';
import { ShareEntityRegistry } from '@/services/sharing/share-entity-registry';
import '@/services/sharing/resolvers';
import {
  isResolvableShareKind,
  SHARE_PASSWORD_MAX_LENGTH,
} from '@/services/sharing/share-resolve-contract';
import type { CreateShareInput, CreateShareRequest, CreateShareResult } from '@/types/sharing';
import { mayShareEntity } from './share-entity-access';
import { hashSharePassword } from './share-password';

const logger = createModuleLogger('ShareCreate');

/** Λήξη **υποχρεωτική** — ίδιο εύρος με τις επιλογές του διαλόγου (1 ώρα … 30 ημέρες). */
export const SHARE_MIN_EXPIRY_HOURS = 1;
export const SHARE_MAX_EXPIRY_HOURS = 720;
const DEFAULT_EXPIRY_HOURS = 72;
const NOTE_MAX_LENGTH = 1000;

const CREATE_REQUEST = z.object({
  entityType: z.string().refine(isResolvableShareKind),
  entityId: z.string().trim().min(1).max(200),
  expiresInHours: z.number().int().min(SHARE_MIN_EXPIRY_HOURS).max(SHARE_MAX_EXPIRY_HOURS).optional(),
  password: z.string().min(1).max(SHARE_PASSWORD_MAX_LENGTH).optional(),
  maxAccesses: z.number().int().min(0).max(10_000).optional(),
  note: z.string().max(NOTE_MAX_LENGTH).optional(),
  showcaseMeta: z.object({
    pdfStoragePath: z.string().max(1024),
    pdfRegeneratedAt: z.union([z.string(), z.null()]).optional(),
  }).optional(),
  contactMeta: z.object({
    includedFields: z.array(z.enum(['name', 'emails', 'phones', 'address', 'company'])).min(1),
  }).optional(),
  fileMeta: z.object({ mimeType: z.string().max(200), sizeBytes: z.number().nonnegative() }).optional(),
});

/** Γιατί δεν γεννήθηκε σύνδεσμος — ονομασμένο. */
export type ShareCreateRefusal = 'malformed' | 'invalid' | 'forbidden';

export type ShareCreateOutcome =
  | { readonly ok: true; readonly result: CreateShareResult }
  | { readonly ok: false; readonly refusal: ShareCreateRefusal; readonly reason?: string };

/** Ο καλών — από την επαληθευμένη συνεδρία, ποτέ από το σώμα. */
export interface ShareCreator {
  readonly uid: string;
  readonly companyId: string;
}

/** Σώμα → αίτημα, ή `null`. */
export function parseCreateShareRequest(body: unknown): CreateShareRequest | null {
  const parsed = CREATE_REQUEST.safeParse(body);
  if (!parsed.success) return null;
  const { showcaseMeta, ...rest } = parsed.data;
  return {
    ...rest,
    entityType: rest.entityType as CreateShareRequest['entityType'],
    ...(showcaseMeta ? { showcaseMeta: { ...showcaseMeta, pdfRegeneratedAt: showcaseMeta.pdfRegeneratedAt ?? null } } : {}),
  };
}

async function buildShareDocument(input: CreateShareInput, tokenHash: string) {
  const expiresAt = new Date(Date.now() + (input.expiresInHours ?? DEFAULT_EXPIRY_HOURS) * 3_600_000).toISOString();
  return {
    tokenHash,
    entityType: input.entityType,
    entityId: input.entityId,
    companyId: input.companyId,
    createdBy: input.createdBy,
    createdAt: nowISO(),
    expiresAt,
    isActive: true,
    requiresPassword: input.password !== undefined,
    passwordHash: input.password === undefined ? null : await hashSharePassword(input.password),
    maxAccesses: input.maxAccesses ?? 0,
    accessCount: 0,
    note: input.note ?? null,
    ...(input.showcaseMeta ? { showcaseMeta: input.showcaseMeta } : {}),
    ...(input.contactMeta ? { contactMeta: input.contactMeta } : {}),
    ...(input.fileMeta ? { fileMeta: input.fileMeta } : {}),
  };
}

/**
 * Το συμβάν `'share'` στο ίχνος του αρχείου (`FileAuditAction`). Το έγραφε το παλιό
 * `FileShareService` — το ενιαίο μονοπάτι **δεν** το έγραφε ποτέ, οπότε μέχρι το Κ4 οι
 * σύνδεσμοι αρχείων από το `UnifiedShareDialog` δεν άφηναν ίχνος. Η αποτυχία του ίχνους
 * δεν ακυρώνει τον σύνδεσμο (ADR-862 §5.7 — το λέει ο ίδιος ο γραφέας).
 */
async function auditFileShare(input: CreateShareInput, shareId: string, requiresPassword: boolean): Promise<void> {
  await recordFileAudit({
    fileId: input.entityId,
    action: 'share',
    performedBy: input.createdBy,
    companyId: input.companyId,
    metadata: { shareId, expiresInHours: input.expiresInHours ?? DEFAULT_EXPIRY_HOURS, requiresPassword },
  });
}

/** Γεννά σύνδεσμο κοινοποίησης για λογαριασμό του `creator`. */
export async function createShareOnServer(
  adminDb: Firestore,
  creator: ShareCreator,
  request: CreateShareRequest,
): Promise<ShareCreateOutcome> {
  const input: CreateShareInput = { ...request, companyId: creator.companyId, createdBy: creator.uid };
  const definition = ShareEntityRegistry.get(input.entityType);
  if (definition === null) return { ok: false, refusal: 'invalid', reason: 'unsupported entityType' };

  const validation = definition.validateCreateInput(input);
  if (!validation.valid) return { ok: false, refusal: 'invalid', reason: validation.reason };
  if (!(await mayShareEntity(adminDb, definition, creator.companyId, input.entityId))) {
    return { ok: false, refusal: 'forbidden' };
  }

  const token = generateShareToken();
  const shareId = generateShareId();
  const document = await buildShareDocument(input, await hashShareToken(token));
  await adminDb.collection(COLLECTIONS.SHARES).doc(shareId).set(document);

  logger.info('Share created', {
    shareId, entityType: input.entityType, requiresPassword: document.requiresPassword, expiresAt: document.expiresAt,
  });
  if (input.entityType === 'file') await auditFileShare(input, shareId, document.requiresPassword);
  return { ok: true, result: { shareId, token, expiresAt: document.expiresAt } };
}
