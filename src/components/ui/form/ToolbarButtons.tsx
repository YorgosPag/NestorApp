'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { CommonBadge } from '@/core/badges';
import {
  Plus, Edit, Trash2, Archive, Phone, Mail, MessageSquare,
  Download, Upload, HelpCircle, Star, RefreshCw, ArrowUpAZ, ArrowDownZA,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import '@/lib/design-system';
import { getStatusColor } from '@/lib/design-system';

import {
  useActionTranslations,
  BUTTON_CATEGORIES,
  BUTTON_STYLES,
  type BaseButtonProps,
  type FilterButtonProps,
} from './action-button-config';

/**
 * Shared body of a toolbar button that can carry a count badge.
 *
 * Extracted 2026-08-07 (ADR-759 §4.12.3): ToolbarDeleteButton and
 * ToolbarArchiveButton carried byte-identical 14-line bodies — a real clone
 * flagged by CHECK 3.28 (jscpd, 62 tokens). The clone PRE-DATES this change
 * (verified against HEAD); it surfaced only because the file was touched.
 *
 * ⚠️ Behaviour note: both call sites guarded the badge with `{badge && …}`.
 * In React that renders a literal `0` when `badge === 0`, painting a stray
 * zero next to the label. This helper uses the `badge != null && badge > 0`
 * guard that ToolbarDeleteFilterButton already used — so `badge={0}` now
 * renders nothing, which is what every call site intended.
 *
 * Deliberately NOT applied to the icon+label-only buttons in this file: that
 * shape is two lines of idiomatic JSX, below every duplication threshold, and
 * wrapping it would add indirection without removing duplication.
 */
function ToolbarButtonBody({
  icon,
  label,
  badge,
}: {
  icon: React.ReactNode;
  label: React.ReactNode;
  badge?: number;
}) {
  return (
    <>
      {icon}
      <span className="hidden md:inline">{label}</span>
      {badge != null && badge > 0 && (
        <CommonBadge
          status="company"
          customLabel={badge.toString()}
          variant="secondary"
          className="ml-auto"
        />
      )}
    </>
  );
}

// ╭───────��─────────────────────────────────────╮
// │           CRUD Toolbar Buttons              │
// ╰─────────────────────────────────────────────╯

export function ToolbarAddButton({
  children,
  disabled = false,
  onClick,
  className,
  size = 'sm',
  variant = 'default'
}: BaseButtonProps) {
  const iconSizes = useIconSizes();
  const actions = useActionTranslations();
  const defaultChildren = children ?? actions.add;
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
  const actions = useActionTranslations();
  const defaultChildren = children ?? actions.edit;
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
  const actions = useActionTranslations();
  const defaultChildren = children ?? actions.delete;
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
      <ToolbarButtonBody
        icon={<Trash2 className={iconSizes.sm} />}
        label={defaultChildren}
        badge={badge}
      />
    </Button>
  );
}

export function ToolbarArchiveButton({
  children,
  disabled = false,
  onClick,
  className,
  size = 'sm',
  badge
}: BaseButtonProps) {
  const iconSizes = useIconSizes();
  const actions = useActionTranslations();
  const defaultChildren = children ?? actions.archive;

  return (
    <Button
      size={size}
      onClick={onClick}
      disabled={disabled}
      className={cn(BUTTON_STYLES.variants.archiveUtility, "flex items-center gap-2 min-w-[100px] justify-start", className)}
    >
      <ToolbarButtonBody
        icon={<Archive className={iconSizes.sm} />}
        label={defaultChildren}
        badge={badge}
      />
    </Button>
  );
}

// ╭──────────────────────────���──────────────────╮
// │        Communication Toolbar Buttons        │
// ╰─────────────────────────────────────────────╯

export function ToolbarCallButton({
  children,
  disabled = false,
  onClick,
  className,
  size = 'sm'
}: BaseButtonProps) {
  const iconSizes = useIconSizes();
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

// ╭────────────────────���────────────────────────╮
// │     Management & Filter Toolbar Buttons     │
// ╰─────────────────────���───────────────────────╯

export function ToolbarExportButton({
  children,
  disabled = false,
  onClick,
  className,
  size = 'sm'
}: BaseButtonProps) {
  const iconSizes = useIconSizes();
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

export function ToolbarSortToggleButton({
  disabled = false,
  onClick,
  className,
  size = 'sm',
  sortDirection = 'asc'
}: BaseButtonProps & { sortDirection?: 'asc' | 'desc' }) {
  const iconSizes = useIconSizes();
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

export function ToolbarFavoritesButton({
  children,
  disabled = false,
  onClick,
  className,
  size = 'sm',
  active = false
}: FilterButtonProps) {
  const iconSizes = useIconSizes();
  const actions = useActionTranslations();
  const defaultChildren = children ?? actions.favorites;
  const buttonClassName = active
    ? cn(BUTTON_CATEGORIES.primary, "flex items-center gap-2 min-w-[100px] justify-start", className)
    : cn(BUTTON_CATEGORIES.utility, `${getStatusColor('warning', 'text')} flex items-center gap-2 min-w-[100px] justify-start`, className);

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
  const actions = useActionTranslations();
  const defaultChildren = children ?? actions.archived;
  const buttonClassName = active
    ? cn(BUTTON_CATEGORIES.primary, "flex items-center gap-2 min-w-[100px] justify-start", className)
    : cn(BUTTON_STYLES.variants.archiveUtility, "flex items-center gap-2 min-w-[100px] justify-start", className);

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

export function ToolbarTrashFilterButton({
  children,
  disabled = false,
  onClick,
  className,
  size = 'sm',
  active = false,
  badge,
}: FilterButtonProps & { badge?: number }) {
  const iconSizes = useIconSizes();
  const buttonClassName = active
    ? cn(BUTTON_CATEGORIES.primary, "flex items-center gap-2 min-w-[100px] justify-start", className)
    : cn(BUTTON_CATEGORIES.utility, getStatusColor('error', 'text'), "flex items-center gap-2 min-w-[100px] justify-start", className);

  return (
    <Button
      size={size}
      onClick={onClick}
      disabled={disabled}
      className={buttonClassName}
    >
      <Trash2 className={iconSizes.sm} />
      <span className="hidden md:inline">{children}</span>
      {badge != null && badge > 0 && (
        <CommonBadge status="deleted" customLabel={String(badge)} className="ml-1" />
      )}
    </Button>
  );
}

export function ToolbarRefreshButton({
  children,
  disabled = false,
  onClick,
  className,
  size = 'sm'
}: BaseButtonProps) {
  const iconSizes = useIconSizes();
  const actions = useActionTranslations();
  const defaultChildren = children ?? actions.refresh;

  return (
    <Button
      size={size}
      onClick={onClick}
      disabled={disabled}
      className={cn(BUTTON_STYLES.variants.refresh, "flex items-center gap-2 min-w-[100px] justify-start", className)}
    >
      <RefreshCw className={iconSizes.sm} />
      <span className="hidden md:inline">{defaultChildren}</span>
    </Button>
  );
}
