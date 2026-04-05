'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Save, X, Trash2, Plus, Edit, Archive, RotateCcw } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import '@/lib/design-system';

import {
  useActionTranslations,
  BUTTON_STYLES,
  type BaseButtonProps,
} from './action-button-config';

// ── Re-exports for backward compatibility ──────────
export { BUTTON_CATEGORIES, BUTTON_STYLES } from './action-button-config';
export type { BaseButtonProps } from './action-button-config';
export {
  ToolbarAddButton,
  ToolbarEditButton,
  ToolbarDeleteButton,
  ToolbarArchiveButton,
  ToolbarCallButton,
  ToolbarEmailButton,
  ToolbarSMSButton,
  ToolbarExportButton,
  ToolbarImportButton,
  ToolbarSortToggleButton,
  ToolbarHelpButton,
  ToolbarFavoritesButton,
  ToolbarArchivedFilterButton,
  ToolbarTrashFilterButton,
  ToolbarRefreshButton,
} from './ToolbarButtons';

// ╭─────────────────────────────────────────────╮
// │          Core Action Buttons                │
// ╰───────��─────────────────────────────────────╯

export function SaveButton({
  children,
  loading = false,
  disabled = false,
  onClick,
  className,
  form,
}: BaseButtonProps) {
  const iconSizes = useIconSizes();
  const actions = useActionTranslations();
  const defaultChildren = children ?? actions.save;
  const loadingText = actions.save_loading;

  return (
    <Button
      type="submit"
      form={form}
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

export function CancelButton({
  children,
  disabled = false,
  onClick,
  className
}: BaseButtonProps) {
  const iconSizes = useIconSizes();
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

export function DeleteButton({
  children,
  loading = false,
  disabled = false,
  onClick,
  className
}: BaseButtonProps) {
  const iconSizes = useIconSizes();
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

export function AddButton({
  children,
  disabled = false,
  onClick,
  className
}: BaseButtonProps) {
  const iconSizes = useIconSizes();
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

export function EditButton({
  children,
  disabled = false,
  onClick,
  className
}: BaseButtonProps) {
  const iconSizes = useIconSizes();
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

export function ArchiveButton({
  children,
  loading = false,
  disabled = false,
  onClick,
  className
}: BaseButtonProps) {
  const iconSizes = useIconSizes();
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

export function RestoreButton({
  children,
  loading = false,
  disabled = false,
  onClick,
  className
}: BaseButtonProps) {
  const iconSizes = useIconSizes();
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
