import 'server-only';

import admin from 'firebase-admin';
import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { sanitizeForFirestore } from '@/utils/firestore-sanitize';
import { generateMaterialId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
import { normalizeToDate } from '@/lib/date-local';
import { ATOE_MASTER_CATEGORIES } from '@/config/boq-categories';
import { EntityAuditService } from '@/services/entity-audit.service';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { safeFireAndForget } from '@/lib/safe-fire-and-forget';
import type { AuthContext } from '@/lib/auth';
import type {
  Material,
  CreateMaterialDTO,
  UpdateMaterialDTO,
  MaterialFilters,
} from '../types/material';
import {
  MAX_PREFERRED_SUPPLIERS,
  MaterialCodeConflictError,
  MaterialValidationError,
} from '../types/material';

const logger = createModuleLogger('MATERIAL_SERVICE');

const VALID_ATOE_CODES = new Set(ATOE_MASTER_CATEGORIES.map((c) => c.code));

// ============================================================================
// VALIDATION
// ============================================================================

function validateAtoeCategory(code: string): void {
  if (!VALID_ATOE_CODES.has(code)) {
    throw new MaterialValidationError(
      'atoeCategoryCode',
      `Invalid ATOE category code: ${code}`,
    );
  }
}

function validatePreferredSuppliers(ids: string[] | undefined): string[] {
  const list = ids ?? [];
  if (list.length > MAX_PREFERRED_SUPPLIERS) {
    throw new MaterialValidationError(
      'preferredSupplierContactIds',
      `Maximum ${MAX_PREFERRED_SUPPLIERS} preferred suppliers allowed`,
    );
  }
  // de-dupe
  return [...new Set(list)];
}

function validateCode(code: string): string {
  const trimmed = code.trim();
  if (!trimmed) {
    throw new MaterialValidationError('code', 'Material code is required');
  }
  if (trimmed.length > 50) {
    throw new MaterialValidationError('code', 'Material code must be ≤50 characters');
  }
  return trimmed;
}

function validateName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new MaterialValidationError('name', 'Material name is required');
  }
  if (trimmed.length > 200) {
    throw new MaterialValidationError('name', 'Material name must be ≤200 characters');
  }
  return trimmed;
}

async function ensureCodeUnique(
  db: FirebaseFirestore.Firestore,
  companyId: string,
  code: string,
  excludeMaterialId?: string,
): Promise<void> {
  const snap = await db
    .collection(COLLECTIONS.MATERIALS)
    .where('companyId', '==', companyId)
    .where('code', '==', code)
    .where('isDeleted', '==', false)
    .limit(2)
    .get();

  const conflict = snap.docs.find((d) => d.id !== excludeMaterialId);
  if (conflict) {
    throw new MaterialCodeConflictError(code, conflict.id);
  }
}

// ============================================================================
// CREATE
// ============================================================================

export async function createMaterial(
  ctx: AuthContext,
  dto: CreateMaterialDTO,
): Promise<Material> {
  return safeFirestoreOperation(async (db) => {
    const code = validateCode(dto.code);
    const name = validateName(dto.name);
    validateAtoeCategory(dto.atoeCategoryCode);
    const preferred = validatePreferredSuppliers(dto.preferredSupplierContactIds);
    await ensureCodeUnique(db, ctx.companyId, code);

    const id = generateMaterialId();
    const now = admin.firestore.Timestamp.now();
    const material: Material = {
      id,
      companyId: ctx.companyId,
      code,
      name,
      unit: dto.unit,
      atoeCategoryCode: dto.atoeCategoryCode,
      description: dto.description ?? null,
      preferredSupplierContactIds: preferred,
      avgPrice: dto.avgPrice ?? null,
      lastPrice: dto.lastPrice ?? null,
      lastPurchaseDate: dto.lastPurchaseDate
        ? admin.firestore.Timestamp.fromDate(normalizeToDate(dto.lastPurchaseDate) ?? new Date())
        : null,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
      createdBy: ctx.uid,
    };

    await db.collection(COLLECTIONS.MATERIALS).doc(id).set(sanitizeForFirestore(material));
    safeFireAndForget(
      EntityAuditService.recordChange({
        entityType: ENTITY_TYPES.MATERIAL,
        entityId: id,
        entityName: `${code} — ${name}`,
        action: 'created',
        changes: [],
        performedBy: ctx.uid,
        performedByName: null,
        companyId: ctx.companyId,
      }),
    );
    logger.info('Material created', { id, code, companyId: ctx.companyId });
    return material;
  });
}

// ============================================================================
// READ
// ============================================================================

