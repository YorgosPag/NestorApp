/**
 * =============================================================================
 * AGENTIC TOOL EXECUTOR — Strategy Pattern Dispatcher
 * =============================================================================
 *
 * Thin dispatcher that routes tool calls to domain-specific handlers.
 * Handles cross-cutting concerns: logging, analytics, error fallback.
 *
 * Architecture (Strategy Pattern):
 * - executor-shared.ts: Types, constants, security, utilities
 * - handlers/firestore-handler.ts: query, get_document, count, write, search_text
 * - handlers/contact-handler.ts: create_contact, append_contact_info
 * - handlers/messaging-handler.ts: send_email, send_telegram, send_social
 * - handlers/customer-handler.ts: complaint, deliver_file, knowledge_base
 * - handlers/utility-handler.ts: get_collection_schema, lookup_doy_code
 *
 * @module services/ai-pipeline/tools/agentic-tool-executor
 * @see ADR-171 (Autonomous AI Agent)
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { captureMessage as sentryCaptureMessage } from '@/lib/telemetry/sentry';
import { getErrorMessage } from '@/lib/error-utils';
// ADR-173: Tool analytics
import { getToolAnalyticsService } from '../tool-analytics-service';

// Shared types & utilities (re-exported for backward compatibility)
import {
  type AgenticContext,
  type ToolResult,
  type ToolHandler,
  logger,
  redactSensitiveFields,
  redactRoleBlockedFields,
  flattenNestedFields,
  truncateResult,
} from './executor-shared';
export type { AgenticContext, ToolResult } from './executor-shared';

// Domain handlers
import { FirestoreHandler } from './handlers/firestore-handler';
import { ContactHandler } from './handlers/contact-handler';
import { MessagingHandler } from './handlers/messaging-handler';
import { CustomerHandler } from './handlers/customer-handler';
import { FileDeliveryHandler } from './handlers/file-delivery-handler';
import { KnowledgeBaseHandler } from './handlers/knowledge-base-handler';
import { UtilityHandler } from './handlers/utility-handler';
import { BankingHandler } from './handlers/banking-handler';
import { RelationshipHandler } from './handlers/relationship-handler';
import { AttachmentHandler } from './handlers/attachment-handler';
import { FileLifecycleHandler } from './handlers/file-lifecycle-handler';
import { ActivityHandler } from './handlers/activity-handler';
import { DocumentReaderHandler } from './handlers/document-reader-handler';
import { ProcurementHandler } from './handlers/procurement-handler';

// ============================================================================
// EXECUTOR CLASS — Strategy Pattern Dispatcher
// ============================================================================

export class AgenticToolExecutor {
  private handlerMap = new Map<string, ToolHandler>();

  constructor() {
    const handlers: ToolHandler[] = [
      new FirestoreHandler(),
      new ContactHandler(),
      new MessagingHandler(),
      new CustomerHandler(),
      new FileDeliveryHandler(),
      new KnowledgeBaseHandler(),
      new UtilityHandler(),
      new BankingHandler(),
      new RelationshipHandler(),
      new AttachmentHandler(),
      new FileLifecycleHandler(),
      new ActivityHandler(),
      new DocumentReaderHandler(),
      new ProcurementHandler(),
    ];

    for (const handler of handlers) {
      for (const name of handler.toolNames) {
        this.handlerMap.set(name, handler);
      }
    }
  }

  /**
   * Execute a tool call — routes to the appropriate domain handler.
   * Cross-cutting: logging, analytics, FAILED_PRECONDITION fallback.
   */
  async executeTool(
    toolName: string,
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    const startTime = Date.now();

    logger.info('Executing tool', {
      tool: toolName,
      requestId: ctx.requestId,
      companyId: ctx.companyId,
      isAdmin: ctx.isAdmin,
    });

    try {
      const handler = this.handlerMap.get(toolName);

      const result = handler
        ? await handler.execute(toolName, args, ctx)
        : { success: false, error: `Unknown tool: ${toolName}` } as ToolResult;

      const elapsed = Date.now() - startTime;
      logger.info('Tool execution completed', {
        tool: toolName,
        requestId: ctx.requestId,
        success: result.success,
        elapsedMs: elapsed,
        resultCount: result.count,
      });

      // ADR-173: Record tool analytics (fire-and-forget)
      getToolAnalyticsService()
        .recordToolExecution(toolName, result.success, result.error)
        .catch(() => { /* non-fatal */ });

      return result;
    } catch (error) {
      const errorMessage = getErrorMessage(error);

      // FAILED_PRECONDITION = missing Firestore index → broad query fallback
      if (errorMessage.includes('FAILED_PRECONDITION') && toolName === 'firestore_query') {
        return this.handleFailedPreconditionFallback(args, ctx, errorMessage);
      }

      if (errorMessage.includes('FAILED_PRECONDITION')) {
        return {
          success: true,
          data: [],
          count: 0,
          warning: `[FALLBACK] Missing index for non-query tool "${toolName}". No results available.`,
        };
      }

      logger.error('Tool execution error', {
        tool: toolName,
        requestId: ctx.requestId,
        error: errorMessage,
      });
      return { success: false, error: `Tool error: ${errorMessage}` };
    }
  }

  /**
   * Broad query fallback when a Firestore index is missing.
   * Fetches all docs with companyId filter and lets AI filter client-side.
   */
  private async handleFailedPreconditionFallback(
    args: Record<string, unknown>,
    ctx: AgenticContext,
    indexError: string
  ): Promise<ToolResult> {
    const collection = String(args.collection ?? '');
    const limit = Math.min(typeof args.limit === 'number' ? args.limit : 20, 50);

    logger.warn('Missing Firestore index — fallback to broad query', {
      tool: 'firestore_query',
      collection,
      requestId: ctx.requestId,
      indexError,
    });

    sentryCaptureMessage(`Missing Firestore index: ${collection}`, 'warning', {
      tags: { component: 'tool-executor', collection },
      extra: { requestId: ctx.requestId, indexError },
    });

    try {
      const db = getAdminFirestore();
      let broadQuery: FirebaseFirestore.Query = db.collection(collection);
      broadQuery = broadQuery.where('companyId', '==', ctx.companyId);
      broadQuery = broadQuery.limit(limit);

      const snapshot = await broadQuery.get();
      const results = snapshot.docs.map(doc => {
        const raw = redactRoleBlockedFields(redactSensitiveFields(doc.data()), ctx);
        return { id: doc.id, ...flattenNestedFields(raw) };
      });

      return {
        success: true,
        data: truncateResult(results),
        count: results.length,
        warning: `[FALLBACK] Results may be incomplete — missing Firestore index for "${collection}". Filters were not fully applied.`,
      };
    } catch {
      return {
        success: true,
        data: [],
        count: 0,
        warning: `[FALLBACK] Broad query also failed for "${collection}". No results available.`,
      };
    }
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let executorInstance: AgenticToolExecutor | null = null;

export function getAgenticToolExecutor(): AgenticToolExecutor {
  if (!executorInstance) {
    executorInstance = new AgenticToolExecutor();
  }
  return executorInstance;
}
