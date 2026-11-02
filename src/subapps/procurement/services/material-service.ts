import 'server-only';

import admin from 'firebase-admin';
import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { sanitizeForFirestore } from '@/utils/firestore-sanitize';
import { generateMaterialId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
import { toAdminTimestampOrNull } from './procurement-timestamps';
import { ATOE_MASTER_CATEGORIES } from '@/config/boq-categories';
import { EntityAuditService } from '@/services/entity-audit.service';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { safeFireAndForget } from '@/lib/safe-fire-and-forget';
import { resolveForeignSku } from '@/server/supply-relationships/supply-foreign-quote.server';
import type { AuthContext } from '@/lib/auth';
import type { SupplierSkuLink, SupplierSkuRef } from '@/subapps/catalog/types/supply-relationship';
import {
  PROCUREMENT_RESOURCE,
  loadOwnedProcurementDoc,
  readOwnedProcurementDoc,
  softDeleteOwnedProcurementDoc,
} from './procurement-owned-doc';
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

/** Ο πόρος αυτού του αρχείου — ένα σημείο, ώστε το όνομα να μη διαφωνήσει ποτέ. */
const subjectOf = (materialId: string) =>
  ({ resource: PROCUREMENT_RESOURCE.MATERIAL, resourceId: materialId }) as const;

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

/**
 * ADR-923 §5.8: ο δεσμός με το SKU, κριμένος **στη στιγμή της εγγραφής** από τον ίδιο αναγνώστη με το BOQ.
 * Μία άρνηση για όλες τις αιτίες, ώστε το route να μην είναι όργανο απαρίθμησης ξένου καταλόγου (Σ7).
 */
async function resolveCatalogRef(ctx: AuthContext, link: SupplierSkuLink | null): Promise<SupplierSkuRef | null> {
  if (link === null) return null;
  const ref = await resolveForeignSku(ctx, link);
  if (ref === null) throw new MaterialValidationError('catalogLink', 'Catalog SKU is not available');
  return ref;
}

const skuLabel = (ref: SupplierSkuRef | null | undefined): string | null =>
  ref ? `${ref.supplierCompanyId}/${ref.variantId}` : null;

/** Το ιστορικό μιας εγγραφής υλικού — ένα σημείο για δημιουργία και αλλαγή. */
function recordMaterialChange(
  ctx: AuthContext,
  material: Pick<Material, 'id' | 'code' | 'name'>,
  action: 'created' | 'updated',
  changes: { field: string; oldValue: string | null; newValue: string | null }[],
): void {
  safeFireAndForget(
    EntityAuditService.recordChange({
      entityType: ENTITY_TYPES.MATERIAL,
      entityId: material.id,
      entityName: `${material.code} — ${material.name}`,
      action,
      changes,
      performedBy: ctx.uid,
      performedByName: null,
      companyId: ctx.companyId,
    }),
    action === 'created' ? 'material-service.create' : 'material-service.update',
  );
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
    const catalogRef = await resolveCatalogRef(ctx, dto.catalogLink ?? null);

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
      lastPurchaseDate: toAdminTimestampOrNull(dto.lastPurchaseDate),
      catalogRef,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
      createdBy: ctx.uid,
    };

    await db.collection(COLLECTIONS.MATERIALS).doc(id).set(sanitizeForFirestore(material));
    recordMaterialChange(ctx, material, 'created', []);
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
  // Δ — σιωπηλή πολιτική: ξένο ≡ ανύπαρκτο, ώστε η ανάγνωση να μη μαρτυρά
  // ύπαρξη ξένου id (ADR-742 §3.3). Το route απαντά ήδη `notFound` στο `null`.
  return safeFirestoreOperation(
    async (db) =>
      readOwnedProcurementDoc<Material>(
        db.collection(COLLECTIONS.MATERIALS).doc(materialId),
        ctx.companyId,
        subjectOf(materialId),
      ),
    null,
  );
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
    const { ref, current } = await loadOwnedProcurementDoc<Material>(
      db.collection(COLLECTIONS.MATERIALS).doc(materialId),
      ctx.companyId,
      subjectOf(materialId),
    );
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
      updates.lastPurchaseDate = toAdminTimestampOrNull(dto.lastPurchaseDate);
    }
    if (dto.catalogLink !== undefined) {
      updates.catalogRef = await resolveCatalogRef(ctx, dto.catalogLink);
    }

    await ref.update(sanitizeForFirestore(updates));
    const next = { ...current, id: materialId, ...updates } as Material;
    const [before, after] = [skuLabel(current.catalogRef), skuLabel(next.catalogRef)];
    recordMaterialChange(ctx, next, 'updated', before === after ? [] : [{ field: 'catalogRef', oldValue: before, newValue: after }]);
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
    const deleted = await softDeleteOwnedProcurementDoc<Material>({
      ref: db.collection(COLLECTIONS.MATERIALS).doc(materialId),
      companyId: ctx.companyId,
      performedBy: ctx.uid,
      subject: subjectOf(materialId),
      audit: (current) => ({
        entityType: ENTITY_TYPES.MATERIAL,
        entityName: `${current.code} — ${current.name}`,
      }),
      logTag: 'material-service.softDelete',
    });
    if (deleted) logger.info('Material soft-deleted', { id: materialId });
  });
}
