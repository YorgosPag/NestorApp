'use client';

import { useMemo } from 'react';
import type { ContactFormData, ContactType } from '@/types/ContactFormTypes';
import type { PhotoSlot } from '@/components/ui/MultiplePhotosUpload';
import type { FileUploadResult } from '@/hooks/useEnterpriseFileUpload';
import { UnifiedPhotoManager } from '@/components/ui/UnifiedPhotoManager';
import { ContactRelationshipManager } from '@/components/contacts/relationships/ContactRelationshipManager';
import { RelationshipsSummary } from '@/components/contacts/relationships/RelationshipsSummary';
import { RelationshipProvider } from '@/components/contacts/relationships/context/RelationshipProvider';
import { DynamicContactArrays } from '@/components/contacts/dynamic/DynamicContactArrays';
import { getContactFormConfig, getContactFormSections, getContactTypeDisplayName, getContactFormRenderer } from './utils/ContactFormConfigProvider';
import { getPhotoUploadHandlers, createUnifiedPhotosChangeHandler, buildRendererPropsForContactType } from './utils/PhotoUploadConfiguration';

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

  // 🔗 Relationships mode control
  relationshipsMode?: 'summary' | 'full'; // 'summary' for main tab, 'full' for modal

  // 🎯 Relationship management callback
  onOpenRelationshipModal?: () => void;
  // 🖼️ Photo click handler για gallery preview
  onPhotoClick?: (index: number) => void;
}

