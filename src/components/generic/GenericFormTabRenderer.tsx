'use client';

import React from 'react';
import { FormGrid } from '@/components/ui/form/FormComponents';
import { TabsOnlyTriggers } from '@/components/ui/navigation/TabsComponents';
import { TabsContent } from '@/components/ui/tabs';
import { createTabsFromConfig, getIconComponent } from './ConfigTabsHelper';
import { GenericFormRenderer } from './GenericFormRenderer';
import { MultiplePhotosUpload } from '@/components/ui/MultiplePhotosUpload';
import type { SectionConfig } from '@/config/company-gemi-config';

// ============================================================================
// INTERFACES
// ============================================================================

export interface GenericFormTabRendererProps {
  /** Sections configuration from config file */
  sections: SectionConfig[];
  /** Form data object */
  formData: Record<string, any>;
  /** Input change handler */
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  /** Select change handler */
  onSelectChange: (name: string, value: string) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Multiple photos change handler (now used for logos too) */
  onPhotosChange?: (photos: any[]) => void;
  /** Custom field renderers for forms */
  customRenderers?: Record<string, (field: any, formData: any, onChange: any, onSelectChange: any, disabled: boolean) => React.ReactNode>;
}

// ============================================================================
// TAB CREATION HELPER
// ============================================================================

/**
 * Creates form tabs from configuration sections
 */
function createFormTabsFromConfig(
  sections: SectionConfig[],
  formData: Record<string, any>,
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void,
  onSelectChange: (name: string, value: string) => void,
  disabled: boolean,
  onPhotosChange?: (photos: any[]) => void,
  customRenderers?: Record<string, any>
) {
  return sections.map(section => ({
    id: section.id,
    label: section.title,
    icon: getIconComponent(section.icon),
    content: (() => {
      // Check for custom renderer FIRST (but exclude companyPhotos and relationships which have special logic)
      if (customRenderers?.[section.id] && section.id !== 'companyPhotos' && section.id !== 'relationships') {
        console.log('🔧 DEBUG: Using generic custom renderer for section:', section.id);
        return customRenderers[section.id]();
      }

      // 🏢 ENTERPRISE: Custom renderer for relationships tab
      if (section.id === 'relationships' && customRenderers && customRenderers.relationships) {
        console.log('🏢 DEBUG: Using relationships custom renderer');
        return customRenderers.relationships();
      }

      if (section.id === 'companyPhotos' && customRenderers && customRenderers.companyPhotos) {
        // 🏢 ENTERPRISE: Custom renderer για companyPhotos (UnifiedPhotoManager)
        console.log('🏢 DEBUG: Using companyPhotos custom renderer');
        return customRenderers.companyPhotos();
      }

      if (section.id === 'logo') {
        // 🏢 ENTERPRISE CENTRALIZED: Logo upload using MultiplePhotosUpload (1 slot)
        return (
          <div className="flex flex-col items-center space-y-4 p-6 min-h-[360px]">
            <MultiplePhotosUpload
              key={`logo-upload-${(formData.multiplePhotos || []).length}-${(formData.multiplePhotos || [])[0]?.uploadUrl || 'empty'}`}
              photos={formData.multiplePhotos || []}
              maxPhotos={1} // For service logos, we use exactly 1 slot
              onPhotosChange={onPhotosChange}
              disabled={disabled}
              purpose="logo" // For services
              contactData={formData} // 🏢 ENTERPRISE: Pass contact data for FileNamingService
              compact={true} // Use compact mode for better layout
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
            formData={formData}
            onChange={onChange}
            onSelectChange={onSelectChange}
            disabled={disabled}
            onPhotosChange={onPhotosChange} // Pass photo handler to GenericFormRenderer
            customRenderers={customRenderers}
          />
        </FormGrid>
      );
    })(),
  }));
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Generic Form Tab Renderer που δημιουργεί tabbed forms από configuration
 *
 * @example
 * ```tsx
 * import { getSortedSections } from '@/config/company-gemi-config';
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
  customRenderers
}: GenericFormTabRendererProps) {
  if (!sections || sections.length === 0) {
    console.warn('GenericFormTabRenderer: No sections provided');
    return null;
  }

  // Create tabs from sections
  const tabs = createFormTabsFromConfig(
    sections,
    formData,
    onChange,
    onSelectChange,
    disabled,
    onPhotosChange,
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

export default GenericFormTabRenderer;