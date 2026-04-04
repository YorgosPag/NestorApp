/**
 * =============================================================================
 * Profession Bridge Service — Auto-fill contact profession from project role
 * =============================================================================
 *
 * When a contact is assigned to a project as an engineer (e.g. architect),
 * this service checks if the contact has a profession set. If not:
 *
 * 1. Searches the ESCO cache → uses REAL ESCO data (preferred label, URI, ISCO)
 * 2. If no ESCO match → falls back to hardcoded profession from config
 *
 * Google "smart defaults" pattern: the system fills in the obvious answer,
 * the user can change it later.
 *
 * @module services/profession-bridge.service
 * @enterprise ADR-282 - Google Derived Roles Pattern
 */

import { ContactsService } from '@/services/contacts.service';
import { EscoService } from '@/services/esco.service';
import { getBridgeEntry } from '@/config/profession-bridge.config';
import { createModuleLogger } from '@/lib/telemetry';
import type { Contact } from '@/types/contacts/contracts';
import type { EscoOccupation } from '@/types/contacts/esco-types';

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
 * Strategy: ESCO cache first → hardcoded fallback → never overwrites existing.
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

  // Strategy: ESCO cache first, hardcoded fallback
  const occupation = await findEscoOccupation(entry.escoSearchHint);

  const payload = occupation
    ? buildEscoPayload(occupation)
    : buildFallbackPayload(entry.fallbackProfession, entry.fallbackIscoCode);

  await ContactsService.updateContact(contactId, payload);

  const profession = payload.profession;
  const source = occupation ? 'ESCO' : 'fallback';
  logger.info(`Auto-filled profession [${source}]: ${profession} (${contactId})`);

  return { updated: true, profession };
}

// ============================================================================
// HELPERS
// ============================================================================

function buildEscoPayload(occupation: EscoOccupation): Record<string, string> {
  return {
    profession: occupation.preferredLabel.el,
    escoLabel: occupation.preferredLabel.el,
    iscoCode: occupation.iscoCode,
    escoUri: occupation.uri,
  };
}

function buildFallbackPayload(
  profession: string,
  iscoCode: string
): Record<string, string | null> {
  return {
    profession,
    escoLabel: profession,
    iscoCode,
    escoUri: null,
  };
}

async function findEscoOccupation(hint: string): Promise<EscoOccupation | null> {
  try {
    const response = await EscoService.searchOccupations({
      query: hint,
      language: 'el',
      limit: 1,
    });
    return response.results.length > 0 ? response.results[0].occupation : null;
  } catch {
    logger.warn('ESCO cache search failed, using fallback');
    return null;
  }
}
