// ============================================================================
// 🏢 ENTERPRISE RELATIONSHIP MANAGEMENT COMPONENTS - BARREL EXPORTS
// ============================================================================

export { ContactRelationshipManager } from './ContactRelationshipManager';
export { EmployeeSelector } from './EmployeeSelector';
export type { ContactSummary } from './EmployeeSelector';

// Re-export relationship types for convenience
export type {
  ContactRelationship,
  RelationshipType,
  ContactWithRelationship,
  ProfessionalContactInfo,
  OrganizationTree,
  FinancialInfo
} from '@/types/contacts/relationships';

// Re-export service for convenience
export { ContactRelationshipService } from '@/services/contact-relationships.service';