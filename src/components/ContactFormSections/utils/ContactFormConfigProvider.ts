import { getSortedSections } from '@/config/company-gemi';
import { getServiceSortedSections } from '@/config/service-config';
import { getIndividualSortedSections } from '@/config/individual-config';
// 🏢 ENTERPRISE: Direct imports to avoid barrel (reduces module graph)
import { GenericFormTabRenderer } from '@/components/generic/GenericFormTabRenderer';
import { ServiceFormTabRenderer } from '@/components/generic/ServiceFormTabRenderer';
import { IndividualFormTabRenderer } from '@/components/generic/IndividualFormTabRenderer';
// 🏢 ENTERPRISE: Import ContactType from its source
import type { ContactType } from '@/types/contacts';


// ============================================================================
// TYPES & INTERFACES
// ============================================================================

// 🏢 ENTERPRISE: Dynamic renderer dispatch — each renderer has its own props interface.
// Common base props: sections, formData, onChange, onSelectChange, disabled.
// Renderers are stored generically and typed at call site.
interface FormTabRendererBaseProps {
  sections: unknown[];
  formData?: unknown;
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onSelectChange?: (name: string, value: string) => void;
  disabled?: boolean;
  fieldErrors?: Record<string, string>;
  onFieldBlur?: (fieldName: string) => void;
}
type FormTabRendererComponent = React.ComponentType<FormTabRendererBaseProps>;

export interface ContactFormConfig {
  // 🏢 ENTERPRISE: Generic sections array - each renderer has its own section type
  getSections: () => unknown[];
  renderer: FormTabRendererComponent;
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
        renderer: IndividualFormTabRenderer as unknown as FormTabRendererComponent,
        name: 'Φυσικό Πρόσωπο'
      };

    case 'company':
      return {
        getSections: getSortedSections, // ΓΕΜΙ config
        renderer: GenericFormTabRenderer as unknown as FormTabRendererComponent,
        name: 'Εταιρεία'
      };

    case 'service':
      return {
        getSections: getServiceSortedSections,
        renderer: ServiceFormTabRenderer as unknown as FormTabRendererComponent,
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
 * 🎭 Get appropriate renderer for contact type
 */
export function getContactFormRenderer(contactType: ContactType) {
  const config = getContactFormConfig(contactType);
  return config.renderer;
}