export async function getMaterial(
  ctx: AuthContext,
  materialId: string,
): Promise<Material | null> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db.collection(COLLECTIONS.MATERIALS).doc(materialId).get();
    if (!snap.exists) return null;
    const material = { id: snap.id, ...snap.data() } as Material;
    if (material.companyId !== ctx.companyId) return null;
    return material;
  }, null);
}

export async function listMaterials(
  ctx: AuthContext,
  filters: MaterialFilters = {},
): Promise<Material[]> {
  return safeFirestoreOperation(async (db) => {
    let query = db
      .collection(COLLECTIONS.MATERIALS)
      .where('companyId', '==', ctx.companyId) as FirebaseFirestore.Query;

    if (!filters.includeDeleted) {
      query = query.where('isDeleted', '==', false);
    }
    if (filters.atoeCategoryCode) {
      query = query.where('atoeCategoryCode', '==', filters.atoeCategoryCode);
    }
    if (filters.supplierContactId) {
      query = query.where(
        'preferredSupplierContactIds',
        'array-contains',
        filters.supplierContactId,
      );
    }

    const snap = await query.orderBy('createdAt', 'desc').get();
    let items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Material));

    if (filters.search) {
      const q = filters.search.toLowerCase();
      items = items.filter(
        (m) =>
          m.code.toLowerCase().includes(q) || m.name.toLowerCase().includes(q),
      );
    }
    return items;
  }, []);
}

// ============================================================================
// UPDATE
// ============================================================================

export async function updateMaterial(
  ctx: AuthContext,
  materialId: string,
  dto: UpdateMaterialDTO,
): Promise<Material> {
  return safeFirestoreOperation(async (db) => {
    const ref = db.collection(COLLECTIONS.MATERIALS).doc(materialId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error(`Material ${materialId} not found`);

    const current = { id: snap.id, ...snap.data() } as Material;
    if (current.companyId !== ctx.companyId) throw new Error('Forbidden');
    if (current.isDeleted) throw new Error('Cannot update a deleted material');

    const updates: Partial<Material> = {
      updatedAt: admin.firestore.Timestamp.now(),
    };

    if (dto.code !== undefined && dto.code !== current.code) {
      const newCode = validateCode(dto.code);
      await ensureCodeUnique(db, ctx.companyId, newCode, materialId);
      updates.code = newCode;
    }
    if (dto.name !== undefined) updates.name = validateName(dto.name);
    if (dto.unit !== undefined) updates.unit = dto.unit;
    if (dto.atoeCategoryCode !== undefined) {
      validateAtoeCategory(dto.atoeCategoryCode);
      updates.atoeCategoryCode = dto.atoeCategoryCode;
    }
    if (dto.description !== undefined) updates.description = dto.description;
    if (dto.preferredSupplierContactIds !== undefined) {
      updates.preferredSupplierContactIds = validatePreferredSuppliers(
        dto.preferredSupplierContactIds,
      );
    }
    if (dto.avgPrice !== undefined) updates.avgPrice = dto.avgPrice;
    if (dto.lastPrice !== undefined) updates.lastPrice = dto.lastPrice;
    if (dto.lastPurchaseDate !== undefined) {
      updates.lastPurchaseDate = dto.lastPurchaseDate
        ? admin.firestore.Timestamp.fromDate(
            normalizeToDate(dto.lastPurchaseDate) ?? new Date(),
          )
        : null;
    }

    await ref.update(sanitizeForFirestore(updates));
    const next = { ...current, ...updates } as Material;
    safeFireAndForget(
      EntityAuditService.recordChange({
        entityType: ENTITY_TYPES.MATERIAL,
        entityId: materialId,
        entityName: `${next.code} — ${next.name}`,
        action: 'updated',
        changes: [],
        performedBy: ctx.uid,
        performedByName: null,
        companyId: ctx.companyId,
      }),
    );
    logger.info('Material updated', { id: materialId, fields: Object.keys(updates) });
    return next;
  });
}

// ============================================================================
// SOFT DELETE
// ============================================================================

export async function softDeleteMaterial(
  ctx: AuthContext,
  materialId: string,
): Promise<void> {
  return safeFirestoreOperation(async (db) => {
    const ref = db.collection(COLLECTIONS.MATERIALS).doc(materialId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error(`Material ${materialId} not found`);
    const current = { id: snap.id, ...snap.data() } as Material;
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
        entityType: ENTITY_TYPES.MATERIAL,
        entityId: materialId,
        entityName: `${current.code} — ${current.name}`,
        action: 'soft_deleted',
        changes: [],
        performedBy: ctx.uid,
        performedByName: null,
        companyId: ctx.companyId,
      }),
    );
    logger.info('Material soft-deleted', { id: materialId });
  });
}
