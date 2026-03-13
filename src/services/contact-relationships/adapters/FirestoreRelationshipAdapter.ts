// ============================================================================
// FIRESTORE RELATIONSHIP ADAPTER
// ============================================================================
//
// 🔥 Firestore database adapter για contact relationships
// Handles all Firebase operations, queries, and data persistence
//
// Architectural Pattern: Adapter Pattern + Repository Pattern
// Responsibility: Database abstraction layer για Firestore operations
//
// ============================================================================

import {
  ContactRelationship,
  RelationshipType
} from '@/types/contacts/relationships';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { normalizeToMillis } from '@/lib/date-local';
import { generateRelationshipId } from '@/services/enterprise-id.service';
import { stripUndefinedDeep } from '@/utils/firestore-sanitize';
import { COLLECTIONS } from '@/config/firestore-collections';
// 🏢 ENTERPRISE: Centralized real-time service for cross-page sync
import { RealtimeService } from '@/services/realtime';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('FirestoreRelationshipAdapter');

// ============================================================================
// CONFIGURATION
// ============================================================================

const RELATIONSHIPS_COLLECTION = COLLECTIONS.CONTACT_RELATIONSHIPS;

// ============================================================================
// FIRESTORE ADAPTER CLASS
// ============================================================================

/**
 * 🔥 Firestore Relationship Adapter
 *
 * Enterprise-grade database adapter για contact relationships.
 * Provides abstraction layer over Firestore operations.
 *
 * Features:
 * - CRUD operations με Firestore
 * - Query optimization and caching
 * - Error handling and retry logic
 * - Type-safe database operations
 */
export class FirestoreRelationshipAdapter {

  // ========================================================================
  // CORE DATABASE OPERATIONS
  // ========================================================================

