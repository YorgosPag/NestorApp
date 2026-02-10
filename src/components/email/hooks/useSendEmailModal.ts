"use client";
import { useState, useCallback } from "react";
import toast from "react-hot-toast";
import { emailTemplates, getTemplateContent } from "../utils/emailTemplates";
// 🏢 ENTERPRISE: Centralized API client with automatic authentication
import { apiClient } from '@/lib/api/enterprise-api-client';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useSendEmailModal');

// 🏢 ENTERPRISE: Lead type with optional fields to match Opportunity type
type Lead = { id?: string; fullName?: string; email?: string };

export function useSendEmailModal(lead?: Lead | null, onClose?: () => void, onEmailSent?: () => void) {
  const [formData, setFormData] = useState({
    templateType: "custom",
    subject: "",
    message: "",
    customData: {} as Record<string, unknown>,
  });
  const [loading, setLoading] = useState(false);

  const templates = emailTemplates(lead?.fullName);

  const handleTemplateChange = useCallback((templateId: string) => {
    const t = templates.find(x => x.id === templateId);
    setFormData(prev => ({
      ...prev,
      templateType: templateId,
      subject: t?.defaultSubject || "",
      message: getTemplateContent(templateId, lead?.fullName),
    }));
  }, [templates, lead?.fullName]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  /**
   * Send email via new unified communications API
   */
  const sendEmailViaAPI = useCallback(async (emailPayload: {
    to: string;
    subject: string;
    message: string;
    templateId: string;
    leadId?: string;
    priority?: string;
    category?: string;
  }) => {
    try {
      // 🏢 ENTERPRISE: Use centralized API client with automatic authentication
      interface EmailApiResponse {
        success: boolean;
        messageId?: string;
      }

      const result = await apiClient.post<EmailApiResponse>('/api/communications/email', emailPayload);
      logger.info('Email queued successfully', { result });
      return { success: true, data: result };

    } catch (error) {
      logger.error('Email API error', { error });
      throw error;
    }
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 🌐 i18n: Validation messages converted to i18n keys - 2026-01-18
    // Note: Components using this hook should translate these keys with t()
    if (!formData.subject.trim()) {
      toast.error("email.validation.subjectRequired");
      return;
    }
    if (!formData.message.trim()) {
      toast.error("email.validation.messageRequired");
      return;
    }
    if (!lead?.email) {
      toast.error("email.validation.leadNoEmail");
      return;
    }

    setLoading(true);
    
    try {
      // Prepare email payload for unified API
      const emailPayload = {
        to: lead.email,
        subject: formData.subject,
        message: formData.message,
        templateId: formData.templateType,
        leadId: lead.id,
        priority: 'normal' as const,
        category: getEmailCategory(formData.templateType)
      };

      // Send via new communications API
      const result = await sendEmailViaAPI(emailPayload);
      
      if (result.success) {
        toast.success("email.status.sentSuccess");
        
        // Reset form
        setFormData({
          templateType: "custom",
          subject: "",
          message: "",
          customData: {},
        });
        
        onClose?.();
        onEmailSent?.();
      }
      
    } catch (error: unknown) {
      // 🌐 i18n: Error messages converted to i18n keys - 2026-01-18
      const errorMessage = error instanceof Error ? error.message : "email.errors.unknown";
      toast.error(`email.errors.sendFailed`);
      logger.error('Email send error', { error });
    } finally {
      setLoading(false);
    }
  }, [formData, lead, onClose, onEmailSent, sendEmailViaAPI]);

  return { 
    formData, 
    setFormData, 
    loading, 
    templates, 
    handleTemplateChange, 
    handleChange, 
    handleSubmit 
  };
}

/**
 * Map template types to email categories
 */
function getEmailCategory(templateType: string): string {
  const categoryMap: Record<string, string> = {
    welcome: 'transactional',
    followup: 'marketing',
    appointment: 'transactional',
    proposal: 'marketing',
    custom: 'transactional'
  };
  
  return categoryMap[templateType] || 'transactional';
}
