/**
 * ============================================================================
 * 🪝 REACT HOOK ΓΙΑ ENTERPRISE MESSAGES SYSTEM
 * ============================================================================
 *
 * PROFESSIONAL REACT INTEGRATION ΓΙΑ CENTRALIZED MESSAGES
 *
 * Features:
 * - Type-safe message access
 * - Performance optimized με useMemo
 * - Consistent API για όλα τα components
 * - Zero re-renders με proper caching
 * - Enterprise-grade patterns
 *
 * Usage Example:
 * ```tsx
 * function ContactDetails() {
 *   const messages = useEnterpriseMessages();
 *
 *   return (
 *     <DetailsContainer
 *       emptyStateProps={{
 *         icon: Users,
 *         title: messages.emptyState.contact.title,
 *         description: messages.emptyState.contact.description
 *       }}
 *     />
 *   );
 * }
 * ```
 *
 * ============================================================================
 */

import { useMemo } from 'react';
import { getMessagesManager, Messages, type EnterpriseMessages } from '@/core/configuration/enterprise-messages-system';

// ============================================================================
// 🎯 HOOK INTERFACE - TYPE-SAFE RETURNS
// ============================================================================

/**
 * Return type για useEnterpriseMessages hook
 */
export interface UseEnterpriseMessagesReturn {
  // 🏠 Empty States - Direct access με type safety
  readonly emptyState: {
    readonly contact: { title: string; description: string };
    readonly project: { title: string; description: string };
    readonly building: { title: string; description: string };
    readonly storage: { title: string; description: string };
    readonly unit: { title: string; description: string };
    readonly property: { title: string; description: string };
    readonly generic: { title: string; description: string };
  };

  // 🔘 Action Buttons - Direct access
  readonly action: {
    readonly save: string;
    readonly cancel: string;
    readonly delete: string;
    readonly edit: string;
    readonly create: string;
    readonly close: string;
    readonly confirm: string;
    readonly back: string;
    readonly next: string;
    readonly finish: string;
  };

  // ✅ Validation Messages - Direct access με functions
  readonly validation: {
    readonly required: string;
    readonly email: string;
    readonly phone: string;
    readonly url: string;
    readonly date: string;
    readonly number: string;
    readonly minLength: (min: number) => string;
    readonly maxLength: (max: number) => string;
    readonly fileSize: (max: string) => string;
  };

  // 🔄 Loading States - Direct access
  readonly loading: {
    readonly generic: string;
    readonly saving: string;
    readonly loading: string;
    readonly deleting: string;
    readonly uploading: string;
  };

  // 📝 Confirmations - Direct access
  readonly confirmation: {
    readonly delete: string;
    readonly discard: string;
    readonly overwrite: string;
    readonly logout: string;
  };

  // 🧭 Navigation - Direct access
  readonly navigation: {
    readonly breadcrumbs: {
      readonly home: string;
      readonly contacts: string;
      readonly projects: string;
      readonly buildings: string;
      readonly units: string;
      readonly storages: string;
      readonly details: string;
    };
    readonly menu: {
      readonly dashboard: string;
      readonly settings: string;
      readonly help: string;
      readonly profile: string;
      readonly logout: string;
    };
  };

  // 📊 Status - Direct access
  readonly status: {
    readonly states: {
      readonly active: string;
      readonly inactive: string;
      readonly pending: string;
      readonly completed: string;
      readonly cancelled: string;
      readonly draft: string;
    };
    readonly notifications: {
      readonly success: string;
      readonly error: string;
      readonly warning: string;
      readonly info: string;
    };
  };

  // 🔧 Utility methods
  readonly getEmptyStateFor: (entityType: 'contact' | 'project' | 'building' | 'storage' | 'unit' | 'property' | 'generic') => { title: string; description: string };
  readonly getActionButton: (action: 'save' | 'cancel' | 'delete' | 'edit' | 'create' | 'close' | 'confirm' | 'back' | 'next' | 'finish') => string;
}

// ============================================================================
// 🪝 MAIN HOOK - ENTERPRISE MESSAGES ACCESS
// ============================================================================

/**
 * Enterprise Messages Hook
 *
 * Παρέχει type-safe access σε όλα τα centralized messages
 * με optimized performance και consistent API
 */
