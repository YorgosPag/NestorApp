'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Contact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { getContactFormConfig } from '@/components/ContactFormSections/utils/ContactFormConfigProvider';
import '@/lib/design-system';

interface ContactBasicInfoTabProps {
  data: Contact;
  additionalData?: {
    formData?: ContactFormData;
    disabled?: boolean;
    handleChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    handleSelectChange?: (name: string, value: string) => void;
  };
}

/**
 * 🏢 ENTERPRISE: Contact Basic Info Tab
 *
 * Centralized tab για βασικές πληροφορίες επαφής.
 * Χρησιμοποιεί existing configuration system για backward compatibility.
 */
export function ContactBasicInfoTab({
  data,
  additionalData,
}: ContactBasicInfoTabProps) {
  const { t } = useTranslation('contacts');
  const config = getContactFormConfig(data.type);
  const sections = config.getSections();

  // Extract data from additionalData prop (UniversalTabsRenderer pattern)
  const {
    formData,
    disabled = true,
    handleChange,
    handleSelectChange,
  } = additionalData || {};

  // Get basic info section (always first)
  const basicInfoSection = sections.find(section => {
    const s = section as { id?: string };
    return s.id === 'basicInfo' || s.id === 'basic';
  });

  if (!basicInfoSection) {
    return (
      <div className="p-2">
        <p className="text-muted-foreground">
          {t('basicInfo.noInfoFound')}
        </p>
      </div>
    );
  }

  const RendererComponent = config.renderer;

  return (
    <div className="space-y-2">
      <RendererComponent
        sections={[basicInfoSection]}
        formData={formData || data}
        onChange={handleChange || (() => {})}
        onSelectChange={handleSelectChange || (() => {})}
        disabled={disabled}
      />
    </div>
  );
}