// Export the configured i18n instance
export { default as i18n } from './config';

// Export hooks and utilities
export { useTranslation } from './hooks/useTranslation';

// Re-export react-i18next components for convenience
export { Trans, Translation } from 'react-i18next';

// Export TypeScript types for type safety
export type {
  TranslationNamespace,
  TranslationKeys,
  TFunction,
  CommonKeys,
  AuthKeys,
  NavigationKeys,
  DashboardKeys,
  CrmKeys,
  PropertiesKeys,
  FormsKeys
} from '@/types/i18n';