// Configuration logic moved to ContactFormConfigProvider utility

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
  disabled = false,
  relationshipsMode = 'full',
  onOpenRelationshipModal,
  onPhotoClick
}: UnifiedContactTabbedSectionProps) {

  // 🏢 ENTERPRISE: Get configuration dynamically based on contact type
  const config = useMemo(() => getContactFormConfig(contactType), [contactType]);
  const sections = useMemo(() => getContactFormSections(contactType), [contactType]);

  // 🔄 UNIFIED PHOTO HANDLER: Consolidate all photo change handlers (extracted)
  const unifiedPhotosChange = useMemo(() =>
    createUnifiedPhotosChangeHandler({
      onPhotosChange,
      handleMultiplePhotosChange,
      setFormData,
      formData
    }),
    [onPhotosChange, handleMultiplePhotosChange, setFormData, formData]
  );

  // 🎯 DYNAMIC RENDERER: Choose the right renderer for this contact type
  const RendererComponent = getContactFormRenderer(contactType);

  // 🏗️ DYNAMIC PROPS: Build props object based on renderer type (extracted)
  const rendererProps = useMemo(() => {
    const baseProps = {
      sections,
      formData,
      onChange: handleChange,
      onSelectChange: handleSelectChange,
      disabled,
      customRenderers: {
        // 🚀 DYNAMIC COMMUNICATION: Custom renderer for communication & social media
        communication: (field: any, fieldFormData: any, fieldOnChange: any, fieldOnSelectChange: any, fieldDisabled: boolean) => (
          <div className="w-full max-w-none min-w-full col-span-full">
            <DynamicContactArrays
              phones={formData.phones || []}
              emails={formData.emails || []}
              websites={formData.websites || []}
              socialMedia={formData.socialMediaArray || []}
              disabled={fieldDisabled}
              onPhonesChange={(phones) => {
                console.log('🔄 UnifiedContactTabbedSection: onPhonesChange called with:', phones.length, 'phones');
                if (setFormData) {
                  const newFormData = { ...formData, phones };
                  console.log('🔄 UnifiedContactTabbedSection: Updating formData with phones:', newFormData.phones?.length);
                  setFormData(newFormData);
                } else {
                  console.warn('⚠️ UnifiedContactTabbedSection: setFormData not provided, falling back to handleChange');
                  const syntheticEvent = {
                    target: { name: 'phones', value: JSON.stringify(phones) }
                  } as React.ChangeEvent<HTMLInputElement>;
                  handleChange(syntheticEvent);
                }
              }}
              onEmailsChange={(emails) => {
                console.log('🔄 UnifiedContactTabbedSection: onEmailsChange called with:', emails.length, 'emails');
                if (setFormData) {
                  const newFormData = { ...formData, emails };
                  console.log('🔄 UnifiedContactTabbedSection: Updating formData with emails:', newFormData.emails?.length);
                  setFormData(newFormData);
                } else {
                  console.warn('⚠️ UnifiedContactTabbedSection: setFormData not provided, falling back to handleChange');
                  const syntheticEvent = {
                    target: { name: 'emails', value: JSON.stringify(emails) }
                  } as React.ChangeEvent<HTMLInputElement>;
                  handleChange(syntheticEvent);
                }
              }}
              onWebsitesChange={(websites) => {
                console.log('🔄 UnifiedContactTabbedSection: onWebsitesChange called with:', websites.length, 'websites');
                if (setFormData) {
                  const newFormData = { ...formData, websites };
                  console.log('🔄 UnifiedContactTabbedSection: Updating formData with websites:', newFormData.websites?.length);
                  setFormData(newFormData);
                } else {
                  console.warn('⚠️ UnifiedContactTabbedSection: setFormData not provided, falling back to handleChange');
                  const syntheticEvent = {
                    target: { name: 'websites', value: JSON.stringify(websites) }
                  } as React.ChangeEvent<HTMLInputElement>;
                  handleChange(syntheticEvent);
                }
              }}
              onSocialMediaChange={(socialMedia) => {
                console.log('🔄 UnifiedContactTabbedSection: onSocialMediaChange called with:', socialMedia.length, 'socialMedia');
                if (setFormData) {
                  const newFormData = { ...formData, socialMediaArray: socialMedia };
                  console.log('🔄 UnifiedContactTabbedSection: Updating formData with socialMediaArray:', newFormData.socialMediaArray?.length);
                  setFormData(newFormData);
                } else {
                  console.warn('⚠️ UnifiedContactTabbedSection: setFormData not provided, falling back to handleChange');
                  const syntheticEvent = {
                    target: { name: 'socialMediaArray', value: JSON.stringify(socialMedia) }
                  } as React.ChangeEvent<HTMLInputElement>;
                  handleChange(syntheticEvent);
                }
              }}
            />
          </div>
        ),

        // 🏢 ENTERPRISE: Custom renderer για companyPhotos (UnifiedPhotoManager) - only for companies
        ...(contactType === 'company' ? {
          companyPhotos: (field: any, fieldFormData: any, fieldOnChange: any, fieldOnSelectChange: any, fieldDisabled: boolean) => (
            <UnifiedPhotoManager
              contactType="company"
              formData={formData}
              handlers={{
                handleLogoChange,
                handleFileChange,
                handleUploadedLogoURL,
                handleUploadedPhotoURL
              }}
              uploadHandlers={getPhotoUploadHandlers(formData)}
              disabled={fieldDisabled}
              className="mt-4"
            />
          )
        } : {}),

        // 🏢 ENTERPRISE: Custom renderer for relationships tab - for ALL contact types
        relationships: (field: any, fieldFormData: any, fieldOnChange: any, fieldOnSelectChange: any, fieldDisabled: boolean) => {
          // ✅ FIXED: Now formData.id is correctly included from the contact mappers
          const contactId = formData.id || 'new-contact';

          // 🚀 PERFORMANCE: Wrap με RelationshipProvider to prevent duplicate API calls
          return (
            <RelationshipProvider
              contactId={contactId}
              contactType={contactType}
              onRelationshipsChange={(relationships) => {
                console.log('🏢 Relationships updated:', relationships.length, 'relationships');
              }}
            >
              {relationshipsMode === 'summary' ? (
                <RelationshipsSummary
                  contactId={contactId}
                  contactType={contactType}
                  readonly={fieldDisabled}
                  className="mt-4"
                  onManageRelationships={() => {
                    console.log('🏢 User clicked manage relationships - opening modal');
                    onOpenRelationshipModal?.();
                  }}
                />
              ) : (
                <ContactRelationshipManager
                  contactId={contactId}
                  contactType={contactType}
                  readonly={fieldDisabled}
                  className="mt-4"
                  onRelationshipsChange={(relationships) => {
                    // Optionally update form data with relationship count for display
                    console.log('🏢 Relationships updated:', relationships.length, 'relationships');
                  }}
                />
              )}
            </RelationshipProvider>
          );
        }
      }
    };

    // Use utility function για props building
    return buildRendererPropsForContactType(contactType, baseProps, {
      handleLogoChange,
      handleFileChange,
      handleUploadedLogoURL,
      handleUploadedPhotoURL,
      unifiedPhotosChange,
      handleMultiplePhotoUploadComplete,
      handleProfilePhotoSelection,
      setFormData,
      formData,
      onPhotoClick
    });
  }, [
    sections, formData, handleChange, handleSelectChange, disabled, contactType,
    handleFileChange, unifiedPhotosChange, handleMultiplePhotoUploadComplete,
    handleProfilePhotoSelection, handleLogoChange, handleUploadedLogoURL,
    handleUploadedPhotoURL, setFormData, relationshipsMode, onPhotoClick
  ]);

  return (
    <div className="unified-contact-section">
      {/* 🔍 DEBUG INFO (remove in production) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-gray-500 mb-2">
          🏢 Unified Contact Section: {getContactTypeDisplayName(contactType)} ({sections.length} sections)
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