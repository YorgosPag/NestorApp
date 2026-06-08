/**
 * ADR-423 — MEP recognition wiring (registers the MEP plug-ins into the registry).
 *
 * Explicit registration (no import side-effects): the app bootstrap calls
 * `registerMepRecognition()` once, and from then on `recognizeSceneFromRegistry`
 * sees the sanitary + heating terminal recognizers, the MEP source recognizer, and
 * the sanitary space classifier. Adding the next discipline (electrical) = another
 * recognizer in this array or its own wiring file — never an engine edit.
 *
 * @see ../recognition-registry.ts
 */

import {
  recognitionRegistry,
  type RecognitionRegistry,
} from '../recognition-registry';
import {
  sanitaryTerminalRecognizer,
  sanitarySpaceClassifier,
} from './sanitary-terminal-recognizer';
import { heatingTerminalRecognizer } from './heating-terminal-recognizer';
import { mepSourceRecognizer } from './mep-source-recognizer';

/** Registration id for the MEP (sanitary pilot) recognition contribution. */
export const MEP_RECOGNITION_ID = 'mep-sanitary';

/**
 * Register the MEP Stage-0 plug-ins into a registry (default: the app SSoT).
 * Idempotent — re-registering replaces in place.
 */
export function registerMepRecognition(
  registry: RecognitionRegistry = recognitionRegistry,
): void {
  registry.register({
    id: MEP_RECOGNITION_ID,
    recognizers: [sanitaryTerminalRecognizer, heatingTerminalRecognizer, mepSourceRecognizer],
    classifier: sanitarySpaceClassifier,
  });
}
