/**
 * =============================================================================
 * Profession Bridge Service — Auto-fill contact profession from project role
 * =============================================================================
 *
 * When a contact is assigned to a project as an engineer (e.g. architect),
 * this service checks if the contact has a profession set. If not, it
 * searches the ESCO cache for the matching occupation and writes ONLY
 * the real ESCO data (preferred label, URI, ISCO code).
 *
 * If no ESCO match is found → nothing is written. Zero guessing.
 *
 * Google "smart defaults" pattern: the system fills in the obvious answer
 * from authoritative data, the user can change it later.
 *
 * @module services/profession-bridge.service
 * @enterprise ADR-282 - Google Derived Roles Pattern
 */

import { ContactsService } from '@/services/contacts.service';
import { EscoService } from '@/services/esco.service';
import { getEscoSearchHint } from '@/config/profession-bridge.config';
import { createModuleLogger } from '@/lib/telemetry';
import type { Contact } from '@/types/contacts/contracts';
import type { EscoOccupation } from '@/types/contacts/esco-types';

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
 * Checks if the contact has no profession and auto-fills it from ESCO cache.
 *
 * Rules:
 * - Only fills for roles that have an ESCO search hint
 * - Only fills for individual contacts (not company/service)
 * - Never overwrites an existing profession
 * - Uses ONLY real ESCO data from cache — if no match, writes nothing
 */
export async function maybeFillProfessionFromRole(
  contactId: string,
  role: string
): Promise<BridgeResult> {
  const searchHint = getEscoSearchHint(role);
  if (!searchHint) return { updated: false };

  const contact = await ContactsService.getContact(contactId);
  if (!contact) return { updated: false };
  if (contact.type !== 'individual') return { updated: false };

  const individualContact = contact as Extract<Contact, { type: 'individual' }>;
  if (individualContact.profession?.trim()) return { updated: false };

  const occupation = await findEscoOccupation(searchHint);
  if (!occupation) {
    logger.warn(`No ESCO match for role "${role}" (hint: "${searchHint}") — skipping`);
    return { updated: false };
  }

  const profession = occupation.preferredLabel.el;

  await ContactsService.updateContact(contactId, {
    profession,
    escoLabel: profession,
    iscoCode: occupation.iscoCode,
    escoUri: occupation.uri,
  });

  logger.info(`Auto-filled profession for ${contactId}: ${profession} (${occupation.uri})`);
  return { updated: true, profession };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Searches the ESCO cache and returns the top occupation match.
 * Returns null if no results found.
 */
async function findEscoOccupation(searchHint: string): Promise<EscoOccupation | null> {
  try {
    const response = await EscoService.searchOccupations({
      query: searchHint,
      language: 'el',
      limit: 1,
    });

    if (response.results.length > 0) {
      return response.results[0].occupation;
    }
    return null;
  } catch {
    logger.warn('ESCO search failed');
    return null;
  }
}
