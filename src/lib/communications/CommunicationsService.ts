// src/lib/communications/CommunicationsService.ts

import messageRouter from './core/messageRouter';
import TelegramProvider from './providers/telegram';
import { MESSAGE_TYPES, MESSAGE_TEMPLATES, isChannelEnabled, COMMUNICATION_CHANNELS } from '../config/communications.config';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  type QueryConstraint
} from 'firebase/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { BaseMessageInput, SendResult, Channel } from '@/types/communications';
import { companySettingsService } from '@/services/company/EnterpriseCompanySettingsService';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { nowISO } from '@/lib/date-local';

const logger = createModuleLogger('CommunicationsService');

// ============================================================================
// 🏢 ENTERPRISE: Type Definitions (ADR-compliant - NO any)
// ============================================================================

/** Template message input */
interface TemplateMessageInput {
  templateType: string;
  channel: Channel;
  variables?: Record<string, string>;
  to: string;
  from?: string;
  subject?: string;
  metadata?: Record<string, unknown>;
  entityType?: 'lead' | 'contact' | 'property';
  entityId?: string;
  threadId?: string | null;
}

/** Options for fetching lead communications */
interface LeadCommunicationsOptions {
  limit?: number;
  channel?: Channel | null;
  direction?: 'inbound' | 'outbound' | null;
  startDate?: Date | null;
  endDate?: Date | null;
}

/** Options for unified inbox */
interface UnifiedInboxOptions {
  limit?: number;
  channel?: Channel | null;
  status?: string | null;
  unreadOnly?: boolean;
}

/** Communication record from Firestore */
interface CommunicationRecord {
  id: string;
  channel: Channel;
  entityType: string;
  entityId: string;
  direction: string;
  status: string;
  content: string;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

/** Channel test result */
interface ChannelTestResult {
  success: boolean;
  message?: string;
  error?: string;
}

/** Template structure */
interface MessageTemplate {
  text?: string;
  subject?: string;
  [key: string]: string | undefined;
}

/** Templates collection by channel */
type MessageTemplatesCollection = Record<string, Record<string, MessageTemplate | string>>;

// 🏢 ENTERPRISE: Centralized Firestore collection configuration
// 🔄 2026-01-17: Changed from COMMUNICATIONS to MESSAGES (COMMUNICATIONS collection deprecated)
const COMMUNICATIONS_COLLECTION = COLLECTIONS.MESSAGES;
const SYSTEM_COLLECTION = COLLECTIONS.SYSTEM;
const CONTACTS_COLLECTION = COLLECTIONS.CONTACTS;

/**
 * Κεντρική υπηρεσία επικοινωνιών
 * Παρέχει high-level interface για όλες τις communication λειτουργίες
 */

class CommunicationsService {
  isInitialized: boolean;
  availableChannels: Channel[];

  constructor() {
    this.isInitialized = false;
    this.availableChannels = [];
  }

  /**
   * Αρχικοποίηση της υπηρεσίας
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      logger.info('Initializing Communications Service...');

      // Καταχώρηση providers
      await this.registerProviders();

      // Έλεγχος διαθέσιμων channels
      await this.checkAvailableChannels();

      this.isInitialized = true;
      logger.info('Communications Service initialized successfully');
      logger.info('Available channels:', { channels: this.availableChannels });

    } catch (error) {
      logger.error('Failed to initialize Communications Service', { error });
      throw error;
    }
  }

  /**
   * Καταχώρηση όλων των providers
   */
  async registerProviders(): Promise<void> {
    // Telegram Provider
    if (isChannelEnabled('telegram') && !messageRouter.providers.has('telegram')) {
      const telegramProvider = new TelegramProvider();
      messageRouter.registerProvider('telegram', telegramProvider);
      logger.info('Telegram provider registered');
    }
  }

  /**
   * Έλεγχος διαθέσιμων channels
   */
  async checkAvailableChannels(): Promise<void> {
    this.availableChannels = [];
    const channels = Object.keys(COMMUNICATION_CHANNELS) as Channel[];
    
    for (const channel of channels) {
      if (isChannelEnabled(channel)) {
        this.availableChannels.push(channel);
      }
    }
  }

