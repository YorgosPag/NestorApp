/**
 * BuildingSpaceActions — Centralized row action bars
 *
 * Used by all building space tabs (Units, Parking, Storage, Floors)
 * in both Table and Card views.
 *
 * - `BuildingSpaceActions`: Eye (view), Pencil (edit), Unlink2 (unlink), Trash2 (delete)
 * - `BuildingSpaceEditActions`: Check (save), X (cancel) — the inline-edit row
 *
 * ♿ Every button goes through `IconButton`: the accessible name is mandatory and is the
 * same string as the tooltip (ADR-898 §21.6 Ε10, WCAG 4.1.2).
 *
 * @module components/building-management/shared/BuildingSpaceActions
 */

'use client';

import { IconButton } from '@/components/ui/icon-button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Check, Eye, Pencil, Unlink2, Trash2, X } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import '@/lib/design-system';

const TOOLTIP_GROUP_DELAY_MS = 300;
const EDIT_ICON_CLASS = 'h-3.5 w-3.5';

// ============================================================================
// TYPES
// ============================================================================

interface BuildingSpaceActionsProps {
  /** Called when the view (eye) icon is clicked */
  onView?: () => void;
  /** Called when the edit (pencil) icon is clicked */
  onEdit?: () => void;
  /** Called when the unlink icon is clicked */
  onUnlink?: () => void;
  /** Called when the delete (trash) icon is clicked */
  onDelete?: () => void;
  /** Shows spinner on the unlink button */
  isUnlinking?: boolean;
  /** Shows spinner on the delete button */
  isDeleting?: boolean;
}

interface BuildingSpaceEditActionsProps {
  onSave: () => void;
  onCancel: () => void;
  /** The save is in flight: spinner on save, both buttons disabled */
  saving: boolean;
  /** `false` blocks the save (e.g. required field empty). Default `true`. */
  canSave?: boolean;
}

// ============================================================================
// COMPONENTS
// ============================================================================

export function BuildingSpaceActions({
  onView,
  onEdit,
  onUnlink,
  onDelete,
  isUnlinking = false,
  isDeleting = false,
}: BuildingSpaceActionsProps) {
  const iconSizes = useIconSizes();
  const { t } = useTranslation(['building-storage']);

  return (
    <TooltipProvider delayDuration={TOOLTIP_GROUP_DELAY_MS}>
      <div role="group" className="flex justify-end gap-1" aria-label={t('spaceActions.actions')}>
        {onView && (
          <IconButton label={t('spaceActions.view')} onClick={onView}>
            <Eye className={iconSizes.xs} />
          </IconButton>
        )}

        {onEdit && (
          <IconButton label={t('spaceActions.edit')} onClick={onEdit}>
            <Pencil className={iconSizes.xs} />
          </IconButton>
        )}

        {onUnlink && (
          <IconButton
            label={t('spaceActions.unlink')}
            className="text-[hsl(var(--text-warning))] hover:text-[hsl(var(--text-warning))]"
            onClick={onUnlink}
            busy={isUnlinking}
          >
            <Unlink2 className={iconSizes.xs} />
          </IconButton>
        )}

        {onDelete && (
          <IconButton
            label={t('spaceActions.delete')}
            className="text-destructive hover:text-destructive"
            onClick={onDelete}
            busy={isDeleting}
          >
            <Trash2 className={iconSizes.xs} />
          </IconButton>
        )}
      </div>
    </TooltipProvider>
  );
}

export function BuildingSpaceEditActions({
  onSave,
  onCancel,
  saving,
  canSave = true,
}: BuildingSpaceEditActionsProps) {
  const { t } = useTranslation(['building-storage']);

  return (
    <TooltipProvider delayDuration={TOOLTIP_GROUP_DELAY_MS}>
      <div role="group" className="flex justify-end gap-1" aria-label={t('spaceActions.actions')}>
        <IconButton label={t('spaceActions.save')} onClick={onSave} busy={saving} disabled={!canSave}>
          <Check className={`${EDIT_ICON_CLASS} text-[hsl(var(--text-success))]`} />
        </IconButton>
        <IconButton label={t('spaceActions.cancel')} onClick={onCancel} disabled={saving}>
          <X className={EDIT_ICON_CLASS} />
        </IconButton>
      </div>
    </TooltipProvider>
  );
}
