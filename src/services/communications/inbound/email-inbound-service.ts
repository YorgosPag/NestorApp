import { createHash } from 'crypto';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getAdminFirestore } from '@/server/admin/admin-guards';
import { COLLECTIONS } from '@/config/firestore-collections';
import { logWebhookEvent } from '@/lib/auth/audit';
import { COMMUNICATION_CHANNELS } from '@/types/communications';
import type { Communication } from '@/types/crm';
import { TRIAGE_STATUSES } from '@/types/crm';
import {
  DEFAULTS,
  SYSTEM_IDENTITY,
  PLATFORMS,
  FILE_CATEGORIES,
  FILE_STATUS,
  type FileCategory,
} from '@/config/domain-constants';
import {
  ATTACHMENT_TYPES,
  detectAttachmentType,
  type MessageAttachment,
} from '@/types/conversations';
import {
  buildIngestionFileRecordData,
  buildFinalizeFileRecordUpdate,
  type FileSourceMetadata,
} from '@/services/file-record';
import { createAIAnalysisProvider } from '@/services/ai-analysis/providers/ai-provider-factory';
import {
  isDocumentClassifyAnalysis,
  isMessageIntentAnalysis,
  type DocumentClassifyAnalysis,
} from '@/schemas/ai-analysis';
import { generateGlobalMessageDocId } from '@/server/lib/id-generation';
import { FILE_TYPE_CONFIG, type FileType } from '@/config/file-upload-config';
import type { IAIAnalysisProvider } from '@/services/ai-analysis/providers/IAIAnalysisProvider';
import { dispatchNotification } from '@/server/notifications/notification-orchestrator';
import {
  NOTIFICATION_EVENT_TYPES,
  SOURCE_SERVICES,
  NOTIFICATION_ENTITY_TYPES,
  getCurrentEnvironment,
} from '@/config/notification-events';
import type { GlobalRole } from '@/lib/auth/types';
import type {
  InboundEmailInput,
  InboundEmailResult,
  InboundEmailAttachment,
  ParsedAddress,
  InboundRoutingRule,
  RoutingResolution,
} from './types';

const logger = createModuleLogger('EMAIL_INBOUND_SERVICE');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export function parseAddress(raw?: string): ParsedAddress | null {
  if (!raw) return null;

  const trimmed = raw.trim();
  const match = trimmed.match(/^(.*)<([^>]+)>$/);
  if (match) {
    const name = match[1]?.trim().replace(/^"|"$/g, '') || undefined;
    const email = normalizeEmail(match[2] || '');
    return email ? { email, name } : null;
  }

  const emailOnly = normalizeEmail(trimmed.replace(/^"|"$/g, ''));
  return emailOnly ? { email: emailOnly } : null;
}

export function splitAddresses(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((part) => parseAddress(part)?.email)
    .filter((email): email is string => Boolean(email));
}

export function resolveSubject(subject?: string): string {
  const trimmed = subject?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULTS.NO_SUBJECT;
}

export function resolveProviderMessageId(prefix: string, fallbackKey: string, ...candidates: Array<string | undefined>): string {
  const provided = candidates.find((candidate) => Boolean(candidate && candidate.trim()));
  if (provided) {
    return provided.trim();
  }

  const hash = createHash('sha256').update(fallbackKey).digest('hex').substring(0, 32);
  return `${prefix}_${hash}`;
}

function normalizePattern(pattern: string): string {
  return pattern.trim().toLowerCase();
}

function matchesRoutingPattern(pattern: string, email: string): boolean {
  const normalizedPattern = normalizePattern(pattern);
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedPattern) return false;

  if (normalizedPattern.includes('@')) {
    if (normalizedPattern.startsWith('@')) {
      const domain = normalizedPattern.slice(1);
      return normalizedEmail.endsWith(`@${domain}`);
    }
    return normalizedEmail === normalizedPattern;
  }

  return normalizedEmail.endsWith(`@${normalizedPattern}`);
}

