/**
 * =============================================================================
 * FACEBOOK MESSENGER — WEBHOOK & CLIENT TYPES
 * =============================================================================
 *
 * Type definitions for Facebook Messenger Platform webhook payloads
 * and send message request/response structures.
 *
 * Messenger uses the Page-scoped webhook format (object: 'page')
 * with messaging events in entry[].messaging[].
 *
 * @module api/communications/webhooks/messenger/types
 * @enterprise ADR-174 - Meta Omnichannel Integration (Phase 2)
 * @see https://developers.facebook.com/docs/messenger-platform/webhooks
 */

// ============================================================================
// WEBHOOK INCOMING PAYLOAD (from Meta → our server)
// ============================================================================

/** Root webhook payload from Messenger Platform */
export interface MessengerWebhookPayload {
  object: 'page';
  entry: MessengerEntry[];
}

export interface MessengerEntry {
  id: string;
  time: number;
  messaging: MessengerMessagingEvent[];
}

// ============================================================================
// MESSAGING EVENTS
// ============================================================================

/** A single messaging event from Messenger */
export interface MessengerMessagingEvent {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  /** Present for text/attachment messages */
  message?: MessengerMessage;
  /** Present for delivery confirmations */
  delivery?: MessengerDelivery;
  /** Present for read receipts */
  read?: MessengerRead;
  /** Present for postback button taps */
  postback?: MessengerPostback;
}

/** Inbound message from a user */
export interface MessengerMessage {
  mid: string;
  text?: string;
  attachments?: MessengerAttachment[];
  /** Present when user taps a Quick Reply button */
  quick_reply?: MessengerQuickReply;
}

/** Attachment in a message */
export interface MessengerAttachment {
  type: 'image' | 'audio' | 'video' | 'file' | 'fallback' | 'location';
  payload: {
    url?: string;
    coordinates?: { lat: number; long: number };
    title?: string;
  };
}

/** Quick Reply payload (when user taps a quick reply button) */
export interface MessengerQuickReply {
  payload: string;
}

/** Delivery confirmation */
export interface MessengerDelivery {
  mids?: string[];
  watermark: number;
}

/** Read receipt */
export interface MessengerRead {
  watermark: number;
}

/** Postback from Get Started / Persistent Menu buttons */
export interface MessengerPostback {
  title: string;
  payload: string;
}

// ============================================================================
// OUTBOUND — SEND MESSAGE API
// ============================================================================

/** Quick Reply button for outbound messages (max 13) */
export interface MessengerQuickReplyButton {
  content_type: 'text';
  title: string;
  payload: string;
}

/** Response from Messenger Send API */
export interface MessengerSendResponse {
  recipient_id: string;
  message_id: string;
}

/** Internal send result */
export interface MessengerSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}
