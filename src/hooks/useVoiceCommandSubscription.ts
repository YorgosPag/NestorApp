/**
 * =============================================================================
 * USE VOICE COMMAND SUBSCRIPTION — ADR-164
 * =============================================================================
 *
 * Hook: Firestore onSnapshot on voice_commands/{commandId}
 * Returns real-time status updates for a voice command.
 *
 * @module hooks/useVoiceCommandSubscription
 * @see ADR-164 (In-App Voice AI Pipeline)
 */

'use client';

import { useEffect } from 'react';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import { useVoiceCommandStore } from '@/stores/voiceCommandStore';
import type { VoiceCommandDoc, VoiceCommandStatus } from '@/types/voice-command';

// ============================================================================
// TYPES
// ============================================================================

interface UseVoiceCommandSubscriptionReturn {
  /** Current processing status */
  status: VoiceCommandStatus | null;
  /** AI response text (when completed) */
  aiResponse: string | null;
  /** Detected intent (when completed) */
  intent: string | null;
  /** Error message (when failed) */
  error: string | null;
  /** Whether the command is still being processed */
  isLoading: boolean;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Subscribe to real-time updates for a voice command document.
 *
 * @param commandId - Firestore document ID to watch (null = no subscription)
 * @returns Real-time status, AI response, and loading state
 */
export function useVoiceCommandSubscription(
  commandId: string | null
): UseVoiceCommandSubscriptionReturn {
  const updateCommand = useVoiceCommandStore((s) => s.updateCommand);
  const entry = useVoiceCommandStore((s) =>
    commandId ? s.commandHistory.find((c) => c.commandId === commandId) : undefined
  );

  useEffect(() => {
    if (!commandId) return;

    const unsubscribe = firestoreQueryService.subscribeDoc<VoiceCommandDoc>(
      'VOICE_COMMANDS',
      commandId,
      (data) => {
        if (!data) return;

        updateCommand(commandId, {
          status: data.status,
          aiResponse: data.aiResponse ?? null,
          intent: data.intent ?? null,
          error: data.error ?? null,
        });
      },
      (err) => {
        updateCommand(commandId, {
          status: 'failed',
          error: err.message,
        });
      }
    );

    return () => unsubscribe();
  }, [commandId, updateCommand]);

  const status = entry?.status ?? null;
  const isLoading = status === 'pending' || status === 'processing';

  return {
    status,
    aiResponse: entry?.aiResponse ?? null,
    intent: entry?.intent ?? null,
    error: entry?.error ?? null,
    isLoading,
  };
}
