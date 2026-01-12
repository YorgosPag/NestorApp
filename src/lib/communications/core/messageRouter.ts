// src/lib/communications/core/messageRouter.ts

import { MESSAGE_DIRECTIONS, MESSAGE_STATUSES, isChannelEnabled } from '../../config/communications.config';
import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp, FieldValue } from 'firebase/firestore';
import type { Channel, BaseMessageInput, SendResult } from '@/types/communications';
import { COLLECTIONS } from '@/config/firestore-collections';

// ============================================================================
// 🏢 ENTERPRISE: Type Definitions (ADR-compliant - NO any)
// ============================================================================

/** Webhook data from external providers */
interface WebhookData {
  from?: string;
  to?: string;
  content?: string;
  body?: string;
  subject?: string;
  messageId?: string;
  externalId?: string;
  timestamp?: string | number;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Message record input data */
interface MessageRecordInput {
  channel: Channel;
  from?: string;
  to?: string;
  content: string;
  subject?: string;
  externalId?: string;
  entityType?: string;
  entityId?: string | null;
  threadId?: string;
  attachments?: Array<{ url: string; name?: string; type?: string }>;
  metadata?: Record<string, unknown>;
}

/** Message status update */
interface MessageStatusUpdate {
  status: string;
  externalId?: string | null;
  metadata?: Record<string, unknown>;
}

/** Message record from database */
interface MessageRecord {
  id: string;
  type: Channel;
  direction: 'inbound' | 'outbound';
  channel: Channel;
  from: string;
  to: string;
  subject: string;
  content: string;
  status: string;
  entityType: string | null;
  entityId: string | null;
  externalId: string | null;
  threadId: string | null;
  attachments: Array<{ url: string; name?: string; type?: string }>;
  metadata: Record<string, unknown>;
  createdAt: FieldValue;
  updatedAt: FieldValue;
}

/** Bulk send result */
interface BulkSendResult extends SendResult {
  originalData: BaseMessageInput;
}

// --- Types ---

interface InboundParsed {
  from: string;
  to: string;
  content: string;
  subject?: string;
  externalId?: string;
  metadata?: Record<string, unknown>;
}

interface Provider {
  sendMessage(msg: BaseMessageInput & { messageId: string }): Promise<SendResult>;
  parseIncomingMessage(webhook: WebhookData): Promise<InboundParsed>;
  testConnection?(): Promise<{ success: boolean; message?: string; error?: string }>;
}

/**
 * Κεντρικός router για όλα τα εισερχόμενα και εξερχόμενα μηνύματα
 * Διαχειρίζεται την κατεύθυνση μηνυμάτων στο σωστό provider
 */

class MessageRouter {
  providers: Map<Channel, Provider>;

  constructor() {
    this.providers = new Map();
  }

  /**
   * Καταχώρηση ενός communication provider
   */
  registerProvider(channelType: Channel, provider: Provider) {
    if (!channelType || !provider) {
      throw new Error('Channel type and provider are required');
    }
    if (this.providers.has(channelType)) {
        // Warning logging removed
        return;
    }
    this.providers.set(channelType, provider);
    // Debug logging removed
  }

  /**
   * Αποστολή μηνύματος μέσω του κατάλληλου provider
   */
  async sendMessage(messageData: BaseMessageInput): Promise<SendResult> {
    let messageRecordId: string | null = null;
    try {
      if (!isChannelEnabled(messageData.channel)) {
        throw new Error(`Channel ${messageData.channel} is not enabled or configured`);
      }

      const record = await this.createMessageRecord(messageData, MESSAGE_DIRECTIONS.OUTBOUND as 'outbound');
      messageRecordId = record.id;
      
      const provider = this.providers.get(messageData.channel);
      if (!provider) {
        throw new Error(`No provider registered for channel: ${messageData.channel}`);
      }

      const result = await provider.sendMessage({ ...messageData, messageId: record.id });

      await this.updateMessageStatus(record.id, {
        status: result.success ? MESSAGE_STATUSES.SENT : MESSAGE_STATUSES.FAILED,
        externalId: result.externalId ?? null,
        metadata: { ...(messageData.metadata ?? {}), providerResponse: result }
      });

      return {
        success: result.success,
        messageId: record.id,
        externalId: result.externalId,
        error: result.error
      };

    } catch (error: unknown) {
      // Error logging removed
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (messageRecordId) {
        await this.updateMessageStatus(messageRecordId, {
          status: MESSAGE_STATUSES.FAILED,
          metadata: { ...(messageData.metadata ?? {}), error: errorMessage }
        });
      }

      throw error;
    }
  }

