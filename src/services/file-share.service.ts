/**
 * =============================================================================
 * 🏢 ENTERPRISE: File Share Service
 * =============================================================================
 *
 * Manages shareable file links with expiration and optional password.
 * Stores share records in Firestore `file_shares` collection.
 *
 * @module services/file-share.service
 * @enterprise ADR-191 - Enterprise Document Management System (Phase 4.2)
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { FileAuditService } from '@/services/file-audit.service';
import { safeFireAndForget } from '@/lib/safe-fire-and-forget';

const logger = createModuleLogger('FileShareService');

// ============================================================================
// TYPES
// ============================================================================

/** Share link record stored in Firestore */
export interface FileShareRecord {
  id: string;
  /** File ID being shared */
  fileId: string;
  /** Unique share token (URL-safe) */
  token: string;
  /** Who created this share */
  createdBy: string;
  /** When created */
  createdAt: Date | string;
  /** Expiration date */
  expiresAt: string;
  /** Is this share still active */
  isActive: boolean;
  /** Optional password hash (bcrypt) */
  passwordHash?: string;
  /** Whether password is required */
  requiresPassword: boolean;
  /** Download count */
  downloadCount: number;
  /** Max downloads allowed (0 = unlimited) */
  maxDownloads: number;
  /** Optional note/message */
  note?: string;
  /** Company ID for tenant isolation */
  companyId?: string;
  /** Property ID when share represents a Property Showcase (ADR-312) */
  showcasePropertyId?: string;
  /** True if share is a Property Showcase link (ADR-312) */
  showcaseMode?: boolean;
  /** Storage path of the generated showcase PDF (ADR-312) */
  pdfStoragePath?: string;
  /** Last time the showcase PDF was regenerated in-place (ADR-312 Phase 3.2) */
  pdfRegeneratedAt?: Date | string;
}

/** Input for creating a share link */
export interface CreateShareInput {
  fileId: string;
  createdBy: string;
  /** Expiration in hours (default: 72) */
  expiresInHours?: number;
  /** Optional password (will be hashed) */
  password?: string;
  /** Max downloads (0 = unlimited) */
  maxDownloads?: number;
  /** Optional note */
  note?: string;
  companyId?: string;
  /** Property ID when creating a Property Showcase share (ADR-312) */
  showcasePropertyId?: string;
  /** Set true to mark share as Property Showcase (ADR-312) */
  showcaseMode?: boolean;
  /** Storage path of the generated showcase PDF (ADR-312) */
  pdfStoragePath?: string;
}

/** Result of share validation */
export interface ShareValidation {
  valid: boolean;
  reason?: string;
  share?: FileShareRecord;
}

// ============================================================================
// TOKEN GENERATION
// ============================================================================

/** Generate URL-safe random token */
function generateToken(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join('');
}

/** Simple hash for password (client-side — not bcrypt) */
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ============================================================================
// SERVICE
// ============================================================================

export class FileShareService {
  /**
   * Create a shareable link for a file.
   * Returns the share token (to be used in URL).
   */
  static async createShare(input: CreateShareInput): Promise<string> {
    const token = generateToken();
    const expiresInHours = input.expiresInHours ?? 72;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);

    const shareData: Omit<FileShareRecord, 'id' | 'createdAt'> & { createdAt: ReturnType<typeof serverTimestamp> } = {
      fileId: input.fileId,
      token,
      createdBy: input.createdBy,
      createdAt: serverTimestamp(),
      expiresAt: expiresAt.toISOString(),
      isActive: true,
      requiresPassword: !!input.password,
      downloadCount: 0,
      maxDownloads: input.maxDownloads ?? 0,
      note: input.note ?? undefined,
      companyId: input.companyId ?? undefined,
      showcasePropertyId: input.showcasePropertyId ?? undefined,
      showcaseMode: input.showcaseMode ?? undefined,
      pdfStoragePath: input.pdfStoragePath ?? undefined,
    };

    // Hash password if provided
    if (input.password) {
      shareData.passwordHash = await hashPassword(input.password);
    }

