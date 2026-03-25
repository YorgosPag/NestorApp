/**
 * =============================================================================
 * CUSTOMER HANDLER — Complaint Triage, File Delivery & Knowledge Base
 * =============================================================================
 *
 * Customer-facing tools that don't require admin privileges.
 *
 * Tools:
 * - create_complaint_task: Complaint triage → CRM task + admin notification
 * - deliver_file_to_chat: Send photo/floorplan/document to current chat
 * - search_knowledge_base: Search legal procedures & document availability
 *
 * @module services/ai-pipeline/tools/handlers/customer-handler
 * @see ADR-171 (Autonomous AI Agent)
 * @see SPEC-257D (Complaint Triage), SPEC-257F (File Delivery), SPEC-257G (Knowledge Base)
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { getErrorMessage } from '@/lib/error-utils';
import { COMPLAINT_SEVERITIES, FILE_SOURCE_TYPES } from '../agentic-tool-definitions';
import type { ComplaintSeverity, FileSourceType } from '../agentic-tool-definitions';
import type { CrmTask } from '@/types/crm';
import {
  type AgenticContext,
  type ToolHandler,
  type ToolResult,
  AI_ERRORS,
  auditWrite,
  logger,
} from '../executor-shared';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Image content types recognized as photos (sent via sendPhoto) */
const PHOTO_CONTENT_TYPES: ReadonlySet<string> = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
]);

/** File extensions recognized as photos */
const PHOTO_EXTENSIONS: ReadonlySet<string> = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'gif',
]);

// ============================================================================
// HANDLER
// ============================================================================

export class CustomerHandler implements ToolHandler {
  readonly toolNames = [
    'create_complaint_task',
    'deliver_file_to_chat',
    'search_knowledge_base',
  ] as const;

