// src/components/crm/SendMessageModal.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Button } from '../ui/button';
import { CONTACT_INFO } from '@/config/contact-info-config';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { CommonBadge } from '@/core/badges';
import {
  Send,
  MessageSquare,
  Mail,
  Phone,
  Loader2,
  CheckCircle,
  AlertCircle,
  User,
  X
} from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Card, CardContent } from '../ui/card';
import communicationsService from '../../lib/communications';
import { MESSAGE_TYPES, MESSAGE_TEMPLATES } from '../../lib/config/communications.config';
import { toast } from 'sonner';

/**
 * Send Message Modal Component
 * Επιτρέπει την αποστολή μηνυμάτων μέσω διαφόρων channels
 */

const SendMessageModal = ({
  trigger,
  leadData = null,
  defaultChannel = MESSAGE_TYPES.EMAIL,
  defaultTemplate = null,
  onMessageSent = null,
  open,
  onOpenChange
}) => {
  const iconSizes = useIconSizes();
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('crm');
  const [isOpen, setIsOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState(defaultChannel);
  const [selectedTemplate, setSelectedTemplate] = useState(defaultTemplate);
  const [availableChannels, setAvailableChannels] = useState([]);
  
  // Form data
  const [formData, setFormData] = useState({
    to: '',
    subject: '',
    content: '',
    templateVariables: {}
  });

  // Προσθήκη custom template variables
  const [customVariables, setCustomVariables] = useState([]);

  useEffect(() => {
    checkAvailableChannels();
  }, []);

  useEffect(() => {
    // Αν έχουμε leadData, συμπληρώνουμε αυτόματα τα στοιχεία
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
  }, [leadData, selectedChannel]);

  useEffect(() => {
    // Όταν αλλάζει το template, φορτώνουμε το περιεχόμενο
    if (selectedTemplate) {
      loadTemplateContent();
    }
  }, [selectedTemplate, selectedChannel]);

  /**
   * Έλεγχος διαθέσιμων channels
   */
  const checkAvailableChannels = async () => {
    try {
      const serviceStatus = communicationsService.getServiceStatus();
      setAvailableChannels(serviceStatus.availableChannels || []);
    } catch (error) {
      console.error('Error checking available channels:', error);
    }
  };

  /**
   * Λήψη default recipient βάσει channel
   */
  const getDefaultRecipient = (channel) => {
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
  };

  /**
   * Φόρτωση περιεχομένου template
   */
  const loadTemplateContent = () => {
    const template = communicationsService.getMessageTemplate(selectedChannel, selectedTemplate);
    if (template) {
      if (typeof template === 'string') {
        setFormData(prev => ({ ...prev, content: template }));
      } else if (template.subject && template.template) {
        setFormData(prev => ({
          ...prev,
          subject: template.subject,
          content: template.template
        }));
      }
    }
  };

  /**
   * Χειρισμός αλλαγής channel
   */
  const handleChannelChange = (channel) => {
    setSelectedChannel(channel);
    setSelectedTemplate(null);
    setFormData(prev => ({
      ...prev,
      to: getDefaultRecipient(channel),
      subject: channel === MESSAGE_TYPES.EMAIL ? prev.subject : '',
      content: ''
    }));
  };

  /**
   * Προσθήκη custom variable
   */
  const addCustomVariable = () => {
    setCustomVariables(prev => [...prev, { key: '', value: '' }]);
  };

  /**
   * Ενημέρωση custom variable
   */
  const updateCustomVariable = (index, field, value) => {
    setCustomVariables(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  /**
   * Διαγραφή custom variable
   */
  const removeCustomVariable = (index) => {
    setCustomVariables(prev => prev.filter((_, i) => i !== index));
  };

  /**
   * Αποστολή μηνύματος
   */
  const handleSend = async () => {
    try {
      setSending(true);

      // Validation
      if (!formData.to.trim()) {
        toast.error(t('sendMessage.validation.recipientRequired'));
        return;
      }

      if (!formData.content.trim()) {
        toast.error(t('sendMessage.validation.contentRequired'));
        return;
      }

      // Προετοιμασία template variables
      const allVariables = {
        ...formData.templateVariables,
        ...Object.fromEntries(
          customVariables
            .filter(v => v.key.trim() && v.value.trim())
            .map(v => [v.key.trim(), v.value.trim()])
        )
      };

      // Προετοιμασία δεδομένων μηνύματος
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

      // Αποστολή μηνύματος
      let result;
      if (selectedTemplate) {
        result = await communicationsService.sendTemplateMessage({
          templateType: selectedTemplate,
          channel: selectedChannel,
          variables: allVariables,
          ...messageData
        });
      } else {
        result = await communicationsService.sendMessage(messageData);
      }

      if (result.success) {
        toast.success(t('sendMessage.toasts.success', { channel: selectedChannel.toUpperCase() }));
        
        // Reset form
        setFormData({
          to: getDefaultRecipient(selectedChannel),
          subject: '',
          content: '',
          templateVariables: {}
        });
        setCustomVariables([]);
        setSelectedTemplate(null);
        
        // Close modal
        setIsOpen(false);
        if (onOpenChange) onOpenChange(false);
        
        // Callback
        if (onMessageSent) {
          onMessageSent(result);
        }
      } else {
        toast.error(t('sendMessage.toasts.error', { error: result.error }));
      }

    } catch (error) {
      console.error('Error sending message:', error);
      toast.error(t('sendMessage.toasts.genericError'));
    } finally {
      setSending(false);
    }
  };

  /**
   * Λήψη διαθέσιμων templates για το επιλεγμένο channel
   */
  const getAvailableTemplates = () => {
    const templates = MESSAGE_TEMPLATES[selectedChannel];
    if (!templates) return [];
    
    return Object.keys(templates).map(key => ({
      value: key,
      label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }));
  };

  /**
   * Λήψη icon για κάθε channel
   */
  const getChannelIcon = (channel) => {
    switch (channel) {
      case MESSAGE_TYPES.EMAIL:
        return <Mail className={iconSizes.sm} />;
      case MESSAGE_TYPES.TELEGRAM:
      case MESSAGE_TYPES.WHATSAPP:
      case MESSAGE_TYPES.MESSENGER:
      case MESSAGE_TYPES.SMS:
        return <MessageSquare className={iconSizes.sm} />;
      case MESSAGE_TYPES.CALL:
        return <Phone className={iconSizes.sm} />;
      default:
        return <MessageSquare className={iconSizes.sm} />;
    }
  };

  /**
   * Render του modal content
   */
  const modalContent = (
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
                      {getChannelIcon(channel)}
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
            <Select value={selectedTemplate || ''} onValueChange={setSelectedTemplate}>
              <SelectTrigger>
                <SelectValue placeholder={t('sendMessage.noTemplate')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{t('sendMessage.noTemplate')}</SelectItem>
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

          {/* Subject (για email) */}
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

                  {/* Predefined variables */}
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

                  {/* Custom variables */}
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
                  <Loader2 className={`${iconSizes.sm} mr-2 animate-spin`} />
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

  return modalContent;
};

export default SendMessageModal;
