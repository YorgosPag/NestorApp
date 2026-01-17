/**
 * =============================================================================
 * CONVERSATIONS LIST API
 * =============================================================================
 *
 * Enterprise endpoint for listing omnichannel conversations.
 * Supports filtering by status, channel, and pagination.
 *
 * @module api/conversations
 * @enterprise EPIC C - Telegram Operationalization
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateRequestId } from '@/services/enterprise-id.service';
import { EnterpriseAPICache } from '@/lib/cache/enterprise-api-cache';
import {
  CONVERSATION_STATUS,
  type ConversationStatus,
  type MessageDirection,
} from '@/types/conversations';
import { COMMUNICATION_CHANNELS, type CommunicationChannel } from '@/types/communications';

// ============================================================================
// TYPES
// ============================================================================

interface ConversationListItem {
  id: string;
  channel: CommunicationChannel;
  status: ConversationStatus;
  messageCount: number;
  unreadCount: number;
  lastMessage: {
    content: string;
    direction: MessageDirection;
    timestamp: string;
  } | null;
  participants: Array<{
    displayName: string;
    role: string;
    isInternal: boolean;
  }>;
  tags: string[];
  assignedTo: string | null;
  audit: {
    createdAt: string;
    updatedAt: string;
  };
}

interface ConversationsListResponse {
  conversations: ConversationListItem[];
  count: number;
  totalCount: number;
  hasMore: boolean;
  page: number;
  pageSize: number;
  loadedAt: string;
  source: 'cache' | 'firestore';
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const CACHE_KEY_PREFIX = 'api:conversations:list';
const CACHE_TTL_MS = 10 * 1000; // 10 seconds for near-realtime

// ============================================================================
// TYPE-SAFE EXTRACTORS
// ============================================================================

function getString(data: Record<string, unknown>, field: string, defaultValue = ''): string {
  const value = data[field];
  return typeof value === 'string' ? value : defaultValue;
}

function getNumber(data: Record<string, unknown>, field: string, defaultValue = 0): number {
  const value = data[field];
  return typeof value === 'number' ? value : defaultValue;
}

function getArray<T>(data: Record<string, unknown>, field: string, defaultValue: T[] = []): T[] {
  const value = data[field];
  return Array.isArray(value) ? (value as T[]) : defaultValue;
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

function getNestedTimestamp(data: Record<string, unknown>, path: string): string {
  const parts = path.split('.');
  let current: unknown = data;

  for (const part of parts) {
    if (typeof current !== 'object' || current === null) return '';
    current = (current as Record<string, unknown>)[part];
  }

  if (!current) return '';

  if (typeof current === 'object' && current !== null && 'toDate' in current) {
    const firestoreTimestamp = current as { toDate: () => Date };
    return firestoreTimestamp.toDate().toISOString();
  }

  if (typeof current === 'string') {
    return current;
  }

  return '';
}

// ============================================================================
// FORCE DYNAMIC
// ============================================================================

export const dynamic = 'force-dynamic';

// ============================================================================
// GET - List Conversations
// ============================================================================

/**
 * GET /api/conversations
 *
 * List omnichannel conversations with filtering and pagination.
 *
 * 🔒 SECURITY: Protected with RBAC (AUTHZ Phase 2)
 * - Permission: comm:conversations:list
 * - Tenant Isolation: Filters by user's companyId
 */
export async function GET(request: NextRequest) {
  const handler = withAuth<ConversationsListResponse>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse<ConversationsListResponse>> => {
      return handleListConversations(req, ctx);
    },
    { permissions: 'comm:conversations:list' }
  );

  return handler(request);
}

