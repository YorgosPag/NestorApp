// src/lib/communications/CommunicationsService.ts

import messageRouter from './core/messageRouter';
import TelegramProvider from './providers/telegram';
import { MESSAGE_TYPES, MESSAGE_TEMPLATES, isChannelEnabled, COMMUNICATION_CHANNELS } from '../config/communications.config';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc, serverTimestamp, writeBatch, updateDoc } from 'firebase/firestore';
import type { BaseMessageInput, SendResult, Channel } from '@/types/communications';

// 🏢 ENTERPRISE: Configurable Firestore collection names
const COMMUNICATIONS_COLLECTION = process.env.NEXT_PUBLIC_COMMUNICATIONS_COLLECTION || 'communications';
const SYSTEM_COLLECTION = process.env.NEXT_PUBLIC_SYSTEM_COLLECTION || 'system';
const CONTACTS_COLLECTION = process.env.NEXT_PUBLIC_CONTACTS_COLLECTION || 'contacts';

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
   * Προετοιμασία μηνύματος πριν την αποστολή
   */
  async prepareMessage(messageData: BaseMessageInput) {
    const metadata = { ...messageData.metadata, sentVia: 'CommunicationsService', timestamp: new Date().toISOString() };
    // 🏢 ENTERPRISE: Get company name από database, όχι hardcoded fallback
    const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME || await this.getCompanyNameFromDatabase();
    const companyEmail = process.env.NEXT_PUBLIC_COMPANY_EMAIL ||
                        process.env.NEXT_PUBLIC_DEFAULT_CONTACT_EMAIL ||
                        `info@${process.env.NEXT_PUBLIC_TENANT_DOMAIN || 'company.local'}`;
    const companyPhone = process.env.NEXT_PUBLIC_COMPANY_PHONE ||
                        process.env.NEXT_PUBLIC_DEFAULT_CONTACT_PHONE ||
                        `${process.env.NEXT_PUBLIC_PHONE_COUNTRY_CODE || '+30'} ${process.env.NEXT_PUBLIC_DEFAULT_PHONE_PATTERN || '210'} 000 0000`;

    const safeContent = typeof messageData.content === 'string'
      ? messageData.content.replace('{{companyName}}', companyName).replace('{{companyEmail}}', companyEmail).replace('{{companyPhone}}', companyPhone)
      : messageData.content;
    const safeSubject = typeof messageData.subject === 'string'
      ? messageData.subject.replace('{{companyName}}', companyName)
      : messageData.subject;

    return { ...messageData, content: safeContent, subject: safeSubject, metadata };
  }

  /**
   * Λήψη template μηνύματος
   */
  getMessageTemplate(channel: string, templateType: string) {
    const channelTemplates = (MESSAGE_TEMPLATES as any)[channel];
    return channelTemplates?.[templateType] || null;
  }

  /**
   * Αντικατάσταση μεταβλητών σε template
   */
  replaceTemplateVariables(template: any, variables: any = {}) {
    let content = typeof template === 'string' ? template : template.text || '';
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
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
   * 🏢 ENTERPRISE: Λήψη company name από database
   */
  private async getCompanyNameFromDatabase(): Promise<string> {
    try {
      // Try to get company config from database
      const companyDoc = await getDoc(doc(db, SYSTEM_COLLECTION, process.env.NEXT_PUBLIC_COMPANY_CONFIG_DOC || 'company'));
      if (companyDoc.exists()) {
        const companyData = companyDoc.data();
        return companyData.name || 'Company';
      }

      // Fallback: Try to get from any existing contact with type 'company'
      const companiesQuery = query(
        collection(db, CONTACTS_COLLECTION),
        where('type', '==', 'company'),
        limit(1)
      );
      const companiesSnapshot = await getDocs(companiesQuery);

      if (!companiesSnapshot.empty) {
        const firstCompany = companiesSnapshot.docs[0].data();
        return firstCompany.companyName || firstCompany.name || 'Company';
      }

      return 'Company';
    } catch (error) {
      console.error('Error fetching company name from database:', error);
      return 'Company';
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
