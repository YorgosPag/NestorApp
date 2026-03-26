/**
 * =============================================================================
 * FILE DELIVERY HANDLER — Send files/photos/floorplans to chat (ADR-257F)
 * =============================================================================
 *
 * Extracted from customer-handler.ts for SRP (Google N.7.1 — max 400 lines).
 *
 * Supports dual-path access control:
 * - Admin: unrestricted access to all files
 * - Customer: scoped to linkedUnitIds / projectRoles
 *
 * @module services/ai-pipeline/tools/handlers/file-delivery-handler
 * @see SPEC-257F (File Delivery)
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FILE_SOURCE_TYPES } from '../agentic-tool-definitions';
import type { FileSourceType } from '../agentic-tool-definitions';
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

export class FileDeliveryHandler implements ToolHandler {
  readonly toolNames = ['deliver_file_to_chat'] as const;

  async execute(
    _toolName: string,
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    return this.executeDeliverFileToChat(args, ctx);
  }

  private async executeDeliverFileToChat(
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    // Common validation (admin + customer)
    const sourceType = String(args.sourceType ?? '');
    const sourceId = String(args.sourceId ?? '').trim();
    const caption = args.caption != null ? String(args.caption).trim() : undefined;

    if (!FILE_SOURCE_TYPES.includes(sourceType as FileSourceType)) {
      return { success: false, error: `sourceType must be one of: ${FILE_SOURCE_TYPES.join(', ')}` };
    }
    if (!sourceId) {
      return { success: false, error: 'sourceId is required' };
    }

    // Customer path: require contactMeta + linkedUnitIds for access control
    const contact = ctx.isAdmin ? null : ctx.contactMeta;
    if (!ctx.isAdmin) {
      if (!contact) {
        return { success: false, error: AI_ERRORS.UNRECOGNIZED_USER };
      }
      const linkedUnitIds = contact.linkedUnitIds ?? [];
      if (linkedUnitIds.length === 0) {
        return { success: false, error: AI_ERRORS.NO_LINKED_UNITS };
      }
    }

    const db = getAdminFirestore();

    let mediaUrls: Array<{ url: string; mediaType: 'photo' | 'document'; filename: string; contentType: string }> = [];

    if (sourceType === 'unit_photo') {
      const resolved = await this.resolveUnitPhotos(db, sourceId, ctx.isAdmin, contact);
      if ('error' in resolved) return resolved as ToolResult;
      mediaUrls = resolved;
    } else if (sourceType === 'file') {
      const resolved = await this.resolveFile(db, sourceId, ctx.isAdmin, contact);
      if ('error' in resolved) return resolved as ToolResult;
      mediaUrls = resolved;
    } else if (sourceType === 'floorplan') {
      const resolved = await this.resolveFloorplan(db, sourceId, ctx.isAdmin, contact);
      if ('error' in resolved) return resolved as ToolResult;
      mediaUrls = resolved;
    }

    return this.sendAndAudit(mediaUrls, sourceType, sourceId, caption, ctx);
  }

  // --------------------------------------------------------------------------
  // Source type resolvers
  // --------------------------------------------------------------------------

  private async resolveUnitPhotos(
    db: FirebaseFirestore.Firestore,
    sourceId: string,
    isAdmin: boolean,
    contact: AgenticContext['contactMeta']
  ): Promise<Array<{ url: string; mediaType: 'photo' | 'document'; filename: string; contentType: string }> | ToolResult> {
    if (!isAdmin) {
      const linkedUnitIds = contact?.linkedUnitIds ?? [];
      if (!linkedUnitIds.includes(sourceId)) {
        return { success: false, error: 'Δεν έχετε πρόσβαση σε αυτό το ακίνητο.' };
      }
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

    return allPhotoUrls.map((url, i) => ({
      url,
      mediaType: 'photo' as const,
      filename: `photo_${i + 1}.jpg`,
      contentType: 'image/jpeg',
    }));
  }

  private async resolveFile(
    db: FirebaseFirestore.Firestore,
    sourceId: string,
    isAdmin: boolean,
    contact: AgenticContext['contactMeta']
  ): Promise<Array<{ url: string; mediaType: 'photo' | 'document'; filename: string; contentType: string }> | ToolResult> {
    const fileDoc = await db.collection(COLLECTIONS.FILES).doc(sourceId).get();
    if (!fileDoc.exists) {
      return { success: false, error: 'Το αρχείο δεν βρέθηκε.' };
    }

    const fileData = fileDoc.data() as Record<string, unknown>;
    if (fileData.isDeleted) {
      return { success: false, error: 'Το αρχείο έχει διαγραφεί.' };
    }

    // Customer access check — admin has unrestricted file access
    if (!isAdmin && contact) {
      const entityType = String(fileData.entityType ?? '');
      const entityId = String(fileData.entityId ?? '');
      const fileProjectId = String(fileData.projectId ?? '');
      const linkedUnitIds = contact.linkedUnitIds ?? [];

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
    }

    const downloadUrl = String(fileData.downloadUrl ?? '');
    if (!downloadUrl) {
      return { success: false, error: 'Το αρχείο δεν είναι διαθέσιμο αυτή τη στιγμή.' };
    }

    const ext = String(fileData.ext ?? '').toLowerCase();
    const ct = String(fileData.contentType ?? 'application/octet-stream');
    const isPhoto = PHOTO_CONTENT_TYPES.has(ct) || PHOTO_EXTENSIONS.has(ext);

    return [{
      url: downloadUrl,
      mediaType: isPhoto ? 'photo' : 'document',
      filename: String(fileData.originalFilename ?? fileData.displayName ?? `file.${ext}`),
      contentType: ct,
    }];
  }

  private async resolveFloorplan(
    db: FirebaseFirestore.Firestore,
    sourceId: string,
    isAdmin: boolean,
    contact: AgenticContext['contactMeta']
  ): Promise<Array<{ url: string; mediaType: 'photo' | 'document'; filename: string; contentType: string }> | ToolResult> {
    const fpDoc = await db.collection(COLLECTIONS.FLOORPLANS).doc(sourceId).get();
    if (!fpDoc.exists) {
      return { success: false, error: 'Η κάτοψη δεν βρέθηκε.' };
    }

    const fpData = fpDoc.data() as Record<string, unknown>;
    const fpProjectId = String(fpData.projectId ?? '');

    // Customer access check — admin has unrestricted floorplan access
    if (!isAdmin && contact) {
      const linkedProjectIds = [...new Set(
        (contact.projectRoles ?? []).map(r => r.projectId).filter(Boolean),
      )];

      if (!linkedProjectIds.includes(fpProjectId)) {
        return { success: false, error: 'Δεν έχετε πρόσβαση σε αυτή την κάτοψη.' };
      }
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
    return [{
      url: resolvedUrl,
      mediaType: resolvedMediaType,
      filename: fpName.includes('.') ? fpName : `${fpName}.pdf`,
      contentType: resolvedMediaType === 'photo' ? 'image/png' : 'application/pdf',
    }];
  }

  // --------------------------------------------------------------------------
  // Send + audit
  // --------------------------------------------------------------------------

  private async sendAndAudit(
    mediaUrls: Array<{ url: string; mediaType: 'photo' | 'document'; filename: string; contentType: string }>,
    sourceType: string,
    sourceId: string,
    caption: string | undefined,
    ctx: AgenticContext
  ): Promise<ToolResult> {
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
}
