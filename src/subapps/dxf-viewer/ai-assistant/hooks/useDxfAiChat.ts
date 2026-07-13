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
 * CRITICAL: Uses refs for getScene/setScene/levelId/messages to prevent
 * stale closures after await. Without refs, the async sendMessage function
 * captures old values in its closure → executor reads stale scene → entities
 * get overwritten → shapes appear to "not render".
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
  DxfAiToolCall,
  TopoPendingConfirm,
} from '../types';
import type { SceneModel } from '../../types/entities';
import { executeDxfAiToolCalls } from '../dxf-ai-tool-executor';
import {
  executeTopoAiToolCalls,
  confirmRemoveElevationSpikes,
  type TopoAiCommands,
} from '../topo-ai-tool-executor';
import { isTopoToolName } from '../topo-tool-definitions';
import { countSceneEntities } from '../../utils/scene-entity-count';
import { generateEntityId } from '../../systems/entity-creation/utils';
import { DXF_AI_API, DXF_AI_LIMITS, DXF_AI_DEFAULTS } from '../../config/ai-assistant-config';
import { nowISO } from '@/lib/date-local';

/** Resolve an i18n key (+ params) to display text — the chat panel passes its `t`. */
export type TopoMessageTranslator = (key: string, params?: Record<string, string | number>) => string;

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
  /**
   * ADR-650 M5β — the topography commands the executor routes NL topo tool-calls to, plus the
   * translator for its i18n message keys. Optional: without it the chat is drawing-only (the
   * DXF-only tests need no topo wiring).
   */
  topo?: TopoAiCommands & { translate: TopoMessageTranslator };
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
  /** A destructive topo action awaiting the engineer's confirm, or null (ADR-650 M5β §9). */
  pendingConfirm: TopoPendingConfirm | null;
  /** Run the pending destructive action (the engineer pressed Confirm). */
  confirmPending: () => void;
  /** Dismiss the pending destructive action (the engineer pressed Cancel). */
  cancelPending: () => void;
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
      gridContext: null, // ADR-189: populated when Grid System is implemented
    };
  }

  const layerNames = Object.values(scene.layersById ?? {}).map((l) => l.name);

  return {
    entityCount: countSceneEntities(scene),
    layers: layerNames,
    bounds: {
      min: { x: scene.bounds.min.x, y: scene.bounds.min.y },
      max: { x: scene.bounds.max.x, y: scene.bounds.max.y },
    },
    units: scene.units,
    currentLayer: layerNames[0] ?? DXF_AI_DEFAULTS.LAYER,
    gridContext: null, // ADR-189: populated when Grid System is implemented
  };
}

// ============================================================================
// TOPO TOOL-CALL ROUTING (ADR-650 M5β)
// ============================================================================

/** The topo half of a response: resolved display text + any destructive action pending confirm. */
interface TopoOutcome {
  readonly message: string;
  readonly pending: TopoPendingConfirm | null;
}

/**
 * Partition the topography tool calls out of a response, run them through the topo executor and
 * resolve their i18n keys with the panel's translator. Drawing calls are handled separately by
 * the entity executor — one chat, two domain executors (the grid-tool-definitions pattern).
 */
function runTopoCalls(
  toolCalls: readonly DxfAiToolCall[],
  topo: (TopoAiCommands & { translate: TopoMessageTranslator }) | undefined,
): TopoOutcome {
  const topoCalls = toolCalls.filter((c) => isTopoToolName(c.name));
  if (topoCalls.length === 0 || !topo) return { message: '', pending: null };

  const { translate, ...commands } = topo;
  const result = executeTopoAiToolCalls(topoCalls, commands);
  const lines = result.messages.map((m) => translate(m.key, m.params));
  if (result.pendingConfirm) {
    lines.push(translate('aiAssistant.topo.spikes.confirmPrompt', { count: result.pendingConfirm.count }));
  }
  return { message: lines.join('\n'), pending: result.pendingConfirm };
}

// ============================================================================
// HOOK
// ============================================================================

