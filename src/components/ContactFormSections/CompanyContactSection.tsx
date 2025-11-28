'use client';

import { GenericFormRenderer } from '@/components/generic';
import { getSortedSections } from '@/config/company-gemi-config';
import type { ContactFormData } from '@/types/ContactFormTypes';

interface CompanyContactSectionProps {
  formData: ContactFormData;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSelectChange: (name: string, value: string) => void;
  disabled?: boolean;
}

export function CompanyContactSection({
  formData,
  handleChange,
  handleSelectChange,
  disabled = false
}: CompanyContactSectionProps) {
  // Get all company GEMI sections from centralized config
  const sections = getSortedSections();

  return (
    <GenericFormRenderer
      sections={sections}
      formData={formData}
      onChange={handleChange}
      onSelectChange={handleSelectChange}
      disabled={disabled}
    />
  );
}