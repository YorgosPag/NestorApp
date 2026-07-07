/**
 * ADR-581 — Universal Match/Transfer Properties Engine · public barrel.
 *
 * Deterministic πυρήνας (πάντα ενεργός). AI στρώμα + UI ζουν χωριστά (feature-flag).
 */

export type {
  MatchCategory,
  MatchWriteChannel,
  MatchValueType,
  MatchUnit,
  SemanticRole,
  ColorValue,
  MatchableValue,
  MatchFragment,
  MatchablePropertyDescriptor,
  CoerceResult,
} from './match-types';
export { COERCE_SKIP } from './match-types';

export {
  getMatchableProperties,
  getDescriptorByKey,
  indexByRole,
} from './match-registry';

export {
  resolveSemanticMapping,
  AI_MAPPING_THRESHOLD,
  type MatchMapping,
} from './semantic-mapping-resolver';

export { coerceValue } from './match-value-coercion';

export { roleFamily, asRole } from './semantic-roles';

export {
  buildMatchTransferCommand,
  collectMatchPatches,
  type MatchTransferRequest,
  type MatchTransferResult,
  type MatchTransferEmit,
  type Channelled,
} from './match-transfer-applier';

export { checkConsistency, type MatchWarning } from './match-consistency-check';

export {
  getMatchBrushSource,
  setMatchBrushSource,
  clearMatchBrushSource,
  hasMatchBrushSource,
  subscribeMatchBrush,
  type MatchBrushSource,
} from './match-brush-store';

export {
  getDefaultChecklist,
  recordApply,
  subscribeHabit,
} from './match-habit-store';

export {
  buildParamsUpdateCommand,
  isParamsCommandKind,
  type ParamsPatch,
} from './match-params-command-builder';
