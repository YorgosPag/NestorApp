'use client';

import React from 'react';
import { FormGrid } from '@/components/ui/form/FormComponents';
import { TabsOnlyTriggers } from '@/components/ui/navigation/TabsComponents';
import { TabsContent } from '@/components/ui/tabs';
import { getIconComponent } from './ConfigTabsHelper';
import { IndividualFormRenderer } from './IndividualFormRenderer';
import { EnterprisePhotoUpload } from '@/components/ui/EnterprisePhotoUpload';
import { MultiplePhotosUpload } from '@/components/ui/MultiplePhotosUpload';
import { PhotoUploadService } from '@/services/photo-upload.service';
import type { IndividualSectionConfig } from '@/config/individual-config';
import type { PhotoSlot } from '@/components/ui/MultiplePhotosUpload';
import type { FileUploadProgress, FileUploadResult } from '@/hooks/useEnterpriseFileUpload';

// ============================================================================
// INTERFACES
// ============================================================================

export interface IndividualFormTabRendererProps {
  /** Sections configuration from individual config file */
  sections: IndividualSectionConfig[];
  /** Form data object */
  formData: Record<string, any>;
  /** Input change handler */
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  /** Select change handler */
  onSelectChange: (name: string, value: string) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Photo file change handler */
  onPhotoChange?: (file: File | null) => void;
  /** Multiple photos change handler */
  onMultiplePhotosChange?: (photos: PhotoSlot[]) => void;
  /** Multiple photo upload complete handler */
  onMultiplePhotoUploadComplete?: (index: number, result: FileUploadResult) => void;
  /** Custom field renderers for forms */
  customRenderers?: Record<string, (field: any, formData: any, onChange: any, onSelectChange: any, disabled: boolean) => React.ReactNode>;
}

// ============================================================================
// TAB CREATION HELPER
// ============================================================================

/**
 * Creates individual form tabs from configuration sections
 */
function createIndividualFormTabsFromConfig(
  sections: IndividualSectionConfig[],
  formData: Record<string, any>,
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void,
  onSelectChange: (name: string, value: string) => void,
  disabled: boolean,
  onPhotoChange?: (file: File | null) => void,
  onMultiplePhotosChange?: (photos: PhotoSlot[]) => void,
  onMultiplePhotoUploadComplete?: (index: number, result: FileUploadResult) => void,
  handleEnterpriseMultiplePhotoUpload?: (file: File, onProgress: (progress: FileUploadProgress) => void) => Promise<FileUploadResult>,
  customRenderers?: Record<string, any>
) {
  return sections.map(section => ({
    id: section.id,
    label: section.title,
    icon: getIconComponent(section.icon),
    content: section.id === 'photo' ? (
      // Special rendering for photo section
      <div className="space-y-4">
        <EnterprisePhotoUpload
          purpose="photo"
          maxSize={5 * 1024 * 1024} // 5MB
          photoFile={formData.photoFile}
          photoPreview={formData.photoPreview}
          onFileChange={onPhotoChange}
          disabled={disabled}
        />

        {/* 📸 ΠΟΛΛΑΠΛΕΣ ΦΩΤΟΓΡΑΦΙΕΣ για Φυσικό Πρόσωπο (μέχρι 5) */}
        <MultiplePhotosUpload
          maxPhotos={5}
          photos={formData.multiplePhotos || []}
          onPhotosChange={onMultiplePhotosChange}
          onPhotoUploadComplete={onMultiplePhotoUploadComplete}
          uploadHandler={handleEnterpriseMultiplePhotoUpload}
          disabled={disabled}
          compact={true}
          showProgress={true}
          purpose="photo"
          className="mt-4"
        />

        <FormGrid>
          <IndividualFormRenderer
            sections={[section]} // Regular fields (like description)
            formData={formData}
            onChange={onChange}
            onSelectChange={onSelectChange}
            disabled={disabled}
            customRenderers={customRenderers}
          />
        </FormGrid>
      </div>
    ) : (
      // Regular rendering for other sections
      <FormGrid>
        <IndividualFormRenderer
          sections={[section]} // Single section per tab
          formData={formData}
          onChange={onChange}
          onSelectChange={onSelectChange}
          disabled={disabled}
          customRenderers={customRenderers}
        />
      </FormGrid>
    ),
  }));
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Individual Form Tab Renderer που δημιουργεί tabbed forms από individual configuration
 *
 * Creates tabs for Individual Contact forms:
 * - Βασικά Στοιχεία (user icon)
 * - Ταυτότητα & ΑΦΜ (credit-card icon)
 * - Επαγγελματικά Στοιχεία (briefcase icon)
 * - Στοιχεία Επικοινωνίας (phone icon)
 *
 * @example
 * ```tsx
 * import { getIndividualSortedSections } from '@/config/individual-config';
 *
 * function MyIndividualTabbedForm() {
 *   const sections = getIndividualSortedSections();
 *
 *   return (
 *     <IndividualFormTabRenderer
 *       sections={sections}
 *       formData={formData}
 *       onChange={handleChange}
 *       onSelectChange={handleSelectChange}
 *       disabled={loading}
 *     />
 *   );
 * }
 * ```
 */
export function IndividualFormTabRenderer({
  sections,
  formData,
  onChange,
  onSelectChange,
  disabled = false,
  onPhotoChange,
  onMultiplePhotosChange,
  onMultiplePhotoUploadComplete,
  customRenderers
}: IndividualFormTabRendererProps) {
  if (!sections || sections.length === 0) {
    return null;
  }

  // 🔥 Enterprise Multiple Photos Upload Handler
  const handleEnterpriseMultiplePhotoUpload = async (
    file: File,
    onProgress: (progress: FileUploadProgress) => void
  ): Promise<FileUploadResult> => {
    console.log('🚀👤 INDIVIDUAL: Starting enterprise multiple photo upload με compression...', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    });

    const result = await PhotoUploadService.uploadContactPhoto(
      file,
      undefined, // contactId - θα προστεθεί αργότερα όταν save-άρουμε
      onProgress,
      'profile-modal' // Smart compression για individual multiple photos
    );

    console.log('✅👤 INDIVIDUAL: Enterprise multiple photo upload completed:', {
      url: result.url,
      originalSize: result.compressionInfo?.originalSize,
      compressedSize: result.compressionInfo?.compressedSize,
      savings: result.compressionInfo?.compressionRatio
    });

    return result;
  };

  // Create tabs from individual sections
  const tabs = createIndividualFormTabsFromConfig(
    sections,
    formData,
    onChange,
    onSelectChange,
    disabled,
    onPhotoChange,
    onMultiplePhotosChange,
    onMultiplePhotoUploadComplete,
    handleEnterpriseMultiplePhotoUpload,
    customRenderers
  );

  return (
    <div className="w-full">
      <TabsOnlyTriggers
        tabs={tabs}
        defaultTab={tabs[0]?.id || "basicInfo"}
        theme="warning"
      >
        {tabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="mt-4">
            {tab.content}
          </TabsContent>
        ))}
      </TabsOnlyTriggers>
    </div>
  );
}

export default IndividualFormTabRenderer;