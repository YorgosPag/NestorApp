// src/components/crm/SendMessageModal.tsx

'use client';

import React, { useState, useEffect, ReactNode } from 'react';
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
  X
} from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Card, CardContent } from '../ui/card';
import communications, { communicationsService } from '../../lib/communications';
import { MESSAGE_TYPES, MESSAGE_TEMPLATES } from '../../lib/config/communications.config';
import type { CommunicationChannel } from '@/types/communications';
import { toast } from 'sonner';

// 🏢 ENTERPRISE: Type for template channels (channels that have templates defined)
type TemplateChannel = 'email' | 'telegram' | 'whatsapp';

// ============================================================================
// 🏢 ENTERPRISE: Type Definitions (ADR-compliant - NO any)
// ============================================================================

/**
 * Message channel type
 * @enterprise Uses canonical CommunicationChannel from @/types/communications
 */
export type MessageChannel = CommunicationChannel;

/** Lead data for message context */
export interface SendMessageLeadData {
  id: string;
  fullName?: string;
  email?: string;
  phone?: string;
}

/** Result from sending a message */
export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/** Callback type for message sent event */
export type OnMessageSentCallback = (result: SendMessageResult) => void;

/** Props for SendMessageModal */
export interface SendMessageModalProps {
  /** Trigger element that opens the modal */
  trigger?: ReactNode;
  /** Lead data for pre-filling recipient info */
  leadData?: SendMessageLeadData | null;
  /** Default channel to select */
  defaultChannel?: MessageChannel;
  /** Default template to load */
  defaultTemplate?: string | null;
  /** Callback when message is sent successfully */
  onMessageSent?: OnMessageSentCallback | null;
  /** Controlled open state */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
}

/**
 * Send Message Modal Component
 * Επιτρέπει την αποστολή μηνυμάτων μέσω διαφόρων channels
 * @enterprise ADR-compliant typed component
 */

