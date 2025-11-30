'use client';

import { GenericFormTabRenderer } from '@/components/generic';
import { getSortedSections } from '@/config/company-gemi-config';
import type { ContactFormData } from '@/types/ContactFormTypes';

interface CompanyContactTabbedSectionProps {
  formData: ContactFormData;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSelectChange: (name: string, value: string) => void;
  disabled?: boolean;
}

/**
 * Company Contact Section με tabs
 * Χρησιμοποιεί τα ίδια sections όπως στα Contact Details αλλά σε tab layout
 */
export function CompanyContactTabbedSection({
  formData,
  handleChange,
  handleSelectChange,
  disabled = false
}: CompanyContactTabbedSectionProps) {
  // Get all company GEMI sections from centralized config
  const sections = getSortedSections();

  return (
    <GenericFormTabRenderer
      sections={sections}
      formData={formData}
      onChange={handleChange}
      onSelectChange={handleSelectChange}
      disabled={disabled}
    />
  );
}