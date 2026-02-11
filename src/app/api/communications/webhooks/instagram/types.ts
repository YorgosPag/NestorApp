/**
 * =============================================================================
 * INSTAGRAM DM — WEBHOOK & CLIENT TYPES
 * =============================================================================
 *
 * Type definitions for Instagram Messaging API webhook payloads
 * and send message request/response structures.
 *
 * NOTE: Instagram DM API does NOT support Quick Reply buttons (outbound).
 * The API silently ignores `quick_replies` field — buttons never render.
 * Feedback is collected via text-based emoji detection in the handler.
 *
 * @module api/communications/webhooks/instagram/types
 * @enterprise ADR-174 - Meta Omnichannel Integration (Phase 3)
 * @see https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api
 */

// ============================================================================
// WEBHOOK INCOMING PAYLOAD (from Meta → our server)
// ============================================================================

/** Root webhook payload from Instagram Messaging API */
export interface InstagramWebhookPayload {
  object: 'instagram';
  entry: InstagramEntry[];
}

export interface InstagramEntry {
  id: string;
  time: number;
  messaging: InstagramMessagingEvent[];
}

// ============================================================================
// MESSAGING EVENTS
// ============================================================================

/** A single messaging event from Instagram */
export interface InstagramMessagingEvent {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  /** Present for text/attachment messages */
  message?: InstagramMessage;
  /** Present for read receipts */
  read?: InstagramRead;
}

/** Inbound message from a user */
export interface InstagramMessage {
  mid: string;
  text?: string;
  attachments?: InstagramAttachment[];
  /** Present when user taps a Quick Reply button */
  quick_reply?: InstagramQuickReply;
}

/** Quick Reply payload (when user taps a quick reply button) */
export interface InstagramQuickReply {
  payload: string;
}

/** Attachment in a message */
export interface InstagramAttachment {
  type: 'image' | 'audio' | 'video' | 'file' | 'share' | 'story_mention';
  payload: {
    url?: string;
  };
}

/** Read receipt */
export interface InstagramRead {
  watermark: number;
}

// ============================================================================
// OUTBOUND — SEND MESSAGE API
// ============================================================================

/** Response from Instagram Send API */
export interface InstagramSendResponse {
  recipient_id: string;
  message_id: string;
}

/** Internal send result */
export interface InstagramSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}
