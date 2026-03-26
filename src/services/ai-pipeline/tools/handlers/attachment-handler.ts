/**
 * ATTACHMENT HANDLER — Link uploaded files (photos/documents) to contacts
 * Bridges Telegram media downloads to contact profile photos and documents.
 * @module services/ai-pipeline/tools/handlers/attachment-handler
 * @see ADR-055 (Enterprise Attachment Ingestion)
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FILE_STATUS } from '@/config/domain-constants';
import { ATTACHMENT_PURPOSES } from '../agentic-tool-definitions';
import type { AttachmentPurpose } from '../agentic-tool-definitions';
import {
  type AgenticContext,
  type ToolHandler,
  type ToolResult,
  auditWrite,
  buildAttribution,
  emitSyncSignalIfMapped,
  logger,
} from '../executor-shared';
import { classifyContactDocument } from './contact-document-classifier';

// ============================================================================
// HANDLER
// ============================================================================

export class AttachmentHandler implements ToolHandler {
  readonly toolNames = ['attach_file_to_contact'] as const;

  async execute(
    toolName: string,
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    if (toolName !== 'attach_file_to_contact') {
      return { success: false, error: `Unknown attachment tool: ${toolName}` };
    }
    if (!ctx.isAdmin) {
      return { success: false, error: 'attach_file_to_contact is admin-only.' };
    }

    const { contactId, fileRecordId, purpose } = validateArgs(args);
    if (!contactId) return { success: false, error: 'contactId is required.' };
    if (!fileRecordId) return { success: false, error: 'fileRecordId is required.' };
    if (!purpose) {
      return {
        success: false,
        error: `purpose must be one of: ${ATTACHMENT_PURPOSES.join(', ')}`,
      };
    }

    // Verify FileRecord exists and has downloadUrl
    const fileRecord = await getFileRecord(fileRecordId);
    if (!fileRecord) {
      return { success: false, error: 'FileRecord not found.' };
    }
    if (!fileRecord.downloadUrl) {
      return { success: false, error: 'FileRecord has no downloadUrl.' };
    }

    // Verify contact exists and belongs to same company — return displayName for AI verification
    const contact = await getContact(contactId, ctx.companyId);
    if (!contact) {
      return { success: false, error: 'Contact not found or access denied.' };
    }

    switch (purpose) {
      case 'profile_photo':
        return this.handleProfilePhoto(contactId, fileRecordId, fileRecord, contact.displayName, ctx);
      case 'gallery_photo':
        return this.handleGalleryPhoto(contactId, fileRecordId, fileRecord, contact.displayName, ctx);
      case 'document':
        return this.handleDocument(contactId, fileRecordId, fileRecord, contact.displayName, ctx);
    }
  }

  // ── PROFILE PHOTO ──

  private async handleProfilePhoto(
    contactId: string,
    fileRecordId: string,
    fileRecord: FileRecordData,
    contactDisplayName: string,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    const db = getAdminFirestore();
    const attribution = buildAttribution(ctx);

    await promoteFileRecord(db, fileRecordId, contactId, 'photos', attribution);
    await createFileLink(db, fileRecordId, contactId, ctx.companyId, attribution, 'profile_photo');

    await db.collection(COLLECTIONS.CONTACTS).doc(contactId).update({
      photoURL: fileRecord.downloadUrl,
      multiplePhotoURLs: FieldValue.arrayUnion(fileRecord.downloadUrl),
      updatedAt: FieldValue.serverTimestamp(),
      lastModifiedBy: attribution,
    });

    await auditWrite(ctx, COLLECTIONS.CONTACTS, contactId, 'attach_profile_photo', {
      fileRecordId, photoURL: fileRecord.downloadUrl,
    });
    emitSyncSignalIfMapped(COLLECTIONS.CONTACTS, 'UPDATED', contactId, ctx.companyId);

    logger.info('Profile photo attached to contact', {
      contactId, fileRecordId, requestId: ctx.requestId,
    });

    return {
      success: true,
      data: { contactId, contactDisplayName, fileRecordId, photoURL: fileRecord.downloadUrl, purpose: 'profile_photo' },
    };
  }

  // ── GALLERY PHOTO ──

  private async handleGalleryPhoto(
    contactId: string,
    fileRecordId: string,
    fileRecord: FileRecordData,
    contactDisplayName: string,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    const db = getAdminFirestore();
    const attribution = buildAttribution(ctx);

    await promoteFileRecord(db, fileRecordId, contactId, 'photos', attribution);
    await createFileLink(db, fileRecordId, contactId, ctx.companyId, attribution, 'gallery_photo');

    await db.collection(COLLECTIONS.CONTACTS).doc(contactId).update({
      multiplePhotoURLs: FieldValue.arrayUnion(fileRecord.downloadUrl),
      updatedAt: FieldValue.serverTimestamp(),
      lastModifiedBy: attribution,
    });

    await auditWrite(ctx, COLLECTIONS.CONTACTS, contactId, 'attach_gallery_photo', {
      fileRecordId,
    });
    emitSyncSignalIfMapped(COLLECTIONS.CONTACTS, 'UPDATED', contactId, ctx.companyId);

    return {
      success: true,
      data: { contactId, contactDisplayName, fileRecordId, purpose: 'gallery_photo' },
    };
  }

  // ── DOCUMENT ──

  private async handleDocument(
    contactId: string,
    fileRecordId: string,
    fileRecord: FileRecordData,
    contactDisplayName: string,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    const db = getAdminFirestore();
    const attribution = buildAttribution(ctx);

    // AI Vision auto-classification: detect document type → correct card
    const classification = await classifyContactDocument({
      downloadUrl: fileRecord.downloadUrl,
      filename: fileRecord.filename,
      contentType: fileRecord.contentType,
    });

    await createFileLink(db, fileRecordId, contactId, ctx.companyId, attribution, classification.purpose);
    await promoteFileRecord(db, fileRecordId, contactId, 'documents', attribution, {
      purpose: classification.purpose,
      classificationAnalysis: {
        classifier: 'contact-document-classifier',
        contactPurpose: classification.purpose,
        confidence: classification.confidence,
        reasoning: classification.reasoning,
        classifiedAt: new Date().toISOString(),
      },
    });

    await auditWrite(ctx, COLLECTIONS.FILES, fileRecordId, 'attach_document', {
      contactId, filename: fileRecord.filename,
      autoClassifiedPurpose: classification.purpose,
      classificationConfidence: classification.confidence,
    });

    logger.info('Document attached to contact with auto-classification', {
      contactId, fileRecordId, purpose: classification.purpose,
      confidence: classification.confidence, requestId: ctx.requestId,
    });

    return {
      success: true,
      data: {
        contactId, contactDisplayName, fileRecordId,
        filename: fileRecord.filename, purpose: 'document',
        autoClassifiedAs: classification.purpose,
        classificationConfidence: classification.confidence,
      },
    };
  }
}

// ============================================================================
// HELPERS
// ============================================================================

interface FileRecordData {
  downloadUrl: string;
  filename: string;
  contentType: string;
}

function validateArgs(args: Record<string, unknown>): {
  contactId: string;
  fileRecordId: string;
  purpose: AttachmentPurpose | null;
} {
  const contactId = String(args.contactId ?? '').trim();
  const fileRecordId = String(args.fileRecordId ?? '').trim();
  const purposeStr = String(args.purpose ?? '').trim();
  const purpose = ATTACHMENT_PURPOSES.includes(purposeStr as AttachmentPurpose)
    ? (purposeStr as AttachmentPurpose)
    : null;
  return { contactId, fileRecordId, purpose };
}

async function getFileRecord(fileRecordId: string): Promise<FileRecordData | null> {
  const db = getAdminFirestore();
  const snap = await db.collection(COLLECTIONS.FILES).doc(fileRecordId).get();
  if (!snap.exists) return null;
  const data = snap.data();
  return {
    downloadUrl: String(data?.downloadUrl ?? ''),
    filename: String(data?.originalFilename ?? data?.filename ?? 'file'),
    contentType: String(data?.contentType ?? 'application/octet-stream'),
  };
}

interface ContactData {
  displayName: string;
}

async function getContact(contactId: string, companyId: string): Promise<ContactData | null> {
  const db = getAdminFirestore();
  const snap = await db.collection(COLLECTIONS.CONTACTS).doc(contactId).get();
  if (!snap.exists) return null;
  const data = snap.data();
  if (data?.companyId && data.companyId !== companyId) return null;
  return { displayName: String(data?.displayName ?? 'Unknown') };
}

interface PromoteOptions {
  /** Contact document purpose (e.g., 'id', 'cv-resume') — sets FileRecord.purpose for UI card matching */
  purpose?: string;
  /** AI classification analysis to store in ingestion.analysis */
  classificationAnalysis?: Record<string, unknown>;
}