async function loadInboundRoutingRules(): Promise<InboundRoutingRule[]> {
  const adminDb = getAdminFirestore();
  const settingsDoc = await adminDb.collection(COLLECTIONS.SYSTEM).doc('settings').get();
  if (!settingsDoc.exists) return [];

  const data = settingsDoc.data();
  if (!data || !isRecord(data)) return [];

  const integrations = data.integrations;
  if (!isRecord(integrations)) return [];

  const rules = integrations.emailInboundRouting;
  if (!Array.isArray(rules)) return [];

  return rules
    .filter((rule) => isRecord(rule))
    .map((rule) => ({
      pattern: typeof rule.pattern === 'string' ? rule.pattern : '',
      companyId: typeof rule.companyId === 'string' ? rule.companyId : '',
      isActive: typeof rule.isActive === 'boolean' ? rule.isActive : true,
    }))
    .filter((rule) => rule.pattern && rule.companyId && rule.isActive);
}

export async function resolveCompanyIdFromRecipients(recipients: string[]): Promise<RoutingResolution> {
  const rules = await loadInboundRoutingRules();
  if (rules.length === 0) {
    return { companyId: null };
  }

  for (const recipient of recipients) {
    const matchedRule = rules.find((rule) => matchesRoutingPattern(rule.pattern, recipient));
    if (matchedRule) {
      return { companyId: matchedRule.companyId, matchedPattern: matchedRule.pattern };
    }
  }

  return { companyId: null };
}

async function findContactByEmail(companyId: string, email: string): Promise<string | null> {
  const adminDb = getAdminFirestore();
  const contactsRef = adminDb.collection(COLLECTIONS.CONTACTS);
  const normalizedEmail = normalizeEmail(email);

  const candidateFields = ['email', 'primaryEmail', 'contactEmail', 'officialEmail'];

  for (const field of candidateFields) {
    const snapshot = await contactsRef
      .where('companyId', '==', companyId)
      .where(field, '==', normalizedEmail)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      return snapshot.docs[0].id;
    }
  }

  return null;
}

function splitName(fullName?: string): { firstName: string; lastName: string } {
  if (!fullName || fullName.trim().length === 0) {
    return { firstName: DEFAULTS.UNKNOWN_SENDER, lastName: DEFAULTS.UNKNOWN_SENDER };
  }

  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: DEFAULTS.UNKNOWN_SENDER };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

