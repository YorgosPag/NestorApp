'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { CommonBadge } from '@/core/badges';
import { Save, X, Trash2, Plus, Edit, Archive, RotateCcw, Phone, Mail, MessageSquare, Download, Upload, HelpCircle, Star, RefreshCw, ArrowUpAZ, ArrowDownZA } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { INTERACTIVE_PATTERNS } from '../effects';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE CENTRALIZED IMPORTS - ZERO HARDCODED VALUES
import { useTranslation } from '@/i18n/hooks/useTranslation';

// ✅ ENTERPRISE: Single translation hook για όλα τα components
// 🔧 FIX (2026-02-02): Must specify 'toolbars' namespace to load translations!
const useActionTranslations = () => {
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
    edit: BUTTON_CATEGORIES.warning, // Edit can be warning as it modifies data

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

interface BaseButtonProps {
  children?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'default' | 'outline' | 'destructive' | 'ghost';
  badge?: number;
}

// SaveButton - Για αποθήκευση forms
export function SaveButton({
  children,
  loading = false,
  disabled = false,
  onClick,
  className
}: BaseButtonProps) {
  const iconSizes = useIconSizes();
  // ✅ ENTERPRISE: Zero Hardcoded - Use centralized translations
  const actions = useActionTranslations();
  const defaultChildren = children ?? actions.save;
  const loadingText = actions.save_loading;

  return (
    <Button
      type="submit"
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(BUTTON_STYLES.variants.save, className)}
    >
      {loading ? (
        <>
          <Spinner size="small" color="inherit" className="mr-2" />
          {loadingText}
        </>
      ) : (
        <>
          <Save className={`mr-2 ${iconSizes.sm}`} />
          {defaultChildren}
        </>
      )}
    </Button>
  );
}

// CancelButton - Για ακύρωση
export function CancelButton({
  children,
  disabled = false,
  onClick,
  className
}: BaseButtonProps) {
  const iconSizes = useIconSizes();
  // ✅ ENTERPRISE: Zero Hardcoded - Use centralized translations
  const actions = useActionTranslations();
  const defaultChildren = children ?? actions.cancel;

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      disabled={disabled}
      className={cn(BUTTON_STYLES.variants.cancel, className)}
    >
      <X className={`mr-2 ${iconSizes.sm}`} />
      {defaultChildren}
    </Button>
  );
}

// DeleteButton - Για διαγραφή
export function DeleteButton({
  children,
  loading = false,
  disabled = false,
  onClick,
  className
}: BaseButtonProps) {
  const iconSizes = useIconSizes();
  // ✅ ENTERPRISE: Zero Hardcoded - Use centralized translations
  const actions = useActionTranslations();
  const defaultChildren = children ?? actions.delete;
  const loadingText = actions.delete_loading;

  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(BUTTON_STYLES.variants.delete, className)}
    >
      {loading ? (
        <>
          <Spinner size="small" color="inherit" className="mr-2" />
          {loadingText}
        </>
      ) : (
        <>
          <Trash2 className={`mr-2 ${iconSizes.sm}`} />
          {defaultChildren}
        </>
      )}
    </Button>
  );
}

// AddButton - Για προσθήκη νέων items
export function AddButton({
  children,
  disabled = false,
  onClick,
  className
}: BaseButtonProps) {
  const iconSizes = useIconSizes();
  // ✅ ENTERPRISE: Zero Hardcoded - Use centralized translations
  const actions = useActionTranslations();
  const defaultChildren = children ?? actions.add;

  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(BUTTON_STYLES.variants.add, className)}
    >
      <Plus className={`mr-2 ${iconSizes.sm}`} />
      {defaultChildren}
    </Button>
  );
}

// EditButton - Για επεξεργασία
export function EditButton({
  children,
  disabled = false,
  onClick,
  className
}: BaseButtonProps) {
  const iconSizes = useIconSizes();
  // ✅ ENTERPRISE: Zero Hardcoded - Use centralized translations
  const actions = useActionTranslations();
  const defaultChildren = children ?? actions.edit;

  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(BUTTON_STYLES.variants.edit, className)}
    >
      <Edit className={`mr-2 ${iconSizes.sm}`} />
      {defaultChildren}
    </Button>
  );
}