export function useEnterpriseMessages(): UseEnterpriseMessagesReturn {
  const messagesManager = getMessagesManager();

  // ============================================================================
  // 🚀 MEMOIZED MESSAGE ACCESS - PERFORMANCE OPTIMIZED
  // ============================================================================

  return useMemo(() => {
    const allMessages = messagesManager.getAllMessages();

    return {
      // 🏠 Empty States - Pre-computed για performance
      emptyState: {
        contact: allMessages.emptyStates.contact,
        project: allMessages.emptyStates.project,
        building: allMessages.emptyStates.building,
        storage: allMessages.emptyStates.storage,
        unit: allMessages.emptyStates.unit,
        property: allMessages.emptyStates.property,
        generic: allMessages.emptyStates.generic,
      },

      // 🔘 Actions - Pre-computed
      action: {
        save: allMessages.actions.buttons.save,
        cancel: allMessages.actions.buttons.cancel,
        delete: allMessages.actions.buttons.delete,
        edit: allMessages.actions.buttons.edit,
        create: allMessages.actions.buttons.create,
        close: allMessages.actions.buttons.close,
        confirm: allMessages.actions.buttons.confirm,
        back: allMessages.actions.buttons.back,
        next: allMessages.actions.buttons.next,
        finish: allMessages.actions.buttons.finish,
      },

      // ✅ Validation - Mixed static και functions
      validation: {
        required: allMessages.validation.required,
        email: allMessages.validation.invalid.email,
        phone: allMessages.validation.invalid.phone,
        url: allMessages.validation.invalid.url,
        date: allMessages.validation.invalid.date,
        number: allMessages.validation.invalid.number,
        minLength: allMessages.validation.limits.minLength,
        maxLength: allMessages.validation.limits.maxLength,
        fileSize: allMessages.validation.limits.fileSize,
      },

      // 🔄 Loading - Pre-computed
      loading: {
        generic: allMessages.actions.loading.generic,
        saving: allMessages.actions.loading.saving,
        loading: allMessages.actions.loading.loading,
        deleting: allMessages.actions.loading.deleting,
        uploading: allMessages.actions.loading.uploading,
      },

      // 📝 Confirmations - Pre-computed
      confirmation: {
        delete: allMessages.actions.confirmations.delete,
        discard: allMessages.actions.confirmations.discard,
        overwrite: allMessages.actions.confirmations.overwrite,
        logout: allMessages.actions.confirmations.logout,
      },

      // 🧭 Navigation - Pre-computed structure
      navigation: {
        breadcrumbs: {
          home: allMessages.navigation.breadcrumbs.home,
          contacts: allMessages.navigation.breadcrumbs.contacts,
          projects: allMessages.navigation.breadcrumbs.projects,
          buildings: allMessages.navigation.breadcrumbs.buildings,
          units: allMessages.navigation.breadcrumbs.units,
          storages: allMessages.navigation.breadcrumbs.storages,
          details: allMessages.navigation.breadcrumbs.details,
        },
        menu: {
          dashboard: allMessages.navigation.menu.dashboard,
          settings: allMessages.navigation.menu.settings,
          help: allMessages.navigation.menu.help,
          profile: allMessages.navigation.menu.profile,
          logout: allMessages.navigation.menu.logout,
        },
      },

      // 📊 Status - Pre-computed structure
      status: {
        states: {
          active: allMessages.status.states.active,
          inactive: allMessages.status.states.inactive,
          pending: allMessages.status.states.pending,
          completed: allMessages.status.states.completed,
          cancelled: allMessages.status.states.cancelled,
          draft: allMessages.status.states.draft,
        },
        notifications: {
          success: allMessages.status.notifications.success,
          error: allMessages.status.notifications.error,
          warning: allMessages.status.notifications.warning,
          info: allMessages.status.notifications.info,
        },
      },

      // 🔧 Utility Methods - Type-safe helpers
      getEmptyStateFor: (entityType) => {
        return allMessages.emptyStates[entityType];
      },

      getActionButton: (action) => {
        return allMessages.actions.buttons[action];
      },

    } as const;
  }, [messagesManager]); // Dependency μόνο ο manager (σταθερός)
}

// ============================================================================
// 🎯 SPECIALIZED HOOKS - SPECIFIC USE CASES
// ============================================================================

/**
 * Hook για empty states μόνο - Lightweight
 */
export function useEmptyStateMessages() {
  const messages = useEnterpriseMessages();

  return useMemo(() => ({
    contact: messages.emptyState.contact,
    project: messages.emptyState.project,
    building: messages.emptyState.building,
    storage: messages.emptyState.storage,
    unit: messages.emptyState.unit,
    property: messages.emptyState.property,
    generic: messages.emptyState.generic,
    getFor: messages.getEmptyStateFor,
  }), [messages.emptyState, messages.getEmptyStateFor]);
}

/**
 * Hook για action buttons μόνο - Lightweight
 */
export function useActionMessages() {
  const messages = useEnterpriseMessages();

  return useMemo(() => ({
    ...messages.action,
    confirmation: messages.confirmation,
    loading: messages.loading,
    getButton: messages.getActionButton,
  }), [messages.action, messages.confirmation, messages.loading, messages.getActionButton]);
}

/**
 * Hook για validation μόνο - Lightweight
 */
export function useValidationMessages() {
  const messages = useEnterpriseMessages();

  return useMemo(() => ({
    ...messages.validation,
  }), [messages.validation]);
}

// ============================================================================
// 🔗 CONVENIENCE EXPORTS - EASY IMPORTS
// ============================================================================

/**
 * Default export για main hook
 */
export default useEnterpriseMessages;

/**
 * Quick access pattern
 */
export {
  useEnterpriseMessages as useMessages,
  useEmptyStateMessages as useEmptyStates,
  useActionMessages as useActions,
  useValidationMessages as useValidation,
};