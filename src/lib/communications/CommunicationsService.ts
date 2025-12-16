// src/lib/communications/CommunicationsService.ts

import messageRouter from './core/messageRouter';
import TelegramProvider from './providers/telegram';
import { MESSAGE_TYPES, MESSAGE_TEMPLATES, isChannelEnabled, COMMUNICATION_CHANNELS } from '../config/communications.config';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc, serverTimestamp, writeBatch, updateDoc } from 'firebase/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { BaseMessageInput, SendResult, Channel } from '@/types/communications';
import { companySettingsService } from '@/services/company/EnterpriseCompanySettingsService';

// 🏢 ENTERPRISE: Centralized Firestore collection configuration
const COMMUNICATIONS_COLLECTION = COLLECTIONS.COMMUNICATIONS;
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
      console.log('Initializing Communications Service...');

      // Καταχώρηση providers
      await this.registerProviders();

      // Έλεγχος διαθέσιμων channels
      await this.checkAvailableChannels();

      this.isInitialized = true;
      console.log('Communications Service initialized successfully');
      console.log('Available channels:', this.availableChannels);

    } catch (error) {
      console.error('Failed to initialize Communications Service:', error);
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
      console.log('Telegram provider registered');
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
    } catch (error: any) {
      console.error('Error sending message:', error);
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
  async sendTemplateMessage(templateData: any): Promise<SendResult> {
    const { templateType, channel, variables, ...otherData } = templateData;

    const template = this.getMessageTemplate(channel, templateType);
    if (!template) {
      throw new Error(`Template ${templateType} not found for channel ${channel}`);
    }

    const content = this.replaceTemplateVariables(template, variables);

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
  async getLeadCommunications(leadId: string, options: any = {}) {
    try {
      const {
        limit: queryLimit = 50,
        channel = null,
        direction = null,
        startDate = null,
        endDate = null
      } = options;

      const qConstraints = [
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
      const communications: any[] = [];
      querySnapshot.forEach((doc) => communications.push({ id: doc.id, ...doc.data() }));
      return communications;
    } catch (error) {
      console.error('Error fetching lead communications:', error);
      throw error;
    }
  }

  /**
   * Λήψη unified inbox
   */
  async getUnifiedInbox(options: any = {}) {
    try {
      const {
        limit: queryLimit = 50,
        channel = null,
        status = null,
        unreadOnly = false
      } = options;

      const qConstraints = [
        orderBy('createdAt', 'desc'),
        limit(queryLimit)
      ];

      if (channel) qConstraints.push(where('channel', '==', channel));
      if (status) qConstraints.push(where('status', '==', status));
      if (unreadOnly) qConstraints.push(where('metadata.read', '==', false));

      const q = query(collection(db, COMMUNICATIONS_COLLECTION), ...qConstraints);
      const querySnapshot = await getDocs(q);
      const messages: any[] = [];
      querySnapshot.forEach((doc) => messages.push({ id: doc.id, ...doc.data() }));
      return messages;
    } catch (error) {
      console.error('Error fetching unified inbox:', error);
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
      console.error('Error fetching communications stats:', error);
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
      timestamp: new Date().toISOString()
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
      console.error('Error loading company settings for message preparation:', error);

      // Fallback to original content/subject without template processing
      return { ...messageData, metadata };
    }
  }

  /**
   * Λήψη template μηνύματος
   */
  getMessageTemplate(channel: string, templateType: string) {
    const channelTemplates = (MESSAGE_TEMPLATES as any)[channel];
    return channelTemplates?.[templateType] || null;
  }

  /**
   * 🏢 ENTERPRISE: Αντικατάσταση μεταβλητών σε template με enhanced processing
   */
  replaceTemplateVariables(template: any, variables: any = {}) {
    let content = typeof template === 'string' ? template : template.text || '';

    // Process template variables με case-insensitive matching
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'gi'); // Case-insensitive flag added
      content = content.replace(regex, variables[key] || '');
    });

    return content;
  }

  /**
   * Test όλων των channels
   */
  async testAllChannels(): Promise<Record<Channel, { success: boolean; message?: string; error?: string }>> {
    const results: any = {};
    for (const channel of this.availableChannels) {
      try {
        const provider = messageRouter.providers.get(channel);
        if (provider && provider.testConnection) {
          results[channel] = await provider.testConnection();
        } else {
          results[channel] = { success: false, message: 'No test method available' };
        }
      } catch (error: any) {
        results[channel] = { success: false, error: error.message };
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
      console.error('Error fetching quick company info:', error);
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
