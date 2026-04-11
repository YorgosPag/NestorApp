/**
 * 🛡️ ENTERPRISE: Persona Removal Guard Registry (ADR-121)
 *
 * Strategy + Registry pattern for persona removal guards.
 * Each guard checks if a persona can be safely removed from a contact.
 * New guard = 1 adapter function + 1 entry in the registry Map.
 */

import type { PersonaType } from '@/types/contacts/personas';
import { BrokerageService } from '@/services/brokerage.service';
import { ClientService } from '@/services/client.service';

// ─── Types ───────────────────────────────────────────────────────────

/** Normalized result — hides service-specific return shapes */
export interface PersonaRemovalGuardResult {
  blocked: boolean;
  /** i18n key for the toast message (null when not blocked) */
  reasonKey: string | null;
}

/** Async guard function signature */
type PersonaRemovalGuardFn = (
  contactId: string,
  companyId: string
) => Promise<PersonaRemovalGuardResult>;

// ─── Guard Adapters ──────────────────────────────────────────────────

const PASS: PersonaRemovalGuardResult = { blocked: false, reasonKey: null };

/** Wraps BrokerageService.hasActiveRecords → normalized result */
async function brokerageGuard(
  contactId: string,
  companyId: string
): Promise<PersonaRemovalGuardResult> {
  const { hasAgreements, hasCommissions } = await BrokerageService.hasActiveRecords(
    contactId,
    companyId
  );
  if (hasAgreements || hasCommissions) {
    return { blocked: true, reasonKey: 'persona.guards.realEstateAgent.blocked' };
  }
  return PASS;
}

/** Wraps ClientService.hasActiveUnits → normalized result */
async function clientGuard(
  contactId: string,
  companyId: string
): Promise<PersonaRemovalGuardResult> {
  const { hasProperties, hasParking, hasStorage } = await ClientService.hasActiveUnits(
    contactId,
    companyId
  );
  if (hasProperties || hasParking || hasStorage) {
    return { blocked: true, reasonKey: 'persona.guards.client.blocked' };
  }
  return PASS;
}

// ─── Registry ────────────────────────────────────────────────────────

/**
 * O(1) lookup map: PersonaType → guard function.
 * Only personas that need a guard are registered.
 * Unregistered personas pass through (fail-open).
 *
 * To add a new guard:
 *   1. Create an adapter function above
 *   2. Add one line here
 */
const PERSONA_REMOVAL_GUARDS: ReadonlyMap<PersonaType, PersonaRemovalGuardFn> = new Map([
  ['real_estate_agent', brokerageGuard],
  ['client', clientGuard],
]);

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Checks whether a persona can be removed from a contact.
 * - If no guard is registered for this persona → returns `{ blocked: false }`
 * - If guard throws → fail-open (allows removal, logs warning)
 */
export async function checkPersonaRemovalGuard(
  personaType: PersonaType,
  contactId: string,
  companyId: string
): Promise<PersonaRemovalGuardResult> {
  const guard = PERSONA_REMOVAL_GUARDS.get(personaType);
  if (!guard) return PASS;

  try {
    return await guard(contactId, companyId);
  } catch (error) {
    // Fail-open: if guard check fails (permissions, network), allow removal
    console.warn(`[PersonaRemovalGuard] ${personaType} check failed — allowing removal:`, error);
    return PASS;
  }
}
