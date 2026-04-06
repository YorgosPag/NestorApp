/**
 * =============================================================================
 * 🏢 ENTERPRISE: CONTACT LOOKUP — TYPE DEFINITIONS
 * =============================================================================
 *
 * Shared types for contact lookup, search, and CRUD operations.
 *
 * @module services/ai-pipeline/shared/contact-lookup-types
 * @see ADR-080, ADR-145
 */

/** Result of a successful contact match */
export interface ContactMatch {
  contactId: string;
  name: string;
}

/** Result of a contact search by name (ADR-145) */
export interface ContactNameSearchResult {
  contactId: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  type: string | null;
}

/** Single duplicate match with match type and confidence */
export interface DuplicateMatch {
  type: 'email' | 'phone' | 'name';
  confidence: 'exact' | 'fuzzy';
  contactId: string;
  name: string;
  email: string | null;
  phone: string | null;
}

/** Result of multi-criteria duplicate check */
export interface DuplicateCheckResult {
  hasDuplicate: boolean;
  matches: DuplicateMatch[];
}

/** Filter type for listing contacts */
export type ContactTypeFilter = 'individual' | 'company' | 'all';

/** Parameters for creating a contact via Admin SDK */
export interface CreateContactParams {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  type: 'individual' | 'company';
  companyId: string;
  companyName?: string;
  createdBy: string;
  skipDuplicateCheck?: boolean;
}

/** Result of a successful contact creation */
export interface CreateContactResult {
  contactId: string;
  displayName: string;
}
