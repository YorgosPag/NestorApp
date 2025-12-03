'use client';

import React from 'react';
import { FormGrid } from '@/components/ui/form/FormComponents';
import { TabsOnlyTriggers } from '@/components/ui/navigation/TabsComponents';
import { TabsContent } from '@/components/ui/tabs';
import { getIconComponent } from './ConfigTabsHelper';
import { IndividualFormRenderer } from './IndividualFormRenderer';
import { MultiplePhotosUpload } from '@/components/ui/MultiplePhotosUpload';
import { UnifiedPhotoManager } from '@/components/ui/UnifiedPhotoManager';
import type { IndividualSectionConfig } from '@/config/individual-config';
import type { PhotoSlot } from '@/components/ui/MultiplePhotosUpload';
import type { FileUploadProgress, FileUploadResult } from '@/hooks/useEnterpriseFileUpload';
import { generateContactFileWithCustomName, logFilenameGeneration } from '@/utils/contact-filename-generator';

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
  /** Profile photo selection handler */
  onProfilePhotoSelection?: (index: number) => void;
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
  onProfilePhotoSelection?: (index: number) => void,
  handleEnterpriseMultiplePhotoUpload?: (file: File, onProgress: (progress: FileUploadProgress) => void) => Promise<FileUploadResult>,
  customRenderers?: Record<string, any>
) {
  return sections.map(section => ({
    id: section.id,
    label: section.title,
    icon: getIconComponent(section.icon),
    content: section.id === 'photo' ? (
      // Photo section - μόνο MultiplePhotosUpload για Individual
      <div className="space-y-4">
        {/* 📸 ΠΟΛΛΑΠΛΕΣ ΦΩΤΟΓΡΑΦΙΕΣ για Φυσικό Πρόσωπο (μέχρι 6) */}
        <MultiplePhotosUpload
          maxPhotos={6}
          photos={formData.multiplePhotos || []}
          onPhotosChange={onMultiplePhotosChange}
          onPhotoUploadComplete={onMultiplePhotoUploadComplete}
          onProfilePhotoSelection={onProfilePhotoSelection}
          uploadHandler={handleEnterpriseMultiplePhotoUpload}
          disabled={disabled}
          compact={false}
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
    )
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
  onProfilePhotoSelection,
  customRenderers
}: IndividualFormTabRendererProps) {
  if (!sections || sections.length === 0) {
    return null;
  }

// Import κεντρικοποιημένης λειτουργικότητας

  // 🔥 Enterprise Multiple Photos Upload Handler
  const handleEnterpriseMultiplePhotoUpload = async (
    file: File,
    onProgress: (progress: FileUploadProgress) => void
  ): Promise<FileUploadResult> => {
    // Βρίσκουμε ποιο index είναι αυτή η φωτογραφία
    const currentPhotos = formData.multiplePhotos || [];
    const photoIndex = currentPhotos.findIndex(photo => !photo.file && !photo.uploadUrl);

    // 🏷️ Χρήση κεντρικοποιημένης λειτουργικότητας filename generation
    const { customFilename, customFile, originalFilename } = generateContactFileWithCustomName({
      originalFile: file,
      contactData: formData,
      fileType: 'gallery',
      photoIndex: photoIndex >= 0 ? photoIndex : currentPhotos.length
    });

    // 📝 Centralized logging
    logFilenameGeneration(originalFilename, customFilename, formData, 'gallery');

    console.log('🚀👤 INDIVIDUAL: Starting enterprise multiple photo upload με centralized filename...', {
      originalFileName: originalFilename,
      customFileName: customFilename,
      photoIndex: photoIndex >= 0 ? photoIndex : currentPhotos.length,
      fileSize: file.size,
      fileType: file.type
    });

    // Χρησιμοποιούμε το υπάρχον uploadContactPhoto για συμβατότητα
    // 🔙 OLD WORKING SYSTEM: Direct Base64 conversion
    const result = await new Promise<FileUploadResult>((resolve, reject) => {
      const reader = new FileReader();
      onProgress({ progress: 0, bytesTransferred: 0, totalBytes: file.size });

      reader.onload = (e) => {
        const base64URL = e.target?.result as string;
        onProgress({ progress: 100, bytesTransferred: file.size, totalBytes: file.size });
        resolve({
          success: true,
          url: base64URL,
          fileName: file.name,
          compressionInfo: {
            originalSize: file.size,
            compressedSize: file.size,
            compressionRatio: 1.0,
            quality: 1.0
          }
        });
      };

      reader.onerror = () => reject(new Error('Base64 conversion failed'));
      reader.readAsDataURL(file);
    });


    console.log('✅👤 INDIVIDUAL: Enterprise multiple photo upload completed:', {
      originalFileName: originalFilename,
      uploadedFileName: customFilename,
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
    onProfilePhotoSelection,
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