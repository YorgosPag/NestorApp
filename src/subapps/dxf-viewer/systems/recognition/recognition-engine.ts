/**
 * ADR-423 / ADR-424 — Stage 0 Recognition engine (agnostic orchestrator).
 *
 * Pipeline (all pure, deterministic — same scene ⇒ same model):
 *   1. detectSpaces   — closed wall loops → classified-later spaces (ADR-419).
 *   2. runRecognizers — each plug-in recognizer emits typed elements.
 *   3. bindElements   — element → smallest containing space (both back-refs).
 *   4. classifySpaces — pluggable classifier fills each space's room type.
 *
 * The engine is GIVEN its recognizers + classifier (via config or the registry);
 * it imports NO MEP/structural concrete types — the binding agnostic constraint.
 *
 * @see ./recognition-registry.ts (the SSoT wiring)
 */

import type {
  RecognitionInput,
  RecognitionModel,
  RecognizedElement,
  RecognitionContext,
  Recognizer,
} from './recognition-types';
import { detectSpaces, DEFAULT_SPACE_TOLERANCE_MM } from './space-detection';
import { bindElementsToSpaces } from './space-binding';
import {
  classifySpaces,
  composeClassifiers,
  type SpaceClassifier,
} from './space-classification';
import { recognitionRegistry, type RecognitionRegistry } from './recognition-registry';

/** Explicit engine configuration (tests + advanced callers). */
export interface RecognitionConfig {
  readonly recognizers: readonly Recognizer[];
  readonly classifier?: SpaceClassifier;
  /** Gap-tolerant loop-closure tolerance (mm). Defaults to ADR-419 Layer 2. */
  readonly toleranceMm?: number;
}

/** Run every recognizer over the context and flatten the emitted elements. */
function runRecognizers(
  ctx: RecognitionContext,
  recognizers: readonly Recognizer[],
): readonly RecognizedElement[] {
  const out: RecognizedElement[] = [];
  for (const r of recognizers) out.push(...r.recognize(ctx));
  return out;
}

/** Group bound elements by their assigned space id (unbound are skipped). */
function groupBySpace(
  elements: readonly RecognizedElement[],
): Map<string, RecognizedElement[]> {
  const map = new Map<string, RecognizedElement[]>();
  for (const el of elements) {
    if (!el.spaceId) continue;
    const list = map.get(el.spaceId) ?? [];
    list.push(el);
    map.set(el.spaceId, list);
  }
  return map;
}

/**
 * Stage 0 — recognize a loaded storey into a meaning model. Pure + transient
 * (never persisted). `config` supplies the discipline plug-ins.
 */
export function recognizeScene(
  input: RecognitionInput,
  config: RecognitionConfig,
): RecognitionModel {
  const tolMm = config.toleranceMm ?? DEFAULT_SPACE_TOLERANCE_MM;
  const spaces0 = detectSpaces(input.entities, input.storeyId, input.sceneUnits, tolMm);
  const ctx: RecognitionContext = {
    entities: input.entities,
    storeyId: input.storeyId,
    sceneUnits: input.sceneUnits,
    spaces: spaces0,
  };
  const elements0 = runRecognizers(ctx, config.recognizers);
  const bound = bindElementsToSpaces(spaces0, elements0);
  const classifier = config.classifier ?? composeClassifiers([]);
  const spaces = classifySpaces(bound.spaces, groupBySpace(bound.elements), classifier);
  return { spaces, elements: bound.elements, storeyId: input.storeyId };
}

/**
 * Stage 0 driven by the SSoT registry — the production entry point. Reads the
 * registered recognizers + composed classifiers so callers never assemble the
 * plug-in set by hand.
 */
export function recognizeSceneFromRegistry(
  input: RecognitionInput,
  registry: RecognitionRegistry = recognitionRegistry,
): RecognitionModel {
  return recognizeScene(input, {
    recognizers: registry.recognizers(),
    classifier: composeClassifiers(registry.classifiers()),
  });
}
