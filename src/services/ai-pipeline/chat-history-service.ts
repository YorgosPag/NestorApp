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
import { createModuleLogger } from '@/lib/telemetry/Logger';

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
  messages: ChatHistoryMessage[];
  lastUpdated: string;
  createdAt: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const COLLECTION_NAME = 'ai_chat_history';
const MAX_MESSAGES_PER_USER = 20;
const MAX_MESSAGE_CONTENT_LENGTH = 2000;
const HISTORY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ============================================================================
// SERVICE
// ============================================================================

export class ChatHistoryService {
  /**
   * Add a message to the chat history for a channel+sender
   */
  async addMessage(
    channelSenderId: string,
    message: ChatHistoryMessage
  ): Promise<void> {
    try {
      const db = getAdminFirestore();
      const docRef = db.collection(COLLECTION_NAME).doc(channelSenderId);

      // Truncate content if too long
      const truncatedMessage: ChatHistoryMessage = {
        ...message,
        content: message.content.length > MAX_MESSAGE_CONTENT_LENGTH
          ? message.content.substring(0, MAX_MESSAGE_CONTENT_LENGTH) + '...'
          : message.content,
      };

      const doc = await docRef.get();

      if (doc.exists) {
        const data = doc.data() as ChatHistoryDocument;
        let messages = data.messages ?? [];

        // Add new message
        messages.push(truncatedMessage);

        // Prune oldest if over limit
        if (messages.length > MAX_MESSAGES_PER_USER) {
          messages = messages.slice(-MAX_MESSAGES_PER_USER);
        }

        await docRef.update({
          messages,
          lastUpdated: new Date().toISOString(),
        });
      } else {
        // Create new document
        const newDoc: ChatHistoryDocument = {
          channelSenderId,
          messages: [truncatedMessage],
          lastUpdated: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        };
        await docRef.set(newDoc);
      }
    } catch (error) {
      // Non-fatal — chat history failure should not break the pipeline
      logger.warn('Failed to add chat history message', {
        channelSenderId,
        role: message.role,
        error: error instanceof Error ? error.message : String(error),
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
      const doc = await db.collection(COLLECTION_NAME).doc(channelSenderId).get();

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
        error: error instanceof Error ? error.message : String(error),
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
      await db.collection(COLLECTION_NAME).doc(channelSenderId).delete();
      logger.info('Cleared chat history', { channelSenderId });
    } catch (error) {
      logger.warn('Failed to clear chat history', {
        channelSenderId,
        error: error instanceof Error ? error.message : String(error),
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
        error: error instanceof Error ? error.message : String(error),
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