  /**
   * Αποστολή μηνύματος
   */
  async sendMessage(messageData: BaseMessageInput): Promise<SendResult> {
    if (!this.isInitialized) {
      throw new Error('Communications Service not initialized');
    }

    try {
      this.validateMessageData(messageData);
      const preparedMessage = await this.prepareMessage(messageData);
      return await messageRouter.sendMessage(preparedMessage);
    } catch (error: unknown) {
      logger.error('Error sending message', { error });
      throw error;
    }
  }

  /**
   * Αποστολή email
   */
  async sendEmail(emailData: Omit<BaseMessageInput, 'channel'>): Promise<SendResult> {
    return this.sendMessage({
      ...emailData,
      channel: MESSAGE_TYPES.EMAIL as Channel
    });
  }

  /**
   * Αποστολή Telegram μηνύματος
   */
  async sendTelegramMessage(telegramData: Omit<BaseMessageInput, 'channel'>): Promise<SendResult> {
    return this.sendMessage({
      ...telegramData,
      channel: MESSAGE_TYPES.TELEGRAM as Channel
    });
  }

  /**
   * Αποστολή WhatsApp μηνύματος
   */
  async sendWhatsAppMessage(whatsappData: Omit<BaseMessageInput, 'channel'>): Promise<SendResult> {
    return this.sendMessage({
      ...whatsappData,
      channel: MESSAGE_TYPES.WHATSAPP as Channel
    });
  }

  /**
   * Αποστολή template-based μηνύματος
   */
  async sendTemplateMessage(templateData: TemplateMessageInput): Promise<SendResult> {
    const { templateType, channel, variables, ...otherData } = templateData;

    const template = this.getMessageTemplate(channel, templateType);
    if (!template) {
      throw new Error(`Template ${templateType} not found for channel ${channel}`);
    }

    const content = this.replaceTemplateVariables(template, variables ?? {});

    return this.sendMessage({
      ...otherData,
      channel,
      content,
      metadata: {
        ...otherData.metadata,
        templateType,
        templateVariables: variables
      }
    });
  }

  /**
   * Λήψη ιστορικού επικοινωνιών για έναν lead
   */
  async getLeadCommunications(leadId: string, options: LeadCommunicationsOptions = {}): Promise<CommunicationRecord[]> {
    try {
      const {
        limit: queryLimit = 50,
        channel = null,
        direction = null,
        startDate = null,
        endDate = null
      } = options;

      const qConstraints: QueryConstraint[] = [
        where('entityType', '==', 'lead'),
        where('entityId', '==', leadId),
        orderBy('createdAt', 'desc'),
        limit(queryLimit)
      ];

      if (channel) qConstraints.push(where('channel', '==', channel));
      if (direction) qConstraints.push(where('direction', '==', direction));
      if (startDate) qConstraints.push(where('createdAt', '>=', startDate));
      if (endDate) qConstraints.push(where('createdAt', '<=', endDate));

      const q = query(collection(db, COMMUNICATIONS_COLLECTION), ...qConstraints);
      const querySnapshot = await getDocs(q);
      const communications: CommunicationRecord[] = [];
      querySnapshot.forEach((docSnap) => communications.push({ id: docSnap.id, ...docSnap.data() } as CommunicationRecord));
      return communications;
    } catch (error) {
      logger.error('Error fetching lead communications', { error });
      throw error;
    }
  }

  /**
   * Λήψη unified inbox
   */
  async getUnifiedInbox(options: UnifiedInboxOptions = {}): Promise<CommunicationRecord[]> {
    try {
      const {
        limit: queryLimit = 50,
        channel = null,
        status = null,
        unreadOnly = false
      } = options;

      const qConstraints: QueryConstraint[] = [
        orderBy('createdAt', 'desc'),
        limit(queryLimit)
      ];

      if (channel) qConstraints.push(where('channel', '==', channel));
      if (status) qConstraints.push(where('status', '==', status));
      if (unreadOnly) qConstraints.push(where('metadata.read', '==', false));

      const q = query(collection(db, COMMUNICATIONS_COLLECTION), ...qConstraints);
      const querySnapshot = await getDocs(q);
      const messages: CommunicationRecord[] = [];
      querySnapshot.forEach((docSnap) => messages.push({ id: docSnap.id, ...docSnap.data() } as CommunicationRecord));
      return messages;
    } catch (error) {
      logger.error('Error fetching unified inbox', { error });
      throw error;
    }
  }

