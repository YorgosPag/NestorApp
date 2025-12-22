'use client';

import React from 'react';
import type { Contact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { getContactFormConfig } from '@/components/ContactFormSections/utils/ContactFormConfigProvider';

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
  const basicInfoSection = sections.find(section =>
    section.id === 'basicInfo' || section.id === 'basic'
  );

  if (!basicInfoSection) {
    return (
      <div className="p-4">
        <p className="text-muted-foreground">
          Δεν βρέθηκαν βασικές πληροφορίες για αυτόν τον τύπο επαφής.
        </p>
      </div>
    );
  }

  const RendererComponent = config.renderer;

  return (
    <div className="space-y-6">
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