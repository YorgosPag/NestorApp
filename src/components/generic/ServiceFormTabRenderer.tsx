'use client';

import React from 'react';
import { FormGrid } from '@/components/ui/form/FormComponents';
import { TabsOnlyTriggers } from '@/components/ui/navigation/TabsComponents';
import { TabsContent } from '@/components/ui/tabs';
import { getIconComponent } from './utils/IconMapping';
import { ServiceFormRenderer, type ServiceFormData, type PhotoData, type CustomFieldRenderer } from './ServiceFormRenderer';
import { MultiplePhotosUpload } from '@/components/ui/MultiplePhotosUpload';
import type { ServiceSectionConfig } from '@/config/service-config';
// 🏢 ENTERPRISE: i18n support for tab labels
import { useTranslation } from 'react-i18next';

// ============================================================================
// INTERFACES
// ============================================================================

/** Photo slot data structure */
interface PhotoSlot {
  uploadUrl?: string;
  url?: string;
  fileName?: string;
  [key: string]: unknown;
}

/** Form field data structure */
interface FormField {
  name: string;
  type: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  [key: string]: unknown;
}

/** Custom renderer function type */
type CustomRendererFn = (
  field: FormField,
  formData: Record<string, unknown>,
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void,
  onSelectChange: (name: string, value: string) => void,
  disabled: boolean
) => React.ReactNode;

export interface ServiceFormTabRendererProps {
  /** Sections configuration from service config file */
  sections: ServiceSectionConfig[];
  /** Form data object */
  formData: Record<string, unknown>;
  /** Input change handler */
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  /** Select change handler */
  onSelectChange: (name: string, value: string) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Multiple photos change handler (now used for logos too) */
  onPhotosChange?: (photos: PhotoSlot[]) => void;
  /** Custom field renderers for forms */
  customRenderers?: Record<string, CustomRendererFn | (() => React.ReactNode)>;
  /** 🏢 ENTERPRISE: Callback when active tab changes (for parent state management) */
  onActiveTabChange?: (tabId: string) => void;
}

// ============================================================================
// TAB CREATION HELPER
// ============================================================================

/**
 * Creates service form tabs from configuration sections
 * 🔧 FIX: Now accepts t function parameter for translating tab labels (2026-01-19)
 */
function createServiceFormTabsFromConfig(
  sections: ServiceSectionConfig[],
  formData: Record<string, unknown>,
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void,
  onSelectChange: (name: string, value: string) => void,
  disabled: boolean,
  t: (key: string) => string,
  onPhotosChange?: (photos: PhotoSlot[]) => void,
  customRenderers?: Record<string, CustomRendererFn | (() => React.ReactNode)>
) {
  return sections.map(section => {
    // ========================================================================
    // SMART LABEL LOGIC για relationships tab + i18n translation
    // ========================================================================

    // 🔧 FIX: Translate section title if it's an i18n key
    let displayLabel = section.title;

    // Check if it looks like an i18n key (contains dots and starts with 'contacts.')
    if (displayLabel.includes('.') && displayLabel.startsWith('contacts.')) {
      // Remove 'contacts.' prefix since we're already in contacts namespace
      const key = displayLabel.replace('contacts.', '');
      const translated = t(key);

      // Use translation if found, otherwise use the key without prefix
      if (translated && translated !== key && !translated.startsWith('contacts.')) {
        displayLabel = translated;
      } else {
        // Fallback: use key without 'contacts.' prefix
        displayLabel = key;
      }
    }

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
      // 🔍 DEBUG: Log which section we're rendering
      console.log('🔍 ServiceFormTabRenderer: Rendering section:', section.id, 'Title:', section.title);

      // Check for custom renderer FIRST (but exclude logo and relationships which have special logic)
      if (customRenderers?.[section.id] && section.id !== 'logo' && section.id !== 'relationships') {
        console.log('🔧 DEBUG: Using service custom renderer for section:', section.id);
        const renderer = customRenderers[section.id] as (() => React.ReactNode);
        return renderer();
      }

      // 🏢 ENTERPRISE: Custom renderer for relationships tab
      if (section.id === 'relationships' && customRenderers && customRenderers.relationships) {
        console.log('🏢 DEBUG: Using relationships custom renderer');
        const renderer = customRenderers.relationships as (() => React.ReactNode);
        return renderer();
      }

      if (section.id === 'logo') {
        // 🏢 ENTERPRISE CENTRALIZED: Logo upload using MultiplePhotosUpload (1 slot)
        const multiplePhotos = (formData.multiplePhotos as PhotoSlot[] | undefined) || [];
        console.log('🖼️ DEBUG: Rendering LOGO section with MultiplePhotosUpload', {
          photos: multiplePhotos,
          onPhotosChange: !!onPhotosChange,
          disabled
        });
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
              compact={true} // Use compact mode for better layout
              showPhotosWhenDisabled={true} // 🔧 FIX: Show upload slot even in disabled/read-only mode (2026-01-19)
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
            formData={formData as ServiceFormData} // 🏢 ENTERPRISE: Type assertion
            onChange={onChange}
            onSelectChange={onSelectChange}
            disabled={disabled}
            onPhotosChange={onPhotosChange as ((photos: PhotoData[]) => void) | undefined} // 🏢 ENTERPRISE: Type assertion
            customRenderers={customRenderers as Record<string, CustomFieldRenderer> | undefined} // 🏢 ENTERPRISE: Type assertion
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
  customRenderers,
  onActiveTabChange
}: ServiceFormTabRendererProps) {
  // 🏢 ENTERPRISE: i18n hook for translating tab labels
  const { t } = useTranslation('contacts');

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

export default ServiceFormTabRenderer;