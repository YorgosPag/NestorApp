/**
 * ADR-423 / ADR-424 — Stage 0 space classification (agnostic orchestration).
 *
 * The kernel does NOT know what a "bathroom" is — classification is a **pluggable**
 * rule set (`SpaceClassifier`) supplied per discipline. The MEP sanitary classifier
 * lives in `recognizers/` and downcasts elements by `category`. Here we only define
 * the contract, the compose-by-max-confidence combinator, and the apply pass.
 *
 * @see ./recognizers/sanitary-terminal-recognizer.ts (the sanitary classifier)
 */

import type {
  RecognizedElement,
  RecognizedSpace,
  SpaceClassification,
} from './recognition-types';

/** A classification verdict for one space. */
export interface SpaceClassificationResult {
  readonly classification: SpaceClassification;
  readonly confidence: number;
}

/** The neutral verdict — used when no classifier is confident. */
export const UNKNOWN_CLASSIFICATION: SpaceClassificationResult = {
  classification: 'unknown',
  confidence: 0,
};

/**
 * A pluggable classifier. Receives the space + the elements bound to it (agnostic
 * `RecognizedElement[]`); a discipline classifier narrows by `category`.
 */
export interface SpaceClassifier {
  classify(
    space: RecognizedSpace,
    contained: readonly RecognizedElement[],
  ): SpaceClassificationResult;
}

/** Compose N classifiers into one that wins by highest confidence. */
export function composeClassifiers(
  classifiers: readonly SpaceClassifier[],
): SpaceClassifier {
  return {
    classify(space, contained) {
      let best = UNKNOWN_CLASSIFICATION;
      for (const c of classifiers) {
        const r = c.classify(space, contained);
        if (r.confidence > best.confidence) best = r;
      }
      return best;
    },
  };
}

/** Apply a classifier to every space, using its bound elements. */
export function classifySpaces(
  spaces: readonly RecognizedSpace[],
  elementsBySpace: ReadonlyMap<string, readonly RecognizedElement[]>,
  classifier: SpaceClassifier,
): readonly RecognizedSpace[] {
  return spaces.map((s) => {
    const contained = elementsBySpace.get(s.spaceId) ?? [];
    const r = classifier.classify(s, contained);
    return {
      ...s,
      classification: r.classification,
      classificationConfidence: r.confidence,
    };
  });
}