  /**
   * Διαχείριση εισερχόμενων μηνυμάτων από webhooks
   */
  async handleIncomingMessage(channel: Channel, webhookData: WebhookData) {
    const provider = this.providers.get(channel);
    if (!provider) {
      throw new Error(`No provider registered for channel: ${channel}`);
    }

    const parsed = await provider.parseIncomingMessage(webhookData);

    const rec = await this.createMessageRecord({
      channel,
      from: parsed.from,
      to: parsed.to,
      content: parsed.content,
      subject: parsed.subject,
      externalId: parsed.externalId,
      entityType: 'lead',
      entityId: null,
      metadata: parsed.metadata
    }, MESSAGE_DIRECTIONS.INBOUND as 'inbound');
    
    const matchedEntityId = await this.attemptLeadMatching(rec.id, parsed);
    await this.triggerNotifications(rec);
    
    return { success: true, messageId: rec.id, matched: !!matchedEntityId };
  }

  /**
   * Δημιουργία εγγραφής μηνύματος στη βάση δεδομένων
   */
  async createMessageRecord(messageData: MessageRecordInput, direction: 'inbound' | 'outbound') {
    try {
      const record = {
        type: messageData.channel as Channel,
        direction,
        channel: messageData.channel as Channel,
        from: messageData.from || '',
        to: messageData.to || '',
        subject: messageData.subject || '',
        content: messageData.content,
        status: MESSAGE_STATUSES.PENDING,
        entityType: messageData.entityType || null,
        entityId: messageData.entityId || null,
        externalId: messageData.externalId || null,
        threadId: messageData.threadId || null,
        attachments: messageData.attachments || [],
        metadata: messageData.metadata || {},
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, COLLECTIONS.COMMUNICATIONS), record);
      return { id: docRef.id, ...record };

    } catch (error) {
      // Error logging removed
      throw error;
    }
  }

  /**
   * Ενημέρωση status μηνύματος
   */
  async updateMessageStatus(messageId: string, updates: MessageStatusUpdate) {
    try {
      const messageRef = doc(db, COLLECTIONS.COMMUNICATIONS, messageId);
      await updateDoc(messageRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      // Error logging removed
      throw error;
    }
  }

  /**
   * Προσπάθεια matching με υπάρχοντα leads
   */
  async attemptLeadMatching(messageId: string, parsed: InboundParsed): Promise<string | null> {
    try {
      const entityId: string | null = null; // TODO: Implement lead searching logic
      if (entityId) {
        await this.updateMessageStatus(messageId, { entityType: 'lead', entityId });
      }
      return entityId;
    } catch (error) {
      // Error logging removed
      return null;
    }
  }

  /**
   * Trigger notifications για νέα μηνύματα
   */
  async triggerNotifications(messageRecord: MessageRecord) {
    try {
      // Debug logging removed
    } catch (error) {
      // Error logging removed
    }
  }

  /**
   * Bulk message sending (για campaigns)
   */
  async sendBulkMessages(messages: BaseMessageInput[]): Promise<BulkSendResult[]> {
    const CONCURRENCY = 5;
    const results: BulkSendResult[] = [];
    for (let i = 0; i < messages.length; i += CONCURRENCY) {
      const chunk = messages.slice(i, i + CONCURRENCY);
      const chunkResults = await Promise.allSettled(chunk.map(m => this.sendMessage(m)));
      chunkResults.forEach((r, idx) => {
        if (r.status === 'fulfilled') {
          results.push({ ...r.value, originalData: chunk[idx] });
        } else {
          const errorMessage = r.reason instanceof Error ? r.reason.message : String(r.reason);
          results.push({ success: false, error: errorMessage, originalData: chunk[idx] });
        }
      });
    }
    return results;
  }
}

const messageRouter = new MessageRouter();
export default messageRouter;
export { MessageRouter };
