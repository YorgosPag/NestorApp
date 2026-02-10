'use client';

import React from 'react';
import { FormGrid } from '@/components/ui/form/FormComponents';
import { TabsOnlyTriggers } from '@/components/ui/navigation/TabsComponents';
import { TabsContent } from '@/components/ui/tabs';
import { getIconComponent } from './utils/IconMapping';
import { GenericFormRenderer, type FormDataRecord, type PhotoData, type CustomRendererFn } from './GenericFormRenderer';
import { MultiplePhotosUpload } from '@/components/ui/MultiplePhotosUpload';
import type { SectionConfig } from '@/config/company-gemi';
// 🏢 ENTERPRISE: i18n support for tab labels
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ContactFormData } from '@/types/ContactFormTypes';

// ============================================================================
// INTERFACES
// ============================================================================

/** Photo slot data for multiple photos */
interface PhotoSlotData {
  uploadUrl?: string;
  url?: string;
  fileName?: string;
  [key: string]: unknown;
}

/** Form field data for custom renderers */
interface FormFieldData {
  name: string;
  type?: string;
  label?: string;
  [key: string]: unknown;
}

/** Local custom renderer function type (parameterless for special sections) */
type LocalCustomRendererFn = () => React.ReactNode;

/** Field renderer function type */
type FieldRendererFn = (field: FormFieldData, formData: ContactFormData, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void, onSelectChange: (name: string, value: string) => void, disabled: boolean) => React.ReactNode;

export interface GenericFormTabRendererProps {
  /** Sections configuration from config file */
  sections: SectionConfig[];
  /** Form data object */
  formData: ContactFormData;
  /** Input change handler */
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  /** Select change handler */
  onSelectChange: (name: string, value: string) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Multiple photos change handler (now used for logos too) */
  onPhotosChange?: (photos: PhotoSlotData[]) => void;
  /** Custom field renderers for forms */
  customRenderers?: Record<string, FieldRendererFn | LocalCustomRendererFn>;
  /** 🏢 ENTERPRISE: Callback when active tab changes (for parent state management) */
  onActiveTabChange?: (tabId: string) => void;
}

// ============================================================================
// TAB CREATION HELPER
// ============================================================================

/**
 * 🏢 ENTERPRISE: Translate i18n key to localized string
 * Keys containing '.' are treated as i18n keys (e.g., 'sections.basicInfoGemi')
 */
function translateLabel(text: string, t: (key: string) => string): string {
  if (!text) return '';
  // i18n keys contain dots
  if (text.includes('.')) {
    const translated = t(text);
    // If translation returns the key itself, extract the last part as fallback
    if (translated === text) {
      const parts = text.split('.');
      return parts[parts.length - 1];
    }
    return translated;
  }
  return text;
}

/**
 * Creates form tabs from configuration sections
 * 🏢 ENTERPRISE: Now accepts translate function for i18n support
 */
