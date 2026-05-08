/**
 * Composite ID helper for the user_preferences collection.
 *
 * The doc ID is deterministic — `{userId}_{companyId}` — because each user has
 * exactly one preferences blob per tenant. This avoids the need for a query
 * lookup and lets `subscribeDoc()` work directly. Same deterministic-composite
 * pattern as `OWNERSHIP_TABLE` (ADR-235).
 *
 * The actual generator lives in `enterprise-id.service` (per N.6 — sole source
 * of Firestore IDs). This module re-exports it under a domain-specific name
 * and adds a parser used by tests / migrations.
 *
 * @module services/user-settings/user-settings-id
 * @enterprise ADR-XXX, ADR-235 (deterministic composite key precedent), N.6
 */

import { generateUserPreferencesId } from '@/services/enterprise-id.service';

/** Build the deterministic Firestore doc ID for a user_preferences document. */
export const buildUserPreferencesDocId = generateUserPreferencesId;
