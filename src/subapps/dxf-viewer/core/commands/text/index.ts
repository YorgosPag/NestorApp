/**
 * ADR-344 Phase 6.A — Text commands SSoT barrel.
 *
 * Canonical entry point for every text-mutation command. The SSoT
 * registry (`text-commands` Tier 4) restricts new ICommand subclasses
 * for DXF text mutations to this directory; importers MUST go through
 * this barrel instead of deep-importing individual files.
 */

export type {
  DxfTextSceneEntity,
  DxfTextAuditAction,
  DxfTextAuditChange,
  DxfTextAuditEvent,
  IDxfTextAuditRecorder,
  ILayerAccessProvider,
  LayerSnapshot,
} from './types';
export { CanEditLayerError, noopAuditRecorder } from './types';

export { assertCanEditLayer } from './CanEditLayerGuard';

export { buildShallowDiff } from './diff-helpers';
export {
  findMatches,
  replaceAll as replaceAllInNode,
  replaceAt as replaceAtInNode,
  type MatchOptions,
  type MatchLocation,
} from './text-match-engine';

export { CreateTextCommand } from './CreateTextCommand';
export type { CreateTextCommandInput } from './CreateTextCommand';

export { UpdateTextStyleCommand } from './UpdateTextStyleCommand';
export type {
  UpdateTextStyleCommandInput,
  TextStylePatch,
} from './UpdateTextStyleCommand';

export { UpdateTextGeometryCommand } from './UpdateTextGeometryCommand';
export type {
  UpdateTextGeometryCommandInput,
  GeometryPatch,
} from './UpdateTextGeometryCommand';

export { UpdateMTextParagraphCommand } from './UpdateMTextParagraphCommand';
export type {
  UpdateMTextParagraphCommandInput,
  ParagraphPatch,
} from './UpdateMTextParagraphCommand';

export { DeleteTextCommand } from './DeleteTextCommand';
export type { DeleteTextCommandInput } from './DeleteTextCommand';

export { ReplaceAllTextCommand } from './ReplaceAllTextCommand';
export type { ReplaceAllTextCommandInput } from './ReplaceAllTextCommand';

export { ReplaceOneTextCommand } from './ReplaceOneTextCommand';
export type { ReplaceOneTextCommandInput } from './ReplaceOneTextCommand';

export { ReplaceTextNodeCommand } from './ReplaceTextNodeCommand';
export type { ReplaceTextNodeCommandInput } from './ReplaceTextNodeCommand';
