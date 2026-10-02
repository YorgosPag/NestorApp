/**
 * =============================================================================
 * Conveyance — γεγονότα της υπόθεσης: παραγόμενα vs ερωτήσεις (ADR-901 §5.5)
 * =============================================================================
 *
 * 🔑 Ποτέ δεν ρωτάμε ό,τι ήδη ξέρουν τα δεδομένα (σχήμα TurboTax: ερωτήσεις μόνο για
 *    το άγνωστο). Τα παραγόμενα γεγονότα βγαίνουν από το προφίλ, τον τύπο ακινήτου, τα
 *    παρακολουθήματα και τους οικοπεδούχους του έργου (αντιπαροχή, ADR-901 §2 Ε-ΣΤ).
 *    Ρητή απάντηση στην υπόθεση **υπερισχύει** του παραγόμενου.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις.
 *
 * @module lib/conveyance/derive-facts
 */

import { isStandaloneUnitType, LAND_PROPERTY_TYPES } from '@/constants/property-types';
import type { ConveyanceFactId, ConveyanceProfile } from '@/config/conveyance-checklist/types';
import type { ConveyanceFactAnswer } from '@/types/conveyance-case';

export type FactValues = Readonly<Partial<Record<ConveyanceFactId, boolean>>>;

/** Τα δεδομένα από τα οποία παράγονται γεγονότα — συλλέγονται από τον server. */
export interface FactSources {
  readonly profile: ConveyanceProfile;
  /** Κανονικός τύπος ακινήτου (`PROPERTY_TYPES`) — `null` αν άγνωστος. */
  readonly propertyType: string | null;
  readonly appurtenanceCount: number;
  /** Πλήθος οικοπεδούχων του έργου — `null` αν δεν διαβάστηκε το έργο. */
  readonly landownerCount: number | null;
}

function multiOwnerBuildingOf(propertyType: string | null): boolean | undefined {
  if (propertyType === null) return undefined;
  if ((LAND_PROPERTY_TYPES as readonly string[]).includes(propertyType)) return false;
  return !isStandaloneUnitType(propertyType);
}

/** Γεγονότα που παράγονται από τα δεδομένα (`undefined` = δεν παράγεται ⇒ ερώτηση). */
export function deriveFacts(sources: FactSources): FactValues {
  const isNewBuild = sources.profile === 'new_build_company';
  const facts: Partial<Record<ConveyanceFactId, boolean>> = {
    is_new_build: isNewBuild,
    has_appurtenances: sources.appurtenanceCount > 0,
    is_unit_in_multi_owner_building: multiOwnerBuildingOf(sources.propertyType),
  };
  if (isNewBuild) {
    facts.seller_is_legal_entity = true;
    facts.existing_building_with_manager = false;
    if (sources.landownerCount !== null) facts.has_antiparochi = sources.landownerCount > 0;
  }
  return Object.fromEntries(
    Object.entries(facts).filter(([, value]) => value !== undefined),
  ) as FactValues;
}

/** Τελικές τιμές: ρητή απάντηση > παραγόμενο. */
export function resolveFacts(
  derived: FactValues,
  answers: Readonly<Partial<Record<ConveyanceFactId, ConveyanceFactAnswer>>>,
): FactValues {
  const resolved: Partial<Record<ConveyanceFactId, boolean>> = { ...derived };
  for (const [factId, answer] of Object.entries(answers) as [ConveyanceFactId, ConveyanceFactAnswer | undefined][]) {
    if (answer) resolved[factId] = answer.value;
  }
  return resolved;
}
