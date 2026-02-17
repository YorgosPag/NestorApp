/**
 * @module ai-assistant/hooks/useDxfAiChat
 * @description React hook for managing DXF AI Drawing Assistant chat state
 *
 * Manages:
 * - Chat messages (user ↔ assistant)
 * - API communication with POST /api/dxf-ai/command
 * - Tool call execution on the canvas via executeDxfAiToolCalls()
 * - Loading/error states
 *
 * @see ADR-185 (AI Drawing Assistant)
 * @since 2026-02-17
 */

'use client';

import { useCallback, useRef, useState } from 'react';
import type {
  DxfAiMessage,
  DxfAiCommandResponse,
  DxfCanvasContext,
  DxfAiChatHistoryEntry,
} from '../types';
import type { SceneModel } from '../../types/entities';
import { executeDxfAiToolCalls } from '../dxf-ai-tool-executor';
import { generateEntityId } from '../../systems/entity-creation/utils';
import { DXF_AI_API, DXF_AI_LIMITS, DXF_AI_DEFAULTS } from '../../config/ai-assistant-config';

// ============================================================================
// TYPES
// ============================================================================

export interface UseDxfAiChatOptions {
  /** Get current scene for a level */
  getScene: (levelId: string) => SceneModel | null;
  /** Set scene for a level */
  setScene: (levelId: string, scene: SceneModel) => void;
  /** Current level ID */
  levelId: string;
}

export interface UseDxfAiChatReturn {
  /** Chat messages */
  messages: DxfAiMessage[];
  /** Whether an API call is in progress */
  isLoading: boolean;
  /** Current error message, if any */
  error: string | null;
  /** Send a message to the AI assistant */
  sendMessage: (text: string) => Promise<void>;
  /** Clear all messages */
  clearChat: () => void;
}

// ============================================================================
// CANVAS CONTEXT BUILDER
// ============================================================================

function buildCanvasContext(
  getScene: (levelId: string) => SceneModel | null,
  levelId: string,
): DxfCanvasContext {
  const scene = getScene(levelId);

  if (!scene) {
    return {
      entityCount: 0,
      layers: [],
      bounds: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } },
      units: 'mm',
      currentLayer: DXF_AI_DEFAULTS.LAYER,
    };
  }

  const layerNames = Object.keys(scene.layers);

  return {
    entityCount: scene.entities.length,
    layers: layerNames,
    bounds: {
      min: { x: scene.bounds.min.x, y: scene.bounds.min.y },
      max: { x: scene.bounds.max.x, y: scene.bounds.max.y },
    },
    units: scene.units,
    currentLayer: layerNames[0] ?? DXF_AI_DEFAULTS.LAYER,
  };
}

// ============================================================================
// HOOK
// ============================================================================

export function useDxfAiChat(options: UseDxfAiChatOptions): UseDxfAiChatReturn {
  const { getScene, setScene, levelId } = options;

  const [messages, setMessages] = useState<DxfAiMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    // Clear previous errors
    setError(null);

    // Add user message
    const userMessage: DxfAiMessage = {
      id: generateEntityId(),
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
      status: 'success',
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Build chat history from previous messages
    const chatHistory: DxfAiChatHistoryEntry[] = messages
      .slice(-DXF_AI_LIMITS.MAX_HISTORY_ENTRIES)
      .map(m => ({ role: m.role, content: m.content }));

    // Build canvas context
    const canvasContext = buildCanvasContext(getScene, levelId);

    // Abort previous request if any
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch(DXF_AI_API.ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          canvasContext,
          chatHistory,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
        throw new Error(errorBody.error ?? `HTTP ${response.status}`);
      }

      const data = await response.json() as DxfAiCommandResponse;

      // Execute tool calls on canvas
      let executionMessage = '';
      if (data.toolCalls.length > 0) {
        const execResult = executeDxfAiToolCalls(data.toolCalls, {
          getScene,
          setScene,
          levelId,
        });

        if (execResult.entitiesCreated.length > 0) {
          executionMessage = `[${execResult.entitiesCreated.length} entity/ies δημιουργήθηκαν]`;
        }
        if (execResult.error) {
          executionMessage += `\n⚠️ ${execResult.error}`;
        }
        if (execResult.message) {
          executionMessage += `\n${execResult.message}`;
        }
      }

      // Build assistant message
      const assistantContent = [
        data.answer,
        executionMessage,
      ].filter(Boolean).join('\n\n');

      const assistantMessage: DxfAiMessage = {
        id: generateEntityId(),
        role: 'assistant',
        content: assistantContent || 'Η εντολή εκτελέστηκε.',
        timestamp: new Date().toISOString(),
        status: 'success',
        toolCalls: data.toolCalls.length > 0 ? data.toolCalls : undefined,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return; // Cancelled — no error
      }

      const errorMsg = err instanceof Error ? err.message : 'Άγνωστο σφάλμα';
      setError(errorMsg);

      const errorMessage: DxfAiMessage = {
        id: generateEntityId(),
        role: 'assistant',
        content: `Σφάλμα: ${errorMsg}`,
        timestamp: new Date().toISOString(),
        status: 'error',
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, getScene, setScene, levelId]);

  const clearChat = useCallback(() => {
    abortControllerRef.current?.abort();
    setMessages([]);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearChat,
  };
}
