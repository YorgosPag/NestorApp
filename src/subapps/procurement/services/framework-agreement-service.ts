import 'server-only';

import admin from 'firebase-admin';
import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { sanitizeForFirestore } from '@/utils/firestore-sanitize';
import { generateFrameworkAgreementId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
import { normalizeToDate } from '@/lib/date-local';
import { EntityAuditService } from '@/services/entity-audit.service';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { safeFireAndForget } from '@/lib/safe-fire-and-forget';
import type { AuthContext } from '@/lib/auth';
import type {
  FrameworkAgreement,
  CreateFrameworkAgreementDTO,
  UpdateFrameworkAgreementDTO,
  FrameworkAgreementFilters,
  VolumeBreakpoint,
} from '../types/framework-agreement';
import {
  FRAMEWORK_AGREEMENT_STATUSES,
  DISCOUNT_TYPES,
  FrameworkAgreementNumberConflictError,
  FrameworkAgreementValidationError,
} from '../types/framework-agreement';

const logger = createModuleLogger('FRAMEWORK_AGREEMENT_SERVICE');

const VALID_STATUSES = new Set<string>(FRAMEWORK_AGREEMENT_STATUSES);
const VALID_DISCOUNT_TYPES = new Set<string>(DISCOUNT_TYPES);

// ============================================================================
// VALIDATION
// ============================================================================

function validateAgreementNumber(agreementNumber: string): string {
  const trimmed = agreementNumber.trim();
  if (!trimmed) {
    throw new FrameworkAgreementValidationError('agreementNumber', 'Agreement number is required');
  }
  if (trimmed.length > 50) {
    throw new FrameworkAgreementValidationError(
      'agreementNumber',
      'Agreement number must be ≤50 characters',
    );
  }
  return trimmed;
}

function validateTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) {
    throw new FrameworkAgreementValidationError('title', 'Title is required');
  }
  if (trimmed.length > 200) {
    throw new FrameworkAgreementValidationError('title', 'Title must be ≤200 characters');
  }
  return trimmed;
}

function validateStatus(status: string | undefined): string {
  const value = status ?? 'draft';
  if (!VALID_STATUSES.has(value)) {
    throw new FrameworkAgreementValidationError('status', `Invalid status: ${value}`);
  }
  return value;
}

function validateDiscountType(discountType: string): string {
  if (!VALID_DISCOUNT_TYPES.has(discountType)) {
    throw new FrameworkAgreementValidationError(
      'discountType',
      `Invalid discount type: ${discountType}`,
    );
  }
  return discountType;
}

function validateBreakpoints(
  breakpoints: VolumeBreakpoint[] | undefined,
): VolumeBreakpoint[] {
  const list = breakpoints ?? [];
  for (const bp of list) {
    if (typeof bp.thresholdEur !== 'number' || bp.thresholdEur < 0) {
      throw new FrameworkAgreementValidationError(
        'volumeBreakpoints',
        'thresholdEur must be a non-negative number',
      );
    }
    if (
      typeof bp.discountPercent !== 'number' ||
      bp.discountPercent < 0 ||
      bp.discountPercent > 100
    ) {
      throw new FrameworkAgreementValidationError(
        'volumeBreakpoints',
        'discountPercent must be between 0 and 100',
      );
    }
  }
  // sort ASC by threshold
  return [...list].sort((a, b) => a.thresholdEur - b.thresholdEur);
}

function validateValidityRange(validFromIso: string, validUntilIso: string): { from: Date; until: Date } {
  const from = normalizeToDate(validFromIso);
  const until = normalizeToDate(validUntilIso);
  if (!from) {
    throw new FrameworkAgreementValidationError('validFrom', 'Invalid validFrom date');
  }
  if (!until) {
    throw new FrameworkAgreementValidationError('validUntil', 'Invalid validUntil date');
  }
  if (from.getTime() >= until.getTime()) {
    throw new FrameworkAgreementValidationError(
      'validUntil',
      'validUntil must be after validFrom',
    );
  }
  return { from, until };
}

function validateFlatPercent(percent: number | null | undefined): number | null {
  if (percent === null || percent === undefined) return null;
  if (typeof percent !== 'number' || percent < 0 || percent > 100) {
    throw new FrameworkAgreementValidationError(
      'flatDiscountPercent',
      'flatDiscountPercent must be between 0 and 100',
    );
  }
  return percent;
}

async function ensureAgreementNumberUnique(
  db: FirebaseFirestore.Firestore,
  companyId: string,
  agreementNumber: string,
  excludeAgreementId?: string,
): Promise<void> {
  const snap = await db
    .collection(COLLECTIONS.FRAMEWORK_AGREEMENTS)
    .where('companyId', '==', companyId)
    .where('agreementNumber', '==', agreementNumber)
    .where('isDeleted', '==', false)
    .limit(2)
    .get();

  const conflict = snap.docs.find((d) => d.id !== excludeAgreementId);
  if (conflict) {
    throw new FrameworkAgreementNumberConflictError(agreementNumber, conflict.id);
  }
}

