/**
 * =============================================================================
 * UNIFIED SHARING SERVICE — SSoT (ADR-315 Phase M1)
 * =============================================================================
 *
 * Single source of truth for shareable-link lifecycle across file / contact /
 * property_showcase. Replaces FileShareService (file-only) with a polymorphic
 * design driven by ShareEntityRegistry.
 *
 * This module is SSoT-locked (see `.ssot-registry.json` → `unified-sharing-service`).
 * Direct reads/writes on `shares` from other modules are forbidden.
 *
 * Scope of Phase M1 (skeleton):
 *   - Token lifecycle only (create / validate / revoke / count / list)
 *   - Password hashing kept as SHA-256 (legacy parity). Phase M2 migrates to
 *     bcrypt via Cloud Function `validatePasswordedShare`.
 *   - No public route, no dispatch, no UI. Those land in M3–M4.
 *
 * @module services/sharing/unified-sharing.service
 * @ssot unified-sharing-service
 * @see adrs/ADR-315-unified-sharing.md
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  limit as fsLimit,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { generateShareId } from '@/services/enterprise-id-convenience';
import { ShareEntityRegistry } from '@/services/sharing/share-entity-registry';
import type {
  CreateShareInput,
  CreateShareResult,
  ShareEntityType,
  ShareRecord,
  ShareValidation,
  AuthorizedUser,
} from '@/types/sharing';

const logger = createModuleLogger('UnifiedSharingService');

const DEFAULT_EXPIRES_IN_HOURS = 72;
const TOKEN_LENGTH = 32;
const TOKEN_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

// ============================================================================
// TOKEN + PASSWORD UTILITIES
// ============================================================================

function generateToken(length = TOKEN_LENGTH): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => TOKEN_CHARS[byte % TOKEN_CHARS.length]).join('');
}

/**
 * M1: SHA-256 client-side (legacy parity with FileShareService). Phase M2
 * migrates to server-side bcrypt via Cloud Function.
 */
