'use client';

import React from 'react';
import { FormGrid } from '@/components/ui/form/FormComponents';
import { TabsOnlyTriggers } from '@/components/ui/navigation/TabsComponents';
import { TabsContent } from '@/components/ui/tabs';
import { getIconComponent } from './utils/IconMapping';
import { IndividualFormRenderer, type IndividualFormData, type CustomFieldRenderer } from './IndividualFormRenderer';
import { MultiplePhotosUpload } from '@/components/ui/MultiplePhotosUpload';
import { UnifiedPhotoManager } from '@/components/ui/UnifiedPhotoManager';
import type { IndividualSectionConfig } from '@/config/individual-config';
import type { PhotoSlot } from '@/components/ui/MultiplePhotosUpload';
import type { FileUploadProgress, FileUploadResult } from '@/hooks/useEnterpriseFileUpload';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

// ============================================================================
// INTERFACES
// ============================================================================

/** Form field interface */
interface FormField {
  name: string;
  type: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  [key: string]: unknown;
}

/** Custom renderer function type */
type IndividualCustomRendererFn = (
  field: FormField,
  formData: Record<string, unknown>,
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void,
  onSelectChange: (name: string, value: string) => void,
  disabled: boolean
) => React.ReactNode;

export interface IndividualFormTabRendererProps {
  /** Sections configuration from individual config file */
  sections: IndividualSectionConfig[];
  /** Form data object */
  formData: Record<string, unknown>;
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
  customRenderers?: Record<string, IndividualCustomRendererFn>;
  /** Photo click handler για gallery preview */
  onPhotoClick?: (index: number) => void;
  /** 🏢 ENTERPRISE: Callback when active tab changes (for parent state management) */
  onActiveTabChange?: (tabId: string) => void;
}

// ============================================================================
// TAB CREATION HELPER
// ============================================================================

/**
 * Creates individual form tabs from configuration sections
 */
function createIndividualFormTabsFromConfig(
  sections: IndividualSectionConfig[],
  formData: Record<string, unknown>,
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void,
  onSelectChange: (name: string, value: string) => void,
  disabled: boolean,
  t: TFunction, // 🏢 ENTERPRISE: i18n translation function
  onPhotoChange?: (file: File | null) => void,
  onMultiplePhotosChange?: (photos: PhotoSlot[]) => void,
  onMultiplePhotoUploadComplete?: (index: number, result: FileUploadResult) => void,
  onProfilePhotoSelection?: (index: number) => void,
  // handleEnterpriseMultiplePhotoUpload removed - using centralized handler
  customRenderers?: Record<string, IndividualCustomRendererFn>,
  onPhotoClick?: (index: number) => void
) {
  return sections.map(section => ({
    id: section.id,
    label: t(section.title), // 🏢 ENTERPRISE: Translate section title
    icon: getIconComponent(section.icon),
    content: section.id === 'photo' ? (
      // Photo section - MultiplePhotosUpload για Individual (και σε disabled mode)
      <div className="space-y-4">
        {/* 📸 ΠΟΛΛΑΠΛΕΣ ΦΩΤΟΓΡΑΦΙΕΣ για Φυσικό Πρόσωπο (μέχρι 6) */}
        <MultiplePhotosUpload
          maxPhotos={6}
          photos={Array.isArray(formData.multiplePhotos) ? formData.multiplePhotos : []}
          onPhotosChange={onMultiplePhotosChange}
          onPhotoUploadComplete={onMultiplePhotoUploadComplete}
          onProfilePhotoSelection={onProfilePhotoSelection}
          // uploadHandler removed - using default centralized handler from MultiplePhotosUpload
          disabled={disabled}
          compact={false}
          showProgress={!disabled} // Hide progress in disabled mode
          purpose="photo"
          contactData={formData} // 🏢 ENTERPRISE: Pass contact data for FileNamingService
          className="mt-4"
          // ✅ CRITICAL FIX: Εμφάνιση φωτογραφιών και στο disabled mode
          showPhotosWhenDisabled={true}
          // 🖼️ Photo click handler για gallery preview
          onPhotoClick={(index) => {
            console.log('🔍 DEBUG IndividualFormTabRenderer: Photo click received', { index, onPhotoClickExists: !!onPhotoClick });
            onPhotoClick?.(index);
          }}
        />

        <FormGrid>
          <IndividualFormRenderer
            sections={[section]} // Regular fields (like description)
            formData={formData as IndividualFormData} // 🏢 ENTERPRISE: Type assertion
            onChange={onChange}
            onSelectChange={onSelectChange}
            disabled={disabled}
            customRenderers={customRenderers as Record<string, CustomFieldRenderer> | undefined} // 🏢 ENTERPRISE: Type assertion
          />
        </FormGrid>
      </div>
    ) : (
      // Regular rendering for other sections
      <FormGrid>
        <IndividualFormRenderer
          sections={[section]} // Single section per tab
          formData={formData as IndividualFormData} // 🏢 ENTERPRISE: Type assertion
          onChange={onChange}
          onSelectChange={onSelectChange}
          disabled={disabled}
          customRenderers={customRenderers as Record<string, CustomFieldRenderer> | undefined} // 🏢 ENTERPRISE: Type assertion
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
  customRenderers,
  onPhotoClick,
  onActiveTabChange
}: IndividualFormTabRendererProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('contacts');

  if (!sections || sections.length === 0) {
    return null;
  }

// Import κεντρικοποιημένης λειτουργικότητας

  // 🚀 CENTRALIZATION: Removed duplicate upload handler - now using centralized defaultUploadHandler from MultiplePhotosUpload

  // Create tabs from individual sections
  const tabs = createIndividualFormTabsFromConfig(
    sections,
    formData,
    onChange,
    onSelectChange,
    disabled,
    t, // 🏢 ENTERPRISE: Pass translation function
    onPhotoChange,
    onMultiplePhotosChange,
    onMultiplePhotoUploadComplete,
    onProfilePhotoSelection,
    // handleEnterpriseMultiplePhotoUpload removed
    customRenderers,
    onPhotoClick
  );

  return (
    <div className="w-full">
      <TabsOnlyTriggers
        tabs={tabs}
        defaultTab={tabs[0]?.id || "basicInfo"}
        theme="clean"
        onTabChange={onActiveTabChange}
      >
        {tabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="">
            {tab.content}
          </TabsContent>
        ))}
      </TabsOnlyTriggers>
    </div>
  );
}

export default IndividualFormTabRenderer;