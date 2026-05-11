// TODO Phase 6.C: UpdateMTextParagraphCommand, DeleteTextCommand, ReplaceAllTextCommand, ReplaceOneTextCommand
export { CreateTextCommand } from './CreateTextCommand';
export { UpdateTextStyleCommand, type TextStylePatch } from './UpdateTextStyleCommand';
export { UpdateTextGeometryCommand, type GeometryPatch } from './UpdateTextGeometryCommand';
export { buildShallowDiff } from './diff-helpers';
export { assertCanEditLayer } from './CanEditLayerGuard';
export {
  noopAuditRecorder,
  CanEditLayerError,
  type DxfTextSceneEntity,
  type DxfTextAuditAction,
  type DxfTextAuditChange,
  type DxfTextAuditEvent,
  type IDxfTextAuditRecorder,
  type LayerSnapshot,
  type ILayerAccessProvider,
} from './types';
