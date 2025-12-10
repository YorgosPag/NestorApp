'use client';

import React from 'react';
import { FormGrid } from '@/components/ui/form/FormComponents';
import { TabsOnlyTriggers } from '@/components/ui/navigation/TabsComponents';
import { TabsContent } from '@/components/ui/tabs';
import { getIconComponent } from './utils/IconMapping';
import { ServiceFormRenderer } from './ServiceFormRenderer';
import { MultiplePhotosUpload } from '@/components/ui/MultiplePhotosUpload';
import type { ServiceSectionConfig } from '@/config/service-config';

// ============================================================================
// INTERFACES
// ============================================================================

export interface ServiceFormTabRendererProps {
  /** Sections configuration from service config file */
  sections: ServiceSectionConfig[];
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
 * Creates service form tabs from configuration sections
 */
function createServiceFormTabsFromConfig(
  sections: ServiceSectionConfig[],
  formData: Record<string, any>,
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void,
  onSelectChange: (name: string, value: string) => void,
  disabled: boolean,
  onPhotosChange?: (photos: any[]) => void,
  customRenderers?: Record<string, any>
) {
  return sections.map(section => {
    // ========================================================================
    // SMART LABEL LOGIC για relationships tab
    // ========================================================================

    let displayLabel = section.title;

    // Αν είναι relationships section και υπάρχει custom renderer, προσθέτουμε indicator
    if (section.id === 'relationships' && customRenderers?.relationships) {
      // Προσθέτουμε ένα visual indicator που δείχνει ότι υπάρχει ενεργό content
      displayLabel = `${section.title} 🔗`;
    }

    return {
      id: section.id,
      label: displayLabel,
      icon: getIconComponent(section.icon),
    content: (() => {
      // Check for custom renderer FIRST (but exclude logo and relationships which have special logic)
      if (customRenderers?.[section.id] && section.id !== 'logo' && section.id !== 'relationships') {
        console.log('🔧 DEBUG: Using service custom renderer for section:', section.id);
        return customRenderers[section.id]();
      }

      // 🏢 ENTERPRISE: Custom renderer for relationships tab
      if (section.id === 'relationships' && customRenderers && customRenderers.relationships) {
        console.log('🏢 DEBUG: Using relationships custom renderer');
        return customRenderers.relationships();
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

      // 🎯 CRITICAL: Use ServiceFormRenderer (not GenericFormRenderer) for clickable links!
      return (
        <div className="space-y-8 md:space-y-6">
          <ServiceFormRenderer
            sections={[section]} // Single section per tab
            formData={formData}
            onChange={onChange}
            onSelectChange={onSelectChange}
            disabled={disabled}
            onPhotosChange={onPhotosChange} // Pass photo handler to ServiceFormRenderer
            customRenderers={customRenderers}
          />
        </div>
      );
    })()
    };
  });
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Service Form Tab Renderer που δημιουργεί tabbed forms από service configuration
 *
 * 🎯 KEY DIFFERENCE: Uses ServiceFormRenderer instead of GenericFormRenderer
 * This ensures that email, phone, and website fields are clickable in disabled mode!
 *
 * @example
 * ```tsx
 * import { getServiceSortedSections } from '@/config/service-config';
 *
 * function MyServiceTabbedForm() {
 *   const sections = getServiceSortedSections();
 *
 *   return (
 *     <ServiceFormTabRenderer
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
export function ServiceFormTabRenderer({
  sections,
  formData,
  onChange,
  onSelectChange,
  disabled = false,
  onPhotosChange,
  customRenderers
}: ServiceFormTabRendererProps) {
  if (!sections || sections.length === 0) {
    console.warn('ServiceFormTabRenderer: No sections provided');
    return null;
  }

  // Create tabs from service sections
  const tabs = createServiceFormTabsFromConfig(
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

export default ServiceFormTabRenderer;