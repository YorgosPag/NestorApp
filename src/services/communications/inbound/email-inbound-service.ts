import { createHash } from 'crypto';
import { isRecord } from '@/lib/type-guards';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getAdminFirestore } from '@/server/admin/admin-guards';
import { COLLECTIONS, SYSTEM_DOCS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { ENTITY_STATUS } from '@/constants/entity-status-values';
import { logWebhookEvent } from '@/lib/auth/audit';
import { COMMUNICATION_CHANNELS } from '@/types/communications';
import type { Communication } from '@/types/crm';
import {
  DEFAULTS,
  SYSTEM_IDENTITY,
  PLATFORMS,
} from '@/config/domain-constants';
import { sanitizeHtmlForStorage } from '@/lib/security/path-sanitizer';
import { createAIAnalysisProvider } from '@/services/ai-analysis/providers/ai-provider-factory';
import {
  isMessageIntentAnalysis,
} from '@/schemas/ai-analysis';
import { generateGlobalMessageDocId } from '@/server/lib/id-generation';
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
  ParsedAddress,
  InboundRoutingRule,
  RoutingResolution,
} from './types';
import { processAttachments } from './email-inbound-attachments';

const logger = createModuleLogger('EMAIL_INBOUND_SERVICE');

// ============================================================================
// EMAIL ADDRESS UTILITIES
// ============================================================================

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

// ============================================================================
// ROUTING — INBOUND EMAIL → COMPANY
// ============================================================================

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
  const settingsDoc = await adminDb.collection(COLLECTIONS.SYSTEM).doc(SYSTEM_DOCS.SYSTEM_SETTINGS).get();
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

// ============================================================================
// CONTACT RESOLUTION
// ============================================================================

async function findContactByEmail(companyId: string, email: string): Promise<string | null> {
  const adminDb = getAdminFirestore();
  const contactsRef = adminDb.collection(COLLECTIONS.CONTACTS);
  const normalizedEmail = normalizeEmail(email);

  const candidateFields = ['email', 'primaryEmail', 'contactEmail', 'officialEmail'];

  for (const field of candidateFields) {
    const snapshot = await contactsRef
      .where(FIELDS.COMPANY_ID, '==', companyId)
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

  // 🏢 ENTERPRISE: setDoc + enterprise ID (SOS N.6)
  const { generateContactId } = await import('@/services/enterprise-id.service');
  const enterpriseId = generateContactId();
  await adminDb.collection(COLLECTIONS.CONTACTS).doc(enterpriseId).set(newContact);

  // ADR-195 — Entity audit trail (auto-created contact from inbound email)
  const { EntityAuditService } = await import('@/services/entity-audit.service');
  const { ENTITY_TYPES } = await import('@/config/domain-constants');
  await EntityAuditService.recordChange({
    entityType: ENTITY_TYPES.CONTACT,
    entityId: enterpriseId,
    entityName: newContact.displayName,
    action: 'created',
    changes: [
      { field: 'firstName', oldValue: null, newValue: firstName, label: 'Όνομα' },
      { field: 'lastName', oldValue: null, newValue: lastName, label: 'Επώνυμο' },
      { field: 'email', oldValue: null, newValue: sender.email, label: 'Email' },
      { field: 'type', oldValue: null, newValue: 'individual', label: 'Τύπος' },
    ],
    performedBy: SYSTEM_IDENTITY.ID,
    performedByName: 'Inbound Email Pipeline',
    companyId,
  });

  return enterpriseId;
}

// ============================================================================
// MAIN PROCESSOR
// ============================================================================

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

  if (routing.matchedPattern) {
    metadata.routingPattern = routing.matchedPattern;
  }

  // 🏢 ENTERPRISE: Dual-content storage pattern (Gmail/Outlook/Salesforce)
  // HTML content preserves colors, fonts, and formatting from the original email
  // 🔒 SECURITY (ADR-252 SV-H1): Server-side sanitization BEFORE storage (defense-in-depth)
  const sanitizedHtml = sanitizeHtmlForStorage(input.contentHtml);
  const emailContent = sanitizedHtml || input.contentText || input.subject;

  const communication: Omit<Communication, 'id' | 'createdAt' | 'updatedAt'> = {
    companyId: routing.companyId,
    contactId,
    type: COMMUNICATION_CHANNELS.EMAIL,
    direction: 'inbound',
    from: input.sender.email,
    to: input.recipients.join(', '),
    subject: input.subject,
    content: emailContent,
    createdBy: SYSTEM_IDENTITY.ID,
    status: 'pending',
    attachments: attachments.map((attachment) => attachment.url || '').filter(Boolean),
    triageStatus: triageStatus ?? 'pending',
    metadata,
    ...(intentAnalysis && { intentAnalysis }),
  };

  logger.info('Preparing to write communication to Firestore', {
    messageDocId,
    triageStatusValue: communication.triageStatus,
    triageStatusType: typeof communication.triageStatus,
    hasIntentAnalysis: Boolean(intentAnalysis),
    contentType: input.contentHtml ? 'html' : 'text',
    hasHtmlFormatting: Boolean(input.contentHtml),
  });

  await adminDb.collection(COLLECTIONS.MESSAGES).doc(messageDocId).set({
    ...communication,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // 🏢 ENTERPRISE: Log audit event for communication creation
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
    logger.error('Failed to log communication creation audit', {
      communicationId: messageDocId,
      error: auditError,
    });
  }

  // 🏢 ENTERPRISE: Dispatch bell notifications via orchestrator (ADR-026)
  try {
    const ADMIN_GLOBAL_ROLES: GlobalRole[] = ['super_admin', 'company_admin'];
    const usersSnapshot = await adminDb
      .collection(COLLECTIONS.USERS)
      .where(FIELDS.COMPANY_ID, '==', routing.companyId)
      .where(FIELDS.STATUS, '==', ENTITY_STATUS.ACTIVE)
      .where('globalRole', 'in', ADMIN_GLOBAL_ROLES)
      .get();

    const adminUserIds = usersSnapshot.docs.map((doc) => doc.id);
    const recipientIds = adminUserIds.length > 0 ? adminUserIds : [SYSTEM_IDENTITY.ID];

    const senderDisplay = input.sender.name || input.sender.email;
    const notificationTitle = `New Email from ${senderDisplay}`;
    const notificationBody = input.subject || '(No subject)';
    const severity = intentAnalysis?.needsTriage ? 'warning' as const : 'info' as const;

    const results = await Promise.allSettled(
      recipientIds.map((recipientId) =>
        dispatchNotification({
          eventType: NOTIFICATION_EVENT_TYPES.CRM_NEW_COMMUNICATION,
          recipientId,
          tenantId: routing.companyId!,
          title: notificationTitle,
          titleKey: 'notifications.email.newFrom',
          titleParams: { sender: senderDisplay },
          body: notificationBody,
          severity,
          source: {
            service: SOURCE_SERVICES.CRM,
            feature: 'ai-inbox',
            env: getCurrentEnvironment(),
          },
          eventId: messageDocId,
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
    logger.error('Failed to dispatch email bell notifications', {
      communicationId: messageDocId,
      error: notificationError,
    });
  }

  return { processed: true, skipped: false, communicationId: messageDocId, attachments };
}
