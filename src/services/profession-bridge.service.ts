/**
 * =============================================================================
 * Profession Bridge Service — Auto-fill contact profession from project role
 * =============================================================================
 *
 * When a contact is assigned to a project as an engineer (e.g. architect),
 * this service checks if the contact has a profession set. If not, it
 * writes the verified ESCO data directly from the static mapping.
 *
 * 5/7 roles have exact ESCO URIs (verified against EU API 2026-04-04).
 * 2/7 roles are Greek TEE-specific (hardcoded, no URI).
 *
 * Google "smart defaults" pattern: the system fills in the obvious answer,
 * the user can change it later.
 *
 * @module services/profession-bridge.service
 * @enterprise ADR-282 - Google Derived Roles Pattern
 */

import { ContactsService } from '@/services/contacts.service';
import { getBridgeEntry } from '@/config/profession-bridge.config';
import { createModuleLogger } from '@/lib/telemetry';
import type { Contact } from '@/types/contacts/contracts';

const logger = createModuleLogger('ProfessionBridge');

// ============================================================================
// TYPES
// ============================================================================

interface BridgeResult {
  updated: boolean;
  profession?: string;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Auto-fills contact profession from project role assignment.
 *
 * Rules:
 * - Only fills for the 7 project engineer roles
 * - Only fills for individual contacts (not company/service)
 * - Never overwrites an existing profession
 * - Uses verified ESCO data (URI + ISCO) where available
 */
export async function maybeFillProfessionFromRole(
  contactId: string,
  role: string
): Promise<BridgeResult> {
  const entry = getBridgeEntry(role);
  if (!entry) return { updated: false };

  const contact = await ContactsService.getContact(contactId);
  if (!contact) return { updated: false };
  if (contact.type !== 'individual') return { updated: false };

  const individual = contact as Extract<Contact, { type: 'individual' }>;
  if (individual.profession?.trim()) return { updated: false };

  const updatePayload: Record<string, string | null> = {
    profession: entry.profession,
    escoLabel: entry.escoLabel,
    iscoCode: entry.iscoCode,
    escoUri: entry.escoUri,
  };

  await ContactsService.updateContact(contactId, updatePayload);
  logger.info(`Auto-filled profession: ${entry.profession} (${contactId})`);

  return { updated: true, profession: entry.profession };
}
