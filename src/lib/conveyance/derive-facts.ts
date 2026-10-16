/**
 * =============================================================================
 * Conveyance — γεγονότα της υπόθεσης: παραγόμενα vs ερωτήσεις (ADR-901 §5.5)
 * =============================================================================
 *
 * 🔑 Ποτέ δεν ρωτάμε ό,τι ήδη ξέρουν τα δεδομένα (σχήμα TurboTax: ερωτήσεις μόνο για
 *    το άγνωστο). Τα παραγόμενα γεγονότα βγαίνουν από το προφίλ, τον τύπο ακινήτου, τα
 *    παρακολουθήματα και τους οικοπεδούχους του έργου (αντιπαροχή, ADR-901 §2 Ε-ΣΤ).
 *    Ρητή απάντηση στην υπόθεση **υπερισχύει** του παραγόμενου — όχι όμως της συνεπαγωγής που ορίζει ο νόμος
 *    (`FACT_ENTAILMENTS`): αυτή εφαρμόζεται **τελευταία**, και στα δύο βήματα.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις.
 *
 * @module lib/conveyance/derive-facts
 */

import { isStandaloneUnitType, LAND_PROPERTY_TYPES } from '@/constants/property-types';
import type { ConveyanceFactId, ConveyanceProfile } from '@/config/conveyance-checklist/types';
import { FACT_ENTAILMENTS } from '@/config/conveyance-checklist/fact-entailments';
import type { ConveyanceFactAnswer, ConveyancePartyFactAnswers, ConveyanceSellerParty } from '@/types/conveyance-case';
import { hasPrincipalSeller } from './case-parties';

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
    facts.existing_building_with_manager = false;
    if (sources.landownerCount !== null) facts.has_antiparochi = sources.landownerCount > 0;
  }
  return applyFactEntailments(Object.fromEntries(
    Object.entries(facts).filter(([, value]) => value !== undefined),
  ) as FactValues);
}

/**
 * Η προϋπόθεση που **επιβάλλει** την τιμή του γεγονότος (`null` = καμία) — ό,τι δείχνει η διεπαφή ως «από τον νόμο».
 * Ελέγχεται πάνω σε **επιλυμένες** τιμές.
 */
export function factEntailedBy(facts: FactValues, factId: ConveyanceFactId): ConveyanceFactId | null {
  const rule = FACT_ENTAILMENTS.find((entailment) => entailment.then.fact === factId && facts[entailment.when.fact] === entailment.when.equals);
  return rule?.when.fact ?? null;
}

/** Εφαρμόζει τις συνεπαγωγές ως σταθερό σημείο (αλυσίδες κλείνουν σε ≤ πλήθος κανόνων περάσματα). Ιδεμπότητη. */
export function applyFactEntailments(facts: FactValues): FactValues {
  const next: Partial<Record<ConveyanceFactId, boolean>> = { ...facts };
  for (let pass = 0; pass < FACT_ENTAILMENTS.length; pass++) {
    let changed = false;
    for (const { when, then } of FACT_ENTAILMENTS) {
      if (next[when.fact] !== when.equals || next[then.fact] === then.value) continue;
      next[then.fact] = then.value;
      changed = true;
    }
    if (!changed) break;
  }
  return next;
}

/** Τελικές τιμές: συνεπαγωγή νόμου > ρητή απάντηση > παραγόμενο. */
export function resolveFacts(
  derived: FactValues,
  answers: Readonly<Partial<Record<ConveyanceFactId, ConveyanceFactAnswer>>>,
): FactValues {
  const resolved: Partial<Record<ConveyanceFactId, boolean>> = { ...derived };
  for (const [factId, answer] of Object.entries(answers) as [ConveyanceFactId, ConveyanceFactAnswer | undefined][]) {
    if (answer) resolved[factId] = answer.value;
  }
  return applyFactEntailments(resolved);
}

/**
 * ADR-915 §22 — γεγονότα **ενός προσώπου** που παράγονται από τα δεδομένα: φυσικό ή νομικό πρόσωπο είναι γνωστό από
 * το ίδιο το πρόσωπο, άρα **δεν** ρωτιέται. (Πριν από την §22 παραγόταν από το προφίλ — «νεόδμητο ⇒ εταιρεία» — που
 * έλεγε ψέματα για κάθε συμπωλητή-ιδιώτη.)
 *
 * §23 — και η **ιδιότητα**: οικοπεδούχος του έργου ⇒ `seller_is_landowner`· οικοπεδούχος **με** τον εργολάβο
 * συμβαλλόμενο (`principal` στους μεταβιβάζοντες) ⇒ η φορολογική ενημερότητα προσκομίζεται από τον εργολάβο (Α.1002/2019).
 * Παραγόμενο, όχι νόμος: το «υπάρχει προσύμφωνο εργολαβίας;» το ξέρει ο άνθρωπος, που μπορεί να το διορθώσει.
 */
export function derivePartyFacts(
  party: Pick<ConveyanceSellerParty, 'kind' | 'capacity'>,
  sellers: readonly Pick<ConveyanceSellerParty, 'capacity'>[],
): FactValues {
  const isLandowner = party.capacity === 'landowner';
  return applyFactEntailments({
    seller_is_legal_entity: party.kind === 'legal_entity',
    seller_is_landowner: isLandowner,
    seller_tax_clearance_by_contractor: isLandowner && hasPrincipalSeller(sellers),
  });
}

/** Οι τελικές τιμές ενός προσώπου — η **ίδια** επίλυση με της υπόθεσης (νόμος > απάντηση > παραγόμενο). */
export function resolvePartyFacts(
  party: ConveyanceSellerParty,
  record: { readonly parties: { readonly sellers: readonly ConveyanceSellerParty[] }; readonly partyFacts: ConveyancePartyFactAnswers },
): FactValues {
  return resolveFacts(derivePartyFacts(party, record.parties.sellers), record.partyFacts[party.key] ?? {});
}
