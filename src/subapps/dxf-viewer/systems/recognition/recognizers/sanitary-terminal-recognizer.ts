/**
 * ADR-423 — Stage 0 sanitary terminal recognizer (PILOT, Tier 1).
 *
 * Recognizes the already-connectable sanitary fixtures (ADR-408 Φ14:
 * WC/washbasin/shower/bathtub/bidet) as `RecognizedTerminal`s, reading their
 * embedded pipe connectors for the service classifications. Tier 1 = our own BIM
 * entities, so confidence is 1 (certain). Plus the sanitary `SpaceClassifier` that
 * infers bathroom/WC from the fixtures a space contains.
 *
 * Reuses the SSoT guards/accessors — zero new fixture logic:
 *   isMepFixtureEntity (entity union) · isSanitaryKind (sanitary SSoT) ·
 *   getEntityConnectors (connector accessor).
 *
 * Honest pilot scope: with only sanitary kinds available, classification realistically
 * resolves to `bathroom`/`wc` (no kitchen/utility — those need a kitchen-sink kind).
 *
 * @see ../../../bim/sanitary/sanitary-symbol-spec.ts (isSanitaryKind, SANITARY_KINDS)
 * @see ../../../bim/mep-systems/connector-access.ts (getEntityConnectors)
 */

import type { Entity } from '../../../types/entities';
import { isMepFixtureEntity } from '../../../types/entities';
import type { MepFixtureEntity } from '../../../bim/types/mep-fixture-types';
import { isSanitaryKind } from '../../../bim/sanitary/sanitary-symbol-spec';
import { getEntityConnectors } from '../../../bim/mep-systems/connector-access';
import type {
  RecognitionContext,
  Recognizer,
  RecognizedElement,
  SpaceClassification,
} from '../recognition-types';
import type {
  SpaceClassificationResult,
  SpaceClassifier,
} from '../space-classification';
import { UNKNOWN_CLASSIFICATION } from '../space-classification';
import {
  isRecognizedTerminal,
  type RecognizedConnectorRef,
  type RecognizedTerminal,
} from './mep-recognized-types';

// ─── Recognizer ───────────────────────────────────────────────────────────────

/** The pipe connectors of a fixture as `(entityId, connectorId, classification)` refs. */
function pipeConnectorRefs(entity: MepFixtureEntity): readonly RecognizedConnectorRef[] {
  const refs: RecognizedConnectorRef[] = [];
  for (const c of getEntityConnectors(entity)) {
    if (c.domain !== 'pipe' || !c.pipe) continue;
    refs.push({
      entityId: entity.id,
      connectorId: c.connectorId,
      systemClassification: c.pipe.systemClassification,
    });
  }
  return refs;
}

function buildSanitaryTerminal(
  entity: MepFixtureEntity,
  storeyId: string,
): RecognizedTerminal {
  const connectorRefs = pipeConnectorRefs(entity);
  const services = [...new Set(connectorRefs.map((r) => r.systemClassification))];
  return {
    elementId: `term:${entity.id}`,
    category: 'mep-terminal',
    position: { x: entity.params.position.x, y: entity.params.position.y },
    tier: 'bim-entity',
    confidence: 1,
    storeyId,
    terminalKind: entity.params.kind,
    serviceClassifications: services,
    connectorRefs,
  };
}

/** Tier-1 recognizer: scene sanitary fixtures → recognized terminals. */
export const sanitaryTerminalRecognizer: Recognizer<RecognizedTerminal> = {
  id: 'sanitary-bim',
  category: 'mep-terminal',
  tier: 'bim-entity',
  recognize(ctx: RecognitionContext): readonly RecognizedTerminal[] {
    const out: RecognizedTerminal[] = [];
    for (const e of ctx.entities) {
      if (isSanitaryFixture(e)) out.push(buildSanitaryTerminal(e, ctx.storeyId));
    }
    return out;
  },
};

/** Narrow to a sanitary `MepFixtureEntity` (WC/washbasin/shower/bathtub/bidet). */
function isSanitaryFixture(e: Entity): e is MepFixtureEntity {
  return isMepFixtureEntity(e) && isSanitaryKind(e.params.kind);
}

// ─── Space classifier (data-driven rules — SSoT) ─────────────────────────────

interface SanitaryRule {
  readonly test: (kinds: ReadonlySet<string>) => boolean;
  readonly classification: SpaceClassification;
  readonly confidence: number;
}

/**
 * Ordered classification rules from contained sanitary kinds (Greek Η/Μ practice).
 * First match wins. A bath/shower ⇒ full bathroom; a WC alone ⇒ WC; WC+basin ⇒
 * bathroom; basin/bidet alone ⇒ likely bathroom (lower confidence).
 */
const SANITARY_SPACE_RULES: readonly SanitaryRule[] = [
  { test: (k) => k.has('bathtub') || k.has('shower'), classification: 'bathroom', confidence: 0.9 },
  { test: (k) => k.has('wc') && k.has('washbasin'), classification: 'bathroom', confidence: 0.7 },
  { test: (k) => k.has('wc'), classification: 'wc', confidence: 0.8 },
  { test: (k) => k.has('washbasin') || k.has('bidet'), classification: 'bathroom', confidence: 0.5 },
];

function classifyFromSanitaryKinds(kinds: ReadonlySet<string>): SpaceClassificationResult {
  for (const rule of SANITARY_SPACE_RULES) {
    if (rule.test(kinds)) {
      return { classification: rule.classification, confidence: rule.confidence };
    }
  }
  return UNKNOWN_CLASSIFICATION;
}

/** Classifies a space from the sanitary terminals it contains. */
export const sanitarySpaceClassifier: SpaceClassifier = {
  classify(_space, contained: readonly RecognizedElement[]): SpaceClassificationResult {
    const kinds = new Set<string>();
    for (const el of contained) {
      if (isRecognizedTerminal(el)) kinds.add(el.terminalKind);
    }
    return classifyFromSanitaryKinds(kinds);
  },
};
