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
  RelationshipType
} from '@/types/contacts/relationships';
import { Contact, ContactType } from '@/types/contacts';

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
      await this.validateBusinessRules(sourceContact, targetContact, data.relationshipType!);
    }

    // Data integrity validation
    this.validateDataIntegrity(data);
  }

  /**
   * 📋 Validate Required Fields
   */
  static validateRequiredFields(data: Partial<ContactRelationship>): void {
    if (!data.sourceContactId) {
      throw new RelationshipValidationError('Source contact ID is required');
    }

    if (!data.targetContactId) {
      throw new RelationshipValidationError('Target contact ID is required');
    }

    if (!data.relationshipType) {
      throw new RelationshipValidationError('Relationship type is required');
    }

    // Validate contact IDs format
    if (typeof data.sourceContactId !== 'string' || data.sourceContactId.trim() === '') {
      throw new RelationshipValidationError('Invalid source contact ID format');
    }

    if (typeof data.targetContactId !== 'string' || data.targetContactId.trim() === '') {
      throw new RelationshipValidationError('Invalid target contact ID format');
    }
  }

  /**
   * 🚫 Validate Self-Relationship
   */
  static validateSelfRelationship(data: Partial<ContactRelationship>): void {
    if (data.sourceContactId === data.targetContactId) {
      throw new RelationshipValidationError('Cannot create relationship with self');
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
        'Individual cannot have employment relationship with another individual'
      );
    }

    // Service contacts can only have government-related relationships
    if (targetType === 'service' && !isGovernment) {
      // Allow some general relationships για services
      const allowedForServices = ['representative', 'advisor', 'consultant', 'client'];
      if (!allowedForServices.includes(relationshipType)) {
        throw new InvalidRelationshipError(
          'Invalid relationship type for public service organization'
        );
      }
    }

    // Company ownership validation
    if (relationshipType === 'shareholder' && targetType !== 'company') {
      throw new InvalidRelationshipError(
        'Shareholder relationships can only be created with companies'
      );
    }

    // Employment relationship validation
    if (isEmployment) {
      // Company cannot be employee of another company
      if (sourceType === 'company') {
        throw new InvalidRelationshipError(
          'Μία εταιρεία δεν μπορεί να είναι εργαζόμενη σε άλλη εταιρεία. Επιλέξτε άλλο τύπο σχέσης (π.χ. Σύμβουλος, Συνεργάτης).'
        );
      }

      // Service cannot be employee of company
      if (sourceType === 'service') {
        throw new InvalidRelationshipError(
          'Μία υπηρεσία δεν μπορεί να είναι εργαζόμενη σε εταιρεία. Επιλέξτε άλλο τύπο σχέσης (π.χ. Σύμβουλος, Προμηθευτής).'
        );
      }

      // Original rule: Employment relationships require a company or service as target
      if (targetType === 'individual') {
        throw new InvalidRelationshipError(
          'Employment relationships require a company or service as target'
        );
      }
    }

    // Government relationship validation
    if (isGovernment) {
      if (targetType !== 'service') {
        throw new InvalidRelationshipError(
          'Government relationships can only be created with public services'
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
          'End date cannot be before start date'
        );
      }
    }

    // Validate status
    if (data.status && !['active', 'inactive', 'terminated', 'pending'].includes(data.status)) {
      throw new RelationshipValidationError(
        'Invalid relationship status'
      );
    }

    // Validate priority
    if (data.priority && !['low', 'medium', 'high', 'critical'].includes(data.priority)) {
      throw new RelationshipValidationError(
        'Invalid priority level'
      );
    }

    // Validate relationship strength
    if (data.relationshipStrength &&
        !['weak', 'moderate', 'strong', 'very_strong'].includes(data.relationshipStrength)) {
      throw new RelationshipValidationError(
        'Invalid relationship strength'
      );
    }

    // Validate employment specific fields
    if (isEmploymentRelationship(data as ContactRelationship)) {
      if (data.employmentStatus &&
          !['full_time', 'part_time', 'contract', 'internship', 'volunteer'].includes(data.employmentStatus)) {
        throw new RelationshipValidationError(
          'Invalid employment status'
        );
      }

      if (data.employmentType &&
          !['permanent', 'temporary', 'seasonal', 'project_based'].includes(data.employmentType)) {
        throw new RelationshipValidationError(
          'Invalid employment type'
        );
      }
    }

    // Validate contact info format
    if (data.contactInfo) {
      if (data.contactInfo.businessEmail && !this.isValidEmail(data.contactInfo.businessEmail)) {
        throw new RelationshipValidationError(
          'Invalid business email format'
        );
      }

      if (data.contactInfo.businessPhone && !this.isValidPhone(data.contactInfo.businessPhone)) {
        throw new RelationshipValidationError(
          'Invalid business phone format'
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
        `Relationship already exists between contacts (ID: ${existingRelationship.id})`
      );
    }
  }

  // ========================================================================
  // HELPER VALIDATION METHODS
  // ========================================================================

  /**
   * 📧 Validate Email Format
   */
  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * 📱 Validate Phone Format (Greek/International)
   */
  private static isValidPhone(phone: string): boolean {
    // Remove spaces, dashes, parentheses
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');

    // Greek mobile: 69XXXXXXXX or +3069XXXXXXXX
    // Greek landline: 2XXXXXXXXX or +302XXXXXXXXX
    // International: +XXXXXXXXXXXX
    const phoneRegex = /^(\+30)?(69\d{8}|2\d{9})$|^\+\d{10,15}$/;
    return phoneRegex.test(cleanPhone);
  }

  /**
   * 🆔 Validate Contact ID Format
   */
  static isValidContactId(contactId: string): boolean {
    if (contactId === 'new-contact') return false;
    return typeof contactId === 'string' && contactId.trim().length > 0;
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
          error: error instanceof Error ? error.message : 'Unknown validation error'
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