async function ensureContactForSender(companyId: string, sender: ParsedAddress): Promise<string> {
  const existingContactId = await findContactByEmail(companyId, sender.email);
  if (existingContactId) {
    return existingContactId;
  }

  const adminDb = getAdminFirestore();
  const { firstName, lastName } = splitName(sender.name || sender.email.split('@')[0]);

  const newContact = {
    type: 'individual' as const,
    isFavorite: false,
    status: 'active' as const,
    firstName,
    lastName,
    displayName: `${firstName} ${lastName}`.trim(),
    name: `${firstName} ${lastName}`.trim(),
    companyId,
    createdBy: SYSTEM_IDENTITY.ID,
    emails: [
      {
        email: sender.email,
        type: 'work' as const,
        isPrimary: true,
      },
    ],
    email: sender.email,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const docRef = await adminDb.collection(COLLECTIONS.CONTACTS).add(newContact);
  return docRef.id;
}

function mapAttachmentTypeToCategory(type: MessageAttachment['type']): FileCategory {
  switch (type) {
    case ATTACHMENT_TYPES.IMAGE:
      return FILE_CATEGORIES.PHOTOS;
    case ATTACHMENT_TYPES.VIDEO:
      return FILE_CATEGORIES.VIDEOS;
    case ATTACHMENT_TYPES.AUDIO:
      return FILE_CATEGORIES.AUDIO;
    case ATTACHMENT_TYPES.DOCUMENT:
    default:
      return FILE_CATEGORIES.DOCUMENTS;
  }
}

function mapAttachmentTypeToFileType(type: MessageAttachment['type']): FileType {
  switch (type) {
    case ATTACHMENT_TYPES.IMAGE:
      return 'image';
    case ATTACHMENT_TYPES.VIDEO:
      return 'video';
    case ATTACHMENT_TYPES.AUDIO:
      return 'any';
    case ATTACHMENT_TYPES.DOCUMENT:
    default:
      return 'document';
  }
}

function getMaxAllowedSize(attachmentType: MessageAttachment['type']): number {
  const fileType = mapAttachmentTypeToFileType(attachmentType);
  return FILE_TYPE_CONFIG[fileType].maxSize;
}

function shouldClassifyAttachment(attachmentType: MessageAttachment['type']): boolean {
  return attachmentType === ATTACHMENT_TYPES.DOCUMENT || attachmentType === ATTACHMENT_TYPES.IMAGE;
}

async function uploadToFirebaseStorage(params: {
  buffer: Buffer;
  storagePath: string;
  contentType: string;
  metadata?: Record<string, string>;
  expectedSize?: number;
}): Promise<{
  downloadUrl: string | null;
  verified: boolean;
  storageSizeBytes?: number;
}> {
  const { buffer, storagePath, contentType, metadata } = params;

  const { getStorage } = await import('firebase-admin/storage');
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!storageBucket) {
    logger.error('Firebase storage bucket not configured');
    return { downloadUrl: null, verified: false };
  }

  const bucket = getStorage().bucket(storageBucket);
  const file = bucket.file(storagePath);

  await file.save(buffer, {
    metadata: {
      contentType,
      metadata,
    },
  });

  await file.makePublic();
  const [exists] = await file.exists();
  const [fileMetadata] = await file.getMetadata().catch(() => [undefined]);
  const metadataSize = fileMetadata?.size ? Number(fileMetadata.size) : undefined;
  const expectedSize = params.expectedSize;
  const verified =
    exists &&
    (expectedSize === undefined || metadataSize === undefined || metadataSize === expectedSize);

  if (!verified) {
    logger.warn('Storage verification failed for attachment', {
      storagePath,
      expectedSize,
      metadataSize,
    });
  }

  return {
    downloadUrl: `https://storage.googleapis.com/${storageBucket}/${storagePath}`,
    verified,
    storageSizeBytes: metadataSize,
  };
}

