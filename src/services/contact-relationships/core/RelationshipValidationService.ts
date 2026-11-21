// ============================================================================
// RELATIONSHIP VALIDATION SERVICE
// ============================================================================
//
// 🔍 Business rules validation για contact relationships
// Handles all validation logic, business rules, and data integrity checks
//
// Architectural Pattern: Service Layer Pattern + Strategy Pattern
// Responsibility: Business rule enforcement and data validation
//
// ============================================================================

import {
  ContactRelationship,
  RelationshipType,
  isEmploymentRelationship
} from '@/types/contacts/relationships';
import type { ContactType } from '@/types/contacts/contracts';
import {
  isRelationshipType,
  isStoredCrossingValid,
  isSymmetricRelationshipType,
  relationshipRoleLabelKey,
} from '@/types/contacts/relationships/core/relationship-orientation';
import { isValidEmail as isValidEmailFn } from '@/lib/validation/email-validation';
import { getErrorMessage } from '@/lib/error-utils';
import { isValidPhone as isValidPhoneFn } from '@/lib/validation/phone-validation';
import { isNonEmptyTrimmedString } from '@/lib/type-guards';
import { Contact } from '@/types/contacts';

// ============================================================================
// VALIDATION ERROR TYPES
// ============================================================================

/**
 * `message` is an i18n KEY. `labelParams` maps ICU placeholders to i18n KEYS
 * that the UI translates first (e.g. `{ type: 'relationships.types.shareholder' }`).
 */
export class RelationshipValidationError extends Error {
  constructor(
    message: string,
    public code?: string,
    public labelParams?: Readonly<Record<string, string>>
  ) {
    super(message);
    this.name = 'RelationshipValidationError';
  }
}

export class DuplicateRelationshipError extends RelationshipValidationError {
  constructor(message: string, labelParams?: Readonly<Record<string, string>>) {
    super(message, 'DUPLICATE_RELATIONSHIP', labelParams);
  }
}

export class InvalidRelationshipError extends RelationshipValidationError {
  constructor(message: string, labelParams?: Readonly<Record<string, string>>) {
    super(message, 'INVALID_RELATIONSHIP', labelParams);
  }
}

// ============================================================================
// VALIDATION SERVICE CLASS
// ============================================================================

/**
 * 🔍 Relationship Validation Service
 *
 * Enterprise-grade validation service για contact relationships.
 * Implements comprehensive business rule validation and data integrity checks.
 *
 * Features:
 * - Required field validation
 * - Business rule enforcement
 * - Contact type compatibility checks
 * - Self-relationship prevention
 * - Custom validation rules
 */
export class RelationshipValidationService {

  // ========================================================================
  // CORE VALIDATION METHODS
  // ========================================================================

  /**
   * 🔍 Validate Relationship Data (Complete Validation)
   *
   * Performs complete validation including required fields,
   * business rules, and contact compatibility
   */
  static async validateRelationshipData(
    data: Partial<ContactRelationship>,
    sourceContact?: Contact,
    targetContact?: Contact
  ): Promise<void> {
    // Required field validation
    this.validateRequiredFields(data);

    // Self-relationship validation
    this.validateSelfRelationship(data);

    // Business rule validation (if contacts provided)
    if (sourceContact && targetContact) {
      this.validateBusinessRules(sourceContact.type, targetContact.type, data.relationshipType!);
    }

    // Data integrity validation
    this.validateDataIntegrity(data);
  }

  /**
   * 📋 Validate Required Fields
   */
  static validateRequiredFields(data: Partial<ContactRelationship>): void {
    if (!data.sourceContactId) {
      throw new RelationshipValidationError('relationships.form.validation.sourceContactRequired');
    }

    if (!data.targetContactId) {
      throw new RelationshipValidationError('relationships.form.validation.contactRequired');
    }

    if (!data.relationshipType) {
      throw new RelationshipValidationError('relationships.form.validation.relationshipTypeRequired');
    }

    // Validate contact IDs format
    if (typeof data.sourceContactId !== 'string' || data.sourceContactId.trim() === '') {
      throw new RelationshipValidationError('relationships.form.validation.invalidSourceFormat');
    }

    if (typeof data.targetContactId !== 'string' || data.targetContactId.trim() === '') {
      throw new RelationshipValidationError('relationships.form.validation.invalidTargetFormat');
    }
  }

