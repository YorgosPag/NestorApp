/**
 * Firestore BOQ Repository — CRUD Operations
 *
 * Firestore CRUD για BOQ items και categories.
 * Pattern: src/services/obligations/InMemoryObligationsRepository.ts
 *
 * @module services/measurements/boq-repository
 * @see ADR-175 (Quantity Surveying / BOQ)
 */

import {
  collection,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { ATOE_MASTER_CATEGORIES } from '@/config/boq-categories';
import { createModuleLogger } from '@/lib/telemetry';
import type {
  BOQItem,
  BOQCategory,
  BOQItemStatus,
  CreateBOQItemInput,
  UpdateBOQItemInput,
} from '@/types/boq';
import { BOQ_ITEM_DEFAULTS } from '@/types/boq';
import type { IBOQRepository, BOQSearchFilters, BOQStats } from './contracts';

const logger = createModuleLogger('FirestoreBOQRepository');

// ============================================================================
// NORMALIZERS — Firestore → Domain
// ============================================================================

const toDateString = (value: unknown): string => {
  if (typeof value === 'string') return value;

  if (value && typeof value === 'object') {
    const candidate = value as {
      toDate?: () => Date;
      seconds?: number;
      nanoseconds?: number;
    };

    try {
      if (typeof candidate.toDate === 'function') {
        return candidate.toDate().toISOString();
      }
    } catch {
      // Ignore malformed timestamps
    }

    if (typeof candidate.seconds === 'number') {
      const millis = candidate.seconds * 1000 + Math.floor((candidate.nanoseconds ?? 0) / 1000000);
      return new Date(millis).toISOString();
    }
  }

  return new Date().toISOString();
};

/**
 * Strip undefined values deep — Firestore rejects undefined
 */
const stripUndefined = <T extends Record<string, unknown>>(obj: T): T => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result as T;
};

/**
 * Normalize Firestore document → BOQItem
 * Every optional field → ?? null
 */
const normalizeBOQItem = (id: string, data: Record<string, unknown>): BOQItem => ({
  id,
  companyId: (data.companyId as string) ?? '',
  projectId: (data.projectId as string) ?? '',
  buildingId: (data.buildingId as string) ?? '',
  scope: (data.scope as BOQItem['scope']) ?? 'building',
  linkedUnitId: (data.linkedUnitId as string) ?? null,
  categoryCode: (data.categoryCode as string) ?? '',
  title: (data.title as string) ?? '',
  description: (data.description as string) ?? null,
  unit: (data.unit as BOQItem['unit']) ?? 'm2',
  estimatedQuantity: (data.estimatedQuantity as number) ?? 0,
  actualQuantity: (data.actualQuantity as number) ?? null,
  wasteFactor: (data.wasteFactor as number) ?? 0,
  wastePolicy: (data.wastePolicy as BOQItem['wastePolicy']) ?? 'inherited',
  materialUnitCost: (data.materialUnitCost as number) ?? 0,
  laborUnitCost: (data.laborUnitCost as number) ?? 0,
  equipmentUnitCost: (data.equipmentUnitCost as number) ?? 0,
  priceAuthority: (data.priceAuthority as BOQItem['priceAuthority']) ?? 'master',
  linkedPhaseId: (data.linkedPhaseId as string) ?? null,
  linkedTaskId: (data.linkedTaskId as string) ?? null,
  linkedInvoiceId: (data.linkedInvoiceId as string) ?? null,
  linkedContractorId: (data.linkedContractorId as string) ?? null,
  source: (data.source as BOQItem['source']) ?? 'manual',
  measurementMethod: (data.measurementMethod as BOQItem['measurementMethod']) ?? 'manual',
  status: (data.status as BOQItemStatus) ?? 'draft',
  qaStatus: (data.qaStatus as BOQItem['qaStatus']) ?? 'pending',
  notes: (data.notes as string) ?? null,
  createdBy: (data.createdBy as string) ?? null,
  approvedBy: (data.approvedBy as string) ?? null,
  createdAt: toDateString(data.createdAt),
  updatedAt: toDateString(data.updatedAt),
});