async function ingestAttachment(params: {
  companyId: string;
  sender: ParsedAddress;
  messageId: string;
  receivedAt?: string;
  attachment: InboundEmailAttachment;
  provider: string;
  aiProvider: IAIAnalysisProvider;
}): Promise<MessageAttachment | null> {
  const { attachment } = params;
  const filename = attachment.filename || `attachment_${params.messageId}`;
  const contentType = attachment.contentType || 'application/octet-stream';
  const sizeBytes = attachment.sizeBytes;

  const attachmentType = detectAttachmentType(contentType);
  const maxAllowedSize = getMaxAllowedSize(attachmentType);
  if (sizeBytes && sizeBytes > maxAllowedSize) {
    logger.warn('Attachment exceeds max allowed size, skipping', {
      filename,
      sizeBytes,
      maxAllowedSize,
    });
    return null;
  }

  const downloadResult = await attachment.download();
  if (!downloadResult) return null;

  const extension = filename.includes('.') ? filename.split('.').pop() || '' : '';
  const cleanExt = extension || 'bin';

  const source: FileSourceMetadata = {
    type: 'email',
    messageId: params.messageId,
    fromUserId: params.sender.email,
    senderName: params.sender.name || params.sender.email,
    receivedAt: params.receivedAt || new Date().toISOString(),
    fileUniqueId: params.messageId,
  };

  const category = mapAttachmentTypeToCategory(attachmentType);

  const { fileId, storagePath, recordBase } = buildIngestionFileRecordData({
    companyId: params.companyId,
    category,
    filename,
    contentType,
    ext: cleanExt,
    source,
  });

  const adminDb = getAdminFirestore();
  await adminDb.collection(COLLECTIONS.FILES).doc(fileId).set({
    ...recordBase,
    createdAt: new Date(),
  });

  const classification = shouldClassifyAttachment(attachmentType)
    ? await classifyAttachment({
        aiProvider: params.aiProvider,
        contentBuffer: downloadResult.buffer,
        filename,
        mimeType: contentType,
        sizeBytes: downloadResult.buffer.length,
      })
    : null;

  if (classification) {
    await adminDb.collection(COLLECTIONS.FILES).doc(fileId).update({
      ingestion: {
        ...recordBase.ingestion,
        analysis: classification,
        stateChangedAt: new Date().toISOString(),
      },
      updatedAt: new Date(),
    });
  }

  const uploadResult = await uploadToFirebaseStorage({
    buffer: downloadResult.buffer,
    storagePath,
    contentType: downloadResult.contentType,
    metadata: {
      source: PLATFORMS.EMAIL,
      fileRecordId: fileId,
      messageId: params.messageId,
      provider: params.provider,
    },
    expectedSize: downloadResult.buffer.length,
  });

  if (!uploadResult.downloadUrl) return null;

  const finalizeUpdate = buildFinalizeFileRecordUpdate({
    sizeBytes: downloadResult.buffer.length,
    downloadUrl: uploadResult.downloadUrl,
    nextStatus: FILE_STATUS.PENDING,
  });

  await adminDb.collection(COLLECTIONS.FILES).doc(fileId).update({
    ...finalizeUpdate,
    updatedAt: new Date(),
  });

  const attachmentMetadata: Record<string, unknown> = {
    fileRecordId: fileId,
    quarantined: true,
    storageVerified: uploadResult.verified,
  };

  if (uploadResult.storageSizeBytes !== undefined) {
    attachmentMetadata.storageSizeBytes = uploadResult.storageSizeBytes;
  }

  if (classification) {
    attachmentMetadata.analysis = classification;
  }

  return {
    type: attachmentType,
    url: uploadResult.downloadUrl,
    filename,
    mimeType: contentType,
    size: downloadResult.buffer.length,
    metadata: attachmentMetadata,
  };
}

async function processAttachments(params: {
  companyId: string;
  sender: ParsedAddress;
  messageId: string;
  receivedAt?: string;
  attachments?: InboundEmailAttachment[];
  provider: string;
  aiProvider: IAIAnalysisProvider;
}): Promise<MessageAttachment[]> {
  const list = params.attachments || [];
  const results: MessageAttachment[] = [];

  for (const attachment of list) {
    const result = await ingestAttachment({
      companyId: params.companyId,
      sender: params.sender,
      messageId: params.messageId,
      receivedAt: params.receivedAt,
      attachment,
      provider: params.provider,
      aiProvider: params.aiProvider,
    });

    if (result) {
      results.push(result);
    }
  }

  return results;
}

