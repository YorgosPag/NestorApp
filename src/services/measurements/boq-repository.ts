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
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { stripUndefinedDeep } from '@/utils/firestore-sanitize';
import { createModuleLogger } from '@/lib/telemetry';
import { generateBoqItemId } from '@/services/enterprise-id.service';
import { nowISO } from '@/lib/date-local';
import type {
  BOQItem,
  BOQCategory,
  BOQItemStatus,
  CreateBOQItemInput,
  UpdateBOQItemInput,
} from '@/types/boq';
import { BOQ_ITEM_DEFAULTS } from '@/types/boq';
import type { IBOQRepository, BOQSearchFilters, BOQStats } from './contracts';
// SSoT κανονικοποίησης εγγράφου → πεδίο ορισμού. Κοινό με το admin-SDK
// μονοπάτι ανάγνωσης του πράκτορα (ADR-734 §8.3): ένα σχήμα εγγράφου, ένας
// μεταφραστής. Δύο αντίγραφα θα απέκλιναν σιωπηλά στην πρώτη προσθήκη πεδίου.
import {
  normalizeBOQCategory,
  normalizeBOQItemSafe,
} from './boq-document-normalize';
import { buildStaticAtoeCategories } from './boq-atoe-fallback';
import { applyBoqSearchText, computeBoqStats, EMPTY_BOQ_STATS } from './boq-read-shared';
// SSoT ελέγχου ιδιοκτησίας — κοινός με το Admin-SDK μονοπάτι. Δύο αντίγραφα του
// ίδιου ελέγχου πρόσβασης θα απέκλιναν σιωπηλά (ADR-584 / CHECK 3.28).
import { ownedItemOrNull } from './boq-tenant-ownership';

const logger = createModuleLogger('FirestoreBOQRepository');

// ============================================================================
// REPOSITORY IMPLEMENTATION
// ============================================================================

export class FirestoreBOQRepository implements IBOQRepository {

  /**
   * Ένα ερώτημα για τις δύο εμβέλειες. Η **μόνη** διαφορά μεταξύ «ανά κτίριο» και «ανά έργο»
   * ήταν το όνομα του πεδίου — δύο πανομοιότυπα σώματα θα απέκλιναν σιωπηλά μόλις αλλάξει η
   * κανονικοποίηση ή η σειρά ταξινόμησης (CHECK 3.28 / N.18).
   */
  private async getByScope(
    companyId: string,
    scopeField: 'buildingId' | 'projectId',
    scopeId: string
  ): Promise<BOQItem[]> {
    try {
      const boqQuery = query(
        collection(db, COLLECTIONS.BOQ_ITEMS),
        where('companyId', '==', companyId),
        where(scopeField, '==', scopeId),
        orderBy('categoryCode', 'asc')
      );

      const snapshot = await getDocs(boqQuery);
      return snapshot.docs
        .map((document) => normalizeBOQItemSafe(document.id, document.data() as Record<string, unknown>))
        .filter((item): item is BOQItem => item !== null);
    } catch (error) {
      logger.error('Error fetching BOQ items by scope', { error, scopeField, scopeId });
      return [];
    }
  }

  async getByBuilding(companyId: string, buildingId: string): Promise<BOQItem[]> {
    return this.getByScope(companyId, 'buildingId', buildingId);
  }

  async getByProject(companyId: string, projectId: string): Promise<BOQItem[]> {
    return this.getByScope(companyId, 'projectId', projectId);
  }

  /**
   * ⚠️ **Η ΜΟΝΑΔΙΚΗ πόρτα προς έγγραφο που ζητήθηκε με id.**
   *
   * Κάθε μέθοδος αυτής της κλάσης που δέχεται `id` — ανάγνωση **και** εγγραφή —
   * περνά από εδώ πρώτα. Μέχρι το ADR-734 §7 τα `delete()` και `updateStatus()`
   * έγραφαν **χωρίς καμία ανάγνωση**: ένα id ήταν αρκετό. Τα Firestore rules τα
   * έκοβαν (`firestore.rules:3015`), αλλά μια άμυνα που ζει μόνο στον διακομιστή
   * σημαίνει ότι ο κώδικας εδώ δεν ξέρει τι κάνει — και η επόμενη διαδρομή
   * (Admin SDK, migration script) δεν θα έχει καν αυτή την άμυνα.
   */
  private async readOwned(companyId: string, id: string): Promise<BOQItem | null> {
    try {
      const docRef = doc(db, COLLECTIONS.BOQ_ITEMS, id);
      const snapshot = await getDoc(docRef);

      if (!snapshot.exists()) {
        return null;
      }

      const item = normalizeBOQItemSafe(snapshot.id, snapshot.data() as Record<string, unknown>);
      return ownedItemOrNull(item, companyId, id, 'client');
    } catch (error) {
      logger.error('Error fetching BOQ item by ID', { error, id });
      return null;
    }
  }

  async getById(companyId: string, id: string): Promise<BOQItem | null> {
    return this.readOwned(companyId, id);
  }

