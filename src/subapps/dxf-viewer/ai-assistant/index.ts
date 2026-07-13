/**
 * @module ai-assistant
 * @description DXF AI Drawing Assistant — barrel exports
 *
 * @see ADR-185 (AI Drawing Assistant)
 * @since 2026-02-17
 */

// Components
export { DxfAiChatPanel } from './components/DxfAiChatPanel';
export type { DxfAiChatPanelProps } from './components/DxfAiChatPanel';

// Hook
export { useDxfAiChat } from './hooks/useDxfAiChat';
export type { UseDxfAiChatOptions, UseDxfAiChatReturn } from './hooks/useDxfAiChat';

// Executor
export { executeDxfAiToolCalls } from './dxf-ai-tool-executor';
export type { ExecuteDxfAiToolCallsOptions } from './dxf-ai-tool-executor';

// ADR-650 M5β — topography tool-set + executor («μίλα στο σχέδιο»)
export {
  TOPO_TOOL_DEFINITIONS,
  TOPO_TOOL_NAMES,
  isTopoToolName,
  type TopoAiToolName,
} from './topo-tool-definitions';
export {
  executeTopoAiToolCalls,
  confirmRemoveElevationSpikes,
  type TopoAiCommands,
} from './topo-ai-tool-executor';

// Types
export type {
  DxfAiMessage,
  DxfAiMessageRole,
  DxfAiMessageStatus,
  DxfCanvasContext,
  DxfAiCommandRequest,
  DxfAiCommandResponse,
  DxfAiToolCall,
  DxfAiToolName,
  DxfAiExecutionResult,
} from './types';
