/**
 * =============================================================================
 * CONVERSATION MESSAGES API
 * =============================================================================
 *
 * Enterprise endpoint for listing messages within a conversation.
 * Supports pagination and chronological ordering.
 *
 * @module api/conversations/[conversationId]/messages
 * @enterprise EPIC C - Telegram Operationalization
 */

import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { withErrorHandling, apiSuccess, ApiError } from '@/lib/api/ApiErrorHandler';
import { COLLECTIONS } from '@/config/firestore-collections';
import { EnterpriseAPICache } from '@/lib/cache/enterprise-api-cache';
import { type MessageDirection, type DeliveryStatus } from '@/types/conversations';
import { type CommunicationChannel } from '@/types/communications';
import { type SenderType } from '@/config/domain-constants';

// ============================================================================
// TYPES
// ============================================================================

interface MessageListItem {
  id: string;
  conversationId: string;
  direction: MessageDirection;
  channel: CommunicationChannel;
  senderId: string;
  senderName: string;
  senderType: SenderType;
  content: {
    text: string;
    attachments?: Array<{
      type: string;
      url?: string;
      filename?: string;
    }>;
  };
  providerMessageId: string;
  deliveryStatus: DeliveryStatus;
  providerMetadata: {
    platform?: string;
    chatId?: string;
    userName?: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface MessagesListResponse {
  messages: MessageListItem[];
  count: number;
  totalCount: number;
  hasMore: boolean;
  page: number;
  pageSize: number;
  conversationId: string;
  loadedAt: string;
  source: 'cache' | 'firestore';
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;
const CACHE_KEY_PREFIX = 'api:conversations:messages';
const CACHE_TTL_MS = 5 * 1000; // 5 seconds for near-realtime messages

// ============================================================================
// TYPE-SAFE EXTRACTORS
// ============================================================================

function getString(data: Record<string, unknown>, field: string, defaultValue = ''): string {
  const value = data[field];
  return typeof value === 'string' ? value : defaultValue;
}

function getObject<T extends Record<string, unknown>>(
  data: Record<string, unknown>,
  field: string,
  defaultValue: T
): T {
  const value = data[field];
  return typeof value === 'object' && value !== null ? (value as T) : defaultValue;
}

function getTimestampString(data: Record<string, unknown>, field: string): string {
  const value = data[field];
  if (!value) return '';

  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const firestoreTimestamp = value as { toDate: () => Date };
    return firestoreTimestamp.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number') {
    return new Date(value).toISOString();
  }

  return '';
}

// ============================================================================
// FORCE DYNAMIC
// ============================================================================

export const dynamic = 'force-dynamic';

// ============================================================================
// GET - List Messages for Conversation
// ============================================================================

export const GET = withErrorHandling(async (
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) => {
  const startTime = Date.now();
  const { conversationId } = await params;

  if (!conversationId) {
    throw new ApiError(400, 'Conversation ID is required');
  }

  console.log(`📨 [Messages/List] Loading messages for conversation: ${conversationId}`);

  // Parse query parameters
  const searchParams = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE), 10)));
  const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc';

  // Build cache key
  const cacheKey = `${CACHE_KEY_PREFIX}:${conversationId}:p${page}:s${pageSize}:${order}`;

  // Check cache
  const cache = EnterpriseAPICache.getInstance();
  const cachedData = cache.get<MessagesListResponse>(cacheKey);

  if (cachedData) {
    const duration = Date.now() - startTime;
    console.log(`⚡ [Messages/List] CACHE HIT - ${cachedData.count} messages in ${duration}ms`);
    return apiSuccess<MessagesListResponse>({
      ...cachedData,
      source: 'cache'
    }, `Messages loaded from cache in ${duration}ms`);
  }

  console.log('🔍 [Messages/List] Cache miss - Fetching from Firestore...');

  // Verify conversation exists
  const convDoc = await adminDb
    .collection(COLLECTIONS.CONVERSATIONS)
    .doc(conversationId)
    .get();

  if (!convDoc.exists) {
    throw new ApiError(404, `Conversation ${conversationId} not found`);
  }

  // Build query
  const query = adminDb
    .collection(COLLECTIONS.MESSAGES)
    .where('conversationId', '==', conversationId)
    .orderBy('createdAt', order);

  // Get total count
  const countSnapshot = await query.count().get();
  const totalCount = countSnapshot.data().count;

  // Apply pagination
  const offset = (page - 1) * pageSize;
  const paginatedQuery = query.offset(offset).limit(pageSize);

  // Execute query
  const snapshot = await paginatedQuery.get();
  console.log(`📨 [Messages/List] Found ${snapshot.docs.length} messages (total: ${totalCount})`);

  // Map to response type
  const messages: MessageListItem[] = snapshot.docs.map(doc => {
    const data = doc.data() as Record<string, unknown>;

    const content = getObject<Record<string, unknown>>(data, 'content', {});
    const providerMetadata = getObject<Record<string, unknown>>(data, 'providerMetadata', {});

    return {
      id: doc.id,
      conversationId: getString(data, 'conversationId'),
      direction: getString(data, 'direction', 'inbound') as MessageDirection,
      channel: getString(data, 'channel', 'telegram') as CommunicationChannel,
      senderId: getString(data, 'senderId'),
      senderName: getString(data, 'senderName'),
      senderType: getString(data, 'senderType', 'customer') as SenderType,
      content: {
        text: getString(content, 'text'),
        attachments: content.attachments as MessageListItem['content']['attachments'],
      },
      providerMessageId: getString(data, 'providerMessageId'),
      deliveryStatus: getString(data, 'deliveryStatus', 'sent') as DeliveryStatus,
      providerMetadata: {
        platform: getString(providerMetadata, 'platform'),
        chatId: getString(providerMetadata, 'chatId'),
        userName: getString(providerMetadata, 'userName'),
      },
      createdAt: getTimestampString(data, 'createdAt'),
      updatedAt: getTimestampString(data, 'updatedAt'),
    };
  });

  // Build response
  const response: MessagesListResponse = {
    messages,
    count: messages.length,
    totalCount,
    hasMore: offset + messages.length < totalCount,
    page,
    pageSize,
    conversationId,
    loadedAt: new Date().toISOString(),
    source: 'firestore',
  };

  // Cache response
  cache.set(cacheKey, response, CACHE_TTL_MS);

  const duration = Date.now() - startTime;
  console.log(`✅ [Messages/List] Complete: ${messages.length} messages in ${duration}ms`);

  return apiSuccess<MessagesListResponse>(response, `Messages loaded in ${duration}ms`);

}, {
  operation: 'listMessages',
  entityType: COLLECTIONS.MESSAGES,
  entityId: 'conversation'
});