async function hashPasswordLegacy(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ============================================================================
// RECORD HYDRATION (Firestore doc → ShareRecord)
// ============================================================================

function hydrateShareRecord(id: string, data: Record<string, unknown>): ShareRecord {
  return {
    id,
    token: data.token as string,
    entityType: data.entityType as ShareEntityType,
    entityId: data.entityId as string,
    companyId: data.companyId as string,
    createdBy: data.createdBy as string,
    createdAt: (data.createdAt as ShareRecord['createdAt']) ?? '',
    expiresAt: data.expiresAt as string,
    isActive: (data.isActive as boolean) ?? false,
    revokedAt: (data.revokedAt as ShareRecord['revokedAt']) ?? null,
    revokedBy: (data.revokedBy as string | null) ?? null,
    requiresPassword: (data.requiresPassword as boolean) ?? false,
    passwordHash: (data.passwordHash as string | null) ?? null,
    maxAccesses: (data.maxAccesses as number) ?? 0,
    accessCount: (data.accessCount as number) ?? 0,
    lastAccessedAt: (data.lastAccessedAt as ShareRecord['lastAccessedAt']) ?? null,
    note: (data.note as string | null) ?? null,
    showcaseMeta: (data.showcaseMeta as ShareRecord['showcaseMeta']) ?? null,
    contactMeta: (data.contactMeta as ShareRecord['contactMeta']) ?? null,
    fileMeta: (data.fileMeta as ShareRecord['fileMeta']) ?? null,
  };
}

// ============================================================================
// SERVICE
// ============================================================================

export class UnifiedSharingService {
  /**
   * Create a shareable token for any registered entity type.
   * Delegates entity-specific validation to ShareEntityRegistry when a
   * resolver is registered (M3+). In M1 (no resolvers) the input is trusted.
   */
  static async createShare(input: CreateShareInput): Promise<CreateShareResult> {
    const definition = ShareEntityRegistry.get(input.entityType);
    if (definition) {
      const result = definition.validateCreateInput(input);
      if (!result.valid) {
        throw new Error(`Invalid share input: ${result.reason ?? 'unknown'}`);
      }
    }

    const expiresInHours = input.expiresInHours ?? DEFAULT_EXPIRES_IN_HOURS;
    const expiresAtDate = new Date();
    expiresAtDate.setHours(expiresAtDate.getHours() + expiresInHours);
    const expiresAt = expiresAtDate.toISOString();

    const shareId = generateShareId();
    const token = generateToken();

    const passwordHash = input.password
      ? await hashPasswordLegacy(input.password)
      : null;

    const payload: Record<string, unknown> = {
      token,
      entityType: input.entityType,
      entityId: input.entityId,
      companyId: input.companyId,
      createdBy: input.createdBy,
      createdAt: serverTimestamp(),
      expiresAt,
      isActive: true,
      requiresPassword: !!input.password,
      passwordHash,
      maxAccesses: input.maxAccesses ?? 0,
      accessCount: 0,
      note: input.note ?? null,
      ...(input.showcaseMeta ? { showcaseMeta: input.showcaseMeta } : {}),
      ...(input.contactMeta ? { contactMeta: input.contactMeta } : {}),
      ...(input.fileMeta ? { fileMeta: input.fileMeta } : {}),
    };

    await setDoc(doc(db, COLLECTIONS.SHARES, shareId), payload);

    logger.info('Share created', {
      shareId,
      entityType: input.entityType,
      requiresPassword: !!input.password,
      expiresAt,
    });

    return { shareId, token, expiresAt };
  }

  /**
   * Validate a public share token. Returns hydrated ShareRecord on success,
   * reason string on failure. Anonymous access path — no companyId filter.
   */
  static async validateShare(token: string): Promise<ShareValidation> {
    const q = query(
      collection(db, COLLECTIONS.SHARES),
      where('token', '==', token), // companyId: N/A — anonymous public token-based share validation
      where('isActive', '==', true),
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      return { valid: false, reason: 'Share link not found or deactivated' };
    }

    const docSnap = snap.docs[0];
    const share = hydrateShareRecord(docSnap.id, docSnap.data());

    if (new Date(share.expiresAt) < new Date()) {
      return { valid: false, reason: 'Share link has expired' };
    }

    if (share.maxAccesses > 0 && share.accessCount >= share.maxAccesses) {
      return { valid: false, reason: 'Access limit reached' };
    }

    return { valid: true, share };
  }

  /**
   * Verify password against stored hash.
   * M1: SHA-256 legacy parity. M2 migrates to bcrypt via Cloud Function.
   */
  static async verifyPassword(share: ShareRecord, password: string): Promise<boolean> {
    if (!share.requiresPassword || !share.passwordHash) return true;
    const hash = await hashPasswordLegacy(password);
    return hash === share.passwordHash;
  }

  static async incrementAccessCount(shareId: string): Promise<void> {
    const ref = doc(db, COLLECTIONS.SHARES, shareId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const current = (snap.data().accessCount as number | undefined) ?? 0;
    await updateDoc(ref, {
      accessCount: current + 1,
      lastAccessedAt: serverTimestamp(),
    });
  }

  static async revoke(shareId: string, revokedBy: string): Promise<void> {
    const ref = doc(db, COLLECTIONS.SHARES, shareId);
    await updateDoc(ref, {
      isActive: false,
      revokedAt: serverTimestamp(),
      revokedBy,
    });
    logger.info('Share revoked', { shareId, revokedBy });
  }

  static async listSharesForEntity(
    entityType: ShareEntityType,
    entityId: string,
    companyId: string,
  ): Promise<ShareRecord[]> {
    const q = query(
      collection(db, COLLECTIONS.SHARES),
      where('companyId', '==', companyId),
      where('entityType', '==', entityType),
      where('entityId', '==', entityId),
      where('isActive', '==', true),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => hydrateShareRecord(d.id, d.data()));
  }

  static async listSharesForCompany(
    companyId: string,
    entityType: ShareEntityType,
    limit = 50,
  ): Promise<ShareRecord[]> {
    const q = query(
      collection(db, COLLECTIONS.SHARES),
      where('companyId', '==', companyId),
      where('entityType', '==', entityType),
      orderBy('createdAt', 'desc'),
      fsLimit(limit),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => hydrateShareRecord(d.id, d.data()));
  }

  /**
   * Authorization hook. Delegates to registered resolver; returns false if
   * no resolver is registered for the entity type (M1 fail-closed default).
   */
  static async canShare(
    user: AuthorizedUser,
    entityType: ShareEntityType,
    entityId: string,
  ): Promise<boolean> {
    const definition = ShareEntityRegistry.get(entityType);
    if (!definition) return false;
    return definition.canShare(user, entityId);
  }
}