const normalizeBOQItemSafe = (id: string, data: Record<string, unknown>): BOQItem | null => {
  try {
    return normalizeBOQItem(id, data);
  } catch (error) {
    logger.error('Error normalizing BOQ item', { error, itemId: id });
    return null;
  }
};

/**
 * Normalize Firestore document → BOQCategory
 */
const normalizeBOQCategory = (id: string, data: Record<string, unknown>): BOQCategory => ({
  id,
  companyId: (data.companyId as string) ?? '',
  code: (data.code as string) ?? '',
  nameEL: (data.nameEL as string) ?? '',
  nameEN: (data.nameEN as string) ?? '',
  description: (data.description as string) ?? null,
  level: (data.level as BOQCategory['level']) ?? 'group',
  parentId: (data.parentId as string) ?? null,
  sortOrder: (data.sortOrder as number) ?? 0,
  defaultWasteFactor: (data.defaultWasteFactor as number) ?? 0,
  allowedUnits: (data.allowedUnits as BOQCategory['allowedUnits']) ?? ['m2'],
  isActive: (data.isActive as boolean) ?? true,
  createdAt: toDateString(data.createdAt),
  updatedAt: toDateString(data.updatedAt),
});

// ============================================================================
// REPOSITORY IMPLEMENTATION
// ============================================================================

export class FirestoreBOQRepository implements IBOQRepository {

  async getByBuilding(buildingId: string): Promise<BOQItem[]> {
    try {
      const boqQuery = query(
        collection(db, COLLECTIONS.BOQ_ITEMS),
        where('buildingId', '==', buildingId),
        orderBy('categoryCode', 'asc')
      );

      const snapshot = await getDocs(boqQuery);
      return snapshot.docs
        .map((document) => normalizeBOQItemSafe(document.id, document.data() as Record<string, unknown>))
        .filter((item): item is BOQItem => item !== null);
    } catch (error) {
      logger.error('Error fetching BOQ items by building', { error, buildingId });
      return [];
    }
  }

  async getById(id: string): Promise<BOQItem | null> {
    try {
      const docRef = doc(db, COLLECTIONS.BOQ_ITEMS, id);
      const snapshot = await getDoc(docRef);

      if (!snapshot.exists()) {
        return null;
      }

      return normalizeBOQItemSafe(snapshot.id, snapshot.data() as Record<string, unknown>);
    } catch (error) {
      logger.error('Error fetching BOQ item by ID', { error, id });
      return null;
    }
  }

