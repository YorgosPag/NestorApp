'use client';

// 🏢 ENTERPRISE: Direct import to avoid barrel (reduces module graph)
import { ServiceFormTabRenderer } from '@/components/generic/ServiceFormTabRenderer';
import { getServiceSortedSections } from '@/config/service-config';
import type { ContactFormData } from '@/types/ContactFormTypes';
import type { PhotoSlot } from '@/components/ui/MultiplePhotosUpload';

interface ServiceContactTabbedSectionProps {
  formData: ContactFormData;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSelectChange: (name: string, value: string) => void;
  onPhotosChange?: (photos: PhotoSlot[]) => void;
  setFormData?: (data: ContactFormData) => void;
  disabled?: boolean;
}

/**
 * Service Contact Section με tabs
 * Χρησιμοποιεί τα service sections από service-config αντί για ΓΕΜΙ
 * Χρησιμοποιεί UnifiedPhotoManager όπως οι εταιρείες για σωστή λειτουργία upload
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
  onPhotosChange,
  setFormData,
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
      onPhotosChange={onPhotosChange}
      disabled={disabled}
    />
  );
}

export default ServiceContactTabbedSection;