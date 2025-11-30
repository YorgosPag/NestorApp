'use client';

import React from 'react';
import { FormGrid } from '@/components/ui/form/FormComponents';
import { TabsOnlyTriggers } from '@/components/ui/navigation/TabsComponents';
import { TabsContent } from '@/components/ui/tabs';
import { getIconComponent } from './ConfigTabsHelper';
import { ServiceFormRenderer } from './ServiceFormRenderer';
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
  /** Logo change handler */
  onLogoChange?: (file: File | null) => void;
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
  onLogoChange?: (file: File | null) => void,
  customRenderers?: Record<string, any>
) {
  return sections.map(section => ({
    id: section.id,
    label: section.title,
    icon: getIconComponent(section.icon),
    content: (
      <FormGrid>
        <ServiceFormRenderer
          sections={[section]} // Single section per tab
          formData={formData}
          onChange={onChange}
          onSelectChange={onSelectChange}
          disabled={disabled}
          onLogoChange={onLogoChange}
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
 * Service Form Tab Renderer που δημιουργεί tabbed forms από service configuration
 *
 * Creates tabs for Service Contact forms:
 * - Βασικά Στοιχεία (landmark icon)
 * - Διοικητικά Στοιχεία (shield icon)
 * - Στοιχεία Επικοινωνίας (phone icon)
 * - Αρμοδιότητες & Υπηρεσίες (clipboard-list icon)
 * - Λογότυπο & Εικόνα (image icon)
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
 *       onLogoChange={handleLogoChange}
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
  onLogoChange,
  customRenderers
}: ServiceFormTabRendererProps) {
  if (!sections || sections.length === 0) {
    return null;
  }

  // Create tabs from service sections
  const tabs = createServiceFormTabsFromConfig(
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
        theme="info"
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