  /**
   * Λήψη στατιστικών επικοινωνιών
   */
  async getCommunicationsStats(period = '30d') {
    try {
      return {
        totalMessages: 0,
        byChannel: { telegram: 0, email: 0, whatsapp: 0, messenger: 0, sms: 0 },
        byDirection: { inbound: 0, outbound: 0 },
        responseTime: { average: '0m', median: '0m' },
        period
      };
    } catch (error) {
      logger.error('Error fetching communications stats', { error });
      throw error;
    }
  }

  /**
   * Validation μηνύματος
   */
  validateMessageData(messageData: BaseMessageInput) {
    if (!messageData.channel) throw new Error('Channel is required');
    if (!messageData.to) throw new Error('Recipient (to) is required');
    if (!messageData.content && !messageData.subject) throw new Error('Content or subject is required');
    if (!this.availableChannels.includes(messageData.channel)) throw new Error(`Channel ${messageData.channel} is not available`);
  }

  /**
   * 🏢 ENTERPRISE: Προετοιμασία μηνύματος με database-driven template variables
   */
  async prepareMessage(messageData: BaseMessageInput) {
    const metadata = {
      ...messageData.metadata,
      sentVia: 'CommunicationsService',
      timestamp: nowISO()
    };

    try {
      // Load template variables από Enterprise Company Settings Service
      const templateVariables = await companySettingsService.getTemplateVariables();

      // Replace template variables σε content και subject
      const safeContent = typeof messageData.content === 'string'
        ? this.replaceTemplateVariables(messageData.content, templateVariables)
        : messageData.content;

      const safeSubject = typeof messageData.subject === 'string'
        ? this.replaceTemplateVariables(messageData.subject, templateVariables)
        : messageData.subject;

      return {
        ...messageData,
        content: safeContent,
        subject: safeSubject,
        metadata: {
          ...metadata,
          templateVariablesUsed: Object.keys(templateVariables)
        }
      };
    } catch (error) {
      logger.error('Error loading company settings for message preparation', { error });

      // Fallback to original content/subject without template processing
      return { ...messageData, metadata };
    }
  }

  /**
   * Λήψη template μηνύματος
   */
  getMessageTemplate(channel: string, templateType: string): MessageTemplate | string | null {
    const templates = MESSAGE_TEMPLATES as MessageTemplatesCollection;
    const channelTemplates = templates[channel];
    return channelTemplates?.[templateType] ?? null;
  }

  /**
   * 🏢 ENTERPRISE: Αντικατάσταση μεταβλητών σε template με enhanced processing
   */
  replaceTemplateVariables(template: string | MessageTemplate, variables: Record<string, string> = {}): string {
    let content = typeof template === 'string' ? template : template.text ?? '';

    // Process template variables με case-insensitive matching
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'gi'); // Case-insensitive flag added
      content = content.replace(regex, variables[key] ?? '');
    });

    return content;
  }

  /**
   * Test όλων των channels
   */
  async testAllChannels(): Promise<Partial<Record<Channel, ChannelTestResult>>> {
    const results: Partial<Record<Channel, ChannelTestResult>> = {};
    for (const channel of this.availableChannels) {
      try {
        const provider = messageRouter.providers.get(channel);
        if (provider && provider.testConnection) {
          results[channel] = await provider.testConnection();
        } else {
          results[channel] = { success: false, message: 'No test method available' };
        }
      } catch (error: unknown) {
        results[channel] = { success: false, error: getErrorMessage(error) };
      }
    }
    return results;
  }

  /**
   * 🏢 ENTERPRISE: Get quick contact information από centralized company settings
   *
   * @deprecated This method is replaced by EnterpriseCompanySettingsService.getQuickContact()
   * Kept for backward compatibility. Use companySettingsService.getQuickContact() for new code.
   */
  async getQuickCompanyInfo() {
    try {
      return await companySettingsService.getQuickContact();
    } catch (error) {
      logger.error('Error fetching quick company info', { error });
      // Fallback για backward compatibility
      return {
        companyName: 'Company',
        email: 'info@company.local',
        phone: '+30 210 000 0000'
      };
    }
  }

  /**
   * Λήψη κατάστασης υπηρεσίας
   */
  getServiceStatus() {
    return {
      initialized: this.isInitialized,
      availableChannels: this.availableChannels,
      totalProviders: messageRouter.providers.size
    };
  }
}

const communicationsService = new CommunicationsService();
export default communicationsService;
export { CommunicationsService };