// ============================================================================
// CREATE
// ============================================================================

export async function createFrameworkAgreement(
  ctx: AuthContext,
  dto: CreateFrameworkAgreementDTO,
): Promise<FrameworkAgreement> {
  return safeFirestoreOperation(async (db) => {
    const agreementNumber = validateAgreementNumber(dto.agreementNumber);
    const title = validateTitle(dto.title);
    const status = validateStatus(dto.status) as FrameworkAgreement['status'];
    const discountType = validateDiscountType(dto.discountType) as FrameworkAgreement['discountType'];
    const flatDiscountPercent = validateFlatPercent(dto.flatDiscountPercent);
    const breakpoints = validateBreakpoints(dto.volumeBreakpoints);
    const { from, until } = validateValidityRange(dto.validFrom, dto.validUntil);

    if (!dto.vendorContactId) {
      throw new FrameworkAgreementValidationError('vendorContactId', 'vendorContactId is required');
    }

    await ensureAgreementNumberUnique(db, ctx.companyId, agreementNumber);

    const id = generateFrameworkAgreementId();
    const now = admin.firestore.Timestamp.now();
    const agreement: FrameworkAgreement = {
      id,
      companyId: ctx.companyId,
      agreementNumber,
      title,
      description: dto.description ?? null,
      vendorContactId: dto.vendorContactId,
      status,
      validFrom: admin.firestore.Timestamp.fromDate(from),
      validUntil: admin.firestore.Timestamp.fromDate(until),
      applicableProjectIds: dto.applicableProjectIds ?? null,
      applicableMaterialIds: dto.applicableMaterialIds ?? null,
      applicableAtoeCategoryCodes: dto.applicableAtoeCategoryCodes ?? null,
      currency: dto.currency ?? 'EUR',
      totalCommitment: dto.totalCommitment ?? null,
      discountType,
      flatDiscountPercent,
      volumeBreakpoints: breakpoints,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
      createdBy: ctx.uid,
    };

    await db
      .collection(COLLECTIONS.FRAMEWORK_AGREEMENTS)
      .doc(id)
      .set(sanitizeForFirestore(agreement));

    safeFireAndForget(
      EntityAuditService.recordChange({
        entityType: ENTITY_TYPES.FRAMEWORK_AGREEMENT,
        entityId: id,
        entityName: `${agreementNumber} — ${title}`,
        action: 'created',
        changes: [],
        performedBy: ctx.uid,
        performedByName: null,
        companyId: ctx.companyId,
      }),
    );
    logger.info('Framework agreement created', { id, agreementNumber, companyId: ctx.companyId });
    return agreement;
  });
}

// ============================================================================
// READ
// ============================================================================

export async function getFrameworkAgreement(
  ctx: AuthContext,
  agreementId: string,
): Promise<FrameworkAgreement | null> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db.collection(COLLECTIONS.FRAMEWORK_AGREEMENTS).doc(agreementId).get();
    if (!snap.exists) return null;
    const agreement = { id: snap.id, ...snap.data() } as FrameworkAgreement;
    if (agreement.companyId !== ctx.companyId) return null;
    return agreement;
  }, null);
}

export async function listFrameworkAgreements(
  ctx: AuthContext,
  filters: FrameworkAgreementFilters = {},
): Promise<FrameworkAgreement[]> {
  return safeFirestoreOperation(async (db) => {
    let query = db
      .collection(COLLECTIONS.FRAMEWORK_AGREEMENTS)
      .where('companyId', '==', ctx.companyId) as FirebaseFirestore.Query;

    if (!filters.includeDeleted) {
      query = query.where('isDeleted', '==', false);
    }
    if (filters.status) {
      query = query.where('status', '==', filters.status);
    }
    if (filters.vendorContactId) {
      query = query.where('vendorContactId', '==', filters.vendorContactId);
    }

    const snap = await query.orderBy('createdAt', 'desc').get();
    let items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as FrameworkAgreement));

    if (filters.search) {
      const q = filters.search.toLowerCase();
      items = items.filter(
        (a) =>
          a.agreementNumber.toLowerCase().includes(q) ||
          a.title.toLowerCase().includes(q),
      );
    }
    return items;
  }, []);
}

// ============================================================================
// UPDATE
// ============================================================================

