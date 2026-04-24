/**
 * ENTERPRISE: Firestore operations for Opportunities
 *
 * ADR-214 Phase 4: READ methods delegated to firestoreQueryService.
 * SECURITY FIX: tenant filtering auto-injected (was previously MISSING).
 *
 * NOTE: This file uses Firebase Client SDK (firebase/firestore), NOT firebase-admin.
 */

import { db } from '@/lib/firebase';
import {
  setDoc,
  doc,
  updateDoc,
  deleteDoc,
  orderBy,
  serverTimestamp,
  type DocumentData,
} from 'firebase/firestore';
import { generateOpportunityId } from '@/services/enterprise-id.service';
import { firestoreQueryService } from '@/services/firestore';
import type { Opportunity } from '@/types/crm';
import { COLLECTIONS } from '@/config/firestore-collections';
import { normalizeToISO } from '@/lib/date-local';

const OPPORTUNITIES_COLLECTION = COLLECTIONS.OPPORTUNITIES;

/** Transform raw DocumentData (from firestoreQueryService) to Opportunity */
const toOpportunity = (raw: DocumentData & { id: string }): Opportunity => {
  const opportunity: Record<string, unknown> = {};
  for (const key in raw) {
    const iso = normalizeToISO(raw[key]);
    opportunity[key] = iso ?? raw[key];
  }
  return opportunity as unknown as Opportunity;
};

// --- READ methods: ADR-214 Phase 4 (tenant-aware via firestoreQueryService) ---

/** Ανάκτηση όλων των ευκαιριών (with automatic tenant filtering) */
export async function getOpportunities(): Promise<Opportunity[]> {
  try {
    const result = await firestoreQueryService.getAll<DocumentData & { id: string }>('OPPORTUNITIES', {
      constraints: [orderBy('createdAt', 'desc')],
    });
    return result.documents.map(toOpportunity);
  } catch (error) {
    throw error;
  }
}

/** Ανάκτηση μίας ευκαιρίας με βάση το ID */
export async function getOpportunityById(id: string): Promise<Opportunity | null> {
  if (!id) return null;
  try {
    const raw = await firestoreQueryService.getById<DocumentData & { id: string }>('OPPORTUNITIES', id);
    if (!raw) return null;
    return toOpportunity(raw);
  } catch (error) {
    throw new Error('Failed to fetch opportunity');
  }
}

// --- WRITE methods: unchanged ---

/** Προσθήκη νέας ευκαιρίας */
export async function addOpportunity(opportunityData: Omit<Opportunity, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ id: string; success: boolean }> {
  try {
    // ADR-210: Enterprise ID generation — setDoc with pre-generated ID
    const id = generateOpportunityId();
    await setDoc(doc(db, OPPORTUNITIES_COLLECTION, id), {
      ...opportunityData,
      id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id, success: true };
  } catch (error) {
    throw error;
  }
}

/** Ενημέρωση ευκαιρίας */
export async function updateOpportunity(opportunityId: string, updates: Partial<Opportunity>): Promise<{ success: boolean }> {
  try {
    const opportunityRef = doc(db, OPPORTUNITIES_COLLECTION, opportunityId);
    await updateDoc(opportunityRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    throw error;
  }
}

/** Διαγραφή ευκαιρίας — TODO: Add cascade cleanup for related records */
export async function deleteOpportunity(opportunityId: string): Promise<{ success: boolean }> {
  try {
    // TODO: ADR-AUDIT — Before deleting, clean up related records:
    // - communications referencing this opportunity
    // - contact_links with targetEntityId === opportunityId
    await deleteDoc(doc(db, OPPORTUNITIES_COLLECTION, opportunityId));
    return { success: true };
  } catch (error) {
    throw error;
  }
}

