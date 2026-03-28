'use client';

import React from 'react';
import { INTERACTIVE_PATTERNS } from '../effects';
import { useTranslation } from '@/i18n/hooks/useTranslation';

// ✅ ENTERPRISE: Single translation hook για όλα τα components
// 🔧 FIX (2026-02-02): Must specify 'toolbars' namespace to load translations!
export const useActionTranslations = () => {
  const { t } = useTranslation('toolbars');
  return {
    save: t('common.actions.save'),
    save_loading: t('common.actions.save_loading'),
    cancel: t('common.actions.cancel'),
    delete: t('common.actions.delete'),
    delete_loading: t('common.actions.delete_loading'),
    add: t('common.actions.add'),
    edit: t('common.actions.edit'),
    archive: t('common.actions.archive'),
    archive_loading: t('common.actions.archive_loading'),
    restore: t('common.actions.restore'),
    restore_loading: t('common.actions.restore_loading'),
    call: t('contacts.actions.call'),
    email: t('contacts.actions.email'),
    sms: t('common.actions.sms'),
    export: t('common.actions.export'),
    import: t('common.actions.import'),
    help: t('common.actions.help'),
    refresh: t('common.actions.refresh'),
    sort: t('common.sort.sort'),
    favorites: t('common.actions.favorites'),
    archived: t('common.actions.archived')
  };
};

// Enterprise Button Categorization - Global Design System Standards
// Based on Google Material Design, Microsoft Fluent, Apple HIG, Bootstrap 5
// Typography: Label Large (14px, medium) as per Material Design button specs
export const BUTTON_CATEGORIES = {
  // 🔵 PRIMARY ACTIONS (Blue #0d6efd) - Main user actions
  primary: `${INTERACTIVE_PATTERNS.PRIMARY_HOVER} text-sm font-medium`,

  // 🟢 SUCCESS/POSITIVE (Green #198754) - Successful completion, save actions
  success: `${INTERACTIVE_PATTERNS.SUCCESS_HOVER} text-sm font-medium`,

  // 🔴 DANGER/DESTRUCTIVE (Red #dc3545) - Permanent destructive actions
  danger: `${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER} text-sm font-medium`,

  // 🟡 WARNING/CAUTION (Orange/Yellow #ffc107) - Reversible destructive actions
  warning: `${INTERACTIVE_PATTERNS.SUBTLE_HOVER} text-sm font-medium`,

  // ⚪ SECONDARY/NEUTRAL (Gray #6c757d) - Secondary, optional actions
  secondary: `${INTERACTIVE_PATTERNS.SUBTLE_HOVER} text-sm font-medium`,

  // 🌑 UTILITY/PASSIVE (Dark Gray #374151) - Tools, communication, management
  utility: `${INTERACTIVE_PATTERNS.ACCENT_HOVER} text-sm font-medium`
} as const;

// Legacy button styles with enterprise categorization mapping
export const BUTTON_STYLES = {
  variants: {
    // Primary Actions (Blue)
    add: BUTTON_CATEGORIES.primary,

    // Success Actions (Green)
    save: BUTTON_CATEGORIES.success,

    // Danger Actions (Red)
    delete: BUTTON_CATEGORIES.danger,

    // Warning Actions (Orange)
    archive: BUTTON_CATEGORIES.warning,
    edit: BUTTON_CATEGORIES.warning,

    // Secondary Actions (Gray)
    cancel: BUTTON_CATEGORIES.secondary,
    restore: BUTTON_CATEGORIES.secondary,

    // Utility Actions (Dark with colored text for differentiation)
    call: `${BUTTON_CATEGORIES.utility} text-green-400`,
    email: `${BUTTON_CATEGORIES.utility} text-blue-400`,
    sms: `${BUTTON_CATEGORIES.utility} text-purple-400`,
    export: `${BUTTON_CATEGORIES.utility} text-emerald-400`,
    import: `${BUTTON_CATEGORIES.utility} text-orange-400`,
    help: `${BUTTON_CATEGORIES.utility} text-cyan-400`,
    sort: `${BUTTON_CATEGORIES.utility} text-indigo-400`,
  }
} as const;

export interface BaseButtonProps {
  children?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'default' | 'outline' | 'destructive' | 'ghost';
  badge?: number;
}

export interface FilterButtonProps extends BaseButtonProps {
  active?: boolean;
}
