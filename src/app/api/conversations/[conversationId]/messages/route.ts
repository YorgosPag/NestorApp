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

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
// 🔒 RATE LIMITING: STANDARD category (60 req/min)
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';

import { loadOwnedConversation } from '../../_shared/conversation-owned-doc';
import { readMessagesPage, type MessageListItem } from './conversation-messages-page';
import { nowISO } from '@/lib/date-local';
import { generateRequestId } from '@/services/enterprise-id.service';
import { EnterpriseAPICache } from '@/lib/cache/enterprise-api-cache';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('ConversationMessagesRoute');

// ============================================================================
// TYPES
// ============================================================================

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

/**
 * Το **κανονικό περιτύλιγμα** `{ success: true, data: T }` που παράγει ο
 * {@link apiSuccess} — ίδιο σχήμα με τον αδελφό `DeleteMessagesCanonicalResponse`
 * (`api/messages/delete/route.ts`).
 *
 * 🔴 **ΕΛΕΙΠΕ ΕΝΤΕΛΩΣ** (ADR-806 §7 #1): το όνομα χρησιμοποιούνταν σε **δύο**
 * υπογραφές παρακάτω και **δεν δηλωνόταν πουθενά στο έργο**. Δεν είναι λάθος
 * εισαγωγή — είναι σύμβολο που **έφυγε και ο καταναλωτής έμεινε**, το ίδιο σχήμα
 * με το περιστατικό `MODAL_SELECT_PLACEHOLDERS` του ADR-806 §4. Αόρατο σε
 * parse-only · σε `symbol-integrity` (δεν ήρθε ποτέ από `import`) · και στο jest
 * (οι τύποι σβήνονται στη μεταγλώττιση).
 */
type MessagesCanonicalResponse = ApiSuccessResponse<MessagesListResponse>;

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

// ADR-219: Field extractors centralized to @/lib/firestore/field-extractors

// ADR-218: getTimestampString replaced by centralized fieldToISO from @/lib/date-local

// ============================================================================
// FORCE DYNAMIC
// ============================================================================

export const dynamic = 'force-dynamic';

// ============================================================================
// GET - List Messages for Conversation
// ============================================================================

/**
 * GET /api/conversations/[conversationId]/messages
 *
 * List messages within a conversation with pagination.
 *
 * 🔒 SECURITY: Protected with RBAC (AUTHZ Phase 2)
 * - Permission: comm:conversations:view
 * - Ownership Validation: Verifies conversation belongs to user's company
 *
 * @rateLimit STANDARD (60 req/min) - Messages listing within conversation
 */
export const GET = withStandardRateLimit(async function GET(
  request: NextRequest,
  context?: { params: Promise<{ conversationId: string }> }
) {
  const handler = withAuth<MessagesCanonicalResponse>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      if (!context?.params) {
        throw new ApiError(400, 'Missing route params');
      }
      const { conversationId } = await context.params;
      return handleListMessages(req, ctx, conversationId);
    },
    { permissions: 'comm:conversations:view' }
  );

  return handler(request);
});

async function handleListMessages(request: NextRequest, ctx: AuthContext, conversationId: string): Promise<NextResponse<MessagesCanonicalResponse>> {
  const startTime = Date.now();
  const operationId = generateRequestId();

  if (!conversationId) {
    throw new ApiError(400, 'Conversation ID is required');
  }

  logger.info('[Messages/List] Loading messages', { conversationId, email: ctx.email, companyId: ctx.companyId });

  // Parse query parameters
  const searchParams = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE), 10)));
  const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc';

  // ──────────────────────────────────────────────────────────────────────────
  // CRITICAL: Ownership validation — φόρτωσε **και** κρίνε σε μία πράξη.
  //
  // Ξένη συνομιλία είναι πλέον δυσδιάκριτη από ανύπαρκτη: πριν, το 403
  // «You can only access conversations from your company» **περιέγραφε τον
  // λόγο**, δηλαδή επιβεβαίωνε ότι το id υπάρχει (ADR-742 §7decies).
  //
  // 🔴🔴 Η ΣΕΙΡΑ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ ΑΣΦΑΛΕΙΑΣ, ΟΧΙ ΑΙΣΘΗΤΙΚΗ (ADR-742 §7decies.2):
  // μέχρι τις 2026-08-01 ο έλεγχος ερχόταν **ΜΕΤΑ** την ανάγνωση της μνήμης, και
  // το κλειδί **δεν περιείχε μισθωτή** ⇒ όποιος ζητούσε το ίδιο conversationId
  // με τις ίδιες παραμέτρους σελίδας έπαιρνε **CACHE HIT** με τα μηνύματα ξένης
  // εταιρείας, χωρίς να τρέξει ποτέ φύλακας. Διαρροή **περιεχομένου**, όχι
  // ύπαρξης — το ίδιο είδος με τη §7octies.
  await loadOwnedConversation({
    conversationId,
    caller: ctx,
    action: 'list-messages',
  });

  // Build cache key — **με μισθωτή**: δεύτερη ζώνη, ώστε ακόμη κι αν κάποιος
  // μετακινήσει ξανά τον φύλακα, οι εγγραφές δύο εταιρειών να μη μοιράζονται
  // ποτέ θέση (belt-and-suspenders· N.7.2 #4).
  const cacheKey = `${CACHE_KEY_PREFIX}:${ctx.companyId}:${conversationId}:p${page}:s${pageSize}:${order}`;

  // Check cache
  const cache = EnterpriseAPICache.getInstance();
  const cachedData = cache.get<MessagesListResponse>(cacheKey);

  if (cachedData) {
    const duration = Date.now() - startTime;
    logger.info('[Messages/List] CACHE HIT', { count: cachedData.count, durationMs: duration });
    // 🏢 ENTERPRISE: Canonical response format { success: true, data: T }
    return apiSuccess<MessagesListResponse>({ ...cachedData, source: 'cache' });
  }

  logger.info('[Messages/List] Cache miss - Fetching from Firestore');

  const { messages, totalCount, offset } = await readMessagesPage({
    conversationId,
    page,
    pageSize,
    order,
  });

  logger.info('[Messages/List] Found messages', { count: messages.length, totalCount });

  // Build response
  const response: MessagesListResponse = {
    messages,
    count: messages.length,
    totalCount,
    hasMore: offset + messages.length < totalCount,
    page,
    pageSize,
    conversationId,
    loadedAt: nowISO(),
    source: 'firestore',
  };

  // Cache response
  cache.set(cacheKey, response, CACHE_TTL_MS);

  const duration = Date.now() - startTime;
  logger.info('[Messages/List] Complete', { messageCount: messages.length, durationMs: duration });

  // 🏢 ENTERPRISE: Canonical response format { success: true, data: T }
  return apiSuccess<MessagesListResponse>(response);
}
