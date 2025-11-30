'use client';

import { ServiceFormTabRenderer } from '@/components/generic/ServiceFormTabRenderer';
import { getServiceSortedSections } from '@/config/service-config';
import type { ContactFormData } from '@/types/ContactFormTypes';

interface ServiceContactTabbedSectionProps {
  formData: ContactFormData;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSelectChange: (name: string, value: string) => void;
  handleLogoChange?: (file: File | null) => void;
  disabled?: boolean;
}

/**
 * Service Contact Section με tabs
 * Χρησιμοποιεί τα service sections από service-config αντί για ΓΕΜΙ
 *
 * Tabs:
 * - Βασικά Στοιχεία (landmark icon)
 * - Διοικητικά Στοιχεία (shield icon)
 * - Στοιχεία Επικοινωνίας (phone icon)
 * - Αρμοδιότητες & Υπηρεσίες (clipboard-list icon)
 * - Λογότυπο & Εικόνα (image icon)
 */
export function ServiceContactTabbedSection({
  formData,
  handleChange,
  handleSelectChange,
  handleLogoChange,
  disabled = false
}: ServiceContactTabbedSectionProps) {
  // Get all service sections from centralized config
  const sections = getServiceSortedSections();

  return (
    <ServiceFormTabRenderer
      sections={sections}
      formData={formData}
      onChange={handleChange}
      onSelectChange={handleSelectChange}
      onLogoChange={handleLogoChange}
      disabled={disabled}
      customRenderers={{
        // Add any custom field renderers if needed for service-specific fields
      }}
    />
  );
}

export default ServiceContactTabbedSection;