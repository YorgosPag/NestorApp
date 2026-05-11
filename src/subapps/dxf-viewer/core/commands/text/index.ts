// TODO Phase 6.B: UpdateTextStyleCommand, UpdateTextGeometryCommand, UpdateMTextParagraphCommand,
//                DeleteTextCommand, ReplaceAllTextCommand, ReplaceOneTextCommand
export { CreateTextCommand } from './CreateTextCommand';
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