  async create(data: CreateBOQItemInput, userId: string, companyId: string): Promise<BOQItem> {
    const now = new Date().toISOString();

    const newItem: Omit<BOQItem, 'id'> = {
      companyId,
      projectId: data.projectId,
      buildingId: data.buildingId,
      scope: data.scope ?? BOQ_ITEM_DEFAULTS.scope,
      linkedUnitId: data.linkedUnitId ?? null,
      categoryCode: data.categoryCode,
      title: data.title,
      description: data.description ?? null,
      unit: data.unit,
      estimatedQuantity: data.estimatedQuantity,
      actualQuantity: null,
      wasteFactor: data.wasteFactor ?? BOQ_ITEM_DEFAULTS.wasteFactor,
      wastePolicy: BOQ_ITEM_DEFAULTS.wastePolicy,
      materialUnitCost: data.materialUnitCost ?? BOQ_ITEM_DEFAULTS.materialUnitCost,
      laborUnitCost: data.laborUnitCost ?? BOQ_ITEM_DEFAULTS.laborUnitCost,
      equipmentUnitCost: data.equipmentUnitCost ?? BOQ_ITEM_DEFAULTS.equipmentUnitCost,
      priceAuthority: BOQ_ITEM_DEFAULTS.priceAuthority,
      linkedPhaseId: data.linkedPhaseId ?? null,
      linkedTaskId: data.linkedTaskId ?? null,
      linkedInvoiceId: null,
      linkedContractorId: null,
      source: data.source ?? BOQ_ITEM_DEFAULTS.source,
      measurementMethod: data.measurementMethod ?? BOQ_ITEM_DEFAULTS.measurementMethod,
      status: BOQ_ITEM_DEFAULTS.status,
      qaStatus: BOQ_ITEM_DEFAULTS.qaStatus,
      notes: data.notes ?? null,
      createdBy: userId,
      approvedBy: null,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(
      collection(db, COLLECTIONS.BOQ_ITEMS),
      stripUndefined(newItem as unknown as Record<string, unknown>)
    );

    return { id: docRef.id, ...newItem };
  }

  async update(id: string, data: UpdateBOQItemInput): Promise<BOQItem | null> {
    try {
      const current = await this.getById(id);
      if (!current) {
        return null;
      }

      const updatePayload: Record<string, unknown> = {
        ...data,
        updatedAt: new Date().toISOString(),
      };

      // Ensure no undefined values reach Firestore
      const sanitized = stripUndefined(updatePayload);

      const docRef = doc(db, COLLECTIONS.BOQ_ITEMS, id);
      await updateDoc(docRef, sanitized);

      return await this.getById(id);
    } catch (error) {
      logger.error('Error updating BOQ item', { error, id });
      return null;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const docRef = doc(db, COLLECTIONS.BOQ_ITEMS, id);
      await deleteDoc(docRef);
      return true;
    } catch (error) {
      logger.error('Error deleting BOQ item', { error, id });
      return false;
    }
  }

  async bulkDelete(ids: string[]): Promise<number> {
    let deletedCount = 0;
    for (const id of ids) {
      const success = await this.delete(id);
      if (success) {
        deletedCount += 1;
      }
    }
    return deletedCount;
  }

  async duplicate(id: string): Promise<BOQItem | null> {
    try {
      const original = await this.getById(id);
      if (!original) return null;

      const now = new Date().toISOString();
      const duplicateData: Omit<BOQItem, 'id'> = {
        ...original,
        title: `${original.title} — Αντίγραφο`,
        status: 'draft',
        qaStatus: 'pending',
        source: 'duplicate',
        actualQuantity: null,
        approvedBy: null,
        createdAt: now,
        updatedAt: now,
      };

      // Remove the id before writing
      const { ...payload } = duplicateData;

      const docRef = await addDoc(
        collection(db, COLLECTIONS.BOQ_ITEMS),
        stripUndefined(payload as unknown as Record<string, unknown>)
      );

      return { id: docRef.id, ...duplicateData };
    } catch (error) {
      logger.error('Error duplicating BOQ item', { error, id });
      return null;
    }
  }

  async updateStatus(id: string, status: BOQItemStatus, userId: string): Promise<boolean> {
    try {
      const docRef = doc(db, COLLECTIONS.BOQ_ITEMS, id);
      const updateData: Record<string, unknown> = {
        status,
        updatedAt: new Date().toISOString(),
      };

      if (status === 'approved') {
        updateData.approvedBy = userId;
      }

      await updateDoc(docRef, updateData);
      return true;
    } catch (error) {
      logger.error('Error updating BOQ item status', { error, id, status });
      return false;
    }
  }

  async search(buildingId: string, filters?: BOQSearchFilters): Promise<BOQItem[]> {
    try {
      const baseRef = collection(db, COLLECTIONS.BOQ_ITEMS);
      const constraints: QueryConstraint[] = [where('buildingId', '==', buildingId)];

      if (filters?.categoryCode) {
        constraints.push(where('categoryCode', '==', filters.categoryCode));
      }

      if (filters?.status && filters.status !== 'all') {
        constraints.push(where('status', '==', filters.status));
      }

      if (filters?.source) {
        constraints.push(where('source', '==', filters.source));
      }

      if (filters?.scope) {
        constraints.push(where('scope', '==', filters.scope));
      }

      if (filters?.linkedPhaseId) {
        constraints.push(where('linkedPhaseId', '==', filters.linkedPhaseId));
      }

      constraints.push(orderBy('categoryCode', 'asc'));

      const searchQuery = query(baseRef, ...constraints);
      const snapshot = await getDocs(searchQuery);

      let results = snapshot.docs
        .map((document) => normalizeBOQItemSafe(document.id, document.data() as Record<string, unknown>))
        .filter((item): item is BOQItem => item !== null);

      // Client-side text search
      if (filters?.searchText?.trim()) {
        const term = filters.searchText.toLowerCase();
        results = results.filter(
          (item) =>
            item.title.toLowerCase().includes(term) ||
            item.categoryCode.toLowerCase().includes(term) ||
            (item.description?.toLowerCase().includes(term) ?? false)
        );
      }

      return results;
    } catch (error) {
      logger.error('Error searching BOQ items', { error, buildingId });
      return [];
    }
  }

  async getStatistics(buildingId: string): Promise<BOQStats> {
    try {
      const items = await this.getByBuilding(buildingId);

      let totalEstimatedCost = 0;
      for (const item of items) {
        const gross = item.estimatedQuantity * (1 + item.wasteFactor);
        const unitCost = item.materialUnitCost + item.laborUnitCost + item.equipmentUnitCost;
        totalEstimatedCost += gross * unitCost;
      }

      return {
        total: items.length,
        draft: items.filter((i) => i.status === 'draft').length,
        submitted: items.filter((i) => i.status === 'submitted').length,
        approved: items.filter((i) => i.status === 'approved').length,
        certified: items.filter((i) => i.status === 'certified').length,
        locked: items.filter((i) => i.status === 'locked').length,
        totalEstimatedCost,
      };
    } catch (error) {
      logger.error('Error getting BOQ statistics', { error, buildingId });
      return { total: 0, draft: 0, submitted: 0, approved: 0, certified: 0, locked: 0, totalEstimatedCost: 0 };
    }
  }

  async getCategories(companyId: string): Promise<BOQCategory[]> {
    try {
      const catQuery = query(
        collection(db, COLLECTIONS.BOQ_CATEGORIES),
        where('companyId', '==', companyId),
        orderBy('sortOrder', 'asc')
      );

      const snapshot = await getDocs(catQuery);
      const firestoreCategories = snapshot.docs.map((document) =>
        normalizeBOQCategory(document.id, document.data() as Record<string, unknown>)
      );

      // Fallback: αν δεν υπάρχουν στο Firestore, χρησιμοποίησε static ΑΤΟΕ
      if (firestoreCategories.length === 0) {
        const now = new Date().toISOString();
        return ATOE_MASTER_CATEGORIES.map((cat) => ({
          id: `static_${cat.code}`,
          companyId,
          code: cat.code,
          nameEL: cat.nameEL,
          nameEN: cat.nameEN,
          description: cat.description,
          level: cat.level,
          parentId: null,
          sortOrder: cat.sortOrder,
          defaultWasteFactor: cat.defaultWasteFactor,
          allowedUnits: [...cat.allowedUnits],
          isActive: true,
          createdAt: now,
          updatedAt: now,
        }));
      }

      return firestoreCategories;
    } catch (error) {
      logger.error('Error fetching BOQ categories', { error, companyId });
      // Fallback to static categories on error
      const now = new Date().toISOString();
      return ATOE_MASTER_CATEGORIES.map((cat) => ({
        id: `static_${cat.code}`,
        companyId,
        code: cat.code,
        nameEL: cat.nameEL,
        nameEN: cat.nameEN,
        description: cat.description,
        level: cat.level,
        parentId: null,
        sortOrder: cat.sortOrder,
        defaultWasteFactor: cat.defaultWasteFactor,
        allowedUnits: [...cat.allowedUnits],
        isActive: true,
        createdAt: now,
        updatedAt: now,
      }));
    }
  }
}
