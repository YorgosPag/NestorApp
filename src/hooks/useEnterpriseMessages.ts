// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
/**
 * ============================================================================
 * 🪝 REACT HOOK ΓΙΑ ENTERPRISE MESSAGES SYSTEM
 * ============================================================================
 *
 * PROFESSIONAL REACT INTEGRATION ΓΙΑ CENTRALIZED MESSAGES
 *
 * 🏢 ENTERPRISE: Now uses i18n system instead of hardcoded strings!
 *
 * Features:
 * - Type-safe message access
 * - Performance optimized με useMemo
 * - Consistent API για όλα τα components
 * - Zero re-renders με proper caching
 * - Enterprise-grade patterns
 * - Full i18n support (multi-language)
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
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from 'react-i18next';
// Legacy imports kept for type compatibility

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
    readonly parking: { title: string; description: string };
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
  readonly getEmptyStateFor: (entityType: 'contact' | 'project' | 'building' | 'storage' | 'parking' | 'property' | 'generic') => { title: string; description: string };
  readonly getActionButton: (action: 'save' | 'cancel' | 'delete' | 'edit' | 'create' | 'close' | 'confirm' | 'back' | 'next' | 'finish') => string;
}

// ============================================================================
// 🪝 MAIN HOOK - ENTERPRISE MESSAGES ACCESS
// ============================================================================

/**
 * Enterprise Messages Hook
 *
 * 🏢 ENTERPRISE: Now uses i18n system for multi-language support!
 * Παρέχει type-safe access σε όλα τα centralized messages
 * με optimized performance και consistent API
 */
export function useEnterpriseMessages(): UseEnterpriseMessagesReturn {
  const { t } = useTranslation('common');

  // ============================================================================
  // 🚀 MEMOIZED MESSAGE ACCESS - i18n ENABLED
  // ============================================================================

  return useMemo(() => {
    return {
      // 🏠 Empty States - i18n enabled
      emptyState: {
        contact: {
          title: t('emptyState.contact.title'),
          description: t('emptyState.contact.description'),
        },
        project: {
          title: t('emptyState.project.title'),
          description: t('emptyState.project.description'),
        },
        building: {
          title: t('emptyState.building.title'),
          description: t('emptyState.building.description'),
        },
        storage: {
          title: t('emptyState.storage.title'),
          description: t('emptyState.storage.description'),
        },
        unit: {
          title: t('emptyState.unit.title'),
          description: t('emptyState.unit.description'),
        },
        parking: {
          title: t('emptyState.parking.title'),
          description: t('emptyState.parking.description'),
        },
        property: {
          title: t('emptyState.property.title'),
          description: t('emptyState.property.description'),
        },
        generic: {
          title: t('emptyState.generic.title'),
          description: t('emptyState.generic.description'),
        },
      },

      // 🔘 Actions - i18n enabled
      action: {
        save: t('actions.save'),
        cancel: t('actions.cancel'),
        delete: t('actions.delete'),
        edit: t('actions.edit'),
        create: t('actions.create'),
        close: t('actions.close'),
        confirm: t('actions.confirm'),
        back: t('actions.back'),
        next: t('actions.next'),
        finish: t('actions.finish'),
      },

      // ✅ Validation - i18n enabled with functions
      validation: {
        required: t('validationMessages.required'),
        email: t('validationMessages.email'),
        phone: t('validationMessages.phone'),
        url: t('validationMessages.url'),
        date: t('validationMessages.date'),
        number: t('validationMessages.number'),
        minLength: (min: number) => t('validationMessages.minLength', { min }),
        maxLength: (max: number) => t('validationMessages.maxLength', { max }),
        fileSize: (max: string) => t('validationMessages.fileSize', { max }),
      },

      // 🔄 Loading - i18n enabled
      loading: {
        generic: t('loadingStates.generic'),
        saving: t('loadingStates.saving'),
        loading: t('loadingStates.loading'),
        deleting: t('loadingStates.deleting'),
        uploading: t('loadingStates.uploading'),
      },

      // 📝 Confirmations - i18n enabled
      confirmation: {
        delete: t('confirmations.delete'),
        discard: t('confirmations.discard'),
        overwrite: t('confirmations.overwrite'),
        logout: t('confirmations.logout'),
      },

      // 🧭 Navigation - i18n enabled
      navigation: {
        breadcrumbs: {
          home: t('navigation.home'),
          contacts: t('navigation.contacts', { defaultValue: 'Επαφές' }),
          projects: t('navigation.projects', { defaultValue: 'Έργα' }),
          buildings: t('navigation.buildings', { defaultValue: 'Κτίρια' }),
          units: t('navigation.units', { defaultValue: 'Μονάδες' }),
          storages: t('navigation.storages', { defaultValue: 'Αποθήκες' }),
          details: t('navigation.details', { defaultValue: 'Λεπτομέρειες' }),
        },
        menu: {
          dashboard: t('headerActions.dashboard'),
          settings: t('userMenu.settings'),
          help: t('userMenu.help'),
          profile: t('userMenu.profile'),
          logout: t('userMenu.logout'),
        },
      },

      // 📊 Status - i18n enabled
      status: {
        states: {
          active: t('filters.status.active'),
          inactive: t('filters.status.inactive'),
          pending: t('filters.status.pending'),
          completed: t('filters.status.completed'),
          cancelled: t('status.completed', { defaultValue: 'Ακυρωμένο' }),
          draft: t('documentStatus.draft'),
        },
        notifications: {
          success: t('toast.success'),
          error: t('toast.error'),
          warning: t('toast.warning'),
          info: t('toast.info'),
        },
      },

      // 🔧 Utility Methods - i18n enabled helpers
      getEmptyStateFor: (entityType) => ({
        title: t(`emptyState.${entityType}.title`),
        description: t(`emptyState.${entityType}.description`),
      }),

      getActionButton: (action) => {
        const buttonKeys: Record<string, string> = {
          save: 'actions.save',
          cancel: 'actions.cancel',
          delete: 'actions.delete',
          edit: 'actions.edit',
          create: 'actions.create',
          close: 'actions.close',
          confirm: 'actions.confirm',
          back: 'actions.back',
          next: 'actions.next',
          finish: 'actions.finish',
        };
        return t(buttonKeys[action] || `actions.${action}`);
      },

    } as const;
  }, [t]); // Dependency on t function for language changes
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
    parking: messages.emptyState.parking,
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