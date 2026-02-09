/**
 * =============================================================================
 * VOICE COMMAND TYPES — ADR-164
 * =============================================================================
 *
 * Type definitions for the In-App Voice AI Pipeline.
 * Voice commands flow: Mic → Transcribe → AI Pipeline → Response in Panel.
 *
 * @module types/voice-command
 * @see ADR-164 (In-App Voice AI Pipeline)
 */

// ============================================================================
// VOICE COMMAND STATUS
// ============================================================================

/** Lifecycle states for a voice command document in Firestore */
export type VoiceCommandStatus = 'pending' | 'processing' | 'completed' | 'failed';

// ============================================================================
// FIRESTORE DOCUMENT: voice_commands/{id}
// ============================================================================

/** Firestore document shape for voice_commands collection */
export interface VoiceCommandDoc {
  /** Firebase Auth UID of the user who issued the command */
  userId: string;
  /** Tenant isolation */
  companyId: string;
  /** Transcribed voice text (user's spoken command) */
  transcript: string;
  /** Current processing status */
  status: VoiceCommandStatus;
  /** Pipeline correlation ID (set after enqueue) */
  pipelineRequestId: string | null;
  /** Pipeline queue document ID (set after enqueue) */
  pipelineQueueId: string | null;
  /** AI response text (set on completion) */
  aiResponse: string | null;
  /** Detected intent (set on completion) */
  intent: string | null;
  /** UC module that handled the command (set on completion) */
  moduleId: string | null;
  /** Whether the user was identified as a super admin */
  isAdmin: boolean;
  /** Error message (set on failure) */
  error: string | null;
  /** Channel identifier */
  channel: 'in_app';
  /** ISO 8601 creation timestamp */
  createdAt: string;
  /** ISO 8601 completion timestamp */
  completedAt: string | null;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/** Response from POST /api/voice/command */
export interface SubmitCommandResult {
  /** Whether the command was accepted */
  success: boolean;
  /** Firestore document ID for the voice command (for onSnapshot) */
  commandId?: string;
  /** Pipeline correlation ID */
  requestId?: string;
  /** Error message if submission failed */
  error?: string;
}