  /**
   * 💾 Save Relationship to Firestore
   */
  static async saveRelationship(relationship: ContactRelationship): Promise<void> {
    try {
      const colRef = collection(db, RELATIONSHIPS_COLLECTION);

      // Convert to Firestore-friendly format (strip undefined keys)
      const firestoreData = {
        ...stripUndefinedDeep(relationship),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Use setDoc with custom ID
      const docRef = doc(colRef, relationship.id);
      await setDoc(docRef, firestoreData);

      // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
      RealtimeService.dispatch('RELATIONSHIP_CREATED', {
        relationshipId: relationship.id,
        relationship: {
          sourceId: relationship.sourceContactId,
          targetId: relationship.targetContactId,
          type: relationship.relationshipType,
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('Failed to save relationship:', { error });
      throw error;
    }
  }

  /**
   * 📖 Get Relationship by ID
   */
  static async getRelationshipById(relationshipId: string): Promise<ContactRelationship | null> {
    try {
      const docRef = doc(db, RELATIONSHIPS_COLLECTION, relationshipId);
      const docSnapshot = await getDoc(docRef);

      if (!docSnapshot.exists()) {
        return null;
      }

      return {
        id: docSnapshot.id,
        ...docSnapshot.data()
      } as ContactRelationship;
    } catch (error) {
      logger.error('❌ FIRESTORE: Error getting relationship by ID:', error);
      return null;
    }
  }

  /**
   * 📝 Update Relationship
   */
  static async updateRelationship(relationshipId: string, updates: Partial<ContactRelationship>): Promise<void> {
    try {
      const docRef = doc(db, RELATIONSHIPS_COLLECTION, relationshipId);

      // Add updated timestamp
      const updatesWithTimestamp = {
        ...updates,
        updatedAt: serverTimestamp()
      };

      await updateDoc(docRef, updatesWithTimestamp);
      logger.info('✅ FIRESTORE: Relationship updated successfully:', relationshipId);

      // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
      RealtimeService.dispatch('RELATIONSHIP_UPDATED', {
        relationshipId,
        updates: {
          type: updates.relationshipType,
          notes: updates.notes,
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('❌ FIRESTORE: Error updating relationship:', error);
      throw error;
    }
  }

  /**
   * 🗑️ Delete Relationship
   */
  static async deleteRelationship(relationshipId: string): Promise<void> {
    try {
      const docRef = doc(db, RELATIONSHIPS_COLLECTION, relationshipId);
      await deleteDoc(docRef);
      logger.info('✅ FIRESTORE: Relationship deleted successfully:', relationshipId);

      // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
      RealtimeService.dispatch('RELATIONSHIP_DELETED', {
        relationshipId,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('❌ FIRESTORE: Error deleting relationship:', error);
      throw error;
    }
  }

  // ========================================================================
  // QUERY OPERATIONS
  // ========================================================================

  /**
   * 🔍 Get Relationships για Contact (Optimized - No Compound Indexes)
   */
  static async getContactRelationships(contactId: string): Promise<ContactRelationship[]> {
    try {
      const colRef = collection(db, RELATIONSHIPS_COLLECTION);

      // Query 1: Where this contact is the source
      const sourceQuery = query(
        colRef,
        where('sourceContactId', '==', contactId),
        where('status', '==', 'active')
      );

      // Query 2: Where this contact is the target
      const targetQuery = query(
        colRef,
        where('targetContactId', '==', contactId),
        where('status', '==', 'active')
      );

      // Execute both queries in parallel
      const [sourceSnapshot, targetSnapshot] = await Promise.all([
        getDocs(sourceQuery),
        getDocs(targetQuery)
      ]);

      const relationships: ContactRelationship[] = [];
      const processedIds = new Set<string>(); // Avoid duplicates

      // Process source relationships
      sourceSnapshot.forEach((doc) => {
        if (!processedIds.has(doc.id)) {
          relationships.push({
            id: doc.id,
            ...doc.data()
          } as ContactRelationship);
          processedIds.add(doc.id);
        }
      });

      // Process target relationships
      targetSnapshot.forEach((doc) => {
        if (!processedIds.has(doc.id)) {
          relationships.push({
            id: doc.id,
            ...doc.data()
          } as ContactRelationship);
          processedIds.add(doc.id);
        }
      });

      // Sort by createdAt manually (since we can't use orderBy with OR)
      relationships.sort((a, b) => normalizeToMillis(b.createdAt) - normalizeToMillis(a.createdAt));

      return relationships;
    } catch (error) {
      logger.error('Failed to query relationships for contact:', { error, contactId });
      return [];
    }
  }

  /**
   * 🏢 Get Organization Employees
   */
  static async getOrganizationEmployees(
    organizationId: string,
    relationshipTypes: RelationshipType[]
  ): Promise<ContactRelationship[]> {
    try {
      const colRef = collection(db, RELATIONSHIPS_COLLECTION);

      logger.info('🏢 FIRESTORE: Querying employees for organization:', organizationId);

      // Single-field query to avoid composite index requirement
      const q = query(
        colRef,
        where('targetContactId', '==', organizationId)
      );

      const snapshot = await getDocs(q);
      const relationships: ContactRelationship[] = [];

      snapshot.forEach((doc) => {
        const relationship = {
          id: doc.id,
          ...doc.data()
        } as ContactRelationship;

        // Filter by status and relationship type in-memory (avoids composite index)
        if (
          relationship.status === 'active' &&
          relationshipTypes.includes(relationship.relationshipType)
        ) {
          relationships.push(relationship);
        }
      });

      // Sort in-memory
      relationships.sort((a, b) => {
        // Sort by relationship type first, then by position
        if (a.relationshipType !== b.relationshipType) {
          return a.relationshipType.localeCompare(b.relationshipType);
        }
        return (a.position || '').localeCompare(b.position || '');
      });

      logger.info('✅ FIRESTORE: Organization employees query returned', relationships.length, 'relationships');
      return relationships;
    } catch (error) {
      logger.error('❌ FIRESTORE: Error querying organization employees:', error);
      return [];
    }
  }

  /**
   * 🔍 Get Specific Relationship (για duplicate checking)
   */
  static async getSpecificRelationship(
    sourceId: string,
    targetId: string,
    relationshipType: RelationshipType
  ): Promise<ContactRelationship | null> {
    logger.info('🔍 FIRESTORE: Getting specific relationship:', {
      sourceId,
      targetId,
      relationshipType
    });

    try {
      const colRef = collection(db, RELATIONSHIPS_COLLECTION);

      // Create query για την specific relationship
      // 🔧 FIX: Use equality filter (== 'active') instead of inequality (!= 'deleted')
      // Inequality filters require composite indexes and can cause silent failures
      const q = query(
        colRef,
        where('sourceContactId', '==', sourceId),
        where('targetContactId', '==', targetId),
        where('relationshipType', '==', relationshipType),
        where('status', '==', 'active')
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        logger.info('✅ FIRESTORE: No existing relationship found');
        return null;
      }

      const relationship = {
        id: snapshot.docs[0].id,
        ...snapshot.docs[0].data()
      } as ContactRelationship;

      logger.info('🔍 FIRESTORE: Found existing relationship:', relationship.id);
      return relationship;

    } catch (error) {
      logger.error('❌ FIRESTORE: Error getting specific relationship:', error);
      return null;
    }
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  /**
   * 🆔 Generate Unique Relationship ID
   * 🏢 ENTERPRISE: Using centralized ID generation (crypto-secure)
   */
  static generateRelationshipIdInternal(): string {
    return generateRelationshipId();
  }

  /**
   * 🧹 Clean Firestore Data
   *
   * Removes undefined values που Firestore δεν δέχεται.
   * Delegates to centralized stripUndefinedDeep (ADR-217).
   */
  static cleanFirestoreData(data: Record<string, unknown>): Record<string, unknown> {
    return stripUndefinedDeep(data);
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export default FirestoreRelationshipAdapter;
