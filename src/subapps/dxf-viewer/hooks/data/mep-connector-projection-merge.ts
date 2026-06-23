/**
 * MEP connector-projection adapter for the `mergeDocsIntoScene` snapshot merge
 * (ADR-408 idle-loop fix · ADR-390).
 *
 * Πριν, ΚΑΘΕ MEP persistence hook (fixture/boiler/radiator/water-heater/underfloor/
 * manifold/electrical-panel) είχε **copy-pasted** το ΙΔΙΟ projection block: χτίζε το
 * fresh doc-entity, project-άρε το live (reconciler-owned) `systemId` cache πάνω στους
 * connectors του, αγνόησε το non-authoritative `systemId` του doc. Χωρίς αυτό, το diff
 * διαφωνεί με τον reconciler σε κάθε snapshot και ping-pong-άρει το `setLevelScene`
 * για πάντα. Πλέον ζει **ΜΙΑ φορά** εδώ, ως ο `docToEntity(doc, existing)` adapter
 * του generic SSoT (reuse του `projectConnectorSystemIds` — μηδέν re-implementation).
 *
 * @see ../../bim/mep-systems/mep-system-coordinator.ts — `projectConnectorSystemIds` SSoT
 * @see ./merge-docs-into-scene.ts — generic merge (καλεί `docToEntity(doc, existing)`)
 */

import type { MepConnector } from '../../bim/types/mep-connector-types';
import { projectConnectorSystemIds } from '../../bim/mep-systems/mep-system-coordinator';

/** Scene entity whose `params` carry MEP connectors (fixture/boiler/radiator/…). */
export interface MepConnectorEntity {
  readonly params: { readonly connectors?: readonly MepConnector[] };
}

/**
 * Project the live (reconciler-owned) systemIds onto a **fresh** doc-entity
 * (ADR-408). Returns `fresh` unchanged on first add (`existing === null`) or when
 * nothing projected (identity bail = zero scene churn).
 *
 * @param fresh    Entity hydrated from the incoming `MepXDoc`.
 * @param existing Current in-scene entity (carries the authoritative systemIds), or
 *                 `null` when this doc has no scene entity yet (add path).
 */
export function projectMepConnectorsOntoFresh<T extends MepConnectorEntity>(
  fresh: T,
  existing: T | null,
): T {
  if (!existing) return fresh;
  const freshConnectors = fresh.params.connectors ?? [];
  const projected = projectConnectorSystemIds(freshConnectors, existing.params.connectors);
  return projected === freshConnectors
    ? fresh
    : ({ ...fresh, params: { ...fresh.params, connectors: projected } } as T);
}