  /**
   * 🚫 Validate Self-Relationship
   */
  static validateSelfRelationship(data: Partial<ContactRelationship>): void {
    if (data.sourceContactId === data.targetContactId) {
      throw new RelationshipValidationError('relationships.form.validation.selfRelationship');
    }
  }

  /**
   * 🎯 Validate Business Rules — ADR-372 §Β2
   *
   * ONE rule: the STORED direction (source → target) must be a crossing the
   * metadata registry declares for this type. No hand-written type lists, no
   * "which side" special cases — the card the user started from is irrelevant
   * because every writer orients the record via `orientRelationship()` first.
   * Custom (registry) types carry no declared crossings ⇒ not checked here.
   */
  static validateBusinessRules(
    sourceType: ContactType,
    targetType: ContactType,
    relationshipType: string
  ): void {
    if (!isRelationshipType(relationshipType)) return;
    if (!isStoredCrossingValid(relationshipType, sourceType, targetType)) {
      throw new InvalidRelationshipError(
        'relationships.form.validation.crossingNotAllowed',
        { type: relationshipRoleLabelKey(relationshipType, 'source') }
      );
    }
  }

  /**
   * 🔧 Validate Data Integrity
   */
  static validateDataIntegrity(data: Partial<ContactRelationship>): void {
    // Validate dates
    if (data.startDate && data.endDate) {
      const startDate = new Date(data.startDate);
      const endDate = new Date(data.endDate);

      if (endDate < startDate) {
        throw new RelationshipValidationError(
          'relationships.form.validation.endDateBeforeStart'
        );
      }
    }

    // Validate status
    if (data.status && !['active', 'inactive', 'terminated', 'pending'].includes(data.status)) {
      throw new RelationshipValidationError(
        'relationships.form.validation.invalidStatus'
      );
    }

    // Validate priority
    if (data.priority && !['low', 'medium', 'high', 'critical'].includes(data.priority)) {
      throw new RelationshipValidationError(
        'relationships.form.validation.invalidPriority'
      );
    }

    // Validate relationship strength
    if (data.relationshipStrength &&
        !['weak', 'moderate', 'strong', 'very_strong'].includes(data.relationshipStrength)) {
      throw new RelationshipValidationError(
        'relationships.form.validation.invalidStrength'
      );
    }

    // Validate employment specific fields
    if (isEmploymentRelationship(data as ContactRelationship)) {
      if (data.employmentStatus &&
          !['full_time', 'part_time', 'contract', 'internship', 'volunteer'].includes(data.employmentStatus)) {
        throw new RelationshipValidationError(
          'relationships.form.validation.invalidEmploymentStatus'
        );
      }

      if (data.employmentType &&
          !['permanent', 'temporary', 'seasonal', 'project_based'].includes(data.employmentType)) {
        throw new RelationshipValidationError(
          'relationships.form.validation.invalidEmploymentType'
        );
      }
    }

    // Validate contact info format
    if (data.contactInfo) {
      if (data.contactInfo.businessEmail && !this.isValidEmail(data.contactInfo.businessEmail)) {
        throw new RelationshipValidationError(
          'relationships.form.validation.invalidEmailFormat'
        );
      }

      if (data.contactInfo.businessPhone && !this.isValidPhone(data.contactInfo.businessPhone)) {
        throw new RelationshipValidationError(
          'relationships.form.validation.invalidPhoneFormat'
        );
      }
    }
  }

  // ========================================================================
  // DUPLICATE VALIDATION
  // ========================================================================

