'use client';

import { IndividualFormTabRenderer } from '@/components/generic/IndividualFormTabRenderer';
import { getIndividualSortedSections } from '@/config/individual-config';
import type { ContactFormData } from '@/types/ContactFormTypes';

interface IndividualContactTabbedSectionProps {
  formData: ContactFormData;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSelectChange: (name: string, value: string) => void;
  handleFileChange?: (file: File | null) => void;
  disabled?: boolean;
}

/**
 * Individual Contact Section με tabs
 * Χρησιμοποιεί τα ίδια sections όπως στα Contact Details αλλά σε tab layout
 *
 * Tabs:
 * - Βασικά Στοιχεία (user icon)
 * - Ταυτότητα & ΑΦΜ (credit-card icon)
 * - Επαγγελματικά Στοιχεία (briefcase icon)
 * - Στοιχεία Επικοινωνίας (phone icon)
 */
export function IndividualContactTabbedSection({
  formData,
  handleChange,
  handleSelectChange,
  handleFileChange,
  disabled = false
}: IndividualContactTabbedSectionProps) {
  // Get all individual sections from centralized config
  const sections = getIndividualSortedSections();

  return (
    <IndividualFormTabRenderer
      sections={sections}
      formData={formData}
      onChange={handleChange}
      onSelectChange={handleSelectChange}
      onPhotoChange={handleFileChange}
      disabled={disabled}
      customRenderers={{
        // Add any custom field renderers if needed for individual-specific fields
      }}
    />
  );
}

export default IndividualContactTabbedSection;