  async execute(
    toolName: string,
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    switch (toolName) {
      case 'create_complaint_task':
        return this.executeCreateComplaintTask(args, ctx);
      case 'deliver_file_to_chat':
        return this.executeDeliverFileToChat(args, ctx);
      case 'search_knowledge_base':
        return this.executeSearchKnowledgeBase(args, ctx);
      default:
        return { success: false, error: `Unknown customer tool: ${toolName}` };
    }
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

    const linkedUnitIds = contact.linkedUnitIds ?? [];
    if (linkedUnitIds.length === 0) {
      return { success: false, error: AI_ERRORS.NO_LINKED_UNITS };
    }

    const title = String(args.title ?? '').trim();
    const description = String(args.description ?? '').trim();
    const severity = String(args.severity ?? 'normal');
    const unitId = String(args.unitId ?? '').trim();

    if (!title || !description) {
      return { success: false, error: 'Απαιτούνται τίτλος και περιγραφή παραπόνου.' };
    }

    if (!COMPLAINT_SEVERITIES.includes(severity as ComplaintSeverity)) {
      return { success: false, error: `severity must be one of: ${COMPLAINT_SEVERITIES.join(', ')}` };
    }

    if (!linkedUnitIds.includes(unitId)) {
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
      const unitDoc = await db.collection(COLLECTIONS.UNITS).doc(unitId).get();
      if (unitDoc.exists) {
        projectId = String(unitDoc.data()?.projectId ?? '') || null;
      }
    } catch {
      logger.warn('Failed to resolve projectId for complaint task', { unitId });
    }

    const { generateTaskId } = await import('@/services/enterprise-id.service');
    const taskId = generateTaskId();
    const now = new Date().toISOString();

    const taskData: Record<string, unknown> = {
      companyId: ctx.companyId,
      title: `Παράπονο: ${title}`,
      description,
      type: 'complaint',
      priority,
      status: 'pending',
      contactId: contact.contactId,
      unitId,
      projectId: projectId ?? null,
      assignedTo: '',
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
      unitId,
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
            textBody: `🚨 ΕΠΕΙΓΟΝ ΠΑΡΑΠΟΝΟ\n\n📋 ${title}\n👤 ${contact.displayName}\n🏠 Unit: ${unitId}\n\n${truncatedDesc}`,
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

  // --------------------------------------------------------------------------
  // deliver_file_to_chat
  // --------------------------------------------------------------------------

  private async executeDeliverFileToChat(
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    const contact = ctx.contactMeta;
    if (!contact) {
      return { success: false, error: AI_ERRORS.UNRECOGNIZED_USER };
    }

    const linkedUnitIds = contact.linkedUnitIds ?? [];
    if (linkedUnitIds.length === 0) {
      return { success: false, error: AI_ERRORS.NO_LINKED_UNITS };
    }

    const sourceType = String(args.sourceType ?? '');
    const sourceId = String(args.sourceId ?? '').trim();
    const caption = args.caption != null ? String(args.caption).trim() : undefined;

    if (!FILE_SOURCE_TYPES.includes(sourceType as FileSourceType)) {
      return { success: false, error: `sourceType must be one of: ${FILE_SOURCE_TYPES.join(', ')}` };
    }
    if (!sourceId) {
      return { success: false, error: 'sourceId is required' };
    }

    const db = getAdminFirestore();

    let mediaUrls: Array<{ url: string; mediaType: 'photo' | 'document'; filename: string; contentType: string }> = [];

    if (sourceType === 'unit_photo') {
      if (!linkedUnitIds.includes(sourceId)) {
        return { success: false, error: 'Δεν έχετε πρόσβαση σε αυτό το ακίνητο.' };
      }

      const unitDoc = await db.collection(COLLECTIONS.UNITS).doc(sourceId).get();
      if (!unitDoc.exists) {
        return { success: false, error: 'Το ακίνητο δεν βρέθηκε.' };
      }

      const unitData = unitDoc.data() as Record<string, unknown>;
      const allPhotoUrls: string[] = [];

      if (typeof unitData.photoURL === 'string' && unitData.photoURL) {
        allPhotoUrls.push(unitData.photoURL);
      }
      if (Array.isArray(unitData.multiplePhotoURLs)) {
        for (const url of unitData.multiplePhotoURLs) {
          if (typeof url === 'string' && url && !allPhotoUrls.includes(url)) {
            allPhotoUrls.push(url);
          }
        }
      }

      if (allPhotoUrls.length === 0) {
        return { success: false, error: 'Δεν υπάρχουν φωτογραφίες για αυτό το ακίνητο.' };
      }

      mediaUrls = allPhotoUrls.map((url, i) => ({
        url,
        mediaType: 'photo' as const,
        filename: `photo_${i + 1}.jpg`,
        contentType: 'image/jpeg',
      }));

    } else if (sourceType === 'file') {
      const fileDoc = await db.collection(COLLECTIONS.FILES).doc(sourceId).get();
      if (!fileDoc.exists) {
        return { success: false, error: 'Το αρχείο δεν βρέθηκε.' };
      }

      const fileData = fileDoc.data() as Record<string, unknown>;
      if (fileData.isDeleted) {
        return { success: false, error: 'Το αρχείο έχει διαγραφεί.' };
      }

      const entityType = String(fileData.entityType ?? '');
      const entityId = String(fileData.entityId ?? '');
      const fileProjectId = String(fileData.projectId ?? '');

      const linkedProjectIds = [...new Set(
        (contact.projectRoles ?? []).map(r => r.projectId).filter(Boolean),
      )];

      let hasAccess = false;
      if (entityType === 'unit') {
        hasAccess = linkedUnitIds.includes(entityId);
      } else if (entityType === 'building' || entityType === 'project') {
        hasAccess = linkedProjectIds.includes(fileProjectId);
      } else {
        hasAccess = fileProjectId ? linkedProjectIds.includes(fileProjectId) : false;
      }

      if (!hasAccess) {
        return { success: false, error: 'Δεν έχετε πρόσβαση σε αυτό το αρχείο.' };
      }

      const downloadUrl = String(fileData.downloadUrl ?? '');
      if (!downloadUrl) {
        return { success: false, error: 'Το αρχείο δεν είναι διαθέσιμο αυτή τη στιγμή.' };
      }

      const ext = String(fileData.ext ?? '').toLowerCase();
      const ct = String(fileData.contentType ?? 'application/octet-stream');
      const isPhoto = PHOTO_CONTENT_TYPES.has(ct) || PHOTO_EXTENSIONS.has(ext);

      mediaUrls = [{
        url: downloadUrl,
        mediaType: isPhoto ? 'photo' : 'document',
        filename: String(fileData.originalFilename ?? fileData.displayName ?? `file.${ext}`),
        contentType: ct,
      }];

    } else if (sourceType === 'floorplan') {
      const fpDoc = await db.collection(COLLECTIONS.FLOORPLANS).doc(sourceId).get();
      if (!fpDoc.exists) {
        return { success: false, error: 'Η κάτοψη δεν βρέθηκε.' };
      }

      const fpData = fpDoc.data() as Record<string, unknown>;
      const fpProjectId = String(fpData.projectId ?? '');

      const linkedProjectIds = [...new Set(
        (contact.projectRoles ?? []).map(r => r.projectId).filter(Boolean),
      )];

      if (!linkedProjectIds.includes(fpProjectId)) {
        return { success: false, error: 'Δεν έχετε πρόσβαση σε αυτή την κάτοψη.' };
      }

      const pdfImageUrl = String(fpData.pdfImageUrl ?? '');
      const fpDownloadUrl = String(fpData.downloadUrl ?? '');
      const fileType = String(fpData.fileType ?? '');

      let resolvedUrl = '';
      let resolvedMediaType: 'photo' | 'document' = 'document';

      if (pdfImageUrl) {
        resolvedUrl = pdfImageUrl;
        resolvedMediaType = 'photo';
      } else if (fpDownloadUrl) {
        resolvedUrl = fpDownloadUrl;
        resolvedMediaType = fileType === 'pdf' ? 'document' : 'photo';
      } else if (fpData.scene) {
        return { success: false, error: 'Η κάτοψη αυτή είναι μόνο σε μορφή CAD (DXF). Δεν είναι δυνατή η αποστολή μέσω μηνύματος.' };
      } else {
        return { success: false, error: 'Η κάτοψη δεν είναι διαθέσιμη σε μορφή αρχείου.' };
      }

      const fpName = String(fpData.fileName ?? fpData.type ?? 'floorplan');
      mediaUrls = [{
        url: resolvedUrl,
        mediaType: resolvedMediaType,
        filename: fpName.includes('.') ? fpName : `${fpName}.pdf`,
        contentType: resolvedMediaType === 'photo' ? 'image/png' : 'application/pdf',
      }];
    }

    // Send via channel (supports multiple photos)
    const { sendChannelMediaReply } = await import(
      '@/services/ai-pipeline/shared/channel-reply-dispatcher'
    );

    let sentCount = 0;
    let lastError = '';
    const totalFiles = mediaUrls.length;

    const channelIds: Record<string, string | undefined> = {
      telegramChatId: ctx.telegramChatId,
      recipientEmail: ctx.channel === 'email' ? ctx.channelSenderId : undefined,
      whatsappPhone: ctx.channel === 'whatsapp' ? ctx.channelSenderId : undefined,
      messengerPsid: ctx.channel === 'messenger' ? ctx.channelSenderId : undefined,
      instagramIgsid: ctx.channel === 'instagram' ? ctx.channelSenderId : undefined,
    };

    for (let i = 0; i < mediaUrls.length; i++) {
      const media = mediaUrls[i];
      const fileCaption = caption
        ?? (totalFiles > 1 ? `${media.filename} (${i + 1}/${totalFiles})` : media.filename);

      const sendResult = await sendChannelMediaReply({
        channel: ctx.channel as import('@/types/ai-pipeline').PipelineChannelValue,
        ...channelIds,
        mediaUrl: media.url,
        mediaType: media.mediaType,
        caption: fileCaption,
        filename: media.filename,
        contentType: media.contentType,
        requestId: ctx.requestId,
      });

      if (sendResult.success) {
        sentCount++;
      } else {
        lastError = sendResult.error ?? 'Αποτυχία αποστολής';
      }
    }

    // Audit trail (fire-and-forget)
    auditWrite(ctx, 'file_delivery', sourceId, 'deliver', {
      sourceType,
      sourceId,
      sentCount,
      totalFiles,
      channel: ctx.channel,
    }).catch(() => { /* non-fatal */ });

    logger.info('File delivery completed', {
      sourceType,
      sourceId,
      sentCount,
      totalFiles,
      channel: ctx.channel,
      requestId: ctx.requestId,
    });

    if (sentCount === 0) {
      return { success: false, error: lastError || 'Αποτυχία αποστολής αρχείων.' };
    }

    return {
      success: true,
      data: { sourceType, sourceId, sentCount, totalFiles },
      count: sentCount,
    };
  }

  // --------------------------------------------------------------------------
  // search_knowledge_base
  // --------------------------------------------------------------------------

  private async executeSearchKnowledgeBase(
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    const query = String(args.query ?? '').trim();
    if (!query) {
      return { success: false, error: 'query is required' };
    }

    const { searchProcedures, DOCUMENT_SOURCE_LABELS } = await import(
      '@/config/legal-procedures-kb'
    );

    const matches = searchProcedures(query);

    if (matches.length === 0) {
      return {
        success: true,
        data: {
          message: 'Δεν βρέθηκε σχετική διαδικασία.',
          suggestion: 'Δοκιμάστε: "συμβόλαιο", "δάνειο", "μεταβίβαση", "προσύμφωνο"',
          procedures: [],
        },
        count: 0,
      };
    }

    const db = getAdminFirestore();
    const linkedUnitIds = ctx.contactMeta?.linkedUnitIds ?? [];
    const linkedProjectIds = [...new Set(
      (ctx.contactMeta?.projectRoles ?? []).map(r => r.projectId).filter(Boolean),
    )];

    const termToDocNames = new Map<string, Set<string>>();
    for (const { procedure } of matches.slice(0, 2)) {
      for (const doc of procedure.requiredDocuments) {
        if (doc.source === 'system' && doc.searchTerms.length > 0) {
          for (const term of doc.searchTerms) {
            const existing = termToDocNames.get(term) ?? new Set();
            existing.add(doc.name);
            termToDocNames.set(term, existing);
          }
        }
      }
    }

    const availableDocNames = new Set<string>();

    if (termToDocNames.size > 0 && (linkedUnitIds.length > 0 || linkedProjectIds.length > 0)) {
      try {
        const filesQuery = db.collection(COLLECTIONS.FILES)
          .where('companyId', '==', ctx.companyId)
          .where('status', '==', 'ready')
          .limit(100);

        const filesSnap = await filesQuery.get();

        for (const fileDoc of filesSnap.docs) {
          const data = fileDoc.data();
          const purpose = String(data.purpose ?? '').toLowerCase();
          const category = String(data.category ?? '').toLowerCase();
          const displayName = String(data.displayName ?? '').toLowerCase();
          const entityId = String(data.entityId ?? '');
          const fileProjectId = String(data.projectId ?? '');

          const isAccessible =
            linkedUnitIds.includes(entityId) ||
            linkedProjectIds.includes(fileProjectId) ||
            linkedProjectIds.includes(entityId);

          if (!isAccessible) continue;

          const searchableText = `${purpose} ${category} ${displayName}`;

          for (const [term, docNames] of termToDocNames) {
            if (searchableText.includes(term.toLowerCase())) {
              for (const name of docNames) {
                availableDocNames.add(name);
              }
            }
          }
        }
      } catch (err) {
        logger.warn('Failed to check document availability for KB', {
          requestId: ctx.requestId,
          error: getErrorMessage(err),
        });
      }
    }

    const enrichedProcedures = matches.slice(0, 2).map(({ procedure, matchScore }) => ({
      id: procedure.id,
      title: procedure.title,
      category: procedure.category,
      description: procedure.description,
      matchScore,
      requiredDocuments: procedure.requiredDocuments.map(doc => ({
        name: doc.name,
        source: doc.source,
        sourceLabel: DOCUMENT_SOURCE_LABELS[doc.source],
        availableInSystem: availableDocNames.has(doc.name),
        canBeSent: availableDocNames.has(doc.name),
      })),
    }));

    logger.info('Knowledge base search completed', {
      query,
      matchCount: matches.length,
      topMatch: enrichedProcedures[0]?.id,
      availableDocsCount: availableDocNames.size,
      requestId: ctx.requestId,
    });

    return {
      success: true,
      data: { procedures: enrichedProcedures },
      count: enrichedProcedures.length,
    };
  }
}
