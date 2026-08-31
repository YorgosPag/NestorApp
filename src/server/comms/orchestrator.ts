// /home/user/studio/src/server/comms/orchestrator.ts

import { isFirebaseAvailable } from '../../app/api/communications/webhooks/telegram/firebase/availability';
import { getFirestoreHelpers, type FirestoreHelpers } from '../../app/api/communications/webhooks/telegram/firebase/helpers-lazy';
import { safeDbOperation } from '../../app/api/communications/webhooks/telegram/firebase/safe-op';
import { COLLECTIONS } from '@/config/firestore-collections';
import { type HumanLanguage } from '@/i18n/languages';
import { emailTextsFor } from '@/server/comms/email-texts';
import { generateMessageId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
import { sanitizeForFirestore } from '@/utils/firestore-sanitize';
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

  /**
   * 🌐 ADR-777 §8.29 — **η γλώσσα του παραλήπτη**, σφραγισμένη στο μήνυμα.
   *
   * 🔑 **Γιατί εδώ και όχι στον αποστολέα.** Ο αγωγός που αδειάζει την ουρά
   * (`outbound-email-flush`) γνωρίζει **διευθύνσεις**, όχι χρήστες: το πεδίο `to`
   * είναι email, και μια αναζήτηση «διεύθυνση → χρήστης → ρυθμίσεις» θα ήταν ένα
   * επιπλέον ερώτημα ανά μήνυμα για κάτι που ο **παραγωγός ήδη κρατά στο χέρι** —
   * ο `notification-email-leg` έχει ολόκληρο το `UserNotificationSettings` για να
   * αποφασίσει το `scheduledAt`.
   *
   * Είναι το **ίδιο σχήμα με το `scheduledAt`**: η πολιτική λύνεται τη στιγμή της
   * εγγραφής, ο αγωγός απλώς εκτελεί. Και έχει την ίδια συνέπεια, δηλωμένη: αν ο
   * χρήστης αλλάξει γλώσσα **αφού** μπει το μήνυμα στην ουρά, εκείνο το μήνυμα
   * φεύγει στην παλιά — όπως ένα `daily` που προγραμματίστηκε για τις 20:00 δεν
   * μετακινείται όταν αλλάξει η ζώνη ώρας.
   *
   * ⚠️ **Προαιρετικό, και μένει προαιρετικό.** Τα μηνύματα των άλλων καναλιών
   * (Telegram/WhatsApp) και όσα γράφτηκαν πριν το §8.29 δεν το έχουν· η ανάγνωση
   * πέφτει στην προεπιλογή.
   */
  language?: HumanLanguage;
  
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
        // 🌐 ADR-777 §8.29 — δίπλα στα `priority`/`category`, τα άλλα δύο πεδία που
        // διαβάζει ο σχεδιαστής συνάθροισης. `?? null` και όχι `undefined`: η
        // Firestore **απορρίπτει** το `undefined` σε εγγραφή, οπότε ένα μήνυμα
        // χωρίς γλώσσα θα έριχνε ολόκληρη την ουρά αντί να πέσει στην προεπιλογή.
        language: params.language ?? null,
        ...getChannelSpecificMetadata(channel, params)
      },

      // Email-specific fields
      ...(channel === 'email' && {
        // 🌐 §8.29: ήταν σκληρογραμμένο `'Ειδοποίηση'` — ένα από **τρία** αντίγραφα
        // της ίδιας εφεδρείας. Τώρα ακολουθεί τη γλώσσα του παραλήπτη.
        subject: params.subject || emailTextsFor(params.language).fallbackSubject
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
    // 🔴 ADR-834 §6.5.γ — **ΚΑΘΕ ΕΞΕΡΧΟΜΕΝΟ ΜΗΝΥΜΑ ΕΠΕΦΤΕ ΕΔΩ, ΣΙΩΠΗΛΑ.**
    // Το `metadata` κουβαλά `templateId` / `campaignId` / `variables` **αυτούσια** από
    // τον καλούντα, και ένας καλών που δεν τα δίνει (π.χ. η πρόσκληση συγκατάθεσης)
    // παράγει `undefined`. Το Admin SDK **δεν** έχει `ignoreUndefinedProperties` σε
    // αυτό το έργο ⇒ το `set` πετά, το `safeDbOperation` επιστρέφει το fallback
    // (`null`), το `enqueueMessage` γυρνά `success: false` — και ο καλών το ονομάζει
    // `failed`, χωρίς κανείς να μάθει **γιατί**. Μετρημένο 2026-08-31: **μηδέν**
    // έγγραφα με `direction: 'outbound'` σε ολόκληρη τη συλλογή.
    // ✅ Το SSoT υπάρχει ήδη και το δηλώνει στην κεφαλίδα του: *«MUST be called on
    // every write operation»* — απλώς δεν είχε κληθεί ΕΔΩ.
    await setDoc(docRef, sanitizeForFirestore(messageRecord));

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

