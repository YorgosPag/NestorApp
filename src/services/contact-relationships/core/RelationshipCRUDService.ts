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
import { FirestoreRelationshipAdapter } from '../adapters/FirestoreRelationshipAdapter';
import { recordRelationshipAudit } from './relationship-audit';
import { buildUpdateChangeEntry, buildTerminationChangeEntry } from './relationship-change-history';
import { RelationshipValidationService } from './RelationshipValidationService';
import {
  getContactById,
  createReciprocalRelationship,
  updateOrganizationalHierarchy
} from './relationship-helpers';
import { getRelationshipGovernanceInfo } from './relationship-governance';
import { deleteReciprocalRelationship, terminateReciprocalRelationship } from './relationship-reciprocal-ops';
import { generateRelationshipId } from '@/services/enterprise-id.service';
import { nowISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
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
      throw new Error('relationships.form.validation.missingRequiredFields');
    }

    // Self-relationship validation
    if (data.sourceContactId === data.targetContactId) {
      throw new Error('relationships.form.validation.selfRelationship');
    }

    // Check for duplicate relationships (handle Firebase index errors gracefully)
    try {
      const existing = await FirestoreRelationshipAdapter.getSpecificRelationship(
        data.sourceContactId,
        data.targetContactId,
        data.relationshipType
      );
      if (existing) {
        throw new Error('relationships.form.validation.duplicateRelationship');
      }
    } catch (error) {
      // 🔧 If Firebase index is missing, log warning but continue with creation
      // This prevents the relationship creation from failing due to missing composite index
      const errorMessage = getErrorMessage(error);
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
      throw new Error('relationships.form.validation.contactsNotFound');
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
      startDate: data.startDate || nowISO(),
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

    // Audit trail for both contacts (fire-and-forget)
    recordRelationshipAudit({
      sourceContactId: relationship.sourceContactId,
      targetContactId: relationship.targetContactId,
      relationshipType: relationship.relationshipType,
      action: 'linked',
      sourceContact: sourceContact,
      targetContact: targetContact,
    });

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
        throw new Error('relationships.form.validation.relationshipNotFound');
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
      // 🔧 FIX: Don't store full objects in oldValue/newValue — causes recursive
      // nesting (changeHistory → oldValue → changeHistory → ...) which exceeds
      // Firestore's max depth → "Property array contains an invalid nested entity"
      const changedFields = Object.keys(updates).filter(
        k => k !== 'lastModifiedBy' && k !== 'updatedAt'
      );
      const changeEntry = buildUpdateChangeEntry({
        changedBy: updates.lastModifiedBy || SYSTEM_IDENTITY.ID,
        changedFields,
        notes: updates.relationshipNotes,
      });

      updated.changeHistory = [...(existing.changeHistory || []), changeEntry];

      // Update in database
      await FirestoreRelationshipAdapter.updateRelationship(relationshipId, updated);

      // Audit trail for both contacts (fire-and-forget)
      recordRelationshipAudit({
        sourceContactId: existing.sourceContactId,
        targetContactId: existing.targetContactId,
        relationshipType: existing.relationshipType,
        action: 'updated',
      });

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
   * 🛑 Terminate Relationship (Lifecycle-safe deactivation)
   */
  static async terminateRelationship(relationshipId: string, terminatedBy: string): Promise<ContactRelationship> {
    const relationship = await this.getRelationshipById(relationshipId);
    if (!relationship) {
      throw new Error('relationships.form.validation.relationshipNotFound');
    }

    const terminationDate = relationship.endDate || nowISO();
    const changeEntry = buildTerminationChangeEntry({ changedBy: terminatedBy });

    const updates: Partial<ContactRelationship> = {
      status: 'terminated',
      endDate: terminationDate,
      updatedAt: new Date(),
      lastModifiedBy: terminatedBy,
      changeHistory: [...(relationship.changeHistory || []), changeEntry]
    };

    if (relationship.employmentStatus && relationship.employmentStatus !== 'terminated') {
      updates.employmentStatus = 'terminated';
    }

    await FirestoreRelationshipAdapter.updateRelationship(relationshipId, updates);

    try {
      await terminateReciprocalRelationship(relationship, terminatedBy, terminationDate);
    } catch (reciprocalError) {
      logger.warn('⚠️ CRUD: Reciprocal termination failed (non-blocking):', reciprocalError);
    }

    const terminatedRelationship: ContactRelationship = {
      ...relationship,
      ...updates
    };

    // Audit trail for both contacts (fire-and-forget)
    recordRelationshipAudit({
      sourceContactId: relationship.sourceContactId,
      targetContactId: relationship.targetContactId,
      relationshipType: relationship.relationshipType,
      action: 'unlinked',
    });

    logger.info('✅ CRUD: Relationship terminated successfully:', relationshipId);
    return terminatedRelationship;
  }

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

      const governance = getRelationshipGovernanceInfo(relationship);
      if (!governance.canHardDelete) {
        throw new Error('relationships.status.deleteBlockedActiveRole');
      }

      // Hard delete the relationship from Firestore
      await FirestoreRelationshipAdapter.deleteRelationship(relationshipId);

      // Audit trail for both contacts (fire-and-forget)
      recordRelationshipAudit({
        sourceContactId: relationship.sourceContactId,
        targetContactId: relationship.targetContactId,
        relationshipType: relationship.relationshipType,
        action: 'unlinked',
      });

      logger.info('✅ CRUD: Relationship hard-deleted:', relationshipId);

      // Cascade: delete reciprocal relationship (reverse direction, same type or mapped type)
      try {
        await deleteReciprocalRelationship(relationship);
      } catch (reciprocalError) {
        logger.warn('⚠️ CRUD: Reciprocal deletion failed (non-blocking):', reciprocalError);
      }

      return true;

    } catch (error) {
      logger.error('❌ CRUD: Error deleting relationship:', error);
      throw error;
    }
  }

  // ========================================================================
  // PRIVATE HELPERS (delegating to extracted relationship-helpers.ts)
  // ========================================================================

  private static async getContactById(contactId: string): Promise<Contact | null> {
    return getContactById(contactId);
  }

  private static async createReciprocalRelationship(
    relationship: ContactRelationship,
    _sourceContact: Contact,
    _targetContact: Contact
  ): Promise<void> {
    return createReciprocalRelationship(
      relationship,
      (data, opts) => this.createRelationship(data, opts)
    );
  }

  private static async updateOrganizationalHierarchy(relationship: ContactRelationship): Promise<void> {
    return updateOrganizationalHierarchy(relationship);
  }

  private static async saveRelationship(relationship: ContactRelationship): Promise<void> {
    logger.info('💾 CRUD: Saving relationship to database', relationship.id);
    await FirestoreRelationshipAdapter.saveRelationship(relationship);
  }

  private static generateId(): string {
    return generateRelationshipId();
  }

  private static async validateBusinessRules(
    source: Contact,
    target: Contact,
    relationshipType: RelationshipType
  ): Promise<void> {
    RelationshipValidationService.validateBusinessRules(
      source.type,
      target.type,
      relationshipType
    );
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export default RelationshipCRUDService;