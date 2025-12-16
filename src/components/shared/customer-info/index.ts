/**
 * 🚀 UNIFIED CUSTOMER INFO SYSTEM - MAIN EXPORTS
 *
 * Κεντρικοποιημένο customer information system
 * Enterprise-class exports για clean imports σε όλη την εφαρμογή
 *
 * @created 2025-12-14
 * @author Claude AI Assistant
 * @version 1.0.0
 */

// ============================================================================
// MAIN COMPONENTS
// ============================================================================

export { UnifiedCustomerCard } from './components/UnifiedCustomerCard';
export { CustomerInfoCompact } from './components/CustomerInfoCompact';
export { CustomerActionButtons } from './components/CustomerActionButtons';
export { UnitCustomerDisplay } from './components/UnitCustomerDisplay';

// ============================================================================
// HOOKS
// ============================================================================

export {
  useCustomerInfo,
  useMultipleCustomerInfo,
  customerInfoCache
} from './hooks/useCustomerInfo';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type {
  // Core Types
  CustomerBasicInfo,
  CustomerExtendedInfo,
  CustomerInfoContext,
  CustomerInfoVariant,
  CustomerInfoSize,

  // Action Types
  CustomerActionType,
  CustomerAction,

  // Component Props
  CustomerInfoBaseProps,
  UnifiedCustomerCardProps,
  CustomerInfoCompactProps,
  CustomerActionButtonsProps,

  // Hook Types
  UseCustomerInfoReturn,
  UseCustomerInfoConfig,

  // Utility Types
  ContextualData,
  CustomerInfoStyling
} from './types/CustomerInfoTypes';

// ============================================================================
// CONSTANTS & CONFIGURATIONS
// ============================================================================

export {
  DEFAULT_CONTEXT_ACTIONS,
  DEFAULT_CONTEXT_VARIANT
} from './types/CustomerInfoTypes';

// ============================================================================
// CONVENIENCE ALIASES
// ============================================================================

/**
 * Main component alias για πιο clean imports
 */
export { UnifiedCustomerCard as CustomerCard } from './components/UnifiedCustomerCard';

/**
 * Compact component alias
 */
export { CustomerInfoCompact as CustomerCompact } from './components/CustomerInfoCompact';

/**
 * Actions component alias
 */
export { CustomerActionButtons as CustomerActions } from './components/CustomerActionButtons';

/**
 * Hook alias για shorter imports
 */
export { useCustomerInfo as useCustomer } from './hooks/useCustomerInfo';

// ============================================================================
// DEFAULT EXPORT - BUILDER PATTERN (Optional)
// ============================================================================

/**
 * Builder pattern για programmatic customer info creation
 * Useful για complex configurations
 *
 * @example
 * ```typescript
 * import CustomerInfoBuilder from '@/components/shared/customer-info';
 *
 * const customerCard = CustomerInfoBuilder
 *   .forContext('unit')
 *   .withActions(['view', 'call', 'email'])
 *   .withSize('md')
 *   .compact(true)
 *   .build();
 * ```
 */
export class CustomerInfoBuilder {
  private config: Partial<UnifiedCustomerCardProps> = {};

  static forContext(context: CustomerInfoContext): CustomerInfoBuilder {
    const builder = new CustomerInfoBuilder();
    builder.config.context = context;
    return builder;
  }

  withContactId(contactId: string): CustomerInfoBuilder {
    this.config.contactId = contactId;
    return this;
  }

  withVariant(variant: CustomerInfoVariant): CustomerInfoBuilder {
    this.config.variant = variant;
    return this;
  }

  withSize(size: CustomerInfoSize): CustomerInfoBuilder {
    this.config.size = size;
    return this;
  }

  withActions(actions: CustomerActionType[]): CustomerInfoBuilder {
    this.config.customActions = actions.map(type => ({
      type,
      label: type,
      icon: (() => {
        switch (type) {
          case 'view': return require('lucide-react').Eye;
          case 'call': return require('lucide-react').Phone;
          case 'email': return require('lucide-react').Mail;
          default: return require('lucide-react').ArrowRight;
        }
      })(),
      onClick: () => console.log(`Action: ${type}`)
    }));
    return this;
  }

  compact(isCompact: boolean = true): CustomerInfoBuilder {
    this.config.compact = isCompact;
    return this;
  }

  showUnitsCount(show: boolean = true): CustomerInfoBuilder {
    this.config.showUnitsCount = show;
    return this;
  }

  showTotalValue(show: boolean = true): CustomerInfoBuilder {
    this.config.showTotalValue = show;
    return this;
  }

  withClassName(className: string): CustomerInfoBuilder {
    this.config.className = className;
    return this;
  }

  onClick(handler: () => void): CustomerInfoBuilder {
    this.config.onClick = handler;
    return this;
  }

  build(): Partial<UnifiedCustomerCardProps> {
    return { ...this.config };
  }
}

// Default export
export default CustomerInfoBuilder;

// ============================================================================
// RE-EXPORTS για DEPENDENCY INJECTION
// ============================================================================

/**
 * Re-export helper functions που χρησιμοποιούνται από το system
 * Αυτό επιτρέπει dependency injection και testing
 */
export { getContactDisplayName, getPrimaryPhone } from '@/types/contacts/helpers';

// ============================================================================
// VERSION & METADATA
// ============================================================================

export const CUSTOMER_INFO_SYSTEM_VERSION = '1.0.0';
export const CUSTOMER_INFO_SYSTEM_CREATED = '2025-12-14';
export const CUSTOMER_INFO_SYSTEM_AUTHOR = 'Claude AI Assistant';

/**
 * System metadata για debugging και monitoring
 */
export const CustomerInfoSystemMeta = {
  version: CUSTOMER_INFO_SYSTEM_VERSION,
  created: CUSTOMER_INFO_SYSTEM_CREATED,
  author: CUSTOMER_INFO_SYSTEM_AUTHOR,
  components: [
    'UnifiedCustomerCard',
    'CustomerInfoCompact',
    'CustomerActionButtons'
  ],
  hooks: [
    'useCustomerInfo',
    'useMultipleCustomerInfo'
  ],
  features: [
    'Enterprise caching',
    'Context-aware actions',
    'Responsive design',
    'Accessibility compliant',
    'Error handling',
    'Loading states',
    'Type-safe',
    'Centralized styling'
  ]
} as const;

// ============================================================================
// DOCUMENTATION LINKS
// ============================================================================

/**
 * Documentation και usage examples
 *
 * @see /docs/components/customer-info.md - Full documentation
 * @see /docs/examples/customer-info-usage.tsx - Usage examples
 * @see /docs/migration/from-customer-link-button.md - Migration guide
 *
 * Quick Start:
 * ```typescript
 * import { UnifiedCustomerCard } from '@/components/shared/customer-info';
 *
 * <UnifiedCustomerCard
 *   contactId="sample-contact-id"
 *   context="unit"
 *   variant="card"
 *   showUnitsCount={true}
 *   onClick={() => console.log('Clicked!')}
 * />
 * ```
 */