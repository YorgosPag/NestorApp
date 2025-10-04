// src/types/communications.ts

export type Channel = 'telegram' | 'whatsapp' | 'messenger' | 'email' | 'sms';

export interface BaseMessageInput {
  channel: Channel;
  to: string;
  from?: string;
  subject?: string;
  content?: string;
  metadata?: Record<string, unknown>;
  messageType?: string; // channel-specific (e.g., telegram: 'text'|'photo'...)
  attachments?: string[];
  entityType?: 'lead' | 'contact' | 'unit' | null;
  entityId?: string | null;
  threadId?: string | null;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  externalId?: string;
  error?: string;
}

export interface TemplateSendInput {
  templateType?: string | null;
  channel: Channel;
  to: string;
  content?: string | null;
  variables?: Record<string, unknown>;
  entityType?: 'lead' | 'contact' | 'unit';
  entityId?: string;
  metadata?: Record<string, unknown>;
}
