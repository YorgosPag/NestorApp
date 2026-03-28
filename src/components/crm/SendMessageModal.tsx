// src/components/crm/SendMessageModal.tsx

'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Button } from '../ui/button';
import { CONTACT_INFO } from '@/config/contact-info-config';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { CommonBadge } from '@/core/badges';
import { Send, MessageSquare, Mail, Phone, X } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Card, CardContent } from '../ui/card';
import { MESSAGE_TYPES } from '../../lib/config/communications.config';
import type { CommunicationChannel } from '@/types/communications';
import { SELECT_CLEAR_VALUE, isSelectClearValue } from '@/config/domain-constants';
import '@/lib/design-system';

// 🏢 ENTERPRISE: Extracted hook + types
import { useSendMessageModal } from './useSendMessageModal';
import type { LeadData, SendResult } from './useSendMessageModal';

// Re-exports for backward compatibility
export type { LeadData, SendResult } from './useSendMessageModal';

interface SendMessageModalProps {
  trigger?: React.ReactNode;
  leadData?: LeadData | null;
  defaultChannel?: CommunicationChannel;
  defaultTemplate?: string | null;
  onMessageSent?: ((result: SendResult) => void) | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const getChannelIcon = (channel: CommunicationChannel, iconClass: string): React.ReactNode => {
  switch (channel) {
    case MESSAGE_TYPES.EMAIL:
      return <Mail className={iconClass} />;
    case MESSAGE_TYPES.TELEGRAM:
    case MESSAGE_TYPES.WHATSAPP:
    case MESSAGE_TYPES.MESSENGER:
    case MESSAGE_TYPES.SMS:
      return <MessageSquare className={iconClass} />;
    case MESSAGE_TYPES.CALL:
      return <Phone className={iconClass} />;
    default:
      return <MessageSquare className={iconClass} />;
  }
};

const SendMessageModal: React.FC<SendMessageModalProps> = ({
  trigger,
  leadData = null,
  defaultChannel = MESSAGE_TYPES.EMAIL as CommunicationChannel,
  defaultTemplate = null,
  onMessageSent = null,
  open,
  onOpenChange
}) => {
  const iconSizes = useIconSizes();
  const { t } = useTranslation('crm');

  const {
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
  } = useSendMessageModal({
    leadData,
    defaultChannel,
    defaultTemplate,
    onMessageSent,
    onOpenChange
  });

  return (
    <Dialog open={open !== undefined ? open : isOpen} onOpenChange={onOpenChange || setIsOpen}>
      {trigger && (
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
      )}

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className={iconSizes.md} />
            {t('sendMessage.title')}
            {leadData && (
              <CommonBadge
                status="contact"
                customLabel={leadData.fullName}
                variant="secondary"
              />
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Channel Selection */}
          <div className="space-y-2">
            <Label>{t('sendMessage.selectChannel')}</Label>
            <Select value={selectedChannel} onValueChange={handleChannelChange}>
              <SelectTrigger>
                <SelectValue placeholder={t('sendMessage.selectChannelPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {availableChannels.map(channel => (
                  <SelectItem key={channel} value={channel}>
                    <div className="flex items-center gap-2">
                      {getChannelIcon(channel, iconSizes.sm)}
                      {channel.toUpperCase()}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Template Selection */}
          <div className="space-y-2">
            <Label>{t('sendMessage.template')}</Label>
            <Select
              value={selectedTemplate || SELECT_CLEAR_VALUE}
              onValueChange={(val) => setSelectedTemplate(isSelectClearValue(val) ? '' : val)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('sendMessage.noTemplate')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SELECT_CLEAR_VALUE}>{t('sendMessage.noTemplate')}</SelectItem>
                {getAvailableTemplates().map(template => (
                  <SelectItem key={template.value} value={template.value}>
                    {template.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Recipient */}
          <div className="space-y-2">
            <Label>{t('sendMessage.recipient')}</Label>
            <Input
              value={formData.to}
              onChange={(e) => setFormData(prev => ({ ...prev, to: e.target.value }))}
              placeholder={
                selectedChannel === MESSAGE_TYPES.EMAIL
                  ? CONTACT_INFO.DEMO_EMAIL_PERSONAL
                  : CONTACT_INFO.DEMO_PHONE_MOBILE
              }
            />
          </div>

          {/* Subject (email only) */}
          {selectedChannel === MESSAGE_TYPES.EMAIL && (
            <div className="space-y-2">
              <Label>{t('sendMessage.subject')}</Label>
              <Input
                value={formData.subject}
                onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                placeholder={t('sendMessage.subjectPlaceholder')}
              />
            </div>
          )}

          {/* Content */}
          <div className="space-y-2">
            <Label>{t('sendMessage.content')}</Label>
            <Textarea
              value={formData.content}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              placeholder={t('sendMessage.contentPlaceholder')}
              rows={6}
            />
          </div>

          {/* Template Variables */}
          {selectedTemplate && (
            <Card>
              <CardContent className="pt-4">
                <div className="space-y-3">
                  <Label className="text-sm font-medium">{t('sendMessage.templateVariables')}</Label>

                  {leadData && (
                    <div className="space-y-2">
                      <div className="text-xs text-gray-600">{t('sendMessage.availableVariables')}</div>
                      <div className="flex flex-wrap gap-1">
                        <CommonBadge status="contact" customLabel="leadName" variant="outline" className="text-xs" />
                        <CommonBadge status="contact" customLabel="leadEmail" variant="outline" className="text-xs" />
                        <CommonBadge status="contact" customLabel="leadPhone" variant="outline" className="text-xs" />
                        <CommonBadge status="company" customLabel="companyName" variant="outline" className="text-xs" />
                        <CommonBadge status="company" customLabel="companyEmail" variant="outline" className="text-xs" />
                        <CommonBadge status="company" customLabel="companyPhone" variant="outline" className="text-xs" />
                      </div>
                    </div>
                  )}

                  {customVariables.map((variable, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        placeholder={t('sendMessage.variableName')}
                        value={variable.key}
                        onChange={(e) => updateCustomVariable(index, 'key', e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        placeholder={t('sendMessage.variableValue')}
                        value={variable.value}
                        onChange={(e) => updateCustomVariable(index, 'value', e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCustomVariable(index)}
                      >
                        <X className={iconSizes.sm} />
                      </Button>
                    </div>
                  ))}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addCustomVariable}
                    className="w-full"
                  >
                    {t('sendMessage.addVariable')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setIsOpen(false);
                if (onOpenChange) onOpenChange(false);
              }}
            >
              {t('sendMessage.cancel')}
            </Button>
            <Button
              onClick={handleSend}
              disabled={sending || !formData.to.trim() || !formData.content.trim()}
            >
              {sending ? (
                <>
                  <Spinner size="small" color="inherit" className="mr-2" />
                  {t('sendMessage.sending')}
                </>
              ) : (
                <>
                  <Send className={`${iconSizes.sm} mr-2`} />
                  {t('sendMessage.send')}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SendMessageModal;
