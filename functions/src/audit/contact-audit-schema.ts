/**
 * =============================================================================
 * CDC AUDIT: What a contact declares about its collections (ADR-195 (η))
 * =============================================================================
 *
 * Pure module (no firebase imports) so the trigger AND its tests read the very
 * same schema. Both halves come from the app SSoT through the CHECK 3.93
 * projection — never edit `../generated/`, change
 * `src/config/audit-collection-identity.ts` and regenerate.
 *
 * @module functions/audit/contact-audit-schema
 * @enterprise ADR-195 — Entity Audit Trail
 */

import type { CdcDiffSchema } from './deep-diff';
import {
  CONTACT_COLLECTION_IDENTITY,
  CONTACT_DERIVED_MIRRORS,
} from '../generated/config/audit-collection-identity';

export const CONTACT_AUDIT_SCHEMA: CdcDiffSchema = {
  collections: CONTACT_COLLECTION_IDENTITY,
  derivedMirrors: CONTACT_DERIVED_MIRRORS,
};
