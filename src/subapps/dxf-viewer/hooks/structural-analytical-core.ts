/**
 * structural-analytical-core — ADR-480 (T2, proactive analytical model).
 *
 * SSoT πυρήνας που (επαν)παράγει τον DERIVED αναλυτικό φορέα από τον στατικό
 * οργανισμό (ADR-459) και:
 *   1. γράφει το μοντέλο στο `AnalyticalModelStore` (single writer = αυτός ο core),
 *   2. emit-άρει `bim:analytical-model-built` → υποδοχή για T3/T4 consumers,
 *   3. επιστρέφει τα προκαταρκτικά diagnostics ευστάθειας **χωρίς** να γράφει το
 *      `StructuralDiagnosticsStore` — αυτό το γράφει ο `useStructuralOrganism` σε
 *      ΕΝΑ pass (διατηρείται ο single-writer του diagnostics store).
 *
 * **Light module (σκόπιμα χωρίς store/firebase imports):** entities/graph/getOffset
 * περνιούνται injected από τον caller → ο πυρήνας μένει jest-clean (mirror του
 * `structural-load-takedown-core`). Pure ως προς τα entities (μηδέν mutation).
 *
 * @see bim/structural/analytical/analytical-model-builder.ts — buildAnalyticalModel (pure)
 * @see bim/structural/analytical/analytical-model-store.ts — ο store που γράφεται
 * @see hooks/useStructuralOrganism.ts — ο caller (single diagnostics writer)
 * @see docs/centralized-systems/reference/adrs/ADR-480-analytical-model-ssot.md
 */

import { EventBus } from '../systems/events/EventBus';
import { buildAnalyticalModel } from '../bim/structural/analytical/analytical-model-builder';
import { runAnalyticalDiagnostics } from '../bim/structural/analytical/analytical-diagnostics';
import { AnalyticalModelStore } from '../bim/structural/analytical/analytical-model-store';
import type { StructuralGraph } from '../bim/structural/organism/structural-organism-types';
import type { StructuralDiagnostic } from '../bim/structural/organism/structural-organism-types';
import type { GuideOffsetLookup } from '../bim/hosting/derive-slots';
import type { Entity } from '../types/entities';

/** Είσοδος του πυρήνα — entities + DERIVED organism graph + guide lookup. */
export interface AnalyticalModelInput {
  readonly entities: readonly Entity[];
  readonly graph: StructuralGraph;
  readonly getOffset?: GuideOffsetLookup;
}

/**
 * Χτίσε & δημοσίευσε τον αναλυτικό φορέα. Επιστρέφει τα diagnostics ευστάθειας
 * ώστε ο caller να τα ενώσει στο ΕΝΑ diagnostics store write.
 */
export function runStructuralAnalyticalModel(
  input: AnalyticalModelInput,
): readonly StructuralDiagnostic[] {
  const model = buildAnalyticalModel(input);
  AnalyticalModelStore.set(model);
  EventBus.emit('bim:analytical-model-built', {
    nodeCount: model.nodes.length,
    memberCount: model.members.length,
  });
  return runAnalyticalDiagnostics(model);
}
