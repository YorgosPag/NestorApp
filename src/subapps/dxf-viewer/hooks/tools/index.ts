/**
 * 🏢 ENTERPRISE: Tools Hooks Index
 *
 * @description Centralized exports for all tool-related hooks
 * @see ADR-XXX: CanvasSection Decomposition
 */

export { useSpecialTools } from './useSpecialTools';
export type {
  UseSpecialToolsProps,
  UseSpecialToolsReturn,
} from './useSpecialTools';

export { useMoveTool } from './useMoveTool';
export type {
  UseMoveToolProps,
  UseMoveToolReturn,
  MovePhase,
} from './useMoveTool';

export { useMovePreview } from './useMovePreview';
export type { UseMovePreviewProps } from './useMovePreview';

export { useMirrorTool } from './useMirrorTool';
export type {
  UseMirrorToolProps,
  UseMirrorToolReturn,
  MirrorPhase,
} from './useMirrorTool';

export { useMirrorPreview } from './useMirrorPreview';
export type { UseMirrorPreviewProps } from './useMirrorPreview';

export { useScaleTool } from './useScaleTool';
export type { UseScaleToolProps, UseScaleToolReturn } from './useScaleTool';

export { useScalePreview } from './useScalePreview';
export type { UseScalePreviewProps } from './useScalePreview';

export { useStretchTool } from './useStretchTool';
export type { UseStretchToolProps, UseStretchToolReturn } from './useStretchTool';

export { useTrimTool } from './useTrimTool';
export type { UseTrimToolProps, UseTrimToolReturn } from './useTrimTool';

export { useTrimPreview } from './useTrimPreview';
export type { UseTrimPreviewProps } from './useTrimPreview';

export { useExtendTool } from './useExtendTool';
export type { UseExtendToolProps, UseExtendToolReturn } from './useExtendTool';

export { useExtendPreview } from './useExtendPreview';
export type { UseExtendPreviewProps } from './useExtendPreview';

export { useTrimDragCapture } from './useTrimDragCapture';
export type { UseTrimDragCaptureProps } from './useTrimDragCapture';

export { useModifyTools } from './useModifyTools';
export type { UseModifyToolsProps, UseModifyToolsReturn } from './useModifyTools';