  async create(data: CreateBOQItemInput, userId: string, companyId: string): Promise<BOQItem> {
    const now = nowISO();

    const newItem: Omit<BOQItem, 'id'> = {
      companyId,
      projectId: data.projectId,
      buildingId: data.buildingId,
      scope: data.scope ?? BOQ_ITEM_DEFAULTS.scope,
      linkedFloorId: data.linkedFloorId ?? null,
      linkedUnitId: data.linkedUnitId ?? null,
      linkedUnitIds: data.linkedUnitIds ?? null,
      costAllocationMethod: data.costAllocationMethod ?? BOQ_ITEM_DEFAULTS.costAllocationMethod,
      customAllocations: data.customAllocations ?? null,
      categoryCode: data.categoryCode,
      subCategoryCode: data.subCategoryCode ?? null,
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

    const enterpriseId = generateBoqItemId();
    const docRef = doc(db, COLLECTIONS.BOQ_ITEMS, enterpriseId);
    await setDoc(docRef, stripUndefinedDeep(newItem as unknown as Record<string, unknown>));

    return { id: enterpriseId, ...newItem };
  }

  async update(companyId: string, id: string, data: UpdateBOQItemInput): Promise<BOQItem | null> {
    // TODO(ADR-253-RC-5): Wrap in runTransaction for atomic read-then-write
    try {
      const current = await this.readOwned(companyId, id);
      if (!current) {
        return null;
      }

      const updatePayload: Record<string, unknown> = {
        ...data,
        updatedAt: nowISO(),
      };

      // Ensure no undefined values reach Firestore
      const sanitized = stripUndefinedDeep(updatePayload);

      const docRef = doc(db, COLLECTIONS.BOQ_ITEMS, id);
      await updateDoc(docRef, sanitized);

      return await this.readOwned(companyId, id);
    } catch (error) {
      logger.error('Error updating BOQ item', { error, id });
      return null;
    }
  }

  // TODO: ADR-AUDIT — Add dependency check before deletion (linked measurements, cost records)
  async delete(companyId: string, id: string): Promise<boolean> {
    try {
      // Η ανάγνωση **πριν** τη διαγραφή δεν είναι επικύρωση δεδομένων — είναι ο
      // έλεγχος ιδιοκτησίας. Χωρίς αυτήν, ένα id αρκούσε για `deleteDoc`.
      const current = await this.readOwned(companyId, id);
      if (!current) {
        return false;
      }

      const docRef = doc(db, COLLECTIONS.BOQ_ITEMS, id);
      await deleteDoc(docRef);
      return true;
    } catch (error) {
      logger.error('Error deleting BOQ item', { error, id });
      return false;
    }
  }

  async bulkDelete(companyId: string, ids: string[]): Promise<number> {
    let deletedCount = 0;
    for (const id of ids) {
      const success = await this.delete(companyId, id);
      if (success) {
        deletedCount += 1;
      }
    }
    return deletedCount;
  }

  async duplicate(companyId: string, id: string): Promise<BOQItem | null> {
    // TODO(ADR-253-RC-5): Wrap in runTransaction for atomic read-then-write
    try {
      const original = await this.readOwned(companyId, id);
      if (!original) return null;

      const now = nowISO();
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

      const duplicateId = generateBoqItemId();
      const docRef = doc(db, COLLECTIONS.BOQ_ITEMS, duplicateId);
      await setDoc(docRef, stripUndefinedDeep(payload as unknown as Record<string, unknown>));

      return { id: duplicateId, ...duplicateData };
    } catch (error) {
      logger.error('Error duplicating BOQ item', { error, id });
      return null;
    }
  }

  async updateStatus(
    companyId: string,
    id: string,
    status: BOQItemStatus,
    userId: string
  ): Promise<boolean> {
    try {
      // Ίδιος λόγος με το `delete()`: η μετάβαση κατάστασης είναι εγγραφή, και
      // μέχρι το ADR-734 §7 γινόταν χωρίς να διαβαστεί ποτέ το έγγραφο.
      const current = await this.readOwned(companyId, id);
      if (!current) {
        return false;
      }

      const docRef = doc(db, COLLECTIONS.BOQ_ITEMS, id);
      const updateData: Record<string, unknown> = {
        status,
        updatedAt: nowISO(),
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

  async search(companyId: string, buildingId: string, filters?: BOQSearchFilters): Promise<BOQItem[]> {
    try {
      const baseRef = collection(db, COLLECTIONS.BOQ_ITEMS);
      const constraints: QueryConstraint[] = [
        where('companyId', '==', companyId),
        where('buildingId', '==', buildingId),
      ];

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

      const results = snapshot.docs
        .map((document) => normalizeBOQItemSafe(document.id, document.data() as Record<string, unknown>))
        .filter((item): item is BOQItem => item !== null);

      // Client-side text search — SSoT κανόνα ταιριάσματος, κοινός με το admin
      // μονοπάτι του πράκτορα (ADR-734 §8.3).
      return applyBoqSearchText(results, filters?.searchText);
    } catch (error) {
      logger.error('Error searching BOQ items', { error, buildingId });
      return [];
    }
  }

  async getStatistics(companyId: string, buildingId: string): Promise<BOQStats> {
    try {
      const items = await this.getByBuilding(companyId, buildingId);
      // SSoT υπολογισμού, κοινός με το admin μονοπάτι του πράκτορα (ADR-734 §8.3).
      return computeBoqStats(items);
    } catch (error) {
      logger.error('Error getting BOQ statistics', { error, buildingId });
      return EMPTY_BOQ_STATS;
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
        return buildStaticAtoeCategories(companyId);
      }

      return firestoreCategories;
    } catch (error) {
      logger.error('Error fetching BOQ categories', { error, companyId });
      // Fallback to static categories on error
      return buildStaticAtoeCategories(companyId);
    }
  }
}