// ArchiveButton - Για αρχειοθέτηση
export function ArchiveButton({
  children,
  loading = false,
  disabled = false,
  onClick,
  className
}: BaseButtonProps) {
  const iconSizes = useIconSizes();
  // ✅ ENTERPRISE: Zero Hardcoded - Use centralized translations
  const actions = useActionTranslations();
  const defaultChildren = children ?? actions.archive;
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(BUTTON_STYLES.variants.archive, className)}
    >
      {loading ? (
        <>
          <Spinner size="small" color="inherit" className="mr-2" />
          {actions.archive_loading}
        </>
      ) : (
        <>
          <Archive className={`mr-2 ${iconSizes.sm}`} />
          {defaultChildren}
        </>
      )}
    </Button>
  );
}

// RestoreButton - Για επαναφορά από archive
export function RestoreButton({
  children,
  loading = false,
  disabled = false,
  onClick,
  className
}: BaseButtonProps) {
  const iconSizes = useIconSizes();
  // ✅ ENTERPRISE: Zero Hardcoded - Use centralized translations
  const actions = useActionTranslations();
  const defaultChildren = children ?? actions.restore;
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(BUTTON_STYLES.variants.restore, className)}
    >
      {loading ? (
        <>
          <Spinner size="small" color="inherit" className="mr-2" />
          {actions.restore_loading}
        </>
      ) : (
        <>
          <RotateCcw className={`mr-2 ${iconSizes.sm}`} />
          {defaultChildren}
        </>
      )}
    </Button>
  );
}

// Toolbar variants - Για ContactsToolbar με consistent styling
export function ToolbarAddButton({
  children,
  disabled = false,
  onClick,
  className,
  size = 'sm',
  variant = 'default'
}: BaseButtonProps) {
  const iconSizes = useIconSizes();
  // ✅ ENTERPRISE: Zero Hardcoded - Use centralized translations
  const actions = useActionTranslations();
  const defaultChildren = children ?? actions.add;
  // Use centralized styling for default variant
  const buttonClassName = variant === 'default'
    ? cn(BUTTON_STYLES.variants.add, "flex items-center gap-2 min-w-[100px] justify-start", className)
    : cn("flex items-center gap-2 min-w-[100px] justify-start", className);

  return (
    <Button
      variant={variant === 'default' ? undefined : variant}
      size={size}
      onClick={onClick}
      disabled={disabled}
      className={buttonClassName}
    >
      <Plus className={iconSizes.sm} />
      <span className="hidden md:inline">{defaultChildren}</span>
    </Button>
  );
}

export function ToolbarEditButton({
  children,
  disabled = false,
  onClick,
  className,
  size = 'sm',
  variant = 'outline'
}: BaseButtonProps) {
  const iconSizes = useIconSizes();
  // ✅ ENTERPRISE: Zero Hardcoded - Use centralized translations
  const actions = useActionTranslations();
  const defaultChildren = children ?? actions.edit;
  // Use centralized styling for outline variant (edit action)
  const buttonClassName = variant === 'outline'
    ? cn(BUTTON_STYLES.variants.edit, "flex items-center gap-2 min-w-[100px] justify-start", className)
    : cn("flex items-center gap-2 min-w-[100px] justify-start", className);

  return (
    <Button
      variant={variant === 'outline' ? undefined : variant}
      size={size}
      onClick={onClick}
      disabled={disabled}
      className={buttonClassName}
    >
      <Edit className={iconSizes.sm} />
      <span className="hidden md:inline">{defaultChildren}</span>
    </Button>
  );
}

export function ToolbarDeleteButton({
  children,
  disabled = false,
  onClick,
  className,
  size = 'sm',
  variant = 'destructive',
  badge
}: BaseButtonProps) {
  const iconSizes = useIconSizes();
  // ✅ ENTERPRISE: Zero Hardcoded - Use centralized translations
  const actions = useActionTranslations();
  const defaultChildren = children ?? actions.delete;
  // Use centralized styling for destructive variant
  const buttonClassName = variant === 'destructive'
    ? cn(BUTTON_STYLES.variants.delete, "flex items-center gap-2 min-w-[100px] justify-start", className)
    : cn("flex items-center gap-2 min-w-[100px] justify-start", className);

  return (
    <Button
      variant={variant === 'destructive' ? undefined : variant}
      size={size}
      onClick={onClick}
      disabled={disabled}
      className={buttonClassName}
    >
      <Trash2 className={iconSizes.sm} />
      <span className="hidden md:inline">{defaultChildren}</span>
      {badge && (
        <CommonBadge
          status="company"
          customLabel={badge.toString()}
          variant="secondary"
          className="ml-auto"
        />
      )}
    </Button>
  );
}

