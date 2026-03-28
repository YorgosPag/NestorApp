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
      className={cn(BUTTON_CATEGORIES.utility, "text-cyan-400 flex items-center gap-2 min-w-[100px] justify-start", className)}
    >
      <RefreshCw className={iconSizes.sm} />
      <span className="hidden md:inline">{defaultChildren}</span>
    </Button>
  );
}
