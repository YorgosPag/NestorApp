'use client';

import { GenericFormTabRenderer } from '@/components/generic';
import { getServiceSortedSections } from '@/config/service-config';
import { UnifiedPhotoManager } from '@/components/ui/UnifiedPhotoManager';
import { PhotoUploadService } from '@/services/photoUploadService';
import type { ContactFormData } from '@/types/ContactFormTypes';

interface ServiceContactTabbedSectionProps {
  formData: ContactFormData;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSelectChange: (name: string, value: string) => void;
  handleLogoChange?: (file: File | null) => void;
  handleUploadedLogoURL?: (logoURL: string) => void;
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
  handleLogoChange,
  handleUploadedLogoURL,
  disabled = false
}: ServiceContactTabbedSectionProps) {
  // Get all service sections from centralized config
  const sections = getServiceSortedSections();

  return (
    <GenericFormTabRenderer
      sections={sections}
      formData={formData}
      onChange={handleChange}
      onSelectChange={handleSelectChange}
      onLogoChange={handleLogoChange}
      disabled={disabled}
      customRenderers={{
        // Custom renderer για το logo tab - θα περιέχει το UnifiedPhotoManager για services
        logo: () => (
          <UnifiedPhotoManager
            contactType="service"
            formData={formData}
            handlers={{
              handleLogoChange,
              handleUploadedLogoURL
            }}
            uploadHandlers={{
              logoUploadHandler: PhotoUploadService.handleLogoUpload  // Χρήση του κεντρικοποιημένου handler
            }}
            disabled={disabled}
            className="mt-4"
          />
        )
      }}
    />
  );
}

export default ServiceContactTabbedSection;