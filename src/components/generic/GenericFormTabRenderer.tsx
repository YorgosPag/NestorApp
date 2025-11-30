'use client';

import React from 'react';
import { FormGrid } from '@/components/ui/form/FormComponents';
import { TabsOnlyTriggers } from '@/components/ui/navigation/TabsComponents';
import { TabsContent } from '@/components/ui/tabs';
import { createTabsFromConfig, getIconComponent } from './ConfigTabsHelper';
import { GenericFormRenderer } from './GenericFormRenderer';
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
  customRenderers?: Record<string, any>
) {
  return sections.map(section => ({
    id: section.id,
    label: section.title,
    icon: getIconComponent(section.icon),
    content: (
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
    ),
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