const SendMessageModal: React.FC<SendMessageModalProps> = ({
  trigger,
  leadData = null,
  defaultChannel = MESSAGE_TYPES.EMAIL as MessageChannel,
  defaultTemplate = null,
  onMessageSent = null,
  open,
  onOpenChange
}) => {
  const iconSizes = useIconSizes();
  const [isOpen, setIsOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<MessageChannel>(defaultChannel);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(defaultTemplate);
  const [availableChannels, setAvailableChannels] = useState<MessageChannel[]>([]);

  // 🏢 ENTERPRISE: Typed form data interface
  interface FormData {
    to: string;
    subject: string;
    content: string;
    templateVariables: Record<string, string>;
  }

  interface CustomVariable {
    key: string;
    value: string;
  }

  // Form data
  const [formData, setFormData] = useState<FormData>({
    to: '',
    subject: '',
    content: '',
    templateVariables: {}
  });

  // Προσθήκη custom template variables
  const [customVariables, setCustomVariables] = useState<CustomVariable[]>([]);

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
   * @enterprise Typed channel parameter
   */
  const getDefaultRecipient = (channel: MessageChannel): string => {
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
   * @enterprise Null-safe template loading
   */
  const loadTemplateContent = () => {
    if (!selectedTemplate) return;

    const template = communicationsService.getMessageTemplate(selectedChannel, selectedTemplate);
    if (template) {
      if (typeof template === 'string') {
        setFormData(prev => ({ ...prev, content: template }));
      } else if (template.subject && template.template) {
        setFormData(prev => ({
          ...prev,
          subject: template.subject ?? prev.subject,
          content: template.template ?? prev.content
        }));
      }
    }
  };

  /**
   * Χειρισμός αλλαγής channel
   * @enterprise Typed channel parameter
   */
  const handleChannelChange = (channel: MessageChannel): void => {
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
   * @enterprise Typed parameters
   */
  const updateCustomVariable = (index: number, field: keyof CustomVariable, value: string): void => {
    setCustomVariables(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  /**
   * Διαγραφή custom variable
   * @enterprise Typed index parameter
   */
  const removeCustomVariable = (index: number): void => {
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
        toast.error('Παρακαλώ συμπληρώστε τον παραλήπτη');
        return;
      }

      if (!formData.content.trim()) {
        toast.error('Παρακαλώ συμπληρώστε το περιεχόμενο');
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
      // @enterprise Type-safe message data preparation
      const messageData = {
        channel: selectedChannel,
        to: formData.to.trim(),
        content: formData.content,
        subject: formData.subject?.trim() || undefined,
        entityType: (leadData ? 'lead' : null) as 'lead' | 'contact' | 'unit' | null,
        entityId: leadData?.id ?? null,
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
        // messageData already has channel, so we spread it and add template-specific fields
        result = await communicationsService.sendTemplateMessage({
          ...messageData,
          templateType: selectedTemplate,
          variables: allVariables
        });
      } else {
        result = await communicationsService.sendMessage(messageData);
      }

      if (result.success) {
        toast.success(`Μήνυμα εστάλη επιτυχώς μέσω ${selectedChannel.toUpperCase()}`);
        
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
        toast.error(`Σφάλμα κατά την αποστολή: ${result.error}`);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Σφάλμα κατά την αποστολή μηνύματος');
    } finally {
      setSending(false);
    }
  };

  /**
   * Λήψη διαθέσιμων templates για το επιλεγμένο channel
   * @enterprise Type-safe template lookup
   */
  const getAvailableTemplates = (): Array<{ value: string; label: string }> => {
    // Only certain channels have templates defined
    if (selectedChannel !== 'email' && selectedChannel !== 'telegram' && selectedChannel !== 'whatsapp') {
      return [];
    }
    const templates = MESSAGE_TEMPLATES[selectedChannel as TemplateChannel];
    if (!templates) return [];

    return Object.keys(templates).map(key => ({
      value: key,
      label: key.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
    }));
  };

  /**
   * Λήψη icon για κάθε channel
   * @enterprise Typed channel parameter
   */
  const getChannelIcon = (channel: MessageChannel): ReactNode => {
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
            Αποστολή Μηνύματος
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
            <Label>Επιλογή Channel</Label>
            <Select value={selectedChannel} onValueChange={handleChannelChange}>
              <SelectTrigger>
                <SelectValue placeholder="Επιλέξτε channel" />
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
            <Label>Template (Προαιρετικό)</Label>
            <Select value={selectedTemplate || ''} onValueChange={setSelectedTemplate}>
              <SelectTrigger>
                <SelectValue placeholder="Χωρίς template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Χωρίς template</SelectItem>
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
            <Label>Παραλήπτης</Label>
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
              <Label>Θέμα</Label>
              <Input
                value={formData.subject}
                onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                placeholder="Θέμα μηνύματος"
              />
            </div>
          )}

          {/* Content */}
          <div className="space-y-2">
            <Label>Περιεχόμενο</Label>
            <Textarea
              value={formData.content}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              placeholder="Γράψτε το μήνυμά σας εδώ..."
              rows={6}
            />
          </div>

          {/* Template Variables */}
          {selectedTemplate && (
            <Card>
              <CardContent className="pt-4">
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Template Variables</Label>
                  
                  {/* Predefined variables */}
                  {leadData && (
                    <div className="space-y-2">
                      <div className="text-xs text-gray-600">Διαθέσιμες μεταβλητές:</div>
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
                        placeholder="Όνομα μεταβλητής"
                        value={variable.key}
                        onChange={(e) => updateCustomVariable(index, 'key', e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        placeholder="Τιμή"
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
                    Προσθήκη Μεταβλητής
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
              Ακύρωση
            </Button>
            <Button
              onClick={handleSend}
              disabled={sending || !formData.to.trim() || !formData.content.trim()}
            >
              {sending ? (
                <>
                  <Loader2 className={`${iconSizes.sm} mr-2 animate-spin`} />
                  Αποστολή...
                </>
              ) : (
                <>
                  <Send className={`${iconSizes.sm} mr-2`} />
                  Αποστολή
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