export async function updateFrameworkAgreement(
  ctx: AuthContext,
  agreementId: string,
  dto: UpdateFrameworkAgreementDTO,
): Promise<FrameworkAgreement> {
  return safeFirestoreOperation(async (db) => {
    const ref = db.collection(COLLECTIONS.FRAMEWORK_AGREEMENTS).doc(agreementId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error(`Framework agreement ${agreementId} not found`);

    const current = { id: snap.id, ...snap.data() } as FrameworkAgreement;
    if (current.companyId !== ctx.companyId) throw new Error('Forbidden');
    if (current.isDeleted) throw new Error('Cannot update a deleted framework agreement');

    const updates: Partial<FrameworkAgreement> = {
      updatedAt: admin.firestore.Timestamp.now(),
    };

    if (dto.agreementNumber !== undefined && dto.agreementNumber !== current.agreementNumber) {
      const next = validateAgreementNumber(dto.agreementNumber);
      await ensureAgreementNumberUnique(db, ctx.companyId, next, agreementId);
      updates.agreementNumber = next;
    }
    if (dto.title !== undefined) updates.title = validateTitle(dto.title);
    if (dto.description !== undefined) updates.description = dto.description;
    if (dto.vendorContactId !== undefined) {
      if (!dto.vendorContactId) {
        throw new FrameworkAgreementValidationError(
          'vendorContactId',
          'vendorContactId cannot be empty',
        );
      }
      updates.vendorContactId = dto.vendorContactId;
    }
    if (dto.status !== undefined) {
      updates.status = validateStatus(dto.status) as FrameworkAgreement['status'];
    }
    if (dto.validFrom !== undefined || dto.validUntil !== undefined) {
      const fromIso =
        dto.validFrom ?? current.validFrom.toDate().toISOString();
      const untilIso =
        dto.validUntil ?? current.validUntil.toDate().toISOString();
      const { from, until } = validateValidityRange(fromIso, untilIso);
      updates.validFrom = admin.firestore.Timestamp.fromDate(from);
      updates.validUntil = admin.firestore.Timestamp.fromDate(until);
    }
    if (dto.applicableProjectIds !== undefined) {
      updates.applicableProjectIds = dto.applicableProjectIds;
    }
    if (dto.applicableMaterialIds !== undefined) {
      updates.applicableMaterialIds = dto.applicableMaterialIds;
    }
    if (dto.applicableAtoeCategoryCodes !== undefined) {
      updates.applicableAtoeCategoryCodes = dto.applicableAtoeCategoryCodes;
    }
    if (dto.currency !== undefined) updates.currency = dto.currency;
    if (dto.totalCommitment !== undefined) updates.totalCommitment = dto.totalCommitment;
    if (dto.discountType !== undefined) {
      updates.discountType = validateDiscountType(dto.discountType) as FrameworkAgreement['discountType'];
    }
    if (dto.flatDiscountPercent !== undefined) {
      updates.flatDiscountPercent = validateFlatPercent(dto.flatDiscountPercent);
    }
    if (dto.volumeBreakpoints !== undefined) {
      updates.volumeBreakpoints = validateBreakpoints(dto.volumeBreakpoints);
    }

    await ref.update(sanitizeForFirestore(updates));
    const next = { ...current, ...updates } as FrameworkAgreement;
    safeFireAndForget(
      EntityAuditService.recordChange({
        entityType: ENTITY_TYPES.FRAMEWORK_AGREEMENT,
        entityId: agreementId,
        entityName: `${next.agreementNumber} — ${next.title}`,
        action: 'updated',
        changes: [],
        performedBy: ctx.uid,
        performedByName: null,
        companyId: ctx.companyId,
      }),
    );
    logger.info('Framework agreement updated', {
      id: agreementId,
      fields: Object.keys(updates),
    });
    return next;
  });
}

// ============================================================================
// SOFT DELETE
// ============================================================================

export async function softDeleteFrameworkAgreement(
  ctx: AuthContext,
  agreementId: string,
): Promise<void> {
  return safeFirestoreOperation(async (db) => {
    const ref = db.collection(COLLECTIONS.FRAMEWORK_AGREEMENTS).doc(agreementId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error(`Framework agreement ${agreementId} not found`);
    const current = { id: snap.id, ...snap.data() } as FrameworkAgreement;
    if (current.companyId !== ctx.companyId) throw new Error('Forbidden');
    if (current.isDeleted) return;

    await ref.update(
      sanitizeForFirestore({
        isDeleted: true,
        updatedAt: admin.firestore.Timestamp.now(),
      }),
    );
    safeFireAndForget(
      EntityAuditService.recordChange({
        entityType: ENTITY_TYPES.FRAMEWORK_AGREEMENT,
        entityId: agreementId,
        entityName: `${current.agreementNumber} — ${current.title}`,
        action: 'soft_deleted',
        changes: [],
        performedBy: ctx.uid,
        performedByName: null,
        companyId: ctx.companyId,
      }),
    );
    logger.info('Framework agreement soft-deleted', { id: agreementId });
  });
}
