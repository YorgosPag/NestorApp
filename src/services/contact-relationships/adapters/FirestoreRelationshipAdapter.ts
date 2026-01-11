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
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { generateRelationshipId } from '@/services/enterprise-id.service';
import { COLLECTIONS } from '@/config/firestore-collections';

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
    console.log('💾 FIRESTORE: Saving relationship', relationship.id);
    try {
      const colRef = collection(db, RELATIONSHIPS_COLLECTION);

      // 🔧 Filter out undefined values (Firestore doesn't accept undefined)
      const cleanedRelationship = Object.fromEntries(
        Object.entries(relationship).filter(([_, value]) => value !== undefined)
      );

      // Convert to Firestore-friendly format
      const firestoreData = {
        ...cleanedRelationship,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Use setDoc with custom ID
      const docRef = doc(colRef, relationship.id);
      await setDoc(docRef, firestoreData);

      console.log('✅ FIRESTORE: Relationship saved successfully:', relationship.id);
    } catch (error) {
      console.error('❌ FIRESTORE: Error saving relationship:', error);
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
      console.error('❌ FIRESTORE: Error getting relationship by ID:', error);
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
      console.log('✅ FIRESTORE: Relationship updated successfully:', relationshipId);
    } catch (error) {
      console.error('❌ FIRESTORE: Error updating relationship:', error);
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
      console.log('✅ FIRESTORE: Relationship deleted successfully:', relationshipId);
    } catch (error) {
      console.error('❌ FIRESTORE: Error deleting relationship:', error);
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

      console.log('🔥 FIRESTORE: Fetching relationships for contact:', contactId);

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
      relationships.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime; // Descending
      });

      console.log('✅ FIRESTORE: Query returned', relationships.length, 'relationships');
      return relationships;
    } catch (error) {
      console.error('❌ FIRESTORE: Error querying contact relationships:', error);
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

      console.log('🏢 FIRESTORE: Querying employees for organization:', organizationId);

      // Simplified query: Get all relationships for this organization
      const q = query(
        colRef,
        where('targetContactId', '==', organizationId),
        where('status', '==', 'active')
      );

      const snapshot = await getDocs(q);
      const relationships: ContactRelationship[] = [];

      snapshot.forEach((doc) => {
        const relationship = {
          id: doc.id,
          ...doc.data()
        } as ContactRelationship;

        // Filter by relationship types in-memory (to avoid compound index)
        if (relationshipTypes.includes(relationship.relationshipType)) {
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

      console.log('✅ FIRESTORE: Organization employees query returned', relationships.length, 'relationships');
      return relationships;
    } catch (error) {
      console.error('❌ FIRESTORE: Error querying organization employees:', error);
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
    console.log('🔍 FIRESTORE: Getting specific relationship:', {
      sourceId,
      targetId,
      relationshipType
    });

    try {
      const colRef = collection(db, RELATIONSHIPS_COLLECTION);

      // Create query για την specific relationship
      const q = query(
        colRef,
        where('sourceContactId', '==', sourceId),
        where('targetContactId', '==', targetId),
        where('relationshipType', '==', relationshipType),
        where('status', '!=', 'deleted')
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        console.log('✅ FIRESTORE: No existing relationship found');
        return null;
      }

      const relationship = {
        id: snapshot.docs[0].id,
        ...snapshot.docs[0].data()
      } as ContactRelationship;

      console.log('🔍 FIRESTORE: Found existing relationship:', relationship.id);
      return relationship;

    } catch (error) {
      console.error('❌ FIRESTORE: Error getting specific relationship:', error);
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
   * Removes undefined values που Firestore δεν δέχεται
   */
  static cleanFirestoreData(data: Record<string, any>): Record<string, any> {
    return Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== undefined)
    );
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export default FirestoreRelationshipAdapter;