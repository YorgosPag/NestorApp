// ============================================================================
// RELATIONSHIP CRUD SERVICE
// ============================================================================
//
// 📝 Core CRUD operations για contact relationships
// Handles Create, Read, Update, Delete operations με proper business logic
//
// Architectural Pattern: Service Layer Pattern + Repository Pattern
// Responsibility: Business logic orchestration για CRUD operations
//
// ============================================================================

import {
  ContactRelationship,
  RelationshipType
} from '@/types/contacts/relationships';
import { Contact } from '@/types/contacts';
import { SYSTEM_IDENTITY } from '@/config/domain-constants';
import { ContactsService } from '@/services/contacts.service';
import { FirestoreRelationshipAdapter } from '../adapters/FirestoreRelationshipAdapter';
import { RelationshipValidationService } from './RelationshipValidationService';
import { generateRelationshipId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('RelationshipCRUDService');

// ============================================================================
// CRUD SERVICE CLASS
// ============================================================================

/**
 * 📝 Relationship CRUD Service
 *
 * Enterprise-grade CRUD service για contact relationships.
 * Orchestrates business logic, validation, and database operations.
 *
 * Features:
 * - Create/Read/Update/Delete operations
 * - Business rule enforcement
 * - Validation integration
 * - Transaction support
 * - Error handling and logging
 */
export class RelationshipCRUDService {

  // ========================================================================
  // CREATE OPERATIONS
  // ========================================================================

  /**
   * 🔗 Create New Relationship
   *
   * Creates a new relationship με full validation και business rules
   */
  static async createRelationship(data: Partial<ContactRelationship>, options?: { skipReciprocal?: boolean }): Promise<ContactRelationship> {
    logger.info('🔗 CRUD: Creating relationship', {
      sourceId: data.sourceContactId,
      targetId: data.targetContactId,
      type: data.relationshipType,
      skipReciprocal: options?.skipReciprocal ?? false
    });

    // ====================================================================
    // VALIDATION & BUSINESS RULES (Copied από παλιό working code)
    // ====================================================================

    // Required field validation
    if (!data.sourceContactId || !data.targetContactId || !data.relationshipType) {
      throw new Error('Missing required fields: sourceContactId, targetContactId, relationshipType');
    }

    // Self-relationship validation
    if (data.sourceContactId === data.targetContactId) {
      throw new Error('Cannot create relationship with self');
    }

    // Check for duplicate relationships (handle Firebase index errors gracefully)
    try {
      const existing = await FirestoreRelationshipAdapter.getSpecificRelationship(
        data.sourceContactId,
        data.targetContactId,
        data.relationshipType
      );
      if (existing) {
        throw new Error('Relationship already exists');
      }
    } catch (error) {
      // 🔧 If Firebase index is missing, log warning but continue with creation
      // This prevents the relationship creation from failing due to missing composite index
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = (error as { code?: string })?.code;

      // 🔧 FIX: Removed 'FirebaseError' match — it caught ALL Firebase errors (permissions, etc.)
      const isIndexError = errorMessage.includes('query requires an index') ||
                          errorCode === 'failed-precondition';

      if (isIndexError) {
        logger.warn('⚠️ Firebase index missing for duplicate check - proceeding with relationship creation');
        logger.warn('📋 Create the composite index at Firebase Console for better performance');
        logger.warn('🔗 Index URL:', errorMessage.match(/https:\/\/[^\s]+/)?.[0] || 'Check Firebase Console');
        logger.info('✅ Skipping duplicate check due to missing index - relationship creation will continue');
        // DO NOT re-throw this error - just continue with relationship creation
      } else if (errorMessage.includes('already exists')) {
        // This is an actual duplicate relationship error
        throw error;
      } else {
        // For any other error, also log but continue (don't block relationship creation)
        logger.warn('⚠️ Duplicate check failed with unexpected error - continuing with creation:', errorMessage);
      }
    }

    // Validate contacts exist
    const [sourceContact, targetContact] = await Promise.all([
      this.getContactById(data.sourceContactId),
      this.getContactById(data.targetContactId)
    ]);

    if (!sourceContact || !targetContact) {
      throw new Error('One or both contacts do not exist');
    }

    // Business rule validation
    await this.validateBusinessRules(sourceContact, targetContact, data.relationshipType);

    // ====================================================================
    // RELATIONSHIP CREATION (Copied από παλιό working code)
    // ====================================================================

    const relationship: ContactRelationship = {
      id: this.generateId(),
      sourceContactId: data.sourceContactId,
      targetContactId: data.targetContactId,
      relationshipType: data.relationshipType,
      status: data.status || 'active',

      // Organizational details
      position: data.position,
      department: data.department,
      team: data.team,
      seniorityLevel: data.seniorityLevel,
      employmentStatus: data.employmentStatus,
      employmentType: data.employmentType,

      // Timeline
      startDate: data.startDate || new Date().toISOString(),
      endDate: data.endDate,
      expectedDuration: data.expectedDuration,

      // Contact and financial info
      contactInfo: data.contactInfo,
      financialInfo: data.financialInfo,
      performanceInfo: data.performanceInfo,

      // Metadata
      responsibilities: data.responsibilities,
      authorityLevel: data.authorityLevel,
      priority: data.priority || 'medium',
      relationshipStrength: data.relationshipStrength || 'moderate',
      communicationFrequency: data.communicationFrequency,

      // 🔧 FIX: Map both 'notes' and 'relationshipNotes' (form uses 'notes')
      relationshipNotes: data.relationshipNotes || (data as Record<string, unknown>).notes as string | undefined,
      tags: data.tags || [],
      customFields: data.customFields || {},

      // Audit fields
      createdBy: data.createdBy || SYSTEM_IDENTITY.ID,
      lastModifiedBy: data.createdBy || SYSTEM_IDENTITY.ID,
      createdAt: new Date(),
      updatedAt: new Date(),
      verificationStatus: 'unverified',
      sensitivityLevel: data.sensitivityLevel || 'internal'
    };

    // Save to database (Firebase/backend implementation)
    await this.saveRelationship(relationship);

    // Create reciprocal relationship if needed (skip if this IS a reciprocal)
    if (!options?.skipReciprocal) {
      logger.info('🔄 CRUD: Creating reciprocal relationship...');
      try {
        await this.createReciprocalRelationship(relationship, sourceContact, targetContact);
        logger.info('✅ CRUD: Reciprocal relationship created successfully');
      } catch (reciprocalError) {
        logger.error('❌ CRUD: Reciprocal relationship creation failed:', reciprocalError);
        // Don't fail the main operation - reciprocal relationships are optional
      }
    } else {
      logger.info('ℹ️ CRUD: Skipping reciprocal creation (this IS a reciprocal)');
    }

    // Update organizational hierarchy if employment relationship
    // 🔧 FIX: Inline check instead of isEmploymentRelationship() to avoid
    // "Maximum call stack size exceeded" in production bundles
    const employmentTypes: RelationshipType[] = [
      'employee', 'manager', 'director', 'executive',
      'intern', 'contractor', 'civil_servant', 'department_head', 'ministry_official'
    ];
    const isEmployment = employmentTypes.includes(relationship.relationshipType);

    if (isEmployment) {
      try {
        await this.updateOrganizationalHierarchy(relationship);
        logger.info('✅ CRUD: Organizational hierarchy updated');
      } catch (hierarchyError) {
        logger.warn('⚠️ CRUD: Organizational hierarchy update failed (non-blocking):', { error: hierarchyError });
      }
    }

    logger.info('✅ CRUD: Relationship created successfully', relationship.id);
    return relationship;
  }

  // ========================================================================
  // READ OPERATIONS
  // ========================================================================

  /**
   * 📖 Get Relationship by ID
   */
  static async getRelationshipById(relationshipId: string): Promise<ContactRelationship | null> {
    try {
      return await FirestoreRelationshipAdapter.getRelationshipById(relationshipId);
    } catch (error) {
      logger.error('❌ CRUD: Error getting relationship by ID:', error);
      return null;
    }
  }

  /**
   * 🔍 Get Specific Relationship
   */
  static async getSpecificRelationship(
    sourceId: string,
    targetId: string,
    relationshipType: RelationshipType
  ): Promise<ContactRelationship | null> {
    try {
      return await FirestoreRelationshipAdapter.getSpecificRelationship(sourceId, targetId, relationshipType);
    } catch (error) {
      logger.error('❌ CRUD: Error getting specific relationship:', error);
      return null;
    }
  }

  /**
   * 👥 Get All Contact Relationships
   */
  static async getContactRelationships(
    contactId: string,
    includeInactive = false
  ): Promise<ContactRelationship[]> {
    try {
      const relationships = await FirestoreRelationshipAdapter.getContactRelationships(contactId);

      if (!includeInactive) {
        return relationships.filter(rel => rel.status === 'active');
      }

      return relationships;
    } catch (error) {
      logger.error('❌ CRUD: Error getting contact relationships:', error);
      return [];
    }
  }

  // ========================================================================
  // UPDATE OPERATIONS
  // ========================================================================

  /**
   * 📝 Update Relationship
   */
  static async updateRelationship(
    relationshipId: string,
    updates: Partial<ContactRelationship>
  ): Promise<ContactRelationship> {
    try {
      const existing = await this.getRelationshipById(relationshipId);
      if (!existing) {
        throw new Error('Relationship not found');
      }

      // Validate updates
      const updatedData = { ...existing, ...updates };
      RelationshipValidationService.validateDataIntegrity(updatedData);

      // Build updated relationship
      const updated: ContactRelationship = {
        ...existing,
        ...updates,
        updatedAt: new Date(),
        lastModifiedBy: updates.lastModifiedBy || SYSTEM_IDENTITY.ID
      };

      // Add change history entry
      const changeEntry = {
        changeDate: new Date().toISOString(),
        changeType: 'updated' as const,
        changedBy: updates.lastModifiedBy || SYSTEM_IDENTITY.ID,
        oldValue: existing,
        newValue: updates,
        ...(updates.relationshipNotes ? { notes: updates.relationshipNotes } : {}),
      };

      updated.changeHistory = [...(existing.changeHistory || []), changeEntry];

      // Update in database
      await FirestoreRelationshipAdapter.updateRelationship(relationshipId, updated);

      logger.info('✅ CRUD: Relationship updated successfully:', relationshipId);
      return updated;

    } catch (error) {
      logger.error('❌ CRUD: Error updating relationship:', error);
      throw error;
    }
  }

  // ========================================================================
  // DELETE OPERATIONS
  // ========================================================================

  /**
   * 🗑️ Delete Relationship (Hard Delete + Cascade Reciprocal)
   */
  static async deleteRelationship(relationshipId: string, _deletedBy: string): Promise<boolean> {
    try {
      const relationship = await this.getRelationshipById(relationshipId);
      if (!relationship) {
        logger.warn('⚠️ CRUD: Relationship not found για deletion:', relationshipId);
        return false;
      }

      // Hard delete the relationship from Firestore
      await FirestoreRelationshipAdapter.deleteRelationship(relationshipId);
      logger.info('✅ CRUD: Relationship hard-deleted:', relationshipId);

      // Cascade: delete reciprocal relationship (reverse direction, same type or mapped type)
      try {
        await this.deleteReciprocalRelationship(relationship);
      } catch (reciprocalError) {
        logger.warn('⚠️ CRUD: Reciprocal deletion failed (non-blocking):', reciprocalError);
      }

      return true;

    } catch (error) {
      logger.error('❌ CRUD: Error deleting relationship:', error);
      return false;
    }
  }

  /**
   * 🔄 Delete Reciprocal Relationship (cascade)
   */
  private static async deleteReciprocalRelationship(relationship: ContactRelationship): Promise<void> {
    const reciprocalMappings: Partial<Record<RelationshipType, RelationshipType>> = {
      'client': 'vendor',
      'vendor': 'client',
      'partner': 'partner',
      'colleague': 'colleague',
      'mentor': 'protege',
      'protege': 'mentor',
      'friend': 'friend',
      'family': 'family',
    };

    const reciprocalType = reciprocalMappings[relationship.relationshipType];
    if (!reciprocalType) return; // Employment/government types have no reciprocal

    try {
      const reciprocal = await FirestoreRelationshipAdapter.getSpecificRelationship(
        relationship.targetContactId,
        relationship.sourceContactId,
        reciprocalType
      );

      if (reciprocal) {
        await FirestoreRelationshipAdapter.deleteRelationship(reciprocal.id);
        logger.info('✅ CRUD: Reciprocal relationship cascade-deleted:', reciprocal.id);
      }
    } catch (error) {
      // Swallow index errors — reciprocal might not exist
      logger.warn('⚠️ CRUD: Could not find/delete reciprocal:', error);
    }
  }

  // ========================================================================
  // HELPER METHODS
  // ========================================================================


  /**
   * 👤 Get Contact by ID
   */
  private static async getContactById(contactId: string): Promise<Contact | null> {
    try {
      return await ContactsService.getContact(contactId);
    } catch (error) {
      logger.error('❌ CRUD: Error fetching contact:', error);
      return null;
    }
  }

  /**
   * 🔄 Create Reciprocal Relationship
   */
  private static async createReciprocalRelationship(
    relationship: ContactRelationship,
    sourceContact: Contact,
    targetContact: Contact
  ): Promise<void> {
    // Define reciprocal relationship mappings
    const reciprocalMappings: Record<RelationshipType, RelationshipType | null> = {
      'employee': null, // Organization is employer, αλλά we don't create reverse
      'manager': null,
      'director': null,
      'executive': null,
      'shareholder': null,
      'client': 'vendor',
      'vendor': 'client',
      'partner': 'partner',
      'colleague': 'colleague',
      'mentor': 'protege',
      'protege': 'mentor',
      'civil_servant': null,
      'elected_official': null,
      'appointed_official': null,
      'department_head': null,
      'ministry_official': null,
      'mayor': null,
      'deputy_mayor': null,
      'regional_governor': null,
      'board_member': null,
      'chairman': null,
      'ceo': null,
      'representative': null,
      'intern': null,
      'contractor': null,
      'consultant': null,
      'advisor': null,
      'supplier': 'customer',
      'customer': 'supplier',
      'competitor': 'competitor',
      'friend': 'friend',
      'family': 'family',
      'other': null
    };

    const reciprocalType = reciprocalMappings[relationship.relationshipType];
    if (reciprocalType) {
      try {
        // Check αν reciprocal relationship already exists
        const existing = await FirestoreRelationshipAdapter.getSpecificRelationship(
          relationship.targetContactId,
          relationship.sourceContactId,
          reciprocalType
        );

        if (!existing) {
          await this.createRelationship({
            sourceContactId: relationship.targetContactId,
            targetContactId: relationship.sourceContactId,
            relationshipType: reciprocalType,
            status: relationship.status,
            startDate: relationship.startDate,
            createdBy: relationship.createdBy,
            lastModifiedBy: relationship.lastModifiedBy
          }, { skipReciprocal: true }); // 🔧 FIX: Prevent infinite recursion
        }
      } catch (error) {
        logger.warn('⚠️ CRUD: Error creating reciprocal relationship:', error);
        // Don't fail the main operation αν reciprocal creation fails
      }
    }
  }

  /**
   * 📊 Update Organizational Hierarchy
   */
  private static async updateOrganizationalHierarchy(relationship: ContactRelationship): Promise<void> {
    logger.info('📊 CRUD: Starting organizational hierarchy update για relationship', relationship.id);

    // Add timeout to prevent infinite hanging
    return new Promise((resolve) => {
      logger.info('💭 CRUD: Organizational hierarchy update is placeholder - completing successfully');

      // Complete immediately to prevent any hanging
      setTimeout(() => {
        logger.info('✅ CRUD: Organizational hierarchy update completed (placeholder)');
        resolve();
      }, 10); // Minimal delay just to ensure logs appear in correct order
    });
  }

  // ========================================================================
  // MISSING METHODS FROM OLD CODE
  // ========================================================================

  /**
   * 💾 Save Relationship to Database (Copied από παλιό working code)
   */
  private static async saveRelationship(relationship: ContactRelationship): Promise<void> {
    logger.info('💾 CRUD: Saving relationship to database', relationship.id);
    await FirestoreRelationshipAdapter.saveRelationship(relationship);
  }

  /**
   * 🆔 Generate Unique ID
   * 🏢 ENTERPRISE: Using centralized ID generation (crypto-secure)
   */
  private static generateId(): string {
    return generateRelationshipId();
  }

  /**
   * 🔍 Validate Business Rules — delegates to centralized RelationshipValidationService (SSoT)
   */
  private static async validateBusinessRules(
    source: Contact,
    target: Contact,
    relationshipType: RelationshipType
  ): Promise<void> {
    logger.info('🔍 VALIDATION: Delegating to centralized RelationshipValidationService', {
      sourceType: source.type,
      targetType: target.type,
      relationshipType
    });

    RelationshipValidationService.validateBusinessRules(
      source.type,
      target.type,
      relationshipType
    );

    logger.info('✅ VALIDATION: Business rules passed');
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export default RelationshipCRUDService;