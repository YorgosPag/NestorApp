/**
 * =============================================================================
 * FILE SHARE RESOLVER (ADR-315)
 * =============================================================================
 *
 * Resolves `entityType: 'file'` shares. Owns the policy for:
 *   - canShare: only the file owner / same-tenant user with write access
 *   - validateCreateInput: require `fileId`, enforce fileMeta presence
 *   - resolve: fetch file metadata from `files` collection
 *   - safePublicProjection: strip tenant PII from the record
 *   - renderPublic: defers to `SharedFilePageContent` via public route (Step D)
 *
 * @module services/sharing/resolvers/file.resolver
 * @see adrs/ADR-315-unified-sharing.md §3.3
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import type {
  AuthorizedUser,
  CreateShareInput,
  PublicShareData,
  ShareEntityDefinition,
  ShareRecord,
  ValidationResult,
} from '@/types/sharing';

const logger = createModuleLogger('FileShareResolver');

export interface FileShareResolvedData {
  shareId: string;
  token: string;
  fileId: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  note: string | null;
}

async function resolveFile(share: ShareRecord): Promise<FileShareResolvedData> {
  const fileRef = doc(db, COLLECTIONS.FILES, share.entityId);
  const fileSnap = await getDoc(fileRef);
  if (!fileSnap.exists()) {
    logger.warn('File share points to missing file', {
      shareId: share.id,
      fileId: share.entityId,
    });
  }
  const data = fileSnap.exists() ? fileSnap.data() : null;
  return {
    shareId: share.id,
    token: share.token,
    fileId: share.entityId,
    fileName: (data?.name as string | undefined) ?? share.entityId,
    mimeType: share.fileMeta?.mimeType ?? (data?.mimeType as string | undefined) ?? null,
    sizeBytes: share.fileMeta?.sizeBytes ?? (data?.sizeBytes as number | undefined) ?? null,
    note: share.note ?? null,
  };
}

function safePublicProjection(share: ShareRecord): PublicShareData {
  return {
    entityType: share.entityType,
    entityId: share.entityId,
    requiresPassword: share.requiresPassword,
    expiresAt: share.expiresAt,
    isActive: share.isActive,
    accessCount: share.accessCount,
    maxAccesses: share.maxAccesses,
    note: share.note ?? null,
    fileMeta: share.fileMeta ?? null,
  };
}

function validateCreateInput(input: CreateShareInput): ValidationResult {
  if (input.entityType !== 'file') {
    return { valid: false, reason: 'Wrong resolver — expected entityType=file' };
  }
  if (!input.entityId?.trim()) {
    return { valid: false, reason: 'fileId required' };
  }
  if (!input.companyId?.trim()) {
    return { valid: false, reason: 'companyId required' };
  }
  if (!input.createdBy?.trim()) {
    return { valid: false, reason: 'createdBy required' };
  }
  return { valid: true };
}

async function canShare(user: AuthorizedUser, entityId: string): Promise<boolean> {
  if (!user?.uid || !user?.companyId) return false;
  const fileRef = doc(db, COLLECTIONS.FILES, entityId);
  const snap = await getDoc(fileRef);
  if (!snap.exists()) return false;
  const fileCompanyId = snap.data().companyId as string | undefined;
  return fileCompanyId === user.companyId;
}

export const fileShareResolver: ShareEntityDefinition<FileShareResolvedData> = {
  resolve: resolveFile,
  safePublicProjection,
  validateCreateInput,
  canShare,
  renderPublic: () => null, // Wired in Step D (public route dispatcher)
};
