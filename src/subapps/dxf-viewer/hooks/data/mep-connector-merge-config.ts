'use client';

/**
 * ADR-594 — Shared `mergeDocsIntoScene` config for MEP entities that carry
 * connectors (radiator / manifold / water-heater / fixture / underfloor /
 * electrical-panel / boiler).
 *
 * Every connector-bearing MEP persistence hook fed `mergeDocsIntoScene` the same
 * adapter: project the reconciler-owned `systemIds` onto the fresh doc-entity
 * (`projectMepConnectorsOntoFresh`, ADR-408 anti-ping-pong) and diff on the
 * projected candidate. This is that adapter, once — the per-hook config is now just
 * `config: mepConnectorMergeConfig(isX, xDocToEntity)`.
 *
 * @see ./mep-connector-projection-merge.ts — the projection SSoT
 * @see ./create-bim-entity-persistence-hook.ts — the factory
 */

import { dequal } from 'dequal';

import type { AnySceneEntity } from '../../types/entities';
import { projectMepConnectorsOntoFresh, type MepConnectorEntity } from './mep-connector-projection-merge';
import type { DocsMergeConfig } from './merge-docs-into-scene';

export function mepConnectorMergeConfig<
  TDoc extends { id: string; params: TEntity['params'] },
  TEntity extends MepConnectorEntity & AnySceneEntity,
>(
  isEntity: (e: AnySceneEntity) => e is TEntity,
  docToEntity: (doc: TDoc) => TEntity,
): DocsMergeConfig<TDoc, TEntity, TEntity['params']> {
  return {
    isEntity,
    docToEntity: (doc, existing) => projectMepConnectorsOntoFresh(docToEntity(doc), existing),
    entityComparable: (e) => e.params,
    docComparable: (d) => d.params,
    differs: (existing, _doc, getCandidate) => {
      const candidate = getCandidate();
      return candidate !== null && !dequal(existing.params, candidate.params);
    },
  };
}
