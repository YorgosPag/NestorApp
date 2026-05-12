/**
 * ADR-344 Phase 12 — DXF text AI integration barrel.
 *
 * Public entry point for AI text command routing + voice transcription.
 */

export { route } from './TextAICommandRouter';
export type { TextAIContext, TextAIRouterResult } from './text-ai-types';
export { useVoiceRecorder } from './useVoiceRecorder';
export type { UseVoiceRecorderReturn, VoiceRecorderState } from './useVoiceRecorder';