async function classifyAttachment(params: {
  aiProvider: IAIAnalysisProvider;
  contentBuffer: Buffer;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<DocumentClassifyAnalysis | null> {
  const analysis = await params.aiProvider.analyze({
    kind: 'document_classify',
    content: params.contentBuffer,
    filename: params.filename,
    mimeType: params.mimeType,
    sizeBytes: params.sizeBytes,
  });

  if (!isDocumentClassifyAnalysis(analysis)) {
    return null;
  }

  return analysis;
}

export async function processInboundEmail(input: InboundEmailInput): Promise<InboundEmailResult> {
  const routing = await resolveCompanyIdFromRecipients(input.recipients);
  if (!routing.companyId) {
    logger.warn('No routing match for inbound email', {
      recipients: input.recipients,
      provider: input.provider,
    });
    return { processed: false, skipped: true, reason: 'routing_unmatched' };
  }

  const adminDb = getAdminFirestore();
  const messageDocId = generateGlobalMessageDocId(COMMUNICATION_CHANNELS.EMAIL, input.providerMessageId);
  const existingDoc = await adminDb.collection(COLLECTIONS.MESSAGES).doc(messageDocId).get();
  if (existingDoc.exists) {
    return { processed: false, skipped: true, reason: 'duplicate' };
  }

  const contactId = await ensureContactForSender(routing.companyId, input.sender);

  const aiProvider = createAIAnalysisProvider();
  const analysis = await aiProvider.analyze({
    kind: 'message_intent',
    messageText: input.contentText || input.subject,
    context: {
      senderName: input.sender.name || input.sender.email,
      channel: COMMUNICATION_CHANNELS.EMAIL,
    },
  });

  const intentAnalysis = isMessageIntentAnalysis(analysis) ? analysis : undefined;

  // 🏢 ENTERPRISE: ALL inbound emails go to 'pending' for manual triage review
  // This ensures admins review every incoming email before it becomes a task
  const triageStatus: 'pending' = 'pending';

  const attachments = await processAttachments({
    companyId: routing.companyId,
    sender: input.sender,
    messageId: input.providerMessageId,
    receivedAt: input.receivedAt,
    attachments: input.attachments,
    provider: input.provider,
    aiProvider,
  });

  // Build metadata object first
  const metadata: Record<string, unknown> = {
    provider: PLATFORMS.EMAIL,
    providerMessageId: input.providerMessageId,
    senderName: input.sender.name || input.sender.email,
    attachments,
    raw: input.raw || {},
  };

  // Only add routingPattern if it exists
  if (routing.matchedPattern) {
    metadata.routingPattern = routing.matchedPattern;
  }

  // 🏢 ENTERPRISE: Dual-content storage pattern (Gmail/Outlook/Salesforce)
  // Priority: HTML with formatting > Plain text > Subject as fallback
  // HTML content preserves colors, fonts, and formatting from the original email
  // Security Note: Sanitization happens at render time in SafeHTMLContent (ADR-072)
  const emailContent = input.contentHtml || input.contentText || input.subject;

  // Build communication object, excluding undefined values for Firestore compatibility
  const communication: Omit<Communication, 'id' | 'createdAt' | 'updatedAt'> = {
    companyId: routing.companyId,
    contactId,
    type: COMMUNICATION_CHANNELS.EMAIL,
    direction: 'inbound',
    from: input.sender.email,
    to: input.recipients.join(', '),
    subject: input.subject,
    content: emailContent,  // 🏢 ENTERPRISE: HTML preferred for formatting preservation
    createdBy: SYSTEM_IDENTITY.ID,
    status: 'pending',
    attachments: attachments.map((attachment) => attachment.url || '').filter(Boolean),
    triageStatus: triageStatus ?? 'pending',  // Guaranteed non-undefined value
    metadata,
    // Only include intentAnalysis if it exists (Firestore doesn't accept undefined)
    ...(intentAnalysis && { intentAnalysis }),
  };

  // Debug logging - verify data before Firestore write
  logger.info('Preparing to write communication to Firestore', {
    messageDocId,
    triageStatusValue: communication.triageStatus,
    triageStatusType: typeof communication.triageStatus,
    hasIntentAnalysis: Boolean(intentAnalysis),
    // 🏢 ENTERPRISE: Track content type for debugging
    contentType: input.contentHtml ? 'html' : 'text',
    hasHtmlFormatting: Boolean(input.contentHtml),
  });

  await adminDb.collection(COLLECTIONS.MESSAGES).doc(messageDocId).set({
    ...communication,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // 🏢 ENTERPRISE: Log audit event for communication creation (2026-02-06)
  // Note: Using logWebhookEvent() because this is triggered by external Mailgun webhook
  // (no authenticated user context). The audit log goes to system_audit_logs collection.
  try {
    await logWebhookEvent(
      'mailgun_inbound',
      messageDocId,
      {
        action: 'communication_created',
        communicationType: 'email',
        companyId: routing.companyId,
        contactId,
        from: input.sender.email,
        to: input.recipients.join(', '),
        subject: input.subject,
        triageStatus: communication.triageStatus,
        hasAttachments: attachments.length > 0,
        attachmentCount: attachments.length,
        hasIntentAnalysis: Boolean(intentAnalysis),
        intentType: intentAnalysis?.intentType,
        needsTriage: intentAnalysis?.needsTriage,
      },
      // Mock request object for metadata extraction (no actual request in background worker)
      {
        headers: { get: () => null },
        url: undefined,
      }
    );

    logger.info('Audit log created for communication creation', {
      communicationId: messageDocId,
      from: input.sender.email,
      companyId: routing.companyId,
    });
  } catch (auditError) {
    // Never throw on audit failure - just log
    logger.error('Failed to log communication creation audit', {
      communicationId: messageDocId,
      error: auditError,
    });
  }

  // 🏢 ENTERPRISE: Dispatch bell notifications via orchestrator (ADR-026)
  // Dynamic recipient resolution: notify all admins of the tenant company
  try {
    // Resolve admin recipients for this company
    const ADMIN_GLOBAL_ROLES: GlobalRole[] = ['super_admin', 'company_admin'];
    const usersSnapshot = await adminDb
      .collection(COLLECTIONS.USERS)
      .where('companyId', '==', routing.companyId)
      .where('status', '==', 'active')
      .where('globalRole', 'in', ADMIN_GLOBAL_ROLES)
      .get();

    const adminUserIds = usersSnapshot.docs.map((doc) => doc.id);

    // Fallback: if no admins found, notify system identity (prevents silent failure)
    const recipientIds = adminUserIds.length > 0 ? adminUserIds : [SYSTEM_IDENTITY.ID];

    const senderDisplay = input.sender.name || input.sender.email;
    const notificationTitle = `New Email from ${senderDisplay}`;
    const notificationBody = input.subject || '(No subject)';
    const severity = intentAnalysis?.needsTriage ? 'warning' as const : 'info' as const;

    // Dispatch to each recipient via enterprise orchestrator
    // Orchestrator handles: dedupe key, user preferences, atomic write, email queuing
    const results = await Promise.allSettled(
      recipientIds.map((recipientId) =>
        dispatchNotification({
          eventType: NOTIFICATION_EVENT_TYPES.CRM_NEW_COMMUNICATION,
          recipientId,
          tenantId: routing.companyId!, // Non-null: early return at line 509 guarantees non-null
          title: notificationTitle, // English fallback
          titleKey: 'notifications.email.newFrom', // i18n key for client-side translation
          titleParams: { sender: senderDisplay },
          body: notificationBody,
          severity,
          source: {
            service: SOURCE_SERVICES.CRM,
            feature: 'ai-inbox',
            env: getCurrentEnvironment(),
          },
          eventId: messageDocId, // Idempotency: same email = same dedupe key per recipient
          entityId: contactId,
          entityType: NOTIFICATION_ENTITY_TYPES.CONTACT,
          actions: [
            { id: 'view_email', label: 'View', url: '/admin/ai-inbox' },
          ],
        })
      )
    );

    const dispatched = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    logger.info('Email bell notifications dispatched via orchestrator', {
      communicationId: messageDocId,
      from: input.sender.email,
      severity,
      recipientCount: recipientIds.length,
      dispatched,
      failed,
    });
  } catch (notificationError) {
    // Never throw on notification failure - just log
    logger.error('Failed to dispatch email bell notifications', {
      communicationId: messageDocId,
      error: notificationError,
    });
  }

  return { processed: true, skipped: false, communicationId: messageDocId, attachments };
}
