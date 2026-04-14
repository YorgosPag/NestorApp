import { useState, useEffect, useCallback } from 'react';
import communicationsService from '../../lib/communications';
import { MESSAGE_TYPES, MESSAGE_TEMPLATES } from '../../lib/config/communications.config';
import { useNotifications } from '@/providers/NotificationProvider';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';
import type { CommunicationChannel } from '@/types/communications';

const logger = createModuleLogger('SendMessageModal');

// ============================================================================
// Types
// ============================================================================

export interface LeadData {
  id?: string;
  fullName?: string;
  email?: string;
  phone?: string;
}

export interface CustomVariable {
  key: string;
  value: string;
}

export interface SendResult {
  success: boolean;
  error?: string;
  messageId?: string;
}

interface FormData {
  to: string;
  subject: string;
  content: string;
  templateVariables: Record<string, string>;
}

interface UseSendMessageModalParams {
  leadData: LeadData | null;
  defaultChannel: CommunicationChannel;
  defaultTemplate: string | null;
  onMessageSent: ((result: SendResult) => void) | null;
  onOpenChange?: (open: boolean) => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useSendMessageModal({
  leadData,
  defaultChannel,
  defaultTemplate,
  onMessageSent,
  onOpenChange
}: UseSendMessageModalParams) {
  const { t } = useTranslation(['crm', 'crm-inbox']);
  const { success, error: notifyError } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<CommunicationChannel>(defaultChannel);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(defaultTemplate);
  const [availableChannels, setAvailableChannels] = useState<CommunicationChannel[]>([]);
  const [formData, setFormData] = useState<FormData>({
    to: '',
    subject: '',
    content: '',
    templateVariables: {}
  });
  const [customVariables, setCustomVariables] = useState<CustomVariable[]>([]);

  const getDefaultRecipient = useCallback((channel: CommunicationChannel): string => {
    if (!leadData) return '';
    switch (channel) {
      case MESSAGE_TYPES.EMAIL:
        return leadData.email || '';
      case MESSAGE_TYPES.SMS:
      case MESSAGE_TYPES.WHATSAPP:
      case MESSAGE_TYPES.TELEGRAM:
        return leadData.phone || '';
      default:
        return leadData.email || leadData.phone || '';
    }
  }, [leadData]);

  useEffect(() => {
    try {
      const serviceStatus = communicationsService.getServiceStatus();
      setAvailableChannels(serviceStatus.availableChannels || []);
    } catch (error) {
      logger.error('Error checking available channels', { error });
    }
  }, []);

  useEffect(() => {
    if (leadData) {
      setFormData(prev => ({
        ...prev,
        to: getDefaultRecipient(selectedChannel),
        templateVariables: {
          leadName: leadData.fullName || '',
          leadEmail: leadData.email || '',
          leadPhone: leadData.phone || '',
          ...prev.templateVariables
        }
      }));
    }
  }, [leadData, selectedChannel, getDefaultRecipient]);

  useEffect(() => {
    if (selectedTemplate) {
      loadTemplateContent();
    }
  }, [selectedTemplate, selectedChannel]);

  function loadTemplateContent() {
    if (!selectedTemplate) return;
    type TemplateChannels = keyof typeof MESSAGE_TEMPLATES;
    const channelKey = selectedChannel as TemplateChannels;
    if (!(channelKey in MESSAGE_TEMPLATES)) return;
    const channelTemplates = MESSAGE_TEMPLATES[channelKey] as Record<string, unknown>;
    if (!channelTemplates) return;

    const template = channelTemplates[selectedTemplate];
    if (template) {
      if (typeof template === 'string') {
        setFormData(prev => ({ ...prev, content: template }));
      } else if (typeof template === 'object' && template !== null && 'subject' in template && 'template' in template) {
        const typedTemplate = template as { subject: string; template: string };
        setFormData(prev => ({
          ...prev,
          subject: typedTemplate.subject,
          content: typedTemplate.template
        }));
      }
    }
  }

  const handleChannelChange = (channel: CommunicationChannel): void => {
    setSelectedChannel(channel);
    setSelectedTemplate(null);
    setFormData(prev => ({
      ...prev,
      to: getDefaultRecipient(channel),
      subject: channel === MESSAGE_TYPES.EMAIL ? prev.subject : '',
      content: ''
    }));
  };

  const addCustomVariable = () => {
    setCustomVariables(prev => [...prev, { key: '', value: '' }]);
  };

  const updateCustomVariable = (index: number, field: keyof CustomVariable, value: string): void => {
    setCustomVariables(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const removeCustomVariable = (index: number): void => {
    setCustomVariables(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    try {
      setSending(true);

      if (!formData.to.trim()) {
        notifyError(t('sendMessage.validation.recipientRequired'));
        return;
      }
      if (!formData.content.trim()) {
        notifyError(t('sendMessage.validation.contentRequired'));
        return;
      }

      const allVariables = {
        ...formData.templateVariables,
        ...Object.fromEntries(
          customVariables
            .filter(v => v.key.trim() && v.value.trim())
            .map(v => [v.key.trim(), v.value.trim()])
        )
      };

      const messageData = {
        channel: selectedChannel,
        to: formData.to.trim(),
        content: formData.content,
        subject: formData.subject?.trim() || undefined,
        entityType: leadData ? 'lead' : null,
        entityId: leadData?.id || null,
        metadata: {
          templateType: selectedTemplate,
          templateVariables: allVariables,
          sentFrom: 'CRM_Modal',
          leadData: leadData ? {
            id: leadData.id,
            fullName: leadData.fullName,
            email: leadData.email,
            phone: leadData.phone
          } : null
        }
      };

      let result: SendResult;
      if (selectedTemplate) {
        result = await communicationsService.sendTemplateMessage({
          templateType: selectedTemplate,
          channel: selectedChannel,
          variables: allVariables,
          to: messageData.to,
          content: messageData.content,
          metadata: { ...messageData.metadata, subject: messageData.subject }
        });
      } else {
        const baseMessageData = {
          to: messageData.to,
          content: messageData.content,
          subject: messageData.subject,
          metadata: messageData.metadata
        };

        switch (selectedChannel) {
          case MESSAGE_TYPES.EMAIL:
            result = await communicationsService.sendEmail(baseMessageData);
            break;
          case MESSAGE_TYPES.TELEGRAM:
            result = await communicationsService.sendTelegramMessage(baseMessageData);
            break;
          case MESSAGE_TYPES.WHATSAPP:
            result = await communicationsService.sendWhatsAppMessage(baseMessageData);
            break;
          default:
            result = await communicationsService.sendEmail(baseMessageData);
        }
      }

      if (result.success) {
        success(t('sendMessage.toasts.success', { channel: selectedChannel.toUpperCase() }));
        setFormData({
          to: getDefaultRecipient(selectedChannel),
          subject: '',
          content: '',
          templateVariables: {}
        });
        setCustomVariables([]);
        setSelectedTemplate(null);
        setIsOpen(false);
        if (onOpenChange) onOpenChange(false);
        if (onMessageSent) onMessageSent(result);
      } else {
        notifyError(t('sendMessage.toasts.error', { error: result.error }));
      }
    } catch (error) {
      logger.error('Error sending message', { error });
      notifyError(t('sendMessage.toasts.genericError'));
    } finally {
      setSending(false);
    }
  };

  const getAvailableTemplates = (): Array<{ value: string; label: string }> => {
    type TemplateChannels = keyof typeof MESSAGE_TEMPLATES;
    const channelKey = selectedChannel as TemplateChannels;
    if (!(channelKey in MESSAGE_TEMPLATES)) return [];
    const templates = MESSAGE_TEMPLATES[channelKey] as Record<string, unknown>;
    if (!templates) return [];
    return Object.keys(templates).map(key => ({
      value: key,
      label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }));
  };

  return {
    isOpen,
    setIsOpen,
    sending,
    selectedChannel,
    selectedTemplate,
    setSelectedTemplate,
    availableChannels,
    formData,
    setFormData,
    customVariables,
    handleChannelChange,
    addCustomVariable,
    updateCustomVariable,
    removeCustomVariable,
    handleSend,
    getAvailableTemplates,
  };
}
