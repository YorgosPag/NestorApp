import { getSortedSections } from '@/config/company-gemi-config';
import { getServiceSortedSections } from '@/config/service-config';
import { getIndividualSortedSections } from '@/config/individual-config';
import { GenericFormTabRenderer } from '@/components/generic';
import { IndividualFormTabRenderer } from '@/components/generic/IndividualFormTabRenderer';
import type { ContactType } from '@/types/ContactFormTypes';

// 🚧 ΠΡΟΣΩΡΙΝΗ ΔΟΚΙΜΗ: Import ContactDetails renderer system
import React from 'react';
import { TabsOnlyTriggers } from '@/components/ui/navigation/TabsComponents';
import { TabsContent } from '@/components/ui/tabs';
import { createCompanyTabsFromConfig, createIndividualTabsFromConfig, createServiceTabsFromConfig } from '@/components/generic';
import { RelationshipsSummary } from '@/components/contacts/relationships/RelationshipsSummary';

// 🚧 ΠΡΟΣΩΡΙΝΟ WRAPPER: ContactDetails-style renderer για testing
const ContactDetailsStyleRenderer = ({ sections, formData, onChange, onSelectChange, disabled, customRenderers }: any) => {
  // Create tabs using the ContactDetails system (TabConfigFactory)
  const contactType = formData.type || 'company';

  const customRenderersWithSummary = {
    ...customRenderers,
    relationships: () => {
      console.log('🧪 TEST: Using ContactDetails-style RelationshipsSummary renderer');
      const contactId = formData.id || 'new-contact';
      return (
        <RelationshipsSummary
          contactId={contactId}
          contactType={contactType}
          readonly={disabled}
          className="mt-4"
          onManageRelationships={() => {
            console.log('🏢 User clicked manage relationships - this should open modal');
          }}
        />
      );
    }
  };

  let tabs;
  if (contactType === 'company') {
    tabs = createCompanyTabsFromConfig(
      sections,
      formData,
      customRenderersWithSummary,
      undefined,
      undefined // onPhotoClick
    );
  } else if (contactType === 'service') {
    tabs = createServiceTabsFromConfig(
      sections,
      formData,
      customRenderersWithSummary,
      undefined,
      undefined // onPhotoClick
    );
  } else {
    tabs = createIndividualTabsFromConfig(
      sections,
      formData,
      customRenderersWithSummary,
      undefined,
      undefined // onPhotoClick
    );
  }

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
};

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface ContactFormConfig {
  getSections: () => any[];
  renderer: any;
  name: string;
}

// ============================================================================
// 🔥 EXTRACTED: CONTACT FORM CONFIGURATION LOGIC
// ============================================================================

/**
 * Contact Form Configuration Provider - Specialized για configuration management
 *
 * Extracted από UnifiedContactTabbedSection για Single Responsibility Principle.
 * Χειρίζεται μόνο τη configuration logic για κάθε contact type.
 *
 * Features:
 * - Contact type-specific configuration
 * - Renderer selection logic
 * - Section configuration management
 * - Clean separation από UI logic
 */

/**
 * 📋 Get configuration based on contact type
 *
 * 🔥 ΚΡΙΣΙΜΗ ΣΥΝΑΡΤΗΣΗ: Καθορίζει ποιο configuration θα χρησιμοποιηθεί
 * για κάθε contact type. Αυτή η λογική ήταν embedded στο component.
 */
export function getContactFormConfig(contactType: ContactType): ContactFormConfig {
  switch (contactType) {
    case 'individual':
      return {
        getSections: getIndividualSortedSections,
        renderer: IndividualFormTabRenderer,
        name: 'Φυσικό Πρόσωπο'
      };

    case 'company':
      return {
        getSections: getSortedSections, // ΓΕΜΙ config
        renderer: GenericFormTabRenderer,
        name: 'Εταιρεία'
      };

    case 'service':
      return {
        getSections: getServiceSortedSections,
        renderer: GenericFormTabRenderer,
        name: 'Δημόσια Υπηρεσία'
      };

    default:
      throw new Error(`Unsupported contact type: ${contactType}`);
  }
}

/**
 * 🎯 Get sections for specific contact type
 *
 * Helper function που απλοποιεί την πρόσβαση στα sections
 */
export function getContactFormSections(contactType: ContactType) {
  const config = getContactFormConfig(contactType);
  return config.getSections();
}

/**
 * 📊 Get contact type display name
 */
export function getContactTypeDisplayName(contactType: ContactType): string {
  const config = getContactFormConfig(contactType);
  return config.name;
}

/**
 * 🎭 Get appropriate renderer for contact type
 */
export function getContactFormRenderer(contactType: ContactType) {
  const config = getContactFormConfig(contactType);
  return config.renderer;
}