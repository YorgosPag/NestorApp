/**
 * =============================================================================
 * Profession Bridge Service — Auto-fill contact profession from project role
 * =============================================================================
 *
 * When a contact is assigned to a project as an engineer (e.g. architect),
 * this service checks if the contact has a profession set. If not, it
 * auto-fills it using the ESCO taxonomy mapping.
 *
 * Google "smart defaults" pattern: the system fills in the obvious answer,
 * the user can change it later.
 *
 * @module services/profession-bridge.service
 * @enterprise ADR-282 - Google Derived Roles Pattern
 */

import { ContactsService } from '@/services/contacts.service';
import { EscoService } from '@/services/esco.service';
import { getProfessionForRole } from '@/config/profession-bridge.config';
import { createModuleLogger } from '@/lib/telemetry';
import type { Contact } from '@/types/contacts/contracts';

const logger = createModuleLogger('ProfessionBridge');

// ============================================================================
// TYPES
// ============================================================================

interface BridgeResult {
  /** Whether the profession was updated */
  updated: boolean;
  /** The profession label that was set (if updated) */
  profession?: string;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Checks if the contact has no profession and auto-fills it from the role mapping.
 *
 * Rules:
 * - Only fills for roles in PROJECT_ROLE_TO_PROFESSION mapping
 * - Only fills for individual contacts (not company/service)
 * - Never overwrites an existing profession
 * - Attempts ESCO URI lookup for full taxonomy integration
 */
export async function maybeFillProfessionFromRole(
  contactId: string,
  role: string
): Promise<BridgeResult> {
  const mapping = getProfessionForRole(role);
  if (!mapping) return { updated: false };

  const contact = await ContactsService.getContact(contactId);
  if (!contact) return { updated: false };
  if (contact.type !== 'individual') return { updated: false };

  const individualContact = contact as Extract<Contact, { type: 'individual' }>;
  if (individualContact.profession?.trim()) return { updated: false };

  const escoUri = await resolveEscoUri(mapping.escoSearchHint);

  const updatePayload: Record<string, string | null> = {
    profession: mapping.profession,
    escoLabel: mapping.escoLabel,
    iscoCode: mapping.iscoCode,
    escoUri: escoUri ?? null,
  };

  await ContactsService.updateContact(contactId, updatePayload);
  logger.info(`Auto-filled profession for ${contactId}: ${mapping.profession}`);

  return { updated: true, profession: mapping.profession };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Attempts to resolve the ESCO URI from the cache via search.
 * Returns null if not found (profession still gets set without URI).
 */
async function resolveEscoUri(searchHint: string): Promise<string | null> {
  try {
    const response = await EscoService.searchOccupations({
      query: searchHint,
      language: 'el',
      limit: 1,
    });

    if (response.results.length > 0) {
      return response.results[0].occupation.uri;
    }
    return null;
  } catch {
    logger.warn('ESCO URI lookup failed, proceeding without URI');
    return null;
  }
}
