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
import { isValidEmail as isValidEmailFn } from '@/lib/validation/email-validation';
import { getErrorMessage } from '@/lib/error-utils';
import { isValidPhone as isValidPhoneFn } from '@/lib/validation/phone-validation';
import { isNonEmptyTrimmedString } from '@/lib/type-guards';
import { Contact } from '@/types/contacts';

// ============================================================================
// VALIDATION ERROR TYPES
// ============================================================================

export class RelationshipValidationError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'RelationshipValidationError';
  }
}

export class DuplicateRelationshipError extends RelationshipValidationError {
  constructor(message: string) {
    super(message, 'DUPLICATE_RELATIONSHIP');
  }
}

export class InvalidRelationshipError extends RelationshipValidationError {
  constructor(message: string) {
    super(message, 'INVALID_RELATIONSHIP');
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
   * 🎯 Validate Business Rules - Simplified to avoid circular dependencies
   *
   * Validates business-specific rules για relationship creation
   */
  static validateBusinessRules(
    sourceType: string,
    targetType: string,
    relationshipType: RelationshipType
  ): void {
    // Employment relationship types
    const employmentTypes = ['employee', 'manager', 'director', 'executive', 'intern', 'contractor', 'civil_servant', 'department_head', 'ministry_official'];
    const isEmployment = employmentTypes.includes(relationshipType);

    // Government relationship types
    const governmentTypes = ['civil_servant', 'elected_official', 'appointed_official', 'department_head', 'ministry_official', 'mayor', 'deputy_mayor', 'regional_governor'];
    const isGovernment = governmentTypes.includes(relationshipType);

    // Individual can't be an employee of another individual
    if (sourceType === 'individual' && targetType === 'individual' && isEmployment) {
      throw new InvalidRelationshipError(
        'relationships.form.validation.individualEmploymentIndividual'
      );
    }

    // Service contacts can only have government, employment, or approved general relationships
    if (targetType === 'service' && !isGovernment && !isEmployment) {
      const allowedForServices = ['representative', 'advisor', 'consultant', 'client'];
      if (!allowedForServices.includes(relationshipType)) {
        throw new InvalidRelationshipError(
          'relationships.form.validation.invalidTypeForService'
        );
      }
    }

    // Company ownership validation
    if (relationshipType === 'shareholder' && targetType !== 'company') {
      throw new InvalidRelationshipError(
        'relationships.form.validation.shareholderRequiresCompany'
      );
    }

    // Employment relationship validation
    if (isEmployment) {
      // Company cannot be employee of another company
      if (sourceType === 'company') {
        throw new InvalidRelationshipError(
          'relationships.form.validation.companyCannotBeEmployee'
        );
      }

      // Service cannot be employee of company
      if (sourceType === 'service') {
        throw new InvalidRelationshipError(
          'relationships.form.validation.serviceCannotBeEmployee'
        );
      }

      // Original rule: Employment relationships require a company or service as target
      if (targetType === 'individual') {
        throw new InvalidRelationshipError(
          'relationships.form.validation.employmentRequiresCompanyTarget'
        );
      }
    }

    // Government relationship validation
    if (isGovernment) {
      if (targetType !== 'service') {
        throw new InvalidRelationshipError(
          'relationships.form.validation.governmentRequiresService'
        );
      }
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
   * @param existingRelationships - Array of existing relationships for the source contact
   * @param targetContactId - The target contact ID to check
   * @param relationshipType - The relationship type to check
   * @param editingId - Optional ID of relationship being edited (to exclude from duplicate check)
   */
  static validateSameContactSameType(
    existingRelationships: ContactRelationship[],
    targetContactId: string,
    relationshipType: RelationshipType,
    editingId?: string
  ): void {
    // Check if the same contact already has the same relationship type
    const duplicate = existingRelationships.find(rel =>
      rel.id !== editingId && // Exclude the relationship being edited
      (rel.sourceContactId === targetContactId || rel.targetContactId === targetContactId) &&
      rel.relationshipType === relationshipType
    );

    if (duplicate) {
      throw new DuplicateRelationshipError(
        `Αυτή η επαφή έχει ήδη δηλωθεί ως "${this.getRelationshipTypeLabel(relationshipType)}". ` +
        `Δεν μπορείτε να προσθέσετε την ίδια επαφή με τον ίδιο τύπο σχέσης δύο φορές.`
      );
    }
  }

  /**
   * 🏢 ENTERPRISE: Get Greek label for relationship type (centralized configuration)
   */
  private static getRelationshipTypeLabel(relationshipType: RelationshipType): string {
    // Import here to avoid circular dependencies
    const { RoleMappingsUtils } = require('@/config/role-mappings-config');
    return RoleMappingsUtils.getRelationshipTypeLabel(relationshipType);
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
   * 🔄 Validate Relationship Type
   */
  static isValidRelationshipType(type: string): type is RelationshipType {
    const validTypes: RelationshipType[] = [
      'employee', 'manager', 'director', 'executive', 'intern', 'contractor',
      'consultant', 'advisor', 'shareholder', 'board_member', 'chairman', 'ceo',
      'client', 'vendor', 'supplier', 'customer', 'partner', 'colleague',
      'mentor', 'protege', 'representative', 'competitor',
      'civil_servant', 'elected_official', 'appointed_official',
      'department_head', 'ministry_official', 'mayor', 'deputy_mayor',
      'regional_governor', 'other'
    ];

    return validTypes.includes(type as RelationshipType);
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