async function handleListConversations(request: NextRequest, ctx: AuthContext): Promise<NextResponse<ConversationsListResponse>> {
  const startTime = Date.now();
  const operationId = generateRequestId();

  console.log(`💬 [Conversations/List] Starting load for user: ${ctx.email} (company: ${ctx.companyId})...`);

  // Parse query parameters
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get('status') as ConversationStatus | null;
  const channel = searchParams.get('channel') as CommunicationChannel | null;
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE), 10)));

  // Build cache key
  const cacheKey = `${CACHE_KEY_PREFIX}:${status || 'all'}:${channel || 'all'}:p${page}:s${pageSize}`;

  // Check cache
  const cache = EnterpriseAPICache.getInstance();
  const cachedData = cache.get<ConversationsListResponse>(cacheKey);

  if (cachedData) {
    const duration = Date.now() - startTime;
    console.log(`⚡ [Conversations/List] CACHE HIT - ${cachedData.count} conversations in ${duration}ms`);
    // 🏢 ENTERPRISE: Wrap response με data envelope (consistency με frontend hooks)
    return NextResponse.json({
      data: {
        ...cachedData,
        source: 'cache'
      }
    });
  }

  console.log('🔍 [Conversations/List] Cache miss - Fetching from Firestore...');

  // Build query with TENANT ISOLATION (AUTHZ Phase 2)
  let query = adminDb.collection(COLLECTIONS.CONVERSATIONS)
    .where('companyId', '==', ctx.companyId) // CRITICAL: Filter by user's company
    .orderBy('audit.updatedAt', 'desc');

  // Apply filters
  if (status && Object.values(CONVERSATION_STATUS).includes(status)) {
    query = query.where('status', '==', status);
  }

  if (channel && Object.values(COMMUNICATION_CHANNELS).includes(channel)) {
    query = query.where('channel', '==', channel);
  }

  // Get total count (for pagination)
  const countSnapshot = await query.count().get();
  const totalCount = countSnapshot.data().count;

  // Apply pagination
  const offset = (page - 1) * pageSize;
  query = query.offset(offset).limit(pageSize);

  // Execute query
  const snapshot = await query.get();
  console.log(`💬 [Conversations/List] Found ${snapshot.docs.length} conversations (total: ${totalCount})`);

  // Map to response type
  const conversations: ConversationListItem[] = snapshot.docs.map(doc => {
    const data = doc.data() as Record<string, unknown>;

    // Extract lastMessage
    const lastMessageData = data.lastMessage as Record<string, unknown> | undefined;
    const lastMessage = lastMessageData ? {
      content: getString(lastMessageData, 'content'),
      direction: getString(lastMessageData, 'direction', 'inbound') as MessageDirection,
      timestamp: getTimestampString(lastMessageData, 'timestamp'),
    } : null;

    // Extract participants
    const participantsData = getArray<Record<string, unknown>>(data, 'participants');
    const participants = participantsData.map(p => ({
      displayName: getString(p, 'displayName'),
      role: getString(p, 'role'),
      isInternal: p.isInternal === true,
    }));

    return {
      id: doc.id,
      channel: getString(data, 'channel', 'telegram') as CommunicationChannel,
      status: getString(data, 'status', 'active') as ConversationStatus,
      messageCount: getNumber(data, 'messageCount'),
      unreadCount: getNumber(data, 'unreadCount'),
      lastMessage,
      participants,
      tags: getArray<string>(data, 'tags'),
      assignedTo: getString(data, 'assignedTo') || null,
      audit: {
        createdAt: getNestedTimestamp(data, 'audit.createdAt'),
        updatedAt: getNestedTimestamp(data, 'audit.updatedAt'),
      },
    };
  });

  // Build response
  const response: ConversationsListResponse = {
    conversations,
    count: conversations.length,
    totalCount,
    hasMore: offset + conversations.length < totalCount,
    page,
    pageSize,
    loadedAt: new Date().toISOString(),
    source: 'firestore',
  };

  // Cache response
  cache.set(cacheKey, response, CACHE_TTL_MS);

  const duration = Date.now() - startTime;
  console.log(`✅ [Conversations/List] Complete: ${conversations.length} conversations in ${duration}ms`);

  // 🏢 ENTERPRISE: Wrap response με data envelope (consistency με frontend hooks)
  return NextResponse.json({ data: response });
}
