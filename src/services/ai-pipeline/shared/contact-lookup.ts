/**
 * =============================================================================
 * 🏢 ENTERPRISE: CENTRALIZED CONTACT LOOKUP — BARREL
 * =============================================================================
 *
 * Types and barrel re-exports for contact lookup operations.
 * All consumers import from this file — internal modules are implementation details.
 *
 * Split into SRP modules (ADR-065):
 * - contact-lookup-types.ts — type definitions
 * - contact-lookup-search.ts — search/lookup/duplicate detection
 * - contact-lookup-crud.ts — create, update, remove, sync signals
 *
 * @module services/ai-pipeline/shared/contact-lookup
 * @see ADR-080, ADR-145, ADR-227
 */

// ============================================================================
// RE-EXPORTS — Types
// ============================================================================

export type {
  ContactMatch,
  ContactNameSearchResult,
  DuplicateMatch,
  DuplicateCheckResult,
  ContactTypeFilter,
  CreateContactParams,
  CreateContactResult,
} from './contact-lookup-types';

// ============================================================================
// RE-EXPORTS — Search & Lookup
// ============================================================================

export {
  findContactByEmail,
  findContactByPhone,
  findContactByName,
  listContacts,
  getContactById,
  checkContactDuplicates,
} from './contact-lookup-search';

// ============================================================================
// RE-EXPORTS — CRUD & Sync
// ============================================================================

export {
  updateContactField,
  removeContactField,
  getContactMissingFields,
  createContactServerSide,
  emitEntitySyncSignal,
  emitContactSyncSignal,
} from './contact-lookup-crud';
