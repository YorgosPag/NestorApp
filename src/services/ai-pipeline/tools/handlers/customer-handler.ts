/**
 * =============================================================================
 * CUSTOMER HANDLER — Complaint Triage (ADR-257D)
 * =============================================================================
 *
 * Customer-facing tools that don't require admin privileges.
 *
 * Tools:
 * - create_complaint_task: Complaint triage → CRM task + admin notification
 *
 * deliver_file_to_chat extracted to file-delivery-handler.ts (SRP / N.7.1)
 * search_knowledge_base extracted to knowledge-base-handler.ts (SRP / N.7.1)
 *
 * @module services/ai-pipeline/tools/handlers/customer-handler
 * @see ADR-171 (Autonomous AI Agent)
 * @see SPEC-257D (Complaint Triage)
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { getErrorMessage } from '@/lib/error-utils';
import { COMPLAINT_SEVERITIES } from '../agentic-tool-definitions';
import type { ComplaintSeverity } from '../agentic-tool-definitions';
import type { CrmTask } from '@/types/crm';
import {
  type AgenticContext,
  type ToolHandler,
  type ToolResult,
  AI_ERRORS,
  auditWrite,
  buildAttribution,
  logger,
} from '../executor-shared';
import { nowISO } from '@/lib/date-local';

// ============================================================================
// HANDLER
// ============================================================================

export class CustomerHandler implements ToolHandler {
  readonly toolNames = ['create_complaint_task'] as const;

  async execute(
    _toolName: string,
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    return this.executeCreateComplaintTask(args, ctx);
  }

  // --------------------------------------------------------------------------
  // create_complaint_task
  // --------------------------------------------------------------------------

  private async executeCreateComplaintTask(
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    const contact = ctx.contactMeta;
    if (!contact) {
      return { success: false, error: AI_ERRORS.UNRECOGNIZED_USER };
    }

    const linkedPropertyIds = contact.linkedPropertyIds ?? [];
    if (linkedPropertyIds.length === 0) {
      return { success: false, error: AI_ERRORS.NO_LINKED_UNITS };
    }

    const title = String(args.title ?? '').trim();
    const description = String(args.description ?? '').trim();
    const severity = String(args.severity ?? 'normal');
    const propertyId = String(args.propertyId ?? '').trim();

    if (!title || !description) {
      return { success: false, error: 'Απαιτούνται τίτλος και περιγραφή παραπόνου.' };
    }

    if (!COMPLAINT_SEVERITIES.includes(severity as ComplaintSeverity)) {
      return { success: false, error: `severity must be one of: ${COMPLAINT_SEVERITIES.join(', ')}` };
    }

    if (!linkedPropertyIds.includes(propertyId)) {
      return { success: false, error: 'Δεν έχετε πρόσβαση σε αυτό το ακίνητο.' };
    }

    const SEVERITY_TO_PRIORITY: Record<ComplaintSeverity, CrmTask['priority']> = {
      urgent: 'urgent',
      normal: 'high',
      low: 'low',
    };
    const priority = SEVERITY_TO_PRIORITY[severity as ComplaintSeverity] ?? 'high';

    const db = getAdminFirestore();
    let projectId: string | null = null;
    try {
      const propertyDoc = await db.collection(COLLECTIONS.PROPERTIES).doc(propertyId).get();
      if (propertyDoc.exists) {
        projectId = String(propertyDoc.data()?.projectId ?? '') || null;
      }
    } catch {
      logger.warn('Failed to resolve projectId for complaint task', { propertyId });
    }

    const { generateTaskId } = await import('@/services/enterprise-id.service');
    const taskId = generateTaskId();
    const now = nowISO();

    const taskData: Record<string, unknown> = {
      companyId: ctx.companyId,
      title: `Παράπονο: ${title}`,
      description,
      type: 'complaint',
      priority,
      status: 'pending',
      contactId: contact.contactId,
      propertyId,
      projectId: projectId ?? null,
      assignedTo: '',
      createdBy: buildAttribution(ctx),
      lastModifiedBy: buildAttribution(ctx),
      createdAt: now,
      updatedAt: now,
      metadata: {
        source: 'ai_complaint_triage',
        channel: ctx.channel,
        severity,
        reportedBy: contact.displayName,
      },
    };

    await db.collection(COLLECTIONS.TASKS).doc(taskId).set(taskData);

    await auditWrite(ctx, COLLECTIONS.TASKS, taskId, 'create', taskData);

    logger.info('Complaint task created', {
      taskId,
      severity,
      priority,
      propertyId,
      contactId: contact.contactId,
      requestId: ctx.requestId,
    });

    // URGENT: Server-side admin notification via Telegram
    let notifiedAdmin = false;
    if (severity === 'urgent') {
      try {
        const { getAdminTelegramChatId } = await import(
          '@/services/ai-pipeline/shared/super-admin-resolver'
        );
        const adminChatId = await getAdminTelegramChatId();
        if (adminChatId) {
          const { sendChannelReply } = await import(
            '@/services/ai-pipeline/shared/channel-reply-dispatcher'
          );
          const truncatedDesc = description.length > 200
            ? `${description.substring(0, 200)}…`
            : description;
          await sendChannelReply({
            channel: 'telegram',
            telegramChatId: adminChatId,
            textBody: `🚨 ΕΠΕΙΓΟΝ ΠΑΡΑΠΟΝΟ\n\n📋 ${title}\n👤 ${contact.displayName}\n🏠 Property: ${propertyId}\n\n${truncatedDesc}`,
            requestId: ctx.requestId,
          });
          notifiedAdmin = true;
        }
      } catch (notifyError) {
        logger.warn('Failed to send admin notification for urgent complaint', {
          taskId,
          requestId: ctx.requestId,
          error: getErrorMessage(notifyError),
        });
      }
    }

    return {
      success: true,
      data: { taskId, priority, severity, notifiedAdmin },
      count: 1,
    };
  }

}