export function useDxfAiChat(options: UseDxfAiChatOptions): UseDxfAiChatReturn {
  const { getScene, setScene, levelId, topo } = options;

  const [messages, setMessages] = useState<DxfAiMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<TopoPendingConfirm | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // ── CRITICAL: Refs to prevent stale closures after await ──
  // sendMessage is async. After `await fetch()`, React may have re-rendered
  // and the closure's getScene/setScene/messages/levelId could be stale.
  // Refs always point to the LATEST values.
  const getSceneRef = useRef(getScene);
  getSceneRef.current = getScene;

  const setSceneRef = useRef(setScene);
  setSceneRef.current = setScene;

  const levelIdRef = useRef(levelId);
  levelIdRef.current = levelId;

  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // ADR-650 M5β — same anti-stale contract for the topo commands/translator.
  const topoRef = useRef(topo);
  topoRef.current = topo;

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
      timestamp: nowISO(),
      status: 'success',
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Read LATEST messages from ref (not stale closure)
    const chatHistory: DxfAiChatHistoryEntry[] = messagesRef.current
      .slice(-DXF_AI_LIMITS.MAX_HISTORY_ENTRIES)
      .map(m => ({ role: m.role, content: m.content }));

    // Read LATEST getScene/levelId from refs for canvas context
    const canvasContext = buildCanvasContext(getSceneRef.current, levelIdRef.current);

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

      // Execute tool calls on canvas — use REFS for latest scene functions
      let executionMessage = '';
      if (data.toolCalls.length > 0) {
        const execResult = executeDxfAiToolCalls(data.toolCalls, {
          getScene: getSceneRef.current,
          setScene: setSceneRef.current,
          levelId: levelIdRef.current,
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

      // ADR-650 M5β — route topo tool calls to their own executor (undo/command SSoT intact),
      // and surface any destructive action awaiting the engineer's confirm.
      const topoOutcome = runTopoCalls(data.toolCalls, topoRef.current);
      setPendingConfirm(topoOutcome.pending);

      // Build assistant message
      const assistantContent = [
        data.answer,
        executionMessage,
        topoOutcome.message,
      ].filter(Boolean).join('\n\n');

      const assistantMessage: DxfAiMessage = {
        id: generateEntityId(),
        role: 'assistant',
        content: assistantContent || 'Η εντολή εκτελέστηκε.',
        timestamp: nowISO(),
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
        timestamp: nowISO(),
        status: 'error',
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, []); // ← No dependencies! Reads everything from refs.

  const clearChat = useCallback(() => {
    abortControllerRef.current?.abort();
    setMessages([]);
    setError(null);
    setIsLoading(false);
    setPendingConfirm(null);
  }, []);

  // ── ADR-650 M5β — destructive-action confirm (§9 human-certifier) ──
  // The engineer, never the LLM, authorises the raw-survey mutation. The action runs here,
  // its outcome is appended as an assistant message, and the pending state clears.
  const appendAssistantMessage = useCallback((content: string, status: DxfAiMessage['status']) => {
    setMessages((prev) => [
      ...prev,
      { id: generateEntityId(), role: 'assistant', content, timestamp: nowISO(), status },
    ]);
  }, []);

  const confirmPending = useCallback(() => {
    const current = pendingConfirm;
    const topo = topoRef.current;
    if (!current || !topo) return;
    setPendingConfirm(null);
    const outcome = confirmRemoveElevationSpikes();
    appendAssistantMessage(topo.translate(outcome.key, outcome.params), 'success');
  }, [pendingConfirm, appendAssistantMessage]);

  const cancelPending = useCallback(() => {
    const topo = topoRef.current;
    if (!pendingConfirm) return;
    setPendingConfirm(null);
    if (topo) appendAssistantMessage(topo.translate('aiAssistant.topo.spikes.cancelled'), 'success');
  }, [pendingConfirm, appendAssistantMessage]);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearChat,
    pendingConfirm,
    confirmPending,
    cancelPending,
  };
}