export function ToolbarArchiveButton({
  children,
  disabled = false,
  onClick,
  className,
  size = 'sm',
  variant = 'ghost',
  badge
}: BaseButtonProps) {
  const iconSizes = useIconSizes();
  // ✅ ENTERPRISE: Zero Hardcoded - Use centralized translations
  const actions = useActionTranslations();
  const defaultChildren = children ?? actions.archive;

  return (
    <Button
      size={size}
      onClick={onClick}
      disabled={disabled}
      className={cn(BUTTON_CATEGORIES.utility, "text-orange-400 flex items-center gap-2 min-w-[100px] justify-start", className)}
    >
      <Archive className={iconSizes.sm} />
      <span className="hidden md:inline">{defaultChildren}</span>
      {badge && (
        <CommonBadge
          status="company"
          customLabel={badge.toString()}
          variant="secondary"
          className="ml-auto"
        />
      )}
    </Button>
  );
}

// Communication buttons - Subtle styling
export function ToolbarCallButton({
  children,
  disabled = false,
  onClick,
  className,
  size = 'sm'
}: BaseButtonProps) {
  const iconSizes = useIconSizes();
  // ✅ ENTERPRISE: Zero Hardcoded - Use centralized translations
  const actions = useActionTranslations();
  const defaultChildren = children ?? actions.call;

  return (
    <Button
      size={size}
      onClick={onClick}
      disabled={disabled}
      className={cn(BUTTON_STYLES.variants.call, "flex items-center gap-2 min-w-[100px] justify-start", className)}
    >
      <Phone className={iconSizes.sm} />
      <span className="hidden md:inline">{defaultChildren}</span>
    </Button>
  );
}

export function ToolbarEmailButton({
  children,
  disabled = false,
  onClick,
  className,
  size = 'sm'
}: BaseButtonProps) {
  const iconSizes = useIconSizes();
  // ✅ ENTERPRISE: Zero Hardcoded - Use centralized translations
  const actions = useActionTranslations();
  const defaultChildren = children ?? actions.email;

  return (
    <Button
      size={size}
      onClick={onClick}
      disabled={disabled}
      className={cn(BUTTON_STYLES.variants.email, "flex items-center gap-2 min-w-[100px] justify-start", className)}
    >
      <Mail className={iconSizes.sm} />
      <span className="hidden md:inline">{defaultChildren}</span>
    </Button>
  );
}

export function ToolbarSMSButton({
  children,
  disabled = false,
  onClick,
  className,
  size = 'sm'
}: BaseButtonProps) {
  const iconSizes = useIconSizes();
  // ✅ ENTERPRISE: Zero Hardcoded - Use centralized translations
  const actions = useActionTranslations();
  const defaultChildren = children ?? actions.sms;

  return (
    <Button
      size={size}
      onClick={onClick}
      disabled={disabled}
      className={cn(BUTTON_STYLES.variants.sms, "flex items-center gap-2 min-w-[100px] justify-start", className)}
    >
      <MessageSquare className={iconSizes.sm} />
      <span className="hidden md:inline">{defaultChildren}</span>
    </Button>
  );
}

// Management buttons - Same dark theme styling as communication
export function ToolbarExportButton({
  children,
  disabled = false,
  onClick,
  className,
  size = 'sm'
}: BaseButtonProps) {
  const iconSizes = useIconSizes();
  // ✅ ENTERPRISE: Zero Hardcoded - Use centralized translations
  const actions = useActionTranslations();
  const defaultChildren = children ?? actions.export;

  return (
    <Button
      size={size}
      onClick={onClick}
      disabled={disabled}
      className={cn(BUTTON_STYLES.variants.export, "flex items-center gap-2 min-w-[100px] justify-start", className)}
    >
      <Download className={iconSizes.sm} />
      <span className="hidden md:inline">{defaultChildren}</span>
    </Button>
  );
}

export function ToolbarImportButton({
  children,
  disabled = false,
  onClick,
  className,
  size = 'sm'
}: BaseButtonProps) {
  const iconSizes = useIconSizes();
  // ✅ ENTERPRISE: Zero Hardcoded - Use centralized translations
  const actions = useActionTranslations();
  const defaultChildren = children ?? actions.import;

  return (
    <Button
      size={size}
      onClick={onClick}
      disabled={disabled}
      className={cn(BUTTON_STYLES.variants.import, "flex items-center gap-2 min-w-[100px] justify-start", className)}
    >
      <Upload className={iconSizes.sm} />
      <span className="hidden md:inline">{defaultChildren}</span>
    </Button>
  );
}

