/**
 * =============================================================================
 * CHAT HISTORY SERVICE — Conversation Memory for AI Agent
 * =============================================================================
 *
 * Stores and retrieves chat history per channel+sender combination.
 * Each user has a single Firestore document with an array of messages.
 *
 * Storage: Firestore `ai_chat_history` collection
 * Key: `${channel}_${senderId}` (e.g. "telegram_5618410820")
 *
 * Design decisions:
 * - Single document per user (no subcollections) → fast read/write
 * - Max 20 messages per user (oldest pruned on add)
 * - 24h TTL — old messages cleaned up periodically
 * - Tool calls stored inline for context preservation
 *
 * @module services/ai-pipeline/chat-history-service
 * @see ADR-171 (Autonomous AI Agent)
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateChatHistoryDocId } from '@/services/enterprise-id.service';
import { getCompanyId } from '@/config/tenant';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';
import { sanitizeDocumentId } from '@/utils/firestore-helpers';

const logger = createModuleLogger('CHAT_HISTORY_SERVICE');

// ============================================================================
// TYPES
// ============================================================================

export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string; // ISO 8601
  toolCalls?: Array<{
    name: string;
    args: string;
    result: string;
  }>;
}

interface ChatHistoryDocument {
  channelSenderId: string;
  companyId: string;
  messages: ChatHistoryMessage[];
  lastUpdated: string;
  createdAt: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const COLLECTION_NAME = COLLECTIONS.AI_CHAT_HISTORY;
const MAX_MESSAGES_PER_USER = 20;
const MAX_MESSAGE_CONTENT_LENGTH = 3000;
const HISTORY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ============================================================================
// SERVICE
// ============================================================================

export class ChatHistoryService {
  /**
   * Build enterprise-compliant document ID from channelSenderId.
   * Input: "telegram_5618410820" → Output: "ach_telegram_5618410820"
   * @ssot Uses ENTERPRISE_ID_PREFIXES.AI_CHAT_HISTORY via generateChatHistoryDocId
   */
  private buildDocId(channelSenderId: string): string {
    const separatorIndex = channelSenderId.indexOf('_');
    if (separatorIndex === -1) {
      // Fallback: use as-is with prefix
      return generateChatHistoryDocId(channelSenderId, 'unknown');
    }
    const channel = channelSenderId.substring(0, separatorIndex);
    const senderId = channelSenderId.substring(separatorIndex + 1);
    return generateChatHistoryDocId(channel, senderId);
  }

  /**
   * Add a message to the chat history for a channel+sender
   */
  async addMessage(
    channelSenderId: string,
    message: ChatHistoryMessage
  ): Promise<void> {
    try {
      const db = getAdminFirestore();
      const docRef = db.collection(COLLECTION_NAME).doc(sanitizeDocumentId(this.buildDocId(channelSenderId)));

      // Truncate content if too long
      const truncatedMessage: ChatHistoryMessage = {
        ...message,
        content: message.content.length > MAX_MESSAGE_CONTENT_LENGTH
          ? message.content.substring(0, MAX_MESSAGE_CONTENT_LENGTH) + '...'
          : message.content,
      };

      await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(docRef);

        if (doc.exists) {
          const data = doc.data() as ChatHistoryDocument;
          let messages = data.messages ?? [];

          // Add new message
          messages.push(truncatedMessage);

          // Prune oldest if over limit
          if (messages.length > MAX_MESSAGES_PER_USER) {
            messages = messages.slice(-MAX_MESSAGES_PER_USER);
          }

          transaction.update(docRef, {
            messages,
            lastUpdated: new Date().toISOString(),
          });
        } else {
          // Create new document
          const newDoc: ChatHistoryDocument = {
            channelSenderId,
            companyId: getCompanyId(),
            messages: [truncatedMessage],
            lastUpdated: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          };
          transaction.set(docRef, newDoc);
        }
      });
    } catch (error) {
      // Non-fatal — chat history failure should not break the pipeline
      logger.warn('Failed to add chat history message', {
        channelSenderId,
        role: message.role,
        error: getErrorMessage(error),
      });
    }
  }

  /**
   * Get recent chat history for a channel+sender
   */
  async getRecentHistory(
    channelSenderId: string,
    maxMessages?: number
  ): Promise<ChatHistoryMessage[]> {
    try {
      const db = getAdminFirestore();
      const doc = await db.collection(COLLECTION_NAME).doc(sanitizeDocumentId(this.buildDocId(channelSenderId))).get();

      if (!doc.exists) {
        return [];
      }

      const data = doc.data() as ChatHistoryDocument;
      const messages = data.messages ?? [];

      // Check if history is stale (older than TTL)
      const lastUpdated = new Date(data.lastUpdated).getTime();
      if (Date.now() - lastUpdated > HISTORY_TTL_MS) {
        // History is stale — return empty and let cleanup handle deletion
        return [];
      }

      const limit = maxMessages ?? MAX_MESSAGES_PER_USER;
      return messages.slice(-limit);
    } catch (error) {
      logger.warn('Failed to get chat history', {
        channelSenderId,
        error: getErrorMessage(error),
      });
      return [];
    }
  }

  /**
   * Clear all chat history for a specific channel+sender.
   * Used to reset poisoned history (e.g. after multiple failed attempts).
   */
  async clearHistory(channelSenderId: string): Promise<void> {
    try {
      const db = getAdminFirestore();
      await db.collection(COLLECTION_NAME).doc(sanitizeDocumentId(this.buildDocId(channelSenderId))).delete();
      logger.info('Cleared chat history', { channelSenderId });
    } catch (error) {
      logger.warn('Failed to clear chat history', {
        channelSenderId,
        error: getErrorMessage(error),
      });
    }
  }

  /**
   * Clean up old chat history documents (older than 24h)
   * Call this from a daily cron job or periodic cleanup.
   *
   * @returns Number of documents cleaned up
   */
  async cleanupOldHistory(): Promise<number> {
    try {
      const db = getAdminFirestore();
      const cutoff = new Date(Date.now() - HISTORY_TTL_MS).toISOString();

      const oldDocs = await db
        .collection(COLLECTION_NAME)
        .where('lastUpdated', '<', cutoff)
        .limit(100) // Batch limit
        .get();

      if (oldDocs.empty) {
        return 0;
      }

      const batch = db.batch();
      for (const doc of oldDocs.docs) {
        batch.delete(doc.ref);
      }
      await batch.commit();

      logger.info('Cleaned up old chat history', {
        deletedCount: oldDocs.size,
      });

      return oldDocs.size;
    } catch (error) {
      logger.warn('Failed to cleanup chat history', {
        error: getErrorMessage(error),
      });
      return 0;
    }
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let serviceInstance: ChatHistoryService | null = null;

export function getChatHistoryService(): ChatHistoryService {
  if (!serviceInstance) {
    serviceInstance = new ChatHistoryService();
  }
  return serviceInstance;
}
