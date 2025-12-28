/**
 * 🏢 ENTERPRISE COMMUNICATION OPERATIONS HOOK
 *
 * @fileoverview Production-grade CRUD operations hook for communication management
 * @version 1.0.0
 * @since 2025-12-28
 *
 * Extracted from UniversalCommunicationManager.tsx (Lines 79-144)
 * Upgraded to enterprise standards with comprehensive business logic
 * validation and type safety.
 *
 * @enterprise Following FAANG/Microsoft enterprise patterns:
 * - ✅ Single Responsibility Principle (SRP)
 * - ✅ Type-safe business operations
 * - ✅ Immutable state updates
 * - ✅ Performance optimized with useCallback
 * - ✅ Comprehensive JSDoc documentation
 * - ✅ Business rule validation
 */

import { useCallback } from 'react';
import type {
  CommunicationItem,
  CommunicationConfig,
  CommunicationFieldValue
} from '../communication/types';
import { generateSocialUrl } from '../communication/utils';

/**
 * Hook parameters for communication operations
 */
export interface UseCommunicationOperationsParams {
  /** Current communication items array */
  readonly items: CommunicationItem[];
  /** Communication configuration object */
  readonly config: CommunicationConfig;
  /** Callback function for state changes */
  readonly onChange: (items: CommunicationItem[]) => void;
}

/**
 * Return type for useCommunicationOperations hook
 */
export interface CommunicationOperations {
  /** Add new communication item with type-specific defaults */
  readonly addItem: () => void;
  /** Update specific field of communication item */
  readonly updateItem: (index: number, field: string, value: CommunicationFieldValue) => void;
  /** Remove communication item with primary reassignment logic */
  readonly removeItem: (index: number) => void;
  /** Set communication item as primary (for phones & emails) */
  readonly setPrimary: (index: number) => void;
}

/**
 * 🏢 ENTERPRISE: Production-grade CRUD operations hook for communication management
 *
 * Provides type-safe, performance-optimized business operations for managing
 * communication items with automatic primary assignment and social URL generation.
 *
 * @param params - Hook configuration parameters
 * @returns CommunicationOperations - Complete CRUD operations interface
 *
 * @example
 * ```tsx
 * const { addItem, updateItem, removeItem, setPrimary } = useCommunicationOperations({
 *   items,
 *   config,
 *   onChange
 * });
 *
 * // Add new phone number
 * addItem();
 *
 * // Update phone number
 * updateItem(0, 'number', '+30 210 1234567');
 *
 * // Set as primary
 * setPrimary(0);
 *
 * // Remove item
 * removeItem(0);
 * ```
 */
export function useCommunicationOperations({
  items,
  config,
  onChange
}: UseCommunicationOperationsParams): CommunicationOperations {

  /**
   * 🏢 ENTERPRISE: Add new communication item with type-specific defaults
   *
   * Creates new communication item with intelligent defaults based on
   * communication type and configuration settings.
   */
  const addItem = useCallback(() => {
    const newItem: CommunicationItem = {
      type: config.defaultType,
      label: '',
      // 🎯 BUSINESS LOGIC: Auto-assign primary if first item and supports primary
      ...(config.supportsPrimary && { isPrimary: items.length === 0 }),

      // 🎯 TYPE-SPECIFIC DEFAULTS: Intelligent defaults per communication type
      ...(config.type === 'phone' && {
        number: '',
        countryCode: '+30' // Default to Greece country code
      }),
      ...(config.type === 'email' && {
        email: ''
      }),
      ...(config.type === 'website' && {
        url: ''
      }),
      ...(config.type === 'social' && {
        username: '',
        url: '',
        // 🎯 SMART DEFAULT: Use first available platform or LinkedIn fallback
        platform: config.platformTypes?.[0]?.value || 'linkedin'
      })
    };

    // 🏢 IMMUTABLE UPDATE: Create new array instead of mutating
    onChange([...items, newItem]);
  }, [items, config, onChange]);

  /**
   * 🏢 ENTERPRISE: Update communication item field with business logic validation
   *
   * Updates specific field of communication item with automatic URL generation
   * for social media and type-safe field validation.
   *
   * @param index - Zero-based index of item to update
   * @param field - Field name to update
   * @param value - New field value (type-safe)
   */
  const updateItem = useCallback((index: number, field: string, value: CommunicationFieldValue) => {
    // 🎯 PERFORMANCE: Early return for invalid index
    if (index < 0 || index >= items.length) {
      console.warn(`Invalid item index: ${index}. Valid range: 0-${items.length - 1}`);
      return;
    }

    const updated = items.map((item, i) => {
      if (i !== index) return item;

      const updatedItem = { ...item, [field]: value };

      // 🎯 BUSINESS LOGIC: Auto-generate URL for social media platforms
      if (config.type === 'social' && (field === 'username' || field === 'platform')) {
        const username = field === 'username' ? value : item.username;
        const platform = field === 'platform' ? value : (item.platform || item.type);

        // 🔒 VALIDATION: Only generate URL if both username and platform exist
        if (username && platform) {
          updatedItem.url = generateSocialUrl(String(platform), String(username));
        }
      }

      return updatedItem;
    });

    // 🏢 IMMUTABLE UPDATE: Replace entire array
    onChange(updated);
  }, [items, config.type, onChange]);

  /**
   * 🏢 ENTERPRISE: Remove communication item with primary reassignment logic
   *
   * Removes communication item and automatically reassigns primary status
   * to first remaining item if removed item was primary.
   *
   * @param index - Zero-based index of item to remove
   */
  const removeItem = useCallback((index: number) => {
    // 🎯 PERFORMANCE: Early return for invalid index
    if (index < 0 || index >= items.length) {
      console.warn(`Invalid item index: ${index}. Valid range: 0-${items.length - 1}`);
      return;
    }

    // 🏢 IMMUTABLE UPDATE: Filter out item at index
    const updated = items.filter((_, i) => i !== index);

    // 🎯 BUSINESS LOGIC: Handle primary reassignment for supportsPrimary types
    if (config.supportsPrimary && items[index]?.isPrimary && updated.length > 0) {
      // 🔒 SAFETY: Ensure first item exists before updating
      updated[0] = { ...updated[0], isPrimary: true };
    }

    onChange(updated);
  }, [items, config.supportsPrimary, onChange]);

  /**
   * 🏢 ENTERPRISE: Set communication item as primary
   *
   * Sets specified item as primary and removes primary status from all others.
   * Only operates on communication types that support primary designation.
   *
   * @param index - Zero-based index of item to set as primary
   */
  const setPrimary = useCallback((index: number) => {
    // 🔒 BUSINESS RULE: Only operate if config supports primary
    if (!config.supportsPrimary) {
      console.warn('setPrimary called on configuration that does not support primary items');
      return;
    }

    // 🎯 PERFORMANCE: Early return for invalid index
    if (index < 0 || index >= items.length) {
      console.warn(`Invalid item index: ${index}. Valid range: 0-${items.length - 1}`);
      return;
    }

    // 🏢 IMMUTABLE UPDATE: Update all items with new primary status
    const updated = items.map((item, i) => ({
      ...item,
      isPrimary: i === index
    }));

    onChange(updated);
  }, [items, config.supportsPrimary, onChange]);

  // 🏢 ENTERPRISE: Return type-safe operations interface
  return {
    addItem,
    updateItem,
    removeItem,
    setPrimary
  } as const;
}