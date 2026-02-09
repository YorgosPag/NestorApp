/**
 * =============================================================================
 * VOICE COMMAND STORE — ADR-164
 * =============================================================================
 *
 * Zustand store for managing the Voice AI Panel state.
 * Follows the same pattern as NotificationDrawer (notificationStore.ts).
 *
 * @module stores/voiceCommandStore
 * @see ADR-164 (In-App Voice AI Pipeline)
 */

import { create } from 'zustand';
import type { VoiceCommandStatus } from '@/types/voice-command';

// ============================================================================
// TYPES
// ============================================================================

/** A single voice command entry in the conversation history */
export interface VoiceCommandEntry {
  /** Firestore document ID */
  commandId: string;
  /** User's transcribed text */
  transcript: string;
  /** Current status */
  status: VoiceCommandStatus;
  /** AI response text (when completed) */
  aiResponse: string | null;
  /** Detected intent (when completed) */
  intent: string | null;
  /** Error message (when failed) */
  error: string | null;
  /** ISO 8601 timestamp */
  createdAt: string;
}

/** Store state shape */
interface VoiceCommandState {
  /** Whether the right-side panel is open */
  isOpen: boolean;
  /** Currently active command being tracked */
  currentCommandId: string | null;
  /** Conversation history (newest first) */
  commandHistory: VoiceCommandEntry[];

  // ── Actions ──

  /** Open the panel and set active command */
  openPanel: (commandId: string, transcript: string) => void;
  /** Close the panel */
  closePanel: () => void;
  /** Toggle panel visibility */
  togglePanel: () => void;
  /** Update an existing command entry (from onSnapshot) */
  updateCommand: (commandId: string, updates: Partial<VoiceCommandEntry>) => void;
  /** Clear all history */
  clearHistory: () => void;
}

// ============================================================================
// STORE
// ============================================================================

export const useVoiceCommandStore = create<VoiceCommandState>((set) => ({
  isOpen: false,
  currentCommandId: null,
  commandHistory: [],

  openPanel: (commandId, transcript) =>
    set((state) => {
      // Check if entry already exists (prevent duplicates)
      const exists = state.commandHistory.some((c) => c.commandId === commandId);
      const newEntry: VoiceCommandEntry = {
        commandId,
        transcript,
        status: 'pending',
        aiResponse: null,
        intent: null,
        error: null,
        createdAt: new Date().toISOString(),
      };

      return {
        isOpen: true,
        currentCommandId: commandId,
        commandHistory: exists
          ? state.commandHistory
          : [newEntry, ...state.commandHistory],
      };
    }),

  closePanel: () => set({ isOpen: false }),

  togglePanel: () => set((state) => ({ isOpen: !state.isOpen })),

  updateCommand: (commandId, updates) =>
    set((state) => ({
      commandHistory: state.commandHistory.map((entry) =>
        entry.commandId === commandId ? { ...entry, ...updates } : entry
      ),
    })),

  clearHistory: () =>
    set({
      commandHistory: [],
      currentCommandId: null,
    }),
}));