  /**
   * 🔍 Validate Duplicate Relationship
   *
   * Checks if relationship already exists between contacts
   */
  static validateDuplicateRelationship(
    existingRelationship: ContactRelationship | null,
    newRelationshipData: Partial<ContactRelationship>
  ): void {
    if (existingRelationship) {
      throw new DuplicateRelationshipError(
        'relationships.form.validation.duplicateRelationship'
      );
    }
  }

  /**
   * 🔍 Validate Same Contact - Same Relationship Type Duplicates
   *
   * Prevents the same contact from being added multiple times with the same relationship type.
   * E.g., prevents the same person from being "Employee" twice, or same company from being "Consultant" twice.
   *
   * ADR-372 §Β2: compares ORIENTED records. For a directed type, «A is shareholder
   * of B» and «B is shareholder of A» are different facts; for a symmetric type
   * the order is irrelevant.
   *
   * @param existingRelationships - Existing relationships of the current contact
   * @param candidate - The oriented record about to be written
   * @param editingId - Optional ID of relationship being edited (excluded)
   */
  static validateSameContactSameType(
    existingRelationships: ContactRelationship[],
    candidate: { sourceContactId: string; targetContactId: string; relationshipType: string },
    editingId?: string
  ): void {
    const symmetric = !isRelationshipType(candidate.relationshipType)
      || isSymmetricRelationshipType(candidate.relationshipType);
    const sameEndpoints = (rel: ContactRelationship): boolean => {
      const forward = rel.sourceContactId === candidate.sourceContactId
        && rel.targetContactId === candidate.targetContactId;
      const backward = rel.sourceContactId === candidate.targetContactId
        && rel.targetContactId === candidate.sourceContactId;
      return forward || (symmetric && backward);
    };
    const duplicate = existingRelationships.find(rel =>
      rel.id !== editingId
      && rel.relationshipType === candidate.relationshipType
      && sameEndpoints(rel)
    );

    if (duplicate) {
      throw new DuplicateRelationshipError(
        'relationships.form.validation.sameContactSameType',
        { type: relationshipRoleLabelKey(candidate.relationshipType, 'source') }
      );
    }
  }

  // ========================================================================
  // HELPER VALIDATION METHODS
  // ========================================================================

  /**
   * 📧 Validate Email Format
   * ✅ ENTERPRISE MIGRATION: Using centralized email validation
   */
  private static isValidEmail(email: string): boolean {
    // ✅ ADR-209: Using centralized email validation (clean ES import)
    return isValidEmailFn(email);
  }

  /**
   * 📱 Validate Phone Format (Greek/International)
   */
  private static isValidPhone(phone: string): boolean {
    // ✅ ADR-212: delegate to centralized phone validation
    return isValidPhoneFn(phone);
  }

  /**
   * 🆔 Validate Contact ID Format
   */
  static isValidContactId(contactId: string): boolean {
    if (contactId === 'new-contact') return false;
    return isNonEmptyTrimmedString(contactId);
  }

  /**
   * 🔄 Validate Relationship Type — derived from the metadata registry (ADR-372 §Β1),
   * never from a hand-written list (the old one had silently drifted to 31 of 37).
   */
  static isValidRelationshipType(type: string): type is RelationshipType {
    return isRelationshipType(type);
  }

  // ========================================================================
  // BATCH VALIDATION
  // ========================================================================

  /**
   * 📋 Validate Bulk Relationships
   *
   * Validates multiple relationships for bulk operations
   */
  static async validateBulkRelationships(
    relationships: Partial<ContactRelationship>[]
  ): Promise<{ valid: Partial<ContactRelationship>[]; errors: Array<{ index: number; error: string }> }> {
    const valid: Partial<ContactRelationship>[] = [];
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < relationships.length; i++) {
      try {
        await this.validateRelationshipData(relationships[i]);
        valid.push(relationships[i]);
      } catch (error) {
        errors.push({
          index: i,
          error: getErrorMessage(error, 'Unknown validation error')
        });
      }
    }

    return { valid, errors };
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export default RelationshipValidationService;
