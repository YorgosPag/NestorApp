// /home/user/studio/src/server/comms/orchestrator.ts

import { isFirebaseAvailable } from '../../app/api/communications/webhooks/telegram/firebase/availability';
import { getFirestoreHelpers, type FirestoreHelpers } from '../../app/api/communications/webhooks/telegram/firebase/helpers-lazy';
import { safeDbOperation } from '../../app/api/communications/webhooks/telegram/firebase/safe-op';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateMessageId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('CommsOrchestrator');

// ============================================================================
// 🏢 ENTERPRISE: Import from canonical SSoT (for local use)
// ============================================================================

import {
  COMMUNICATION_CHANNELS,
  MESSAGE_PRIORITIES,
  MESSAGE_CATEGORIES,
  IMPLEMENTED_CHANNELS,
  isChannelImplemented,
  getImplementedChannels,
  type CommunicationChannel,
  type MessagePriority,
  type MessageCategory,
  type ImplementedChannel,
} from '@/types/communications';

// Re-export for consumers of this module
// @see src/types/communications.ts (CANONICAL)
export {
  COMMUNICATION_CHANNELS,
  MESSAGE_PRIORITIES,
  MESSAGE_CATEGORIES,
  IMPLEMENTED_CHANNELS,
  isChannelImplemented,
  getImplementedChannels,
  type CommunicationChannel,
  type MessagePriority,
  type MessageCategory,
  type ImplementedChannel,
};

// ============================================================================
// 🏢 ENTERPRISE: Type Definitions (ADR-compliant - NO any)
// ============================================================================

/** Template variables for message personalization */
export type TemplateVariables = Record<string, unknown>;

/** Email attachment type */
export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
  encoding?: string;
}

/** Telegram keyboard type (InlineKeyboard or ReplyKeyboard) */
export interface TelegramKeyboard {
  inline_keyboard?: Array<Array<{
    text: string;
    callback_data?: string;
    url?: string;
  }>>;
  keyboard?: Array<Array<{
    text: string;
  }>>;
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
}

/** WhatsApp template parameters */
export type WhatsAppTemplateParams = Array<string | { type: string; text?: string; image?: { link: string } }>;
// 🏢 ENTERPRISE: FirestoreHelpers type imported from canonical module
// @see src/app/api/communications/webhooks/telegram/firebase/helpers-lazy.ts

export interface EnqueueMessageParams {
  // Core message data
  channels: CommunicationChannel[];
  to: string | string[]; // Recipients
  subject?: string; // For email/notifications
  content: string;
  
  // Template and personalization
  templateId?: string;
  variables?: TemplateVariables;
  
  // Targeting and context
  entityType?: 'lead' | 'customer' | 'project' | 'task' | 'invoice';
  entityId?: string;
  
  // Scheduling and priority
  priority?: MessagePriority;
  category?: MessageCategory;
  scheduledAt?: Date;
  
  // Deduplication and tracking
  idempotencyKey?: string;
  campaignId?: string;
  
  // Channel-specific metadata
  metadata?: {
    email?: {
      from?: string;
      replyTo?: string;
      attachments?: EmailAttachment[];
    };
    telegram?: {
      chatId?: string;
      parseMode?: 'HTML' | 'Markdown';
      keyboard?: TelegramKeyboard;
    };
    whatsapp?: {
      templateName?: string;
      templateParams?: WhatsAppTemplateParams;
    };
  };
}

export interface EnqueueResult {
  success: boolean;
  messageIds: string[];
  errors?: string[];
}

/**
 * Main orchestrator function - enqueues messages across channels
 * Compatible with existing Telegram CRM store structure
 */
