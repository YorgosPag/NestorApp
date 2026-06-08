/**
 * ADR-423 / ADR-424 — Stage 0 Semantic Recognition: public barrel.
 *
 * The single import surface for the recognition layer. Kernel (agnostic) +
 * registry + MEP plug-ins. Structural (ADR-424) recognizers will export from here
 * too when they land.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-423-mep-auto-design-framework.md §3
 */

// Agnostic kernel
export type {
  RecognitionTier,
  RecognizedElementCategory,
  SpaceClassification,
  RecognizedSpace,
  RecognizedElement,
  RecognitionContext,
  Recognizer,
  RecognitionInput,
  RecognitionModel,
} from './recognition-types';
export {
  recognizeScene,
  recognizeSceneFromRegistry,
  type RecognitionConfig,
} from './recognition-engine';
export {
  detectSpaces,
  DEFAULT_SPACE_TOLERANCE_MM,
} from './space-detection';
export {
  bindElementsToSpaces,
  type SpaceBindingResult,
} from './space-binding';
export {
  classifySpaces,
  composeClassifiers,
  UNKNOWN_CLASSIFICATION,
  type SpaceClassifier,
  type SpaceClassificationResult,
} from './space-classification';
export {
  RecognitionRegistry,
  recognitionRegistry,
  type RecognitionRegistration,
} from './recognition-registry';

// MEP plug-ins (ADR-423)
export {
  isRecognizedTerminal,
  isRecognizedSource,
  type RecognizedTerminal,
  type RecognizedSource,
  type RecognizedConnectorRef,
  type MepSourceKind,
} from './recognizers/mep-recognized-types';
export {
  sanitaryTerminalRecognizer,
  sanitarySpaceClassifier,
} from './recognizers/sanitary-terminal-recognizer';
export { mepSourceRecognizer } from './recognizers/mep-source-recognizer';
export {
  registerMepRecognition,
  MEP_RECOGNITION_ID,
} from './recognizers/mep-recognition';
