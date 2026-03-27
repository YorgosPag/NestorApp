'use client';

import React from 'react';
import '@/lib/design-system';
import type { Contact, PhoneInfo, EmailInfo, WebsiteInfo, SocialMediaInfo } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import type { ContactEntityType } from '@/components/contacts/dynamic/communication';
import { DynamicContactArrays } from '@/components/contacts/dynamic/DynamicContactArrays';

interface ContactCommunicationTabProps {
  data: Contact;
  additionalData?: {
    formData?: ContactFormData;
    disabled?: boolean;
    setFormData?: (data: ContactFormData) => void;
  };
}

/**
 * 🏢 ENTERPRISE: Contact Communication Tab
 *
 * Centralized tab για επικοινωνία (phones, emails, websites, social media).
 * Χρησιμοποιεί το existing DynamicContactArrays component.
 */
export function ContactCommunicationTab({
  data,
  additionalData,
}: ContactCommunicationTabProps) {
  // Extract data from additionalData prop (UniversalTabsRenderer pattern)
  const {
    formData,
    disabled = true,
    setFormData,
  } = additionalData || {};

  const effectiveFormData = formData || data;
  const contactType = data.type as ContactEntityType;

  const handlePhonesChange = React.useCallback((phones: PhoneInfo[]) => {
    if (setFormData && formData) {
      setFormData({ ...formData, phones });
    }
  }, [setFormData, formData]);

  const handleEmailsChange = React.useCallback((emails: EmailInfo[]) => {
    if (setFormData && formData) {
      setFormData({ ...formData, emails });
    }
  }, [setFormData, formData]);

  const handleWebsitesChange = React.useCallback((websites: WebsiteInfo[]) => {
    if (setFormData && formData) {
      setFormData({ ...formData, websites });
    }
  }, [setFormData, formData]);

  const handleSocialMediaChange = React.useCallback((socialMedia: SocialMediaInfo[]) => {
    if (setFormData && formData) {
      setFormData({ ...formData, socialMediaArray: socialMedia });
    }
  }, [setFormData, formData]);

  return (
    <div className="space-y-2">
      <DynamicContactArrays
        phones={effectiveFormData.phones || []}
        emails={effectiveFormData.emails || []}
        websites={Array.isArray(effectiveFormData.websites) ? effectiveFormData.websites : []}
        socialMedia={effectiveFormData.socialMediaArray || []}
        disabled={disabled}
        contactType={contactType}
        onPhonesChange={handlePhonesChange}
        onEmailsChange={handleEmailsChange}
        onWebsitesChange={handleWebsitesChange}
        onSocialMediaChange={handleSocialMediaChange}
      />
    </div>
  );
}
