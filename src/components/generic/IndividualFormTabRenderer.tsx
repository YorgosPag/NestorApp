'use client';

import React from 'react';
import { FormGrid } from '@/components/ui/form/FormComponents';
import { TabsOnlyTriggers } from '@/components/ui/navigation/TabsComponents';
import { TabsContent } from '@/components/ui/tabs';
import { getIconComponent } from './ConfigTabsHelper';
import { IndividualFormRenderer } from './IndividualFormRenderer';
import type { IndividualSectionConfig } from '@/config/individual-config';

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
  customRenderers?: Record<string, any>
) {
  return sections.map(section => ({
    id: section.id,
    label: section.title,
    icon: getIconComponent(section.icon),
    content: (
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
  customRenderers
}: IndividualFormTabRendererProps) {
  if (!sections || sections.length === 0) {
    console.warn('IndividualFormTabRenderer: No sections provided');
    return null;
  }

  // Create tabs from individual sections
  const tabs = createIndividualFormTabsFromConfig(
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

export default IndividualFormTabRenderer;