export async function enqueueMessage(params: EnqueueMessageParams): Promise<EnqueueResult> {
  if (!isFirebaseAvailable()) {
    logger.warn('⚠️ Firebase not available, cannot enqueue message');
    return {
      success: false,
      messageIds: [],
      errors: ['Firebase not available']
    };
  }

  const firestoreHelpers = await getFirestoreHelpers();
  if (!firestoreHelpers) {
    logger.warn('⚠️ Firestore helpers not available for message queuing');
    return {
      success: false,
      messageIds: [],
      errors: ['Firestore helpers not available']
    };
  }

  const recipients = Array.isArray(params.to) ? params.to : [params.to];
  const messageIds: string[] = [];
  const errors: string[] = [];

  // 🏢 ENTERPRISE FAIL-FAST: Validate all channels have implementations
  // Uses static imports from canonical SSoT (re-exported at top of file)
  const unimplementedChannels = params.channels.filter(ch => !isChannelImplemented(ch));

  if (unimplementedChannels.length > 0) {
    const supported = getImplementedChannels().join(', ');
    const errorMsg = `❌ FAIL-FAST: Cannot dispatch to unimplemented channels: ${unimplementedChannels.join(', ')}. ` +
      `Implemented channels: ${supported}. ` +
      `See src/types/communications.ts IMPLEMENTED_CHANNELS for the canonical list.`;
    logger.error(errorMsg);
    return {
      success: false,
      messageIds: [],
      errors: [errorMsg]
    };
  }

  // Process each channel and recipient combination
  for (const channel of params.channels) {
    for (const recipient of recipients) {
      try {
        const messageId = await enqueueMessageForChannel(
          channel,
          recipient,
          params,
          firestoreHelpers
        );
        
        if (messageId) {
          messageIds.push(messageId);
          logger.info(`✅ Message queued for ${channel} to ${recipient}: ${messageId}`);
        } else {
          errors.push(`Failed to queue ${channel} message to ${recipient}`);
        }
      } catch (error) {
        const errorMsg = `Error queuing ${channel} message to ${recipient}: ${error}`;
        logger.error(errorMsg);
        errors.push(errorMsg);
      }
    }
  }

  return {
    success: messageIds.length > 0,
    messageIds,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Enqueue message for a specific channel
 * Uses the same structure as the existing Telegram CRM store
 */
async function enqueueMessageForChannel(
  channel: CommunicationChannel,
  recipient: string,
  params: EnqueueMessageParams,
  firestoreHelpers: FirestoreHelpers
): Promise<string | null> {
  return await safeDbOperation(async (database) => {
    const { collection, doc, setDoc, Timestamp } = firestoreHelpers;

    // Build message record compatible with existing structure
    const messageRecord = {
      // Core fields (compatible with Telegram store)
      type: channel,
      direction: 'outbound',
      channel,
      from: getFromAddress(channel, params),
      to: recipient,
      content: params.content,
      status: 'pending',
      
      // Entity association
      entityType: params.entityType || 'lead',
      entityId: params.entityId || null,
      externalId: null, // Will be set after sending
      
      // Message metadata
      metadata: {
        templateId: params.templateId,
        category: params.category || 'transactional',
        platform: getPlatformName(channel),
        priority: params.priority || 'normal',
        campaignId: params.campaignId,
        variables: params.variables,
        ...getChannelSpecificMetadata(channel, params)
      },
      
      // Email-specific fields
      ...(channel === 'email' && {
        subject: params.subject || 'Ειδοποίηση'
      }),
      
      // Scheduling and retry
      scheduledAt: params.scheduledAt ? 
        Timestamp.fromDate(params.scheduledAt) : 
        Timestamp.now(),
      attempts: 0,
      maxAttempts: getMaxAttempts(channel, params.priority),
      
      // Deduplication
      idempotencyKey: params.idempotencyKey,
      
      // Timestamps (compatible with existing structure)
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    // Store in messages collection (canonical collection for all communications)
    // 🏢 ENTERPRISE: setDoc + enterprise ID (SOS N.6)
    // 🔄 2026-01-17: Changed from COMMUNICATIONS to MESSAGES
    const enterpriseId = generateMessageId();
    const collectionRef = collection(COLLECTIONS.MESSAGES);
    const docRef = doc(collectionRef, enterpriseId);
    await setDoc(docRef, messageRecord);

    // Log for debugging
    logger.info(`📝 ${channel.toUpperCase()} message queued:`, {
      id: enterpriseId,
      to: recipient,
      channel,
      entityType: params.entityType,
      entityId: params.entityId
    });

    return enterpriseId;
  }, null);
}

/**
 * Get appropriate "from" address based on channel
 */
function getFromAddress(channel: CommunicationChannel, params: EnqueueMessageParams): string {
  switch (channel) {
    case 'email':
      return params.metadata?.email?.from || 'noreply@nestorconstruct.gr';
    case 'telegram':
      return 'bot';
    case 'whatsapp':
      return 'whatsapp_bot';
    case 'sms':
      return 'sms_service';
    default:
      return 'system';
  }
}

/**
 * Get platform name for metadata
 */
function getPlatformName(channel: CommunicationChannel): string {
  const platforms: Record<CommunicationChannel, string> = {
    [COMMUNICATION_CHANNELS.EMAIL]: 'mailgun',
    [COMMUNICATION_CHANNELS.TELEGRAM]: 'telegram',
    [COMMUNICATION_CHANNELS.WHATSAPP]: 'meta_cloud_api',
    [COMMUNICATION_CHANNELS.SMS]: 'sms_provider',
    [COMMUNICATION_CHANNELS.MESSENGER]: 'messenger',
    [COMMUNICATION_CHANNELS.INSTAGRAM]: 'instagram',
  };
  return platforms[channel] || channel;
}

/**
 * Get channel-specific metadata
 */
function getChannelSpecificMetadata(channel: CommunicationChannel, params: EnqueueMessageParams): Record<string, unknown> {
  const channelMeta = (params.metadata as Record<CommunicationChannel, unknown> | undefined)?.[channel] ?? {};

  switch (channel) {
    case 'telegram':
      const telegramMeta = channelMeta as { chatId?: string; parseMode?: 'HTML' | 'Markdown' };
      return {
        chatId: telegramMeta.chatId || params.to,
        parseMode: telegramMeta.parseMode || 'HTML'
      };
    case 'whatsapp':
      const whatsappMeta = channelMeta as { templateName?: string; templateParams?: WhatsAppTemplateParams };
      return {
        templateName: whatsappMeta.templateName,
        templateParams: whatsappMeta.templateParams
      };
    default:
      return channelMeta as Record<string, unknown>;
  }
}

/**
 * Get max retry attempts based on channel and priority
 */
function getMaxAttempts(channel: CommunicationChannel, priority?: MessagePriority): number {
  const baseAttempts: Record<CommunicationChannel, number> = {
    [COMMUNICATION_CHANNELS.EMAIL]: 3,
    [COMMUNICATION_CHANNELS.TELEGRAM]: 5,
    [COMMUNICATION_CHANNELS.WHATSAPP]: 3,
    [COMMUNICATION_CHANNELS.SMS]: 2,
    [COMMUNICATION_CHANNELS.MESSENGER]: 3,
    [COMMUNICATION_CHANNELS.INSTAGRAM]: 3,
  };

  const base = baseAttempts[channel] || 3;
  
  // Increase attempts for high priority messages
  if (priority === 'urgent') return base + 2;
  if (priority === 'high') return base + 1;
  
  return base;
}