/**
 * Promote a FileRecord from ingestion/pending to contact-linked/ready.
 * Updates entityType, entityId, domain, category, status, and optionally purpose.
 */
async function promoteFileRecord(
  db: FirebaseFirestore.Firestore,
  fileRecordId: string,
  contactId: string,
  category: 'photos' | 'documents',
  attribution: string,
  options?: PromoteOptions
): Promise<void> {
  const updateData: Record<string, unknown> = {
    entityType: 'contact',
    entityId: contactId,
    domain: 'admin',
    category,
    status: FILE_STATUS.READY,
    updatedAt: FieldValue.serverTimestamp(),
    lastModifiedBy: attribution,
    'ingestion.state': 'classified',
    'ingestion.stateChangedAt': new Date().toISOString(),
  };

  if (options?.purpose) {
    updateData.purpose = options.purpose;
  }
  if (options?.classificationAnalysis) {
    updateData['ingestion.analysis'] = options.classificationAnalysis;
  }

  await db.collection(COLLECTIONS.FILES).doc(fileRecordId).update(updateData);
}

/**
 * Create a file_link record so the same file can be linked to multiple contacts.
 * Idempotent: uses deterministic ID (set with merge) so retries are safe.
 * @see ADR-032 (Linking Model)
 */
async function createFileLink(
  db: FirebaseFirestore.Firestore,
  fileRecordId: string,
  contactId: string,
  companyId: string,
  attribution: string,
  reason?: string
): Promise<void> {
  const linkId = `fl_${fileRecordId}_contact_${contactId}`;
  await db.collection(COLLECTIONS.FILE_LINKS).doc(linkId).set({
    id: linkId,
    sourceFileId: fileRecordId,
    sourceWorkspaceId: companyId,
    targetEntityType: 'contact',
    targetEntityId: contactId,
    reason: reason ?? null,
    status: 'active',
    createdAt: FieldValue.serverTimestamp(),
    createdBy: attribution,
  }, { merge: true });
}