// Single sorting toggle button - Centralized design system integration
export function ToolbarSortToggleButton({
  disabled = false,
  onClick,
  className,
  size = 'sm',
  sortDirection = 'asc'
}: BaseButtonProps & { sortDirection?: 'asc' | 'desc' }) {
  const iconSizes = useIconSizes();
  // ✅ ENTERPRISE: Zero Hardcoded - Use centralized translations
  const actions = useActionTranslations();
  const icon = sortDirection === 'asc' ? <ArrowUpAZ className={iconSizes.sm} /> : <ArrowDownZA className={iconSizes.sm} />;

  return (
    <Button
      size={size}
      onClick={onClick}
      disabled={disabled}
      className={cn(BUTTON_STYLES.variants.sort, "flex items-center gap-2 min-w-[100px] justify-start", className)}
    >
      {icon}
      <span className="hidden md:inline">{actions.sort}</span>
    </Button>
  );
}

export function ToolbarHelpButton({
  children,
  disabled = false,
  onClick,
  className,
  size = 'sm'
}: BaseButtonProps) {
  const iconSizes = useIconSizes();
  // ✅ ENTERPRISE: Zero Hardcoded - Use centralized translations
  const actions = useActionTranslations();
  const defaultChildren = children ?? actions.help;

  return (
    <Button
      size={size}
      onClick={onClick}
      disabled={disabled}
      className={cn(BUTTON_STYLES.variants.help, "flex items-center gap-2 min-w-[100px] justify-start", className)}
    >
      <HelpCircle className={iconSizes.sm} />
      <span className="hidden md:inline">{defaultChildren}</span>
    </Button>
  );
}

// Filter buttons - Toggle functionality for filters
interface FilterButtonProps extends BaseButtonProps {
  active?: boolean;
}

export function ToolbarFavoritesButton({
  children,
  disabled = false,
  onClick,
  className,
  size = 'sm',
  active = false
}: FilterButtonProps) {
  const iconSizes = useIconSizes();
  // ✅ ENTERPRISE: Zero Hardcoded - Use centralized translations
  const actions = useActionTranslations();
  const defaultChildren = children ?? actions.favorites;
  // Active state uses primary color, inactive uses utility (subtle)
  const buttonClassName = active
    ? cn(BUTTON_CATEGORIES.primary, "flex items-center gap-2 min-w-[100px] justify-start", className)
    : cn(BUTTON_CATEGORIES.utility, "text-yellow-400 flex items-center gap-2 min-w-[100px] justify-start", className);

  return (
    <Button
      size={size}
      onClick={onClick}
      disabled={disabled}
      className={buttonClassName}
    >
      <Star className={iconSizes.sm} />
      <span className="hidden md:inline">{defaultChildren}</span>
    </Button>
  );
}

export function ToolbarArchivedFilterButton({
  children,
  disabled = false,
  onClick,
  className,
  size = 'sm',
  active = false
}: FilterButtonProps) {
  const iconSizes = useIconSizes();
  // ✅ ENTERPRISE: Zero Hardcoded - Use centralized translations
  const actions = useActionTranslations();
  const defaultChildren = children ?? actions.archived;
  // Active state uses primary color, inactive uses utility (subtle)
  const buttonClassName = active
    ? cn(BUTTON_CATEGORIES.primary, "flex items-center gap-2 min-w-[100px] justify-start", className)
    : cn(BUTTON_CATEGORIES.utility, "text-orange-400 flex items-center gap-2 min-w-[100px] justify-start", className);

  return (
    <Button
      size={size}
      onClick={onClick}
      disabled={disabled}
      className={buttonClassName}
    >
      <Archive className={iconSizes.sm} />
      <span className="hidden md:inline">{defaultChildren}</span>
    </Button>
  );
}

// Refresh button - Utility action for refreshing data
export function ToolbarRefreshButton({
  children,
  disabled = false,
  onClick,
  className,
  size = 'sm'
}: BaseButtonProps) {
  const iconSizes = useIconSizes();
  // ✅ ENTERPRISE: Zero Hardcoded - Use centralized translations
  const actions = useActionTranslations();
  const defaultChildren = children ?? actions.refresh;

  return (
    <Button
      size={size}
      onClick={onClick}
      disabled={disabled}
      className={cn(BUTTON_CATEGORIES.utility, "text-cyan-400 flex items-center gap-2 min-w-[100px] justify-start", className)}
    >
      <RefreshCw className={iconSizes.sm} />
      <span className="hidden md:inline">{defaultChildren}</span>
    </Button>
  );
}