    // Remove undefined values for Firestore
    const cleanData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(shareData)) {
      if (value !== undefined) {
        cleanData[key] = value;
      }
    }

    const { generateShareId } = await import('@/services/enterprise-id.service');
    const enterpriseId = generateShareId();
    const docRef = doc(db, COLLECTIONS.FILE_SHARES, enterpriseId);
    await setDoc(docRef, cleanData);

    logger.info('Share link created', {
      fileId: input.fileId,
      expiresAt: expiresAt.toISOString(),
      requiresPassword: !!input.password,
    });

    // Audit trail
    safeFireAndForget(FileAuditService.log(input.fileId, 'share', input.createdBy, input.companyId, {
      expiresInHours,
      requiresPassword: !!input.password,
    }), 'FileShare.createLink');

    return token;
  }

  /**
   * Validate a share token.
   */
  static async validateShare(token: string): Promise<ShareValidation> {
    const colRef = collection(db, COLLECTIONS.FILE_SHARES);
    // companyId: N/A — share links must remain publicly readable for anonymous access
    // (firestore.rules explicitly allows public read on file_shares by token).
    // Token is a 32-char URL-safe random string, unguessable. Tenant binding is stored
    // in `share.companyId` and used by downstream file-access checks.
    const q = query(
      // companyId: N/A — anonymous public token-based share validation
      colRef,
      where('token', '==', token),
      where('isActive', '==', true)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      return { valid: false, reason: 'Share link not found or deactivated' };
    }

    const docSnap = snap.docs[0];
    const data = docSnap.data();

    const share: FileShareRecord = {
      id: docSnap.id,
      fileId: data.fileId,
      token: data.token,
      createdBy: data.createdBy,
      createdAt: data.createdAt?.toDate?.() ?? data.createdAt ?? '',
      expiresAt: data.expiresAt,
      isActive: data.isActive,
      passwordHash: data.passwordHash,
      requiresPassword: data.requiresPassword ?? false,
      downloadCount: data.downloadCount ?? 0,
      maxDownloads: data.maxDownloads ?? 0,
      note: data.note,
      companyId: data.companyId,
      showcasePropertyId: data.showcasePropertyId,
      showcaseMode: data.showcaseMode,
      pdfStoragePath: data.pdfStoragePath,
    };

    // Check expiration
    if (new Date(share.expiresAt) < new Date()) {
      return { valid: false, reason: 'Share link has expired' };
    }

    // Check max downloads
    if (share.maxDownloads > 0 && share.downloadCount >= share.maxDownloads) {
      return { valid: false, reason: 'Download limit reached' };
    }

    return { valid: true, share };
  }

  /**
   * Verify password for a password-protected share.
   */
  static async verifyPassword(share: FileShareRecord, password: string): Promise<boolean> {
    if (!share.requiresPassword || !share.passwordHash) return true;
    const hash = await hashPassword(password);
    return hash === share.passwordHash;
  }

  /**
   * Increment download count for a share.
   */
  static async incrementDownloadCount(shareId: string): Promise<void> {
    const docRef = doc(db, COLLECTIONS.FILE_SHARES, shareId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const current = docSnap.data().downloadCount ?? 0;
      await updateDoc(docRef, { downloadCount: current + 1 });
    }
  }

  /**
   * Deactivate a share link.
   */
  static async deactivateShare(shareId: string): Promise<void> {
    const docRef = doc(db, COLLECTIONS.FILE_SHARES, shareId);
    await updateDoc(docRef, { isActive: false });
    logger.info('Share link deactivated', { shareId });
  }

  /**
   * Get all active shares for a file.
   */
  static async getSharesForFile(fileId: string, companyId: string): Promise<FileShareRecord[]> {
    const colRef = collection(db, COLLECTIONS.FILE_SHARES);
    const q = query(colRef, where('companyId', '==', companyId), where('fileId', '==', fileId), where('isActive', '==', true));
    const snap = await getDocs(q);

    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        fileId: data.fileId,
        token: data.token,
        createdBy: data.createdBy,
        createdAt: data.createdAt?.toDate?.() ?? data.createdAt ?? '',
        expiresAt: data.expiresAt,
        isActive: data.isActive,
        requiresPassword: data.requiresPassword ?? false,
        downloadCount: data.downloadCount ?? 0,
        maxDownloads: data.maxDownloads ?? 0,
        note: data.note,
        companyId: data.companyId,
      } as FileShareRecord;
    });
  }
}
