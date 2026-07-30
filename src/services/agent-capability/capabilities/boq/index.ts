/**
 * BOQ Capabilities — Barrel (ADR-734 Φάση 2, τα επτά εργαλεία του §7)
 *
 * Ο κατάλογος παράγεται από **εξαρτήσεις** και όχι από singleton: ποιος
 * `IBOQService` τον τροφοδοτεί το αποφασίζει ο καλών (Φάση 3 — auth/SDK).
 *
 * @module services/agent-capability/capabilities/boq
 * @see ADR-734 §7
 */

import { type AnyCapability, type CapabilityRegistry, createCapabilityRegistry } from '../../registry';
import { createBoqAggregateCapabilities } from './boq-aggregate-capabilities';
import { createBoqItemCapabilities } from './boq-item-capabilities';
import type { BoqCapabilityDeps } from './boq-capability-shared';

export type { BoqCapabilityDeps } from './boq-capability-shared';
export { fetchOwnedBoqItem } from './boq-tenant-guard';
export type { OwnedItemResult } from './boq-tenant-guard';

/** Και τα επτά εργαλεία του ADR-734 §7, με σειρά τομέα. */
export function createBoqCapabilities(deps: BoqCapabilityDeps): readonly AnyCapability[] {
  return [...createBoqAggregateCapabilities(deps), ...createBoqItemCapabilities(deps)];
}

/**
 * Έτοιμο registry για τον τομέα BOQ.
 *
 * Ρίχνει κατά την κατασκευή αν κάποιος ορισμός παραβιάζει τους κανόνες §5.3/§5.4
 * — δηλαδή στο πρώτο import, όχι στο πρώτο αίτημα.
 */
export function createBoqCapabilityRegistry(deps: BoqCapabilityDeps): CapabilityRegistry {
  return createCapabilityRegistry(createBoqCapabilities(deps));
}
