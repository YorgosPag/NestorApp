'use client';

import React from 'react';
import { INTERACTIVE_PATTERNS } from '../effects';
import { useTranslation } from '@/i18n/hooks/useTranslation';

// ✅ ENTERPRISE: Single translation hook για όλα τα components
// 🔧 FIX (2026-02-02): Must specify 'toolbars' namespace to load translations!
export const useActionTranslations = () => {
  const { t } = useTranslation('toolbars');
  return {
    save: t('common-actions:actions.save'),
    save_loading: t('common-actions:actions.save_loading'),
    cancel: t('common-actions:actions.cancel'),
    delete: t('common-actions:actions.delete'),
    delete_loading: t('common-actions:actions.delete_loading'),
    add: t('common-actions:actions.add'),
    edit: t('common-actions:actions.edit'),
    archive: t('common-actions:actions.archive'),
    archive_loading: t('common-actions:actions.archive_loading'),
    restore: t('common-actions:actions.restore'),
    restore_loading: t('common-actions:actions.restore_loading'),
    call: t('contacts.actions.call'),
    email: t('contacts.actions.email'),
    sms: t('common-actions:actions.sms'),
    export: t('common-actions:actions.export'),
    import: t('common-actions:actions.import'),
    help: t('common-actions:actions.help'),
    refresh: t('common-actions:actions.refresh'),
    sort: t('common-actions:actions.sort'),
    favorites: t('common-actions:actions.favorites'),
    archived: t('common-actions:actions.archived')
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
    //
    // ⚠️ INK, NOT SURFACE (ADR-759 §4.12.2 — measured 2026-08-07).
    // Every entry below MUST use a purpose-named *text* token
    // (`--text-success` / `--text-warning` / `--text-info`), never `--primary`.
    // `--primary` is a *surface* colour: in the default (dark) theme it resolves
    // to `217 33% 17%` — byte-identical to `--card` — so `text-primary` renders
    // at 1.00:1 there, i.e. invisible, on all 23 surface tokens (worst 1.48:1).
    // `--text-info` was measured on the same 23 surfaces: 0 failures, worst
    // 3.90:1 — strictly better than `--text-success`/`--text-warning`, which
    // this map already trusts.
    call: `${BUTTON_CATEGORIES.utility} text-[hsl(var(--text-success))]`,
    // Deliberately NOT named `archive`: that key is already taken above by a
    // different composition (`BUTTON_CATEGORIES.warning`, used by
    // ActionButtons.tsx). This is the *utility-flavoured* archive shared by
    // ToolbarArchiveButton and ToolbarArchivedFilterButton, both of which
    // hand-rolled this exact string — and both lost the same space.
    archiveUtility: `${BUTTON_CATEGORIES.utility} text-[hsl(var(--text-warning))]`,
    email: `${BUTTON_CATEGORIES.utility} text-[hsl(var(--text-info))]`,
    sms: `${BUTTON_CATEGORIES.utility} text-[hsl(var(--text-info))]`,
    export: `${BUTTON_CATEGORIES.utility} text-[hsl(var(--text-success))]`,
    import: `${BUTTON_CATEGORIES.utility} text-[hsl(var(--text-warning))]`,
    help: `${BUTTON_CATEGORIES.utility} text-[hsl(var(--text-info))]`,
    // `refresh` was missing from this map, so ToolbarRefreshButton hand-rolled
    // the same string inline — and the hand-rolled copy lost a space
    // (`text-primaryflex`), silently killing both the colour and the flex
    // layout. The gap in the map *was* the bug; the typo was its symptom.
    refresh: `${BUTTON_CATEGORIES.utility} text-[hsl(var(--text-info))]`,
    sort: `${BUTTON_CATEGORIES.utility} text-[hsl(var(--text-info))]`,
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
  /**
   * HTML `form` attribute — associates a submit button with a form by id
   * when the button lives OUTSIDE the `<form>` tag (e.g. in a header
   * toolbar). Native browser behaviour, no JS required.
   */
  form?: string;
}

export interface FilterButtonProps extends BaseButtonProps {
  active?: boolean;
}
