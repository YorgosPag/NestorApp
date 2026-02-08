// src/lib/communications/index.ts

import communicationsService from './CommunicationsService';
import messageRouter from './core/messageRouter';
import {
  COMMUNICATION_CHANNELS,
  MESSAGE_TYPES,
  MESSAGE_DIRECTIONS,
  MESSAGE_STATUSES,
  MESSAGE_TEMPLATES,
  isChannelEnabled
} from '../config/communications.config';
import type { BaseMessageInput, SendResult, Channel, TemplateSendInput } from '@/types/communications';

// ============================================================================
// ENTERPRISE TYPES
// ============================================================================

/** Lead data for communication functions */
interface LeadData {
  id: string;
  email?: string;
  phone?: string;
  fullName?: string;
}

/** Appointment data for confirmation messages */
interface AppointmentData {
  id: string;
  date: string;
  time: string;
  location?: string;
}

/** Campaign data for bulk messaging */
interface CampaignData extends Partial<BaseMessageInput> {
  channel: Channel;
  variables?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

/** Channel configuration with optional fields */
interface ChannelConfig {
  provider?: string;
  apiKey?: string;
  botToken?: string;
  enabled?: boolean;
}


/**
 * Αρχικοποίηση της communications infrastructure
 */
export const initializeCommunications = async () => {
  try {
    console.log('🚀 Initializing Communications Infrastructure...');
    await communicationsService.initialize();
    console.log('✅ Communications Infrastructure initialized successfully');
    return {
      success: true,
      availableChannels: communicationsService.availableChannels,
      serviceStatus: communicationsService.getServiceStatus()
    };
  } catch (error) {
    console.error('❌ Failed to initialize Communications Infrastructure:', error);
    throw error;
  }
};

/**
 * Λήψη κατάστασης όλων των channels
 */
export const getChannelsStatus = async (): Promise<Record<string, { enabled: boolean; configured: boolean; provider?: string }>> => {
    const status: Record<string, { enabled: boolean; configured: boolean; provider?: string }> = {};
    for (const [channelName, cfg] of Object.entries(COMMUNICATION_CHANNELS)) {
      const config = cfg as ChannelConfig;
      status[channelName] = {
        enabled: isChannelEnabled(channelName as Channel),
        configured: Boolean(config.provider || config.apiKey || config.botToken),
        provider: config.provider,
      };
    }
    return status;
};

/**
 * Quick send functions για κάθε channel
 */
export const sendEmail = (emailData: Omit<BaseMessageInput, 'channel'>): Promise<SendResult> =>
  communicationsService.sendEmail(emailData);

export const sendTelegramMessage = (telegramData: Omit<BaseMessageInput, 'channel'>): Promise<SendResult> =>
  communicationsService.sendTelegramMessage(telegramData);

export const sendWhatsAppMessage = (whatsappData: Omit<BaseMessageInput, 'channel'>): Promise<SendResult> =>
  communicationsService.sendWhatsAppMessage(whatsappData);

export const sendTemplateMessage = (templateData: TemplateSendInput): Promise<SendResult> =>
  communicationsService.sendTemplateMessage(templateData);

/**
 * Helper functions για CRM integration
 */
export const sendWelcomeMessage = (leadData: LeadData, channel: Channel = 'email'): Promise<SendResult> => {
  const to = (channel === 'email' ? leadData.email : leadData.phone) || '';
  return communicationsService.sendTemplateMessage({
    templateType: 'welcome',
    channel,
    to,
    variables: { leadName: leadData.fullName || '', companyName: process.env.NEXT_PUBLIC_COMPANY_NAME || '' },
    entityType: 'lead',
    entityId: leadData.id,
    metadata: { automatedMessage: true, trigger: 'new_lead' },
  });
};

export const sendFollowUpMessage = (
  leadData: LeadData,
  channel: Channel,
  customContent: string | null = null
): Promise<SendResult> => {
  const to = (channel === 'email' ? leadData.email : leadData.phone) || '';
  if (customContent) {
    return communicationsService.sendMessage({ channel, to, content: customContent, entityType: 'lead', entityId: leadData.id });
  }
  return communicationsService.sendTemplateMessage({
    templateType: 'follow_up',
    channel,
    to,
    variables: { leadName: leadData.fullName || '', companyName: process.env.NEXT_PUBLIC_COMPANY_NAME || '' },
    entityType: 'lead',
    entityId: leadData.id,
    metadata: { automatedMessage: false, trigger: 'manual_follow_up' },
  });
};


export const sendAppointmentConfirmation = async (leadData: LeadData, appointmentData: AppointmentData, channel: Channel = 'email'): Promise<SendResult> => {
  try {
    const appointmentMessage: TemplateSendInput = {
      templateType: 'appointment',
      channel,
      to: (channel === 'email' ? leadData.email : leadData.phone) || '',
      variables: {
        leadName: leadData.fullName || '',
        date: appointmentData.date,
        time: appointmentData.time,
        // 🌐 i18n: Converted to i18n key - 2026-01-18
        location: appointmentData.location || 'communications.appointment.defaultLocation',
        companyName: process.env.NEXT_PUBLIC_COMPANY_NAME || ''
      },
      entityType: 'lead',
      entityId: leadData.id,
      metadata: { automatedMessage: true, trigger: 'appointment_confirmation', appointmentId: appointmentData.id }
    };
    return await communicationsService.sendTemplateMessage(appointmentMessage);
  } catch (error) {
    console.error('Error sending appointment confirmation:', error);
    throw error;
  }
};

/**
 * Bulk operations
 */
export const sendBulkMessages = (messages: BaseMessageInput[]) =>
  messageRouter.sendBulkMessages(messages);


export const sendCampaignToLeads = async (leads: LeadData[], campaignData: CampaignData) => {
  try {
    const { variables: _variables, ...campaignBase } = campaignData;
    const messages: BaseMessageInput[] = [];

    leads.forEach(lead => {
      const to = campaignData.channel === MESSAGE_TYPES.EMAIL ? lead.email : lead.phone;
      if (!to) {
        return;
      }

      messages.push({
        ...campaignBase,
        to,
        entityType: 'lead',
        entityId: lead.id,
        metadata: { ...campaignData.metadata, campaignType: 'bulk', automatedMessage: true }
      });
    });

    return await sendBulkMessages(messages);
  } catch (error) {
    console.error('Error sending campaign:', error);
    throw error;
  }
};

/**
 * Analytics & Reporting
 */
export const getLeadCommunications = async (leadId: string, options = {}) => {
  return await communicationsService.getLeadCommunications(leadId, options);
};

export const getUnifiedInbox = async (options = {}) => {
  return await communicationsService.getUnifiedInbox(options);
};

export const getCommunicationsStats = async (period = '30d') => {
  return await communicationsService.getCommunicationsStats(period);
};

/**
 * Testing & Debugging
 */
export const testAllChannels = async () => {
  return await communicationsService.testAllChannels();
};

export const testChannel = (channelName: Channel) => {
  const provider = messageRouter.providers.get(channelName);
  return provider?.testConnection ? provider.testConnection() : { success: false, message: `No test method for ${channelName}` };
};

/**
 * Configuration helpers
 */
export const getChannelTemplates = (channel: string) => {
  type TemplateValue = string | { subject: string; template: string };
  const templates = (MESSAGE_TEMPLATES as Record<string, Record<string, TemplateValue>>)[channel];
  if (!templates) return [];
  return Object.keys(templates).map(key => ({
    value: key,
    label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    template: templates[key]
  }));
};

export const isChannelAvailable = (channelName: string) => isChannelEnabled(channelName as Channel);

/**
 * Export όλων των βασικών services και utilities
 */
export {
  communicationsService,
  messageRouter,
  COMMUNICATION_CHANNELS,
  MESSAGE_TYPES,
  MESSAGE_DIRECTIONS,
  MESSAGE_STATUSES,
  MESSAGE_TEMPLATES,
  isChannelEnabled
};

/**
 * Default export για convenience
 */
export default {
  initialize: initializeCommunications,
  getChannelsStatus,
  getServiceStatus: () => communicationsService.getServiceStatus(),
  sendEmail,
  sendTelegramMessage,
  sendWhatsAppMessage,
  sendTemplateMessage,
  sendWelcomeMessage,
  sendFollowUpMessage,
  sendAppointmentConfirmation,
  sendBulkMessages,
  sendCampaignToLeads,
  getLeadCommunications,
  getUnifiedInbox,
  getCommunicationsStats,
  testAllChannels,
  testChannel,
  getChannelTemplates,
  isChannelAvailable,
  service: communicationsService,
  router: messageRouter
};
