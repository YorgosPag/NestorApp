/**
 * =============================================================================
 * WHATSAPP CLOUD API — WEBHOOK & CLIENT TYPES
 * =============================================================================
 *
 * Type definitions for WhatsApp Cloud API v22.0 webhook payloads
 * and send message request/response structures.
 *
 * @module api/communications/webhooks/whatsapp/types
 * @enterprise ADR-174 - Meta Omnichannel Integration
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components
 */

// ============================================================================
// WEBHOOK INCOMING PAYLOAD (from Meta → our server)
// ============================================================================

/** Root webhook payload from WhatsApp Cloud API */
export interface WhatsAppWebhookPayload {
  object: 'whatsapp_business_account';
  entry: WhatsAppEntry[];
}

export interface WhatsAppEntry {
  id: string;
  changes: WhatsAppChange[];
}

export interface WhatsAppChange {
  value: WhatsAppChangeValue;
  field: 'messages' | 'message_template_status_update';
}

export interface WhatsAppChangeValue {
  messaging_product: 'whatsapp';
  metadata: WhatsAppMetadata;
  contacts?: WhatsAppContact[];
  messages?: WhatsAppMessage[];
  statuses?: WhatsAppStatus[];
  errors?: WhatsAppError[];
}

export interface WhatsAppMetadata {
  display_phone_number: string;
  phone_number_id: string;
}

/** Contact info from webhook */
export interface WhatsAppContact {
  profile: { name: string };
  wa_id: string;
}

// ============================================================================
// INBOUND MESSAGE TYPES
// ============================================================================

export interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  type: WhatsAppMessageType;
  /** Text message */
  text?: { body: string };
  /** Image message */
  image?: WhatsAppMediaPayload;
  /** Document message */
  document?: WhatsAppMediaPayload & { filename?: string };
  /** Audio message */
  audio?: WhatsAppMediaPayload;
  /** Video message */
  video?: WhatsAppMediaPayload;
  /** Location message */
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  /** Reaction message */
  reaction?: { message_id: string; emoji: string };
  /** Sticker message */
  sticker?: WhatsAppMediaPayload;
  /** Context (reply) */
  context?: { from: string; id: string };
}

export type WhatsAppMessageType =
  | 'text'
  | 'image'
  | 'document'
  | 'audio'
  | 'video'
  | 'location'
  | 'reaction'
  | 'sticker'
  | 'contacts'
  | 'interactive'
  | 'button'
  | 'order'
  | 'unknown';

export interface WhatsAppMediaPayload {
  id: string;
  mime_type: string;
  sha256: string;
  caption?: string;
}

// ============================================================================
// STATUS UPDATES (delivery receipts)
// ============================================================================

export interface WhatsAppStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  errors?: WhatsAppError[];
  conversation?: {
    id: string;
    origin: { type: string };
    expiration_timestamp?: string;
  };
  pricing?: {
    billable: boolean;
    pricing_model: string;
    category: string;
  };
}

export interface WhatsAppError {
  code: number;
  title: string;
  message: string;
  error_data?: { details: string };
}

// ============================================================================
// OUTBOUND — SEND MESSAGE API
// ============================================================================

/** Send text message request */
export interface WhatsAppSendTextRequest {
  messaging_product: 'whatsapp';
  recipient_type?: 'individual';
  to: string;
  type: 'text';
  text: { body: string; preview_url?: boolean };
}

/** Send template message request */
export interface WhatsAppSendTemplateRequest {
  messaging_product: 'whatsapp';
  to: string;
  type: 'template';
  template: {
    name: string;
    language: { code: string };
    components?: WhatsAppTemplateComponent[];
  };
}

export interface WhatsAppTemplateComponent {
  type: 'header' | 'body' | 'button';
  parameters: Array<{
    type: 'text' | 'image' | 'document';
    text?: string;
    image?: { link: string };
    document?: { link: string; filename: string };
  }>;
}

/** Union of all sendable message types */
export type WhatsAppSendRequest = WhatsAppSendTextRequest | WhatsAppSendTemplateRequest;

/** Response from WhatsApp send message API */
export interface WhatsAppSendResponse {
  messaging_product: 'whatsapp';
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string; message_status?: string }>;
}

/** Internal send result */
export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}