function createFormTabsFromConfig(
  sections: SectionConfig[],
  formData: ContactFormData,
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void,
  onSelectChange: (name: string, value: string) => void,
  disabled: boolean,
  t: (key: string) => string,
  onPhotosChange?: (photos: PhotoSlotData[]) => void,
  customRenderers?: Record<string, FieldRendererFn | CustomRendererFn>
) {
  return sections.map(section => {
    // ========================================================================
    // 🏢 ENTERPRISE: Translate section title using i18n
    // ========================================================================

    let displayLabel = translateLabel(section.title, t);

    // Αν είναι relationships section και υπάρχει custom renderer, προσθέτουμε indicator
    if (section.id === 'relationships' && customRenderers?.relationships) {
      // Προσθέτουμε ένα visual indicator που δείχνει ότι υπάρχει ενεργό content
      displayLabel = `${displayLabel} 🔗`;
    }

    return {
      id: section.id,
      label: displayLabel,
      icon: getIconComponent(section.icon),
    content: (() => {
      // Check for custom renderer FIRST (but exclude companyPhotos and relationships which have special logic)
      if (customRenderers?.[section.id] && section.id !== 'companyPhotos' && section.id !== 'relationships') {
        console.log('🔧 DEBUG: Using generic custom renderer for section:', section.id);
        const renderer = customRenderers[section.id] as LocalCustomRendererFn;
        return renderer();
      }

      // 🏢 ENTERPRISE: Custom renderer for relationships tab
      if (section.id === 'relationships' && customRenderers && customRenderers.relationships) {
        console.log('🏢 DEBUG: Using relationships custom renderer');
        const renderer = customRenderers.relationships as LocalCustomRendererFn;
        return renderer();
      }

      if (section.id === 'companyPhotos' && customRenderers && customRenderers.companyPhotos) {
        // 🏢 ENTERPRISE: Custom renderer για companyPhotos (UnifiedPhotoManager)
        console.log('🏢 DEBUG: Using companyPhotos custom renderer');
        const renderer = customRenderers.companyPhotos as LocalCustomRendererFn;
        return renderer();
      }

      if (section.id === 'logo') {
        // 🏢 ENTERPRISE CENTRALIZED: Logo upload using MultiplePhotosUpload (1 slot)
        const multiplePhotos = (formData.multiplePhotos as PhotoSlotData[] | undefined) || [];
        return (
          <div className="flex flex-col items-center space-y-4 p-6 min-h-[360px]">
            <MultiplePhotosUpload
              key={`logo-upload-${multiplePhotos.length}-${multiplePhotos[0]?.uploadUrl || 'empty'}`}
              photos={multiplePhotos}
              maxPhotos={1} // For service logos, we use exactly 1 slot
              onPhotosChange={onPhotosChange as ((photos: import('@/components/ui/MultiplePhotosUpload').PhotoSlot[]) => void) | undefined}
              disabled={disabled}
              purpose="logo" // For services
              contactData={formData} // 🏢 ENTERPRISE: Pass contact data for FileNamingService
              compact // Use compact mode for better layout
              className=""
            />
          </div>
        );
      }

      // Regular rendering for other sections
      return (
        <FormGrid>
          <GenericFormRenderer
            sections={[section]} // Single section per tab
            formData={formData as unknown as FormDataRecord} // 🏢 ENTERPRISE: Type assertion - formData is compatible
            onChange={onChange}
            onSelectChange={onSelectChange}
            disabled={disabled}
            onPhotosChange={onPhotosChange as ((photos: PhotoData[]) => void) | undefined} // 🏢 ENTERPRISE: Type assertion
            customRenderers={customRenderers as Record<string, CustomRendererFn> | undefined} // 🏢 ENTERPRISE: Type assertion
          />
        </FormGrid>
      );
    })()
    };
  });
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Generic Form Tab Renderer που δημιουργεί tabbed forms από configuration
 *
 * @example
 * ```tsx
 * import { getSortedSections } from '@/config/company-gemi';
 *
 * function MyTabbedForm() {
 *   const sections = getSortedSections();
 *
 *   return (
 *     <GenericFormTabRenderer
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
export function GenericFormTabRenderer({
  sections,
  formData,
  onChange,
  onSelectChange,
  disabled = false,
  onPhotosChange,
  customRenderers,
  onActiveTabChange
}: GenericFormTabRendererProps) {
  // 🏢 ENTERPRISE: i18n support for tab labels
  const { t } = useTranslation('forms');

  if (!sections || sections.length === 0) {
    console.warn('GenericFormTabRenderer: No sections provided');
    return null;
  }

  // Create tabs from sections - 🏢 ENTERPRISE: Pass translate function
  const tabs = createFormTabsFromConfig(
    sections,
    formData,
    onChange,
    onSelectChange,
    disabled,
    t,
    onPhotosChange,
    customRenderers
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
          <TabsContent key={tab.id} value={tab.id} className="mt-4">
            {tab.content}
          </TabsContent>
        ))}
      </TabsOnlyTriggers>
    </div>
  );
}

export default GenericFormTabRenderer;
