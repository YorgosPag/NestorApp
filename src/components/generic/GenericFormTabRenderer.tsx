'use client';

import React from 'react';
import { FormGrid } from '@/components/ui/form/FormComponents';
import { TabsOnlyTriggers } from '@/components/ui/navigation/TabsComponents';
import { TabsContent } from '@/components/ui/tabs';
import { createTabsFromConfig, getIconComponent } from './ConfigTabsHelper';
import { GenericFormRenderer } from './GenericFormRenderer';
import { EnterprisePhotoUpload } from '@/components/ui/EnterprisePhotoUpload';
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
  /** Logo file change handler */
  onLogoChange?: (file: File | null) => void;
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
  onLogoChange?: (file: File | null) => void,
  customRenderers?: Record<string, any>
) {
  return sections.map(section => ({
    id: section.id,
    label: section.title,
    icon: getIconComponent(section.icon),
    content: (() => {
      // Check for custom renderer FIRST
      if (customRenderers?.[section.id]) {
        return customRenderers[section.id]();
      }

      return (section.id === 'logo' || section.id === 'companyPhotos') ? (
      // Special rendering for logo/companyPhotos section
      section.id === 'companyPhotos' && customRenderers && customRenderers.companyPhotos ? (
        // Custom renderer για companyPhotos (UnifiedPhotoManager)
        customRenderers.companyPhotos(section, formData, onChange, onSelectChange, disabled)
      ) : (
        // Default logo rendering για backward compatibility
        <div className="space-y-4">
          <EnterprisePhotoUpload
            purpose="logo"
            maxSize={5 * 1024 * 1024} // 5MB
            photoFile={formData.logoFile}
            photoPreview={formData.logoPreview}
            onFileChange={onLogoChange}
            disabled={disabled}
            contactData={formData} // 🏷️ Pass contact data for filename generation
          />
          <FormGrid>
            <GenericFormRenderer
              sections={[section]} // Regular fields (like description)
              formData={formData}
              onChange={onChange}
              onSelectChange={onSelectChange}
              disabled={disabled}
              customRenderers={customRenderers}
            />
          </FormGrid>
        </div>
      )
    ) : (
      // Regular rendering for other sections
      <FormGrid>
        <GenericFormRenderer
          sections={[section]} // Single section per tab
          formData={formData}
          onChange={onChange}
          onSelectChange={onSelectChange}
          disabled={disabled}
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
  onLogoChange,
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
    onLogoChange,
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