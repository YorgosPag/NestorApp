'use client';

import { useMemo } from 'react';
import { GenericFormTabRenderer } from '@/components/generic';
import { IndividualFormTabRenderer } from '@/components/generic/IndividualFormTabRenderer';
import { getSortedSections } from '@/config/company-gemi-config';
import { getServiceSortedSections } from '@/config/service-config';
import { getIndividualSortedSections } from '@/config/individual-config';
import type { ContactFormData, ContactType } from '@/types/ContactFormTypes';
import type { PhotoSlot } from '@/components/ui/MultiplePhotosUpload';
import type { FileUploadResult } from '@/hooks/useEnterpriseFileUpload';

/**
 * 🏢 ENTERPRISE CENTRALIZED CONTACT FORM SECTION
 *
 * Single component που αντικαθιστά όλα τα διάσπαρτα ContactFormSection components:
 * - CompanyContactTabbedSection ❌ → UnifiedContactTabbedSection ✅
 * - ServiceContactTabbedSection ❌ → UnifiedContactTabbedSection ✅
 * - IndividualContactTabbedSection ❌ → UnifiedContactTabbedSection ✅
 * - CompanyContactSection ❌ → UnifiedContactTabbedSection ✅
 * - ServiceContactSection ❌ → UnifiedContactTabbedSection ✅
 * - IndividualContactSection ❌ → UnifiedContactTabbedSection ✅
 * - CommonContactSection ❌ → UnifiedContactTabbedSection ✅
 *
 * SINGLE SOURCE OF TRUTH για όλες τις επαφές!
 */
interface UnifiedContactTabbedSectionProps {
  contactType: ContactType;
  formData: ContactFormData;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSelectChange: (name: string, value: string) => void;

  // 🔄 Legacy handlers (για backward compatibility)
  handleFileChange?: (file: File | null) => void;
  handleLogoChange?: (file: File | null) => void;

  // 🏢 Enterprise photo system handlers
  onPhotosChange?: (photos: PhotoSlot[]) => void;
  handleMultiplePhotosChange?: (photos: PhotoSlot[]) => void;
  handleMultiplePhotoUploadComplete?: (index: number, result: FileUploadResult) => void;
  handleProfilePhotoSelection?: (index: number) => void;

  // 🔗 URL handlers (για server-side uploads)
  handleUploadedLogoURL?: (logoURL: string) => void;
  handleUploadedPhotoURL?: (photoURL: string) => void;

  // 📝 Form state
  setFormData?: (data: ContactFormData) => void;
  disabled?: boolean;
}

/**
 * 📋 Get configuration based on contact type
 */
function getConfigByContactType(contactType: ContactType) {
  switch (contactType) {
    case 'individual':
      return {
        getSections: getIndividualSortedSections,
        renderer: IndividualFormTabRenderer,
        name: 'Φυσικό Πρόσωπο'
      };

    case 'company':
      return {
        getSections: getSortedSections, // ΓΕΜΙ config
        renderer: GenericFormTabRenderer,
        name: 'Εταιρεία'
      };

    case 'service':
      return {
        getSections: getServiceSortedSections,
        renderer: GenericFormTabRenderer,
        name: 'Δημόσια Υπηρεσία'
      };

    default:
      throw new Error(`Unsupported contact type: ${contactType}`);
  }
}

export function UnifiedContactTabbedSection({
  contactType,
  formData,
  handleChange,
  handleSelectChange,
  handleFileChange,
  handleLogoChange,
  onPhotosChange,
  handleMultiplePhotosChange,
  handleMultiplePhotoUploadComplete,
  handleProfilePhotoSelection,
  handleUploadedLogoURL,
  handleUploadedPhotoURL,
  setFormData,
  disabled = false
}: UnifiedContactTabbedSectionProps) {

  // 🏢 ENTERPRISE: Get configuration dynamically based on contact type
  const config = useMemo(() => getConfigByContactType(contactType), [contactType]);
  const sections = useMemo(() => config.getSections(), [config]);

  // 🔄 UNIFIED PHOTO HANDLER: Consolidate all photo change handlers
  const unifiedPhotosChange = useMemo(() => {
    return onPhotosChange || handleMultiplePhotosChange || ((photos: PhotoSlot[]) => {
      console.log('🏢 UNIFIED: Photos changed:', photos.length, 'photos');
      // Default behavior: update formData if available
      if (setFormData && formData) {
        setFormData({
          ...formData,
          multiplePhotos: photos
        });
      }
    });
  }, [onPhotosChange, handleMultiplePhotosChange, setFormData, formData]);

  // 🎯 DYNAMIC RENDERER: Choose the right renderer for this contact type
  const RendererComponent = config.renderer;

  // 🏗️ DYNAMIC PROPS: Build props object based on renderer type
  const rendererProps = useMemo(() => {
    const baseProps = {
      sections,
      formData,
      onChange: handleChange,
      onSelectChange: handleSelectChange,
      disabled,
      customRenderers: {}
    };

    // 👤 Individual-specific props
    if (contactType === 'individual') {
      return {
        ...baseProps,
        onPhotoChange: handleFileChange,
        onMultiplePhotosChange: unifiedPhotosChange,
        onMultiplePhotoUploadComplete: handleMultiplePhotoUploadComplete,
        onProfilePhotoSelection: handleProfilePhotoSelection
      };
    }

    // 🏢 Company & Service props
    return {
      ...baseProps,
      onPhotosChange: unifiedPhotosChange,
      onLogoChange: handleLogoChange,
      handleUploadedLogoURL,
      handleUploadedPhotoURL,
      setFormData
    };
  }, [
    sections, formData, handleChange, handleSelectChange, disabled, contactType,
    handleFileChange, unifiedPhotosChange, handleMultiplePhotoUploadComplete,
    handleProfilePhotoSelection, handleLogoChange, handleUploadedLogoURL,
    handleUploadedPhotoURL, setFormData
  ]);

  return (
    <div className="unified-contact-section">
      {/* 🔍 DEBUG INFO (remove in production) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-gray-500 mb-2">
          🏢 Unified Contact Section: {config.name} ({sections.length} sections)
        </div>
      )}

      {/* 🎯 DYNAMIC RENDERER */}
      <RendererComponent {...rendererProps} />
    </div>
  );
}

export default UnifiedContactTabbedSection;

/**
 * 🏷️ EXPORT ALIASES για backward compatibility
 * Αυτά θα επιτρέψουν στα existing imports να συνεχίσουν να δουλεύουν
 */
export { UnifiedContactTabbedSection as CompanyContactTabbedSection };
export { UnifiedContactTabbedSection as ServiceContactTabbedSection };
export { UnifiedContactTabbedSection as IndividualContactTabbedSection };
export { UnifiedContactTabbedSection as CompanyContactSection };
export { UnifiedContactTabbedSection as ServiceContactSection };
export { UnifiedContactTabbedSection as IndividualContactSection };
export { UnifiedContactTabbedSection as CommonContactSection };