/**
 * BuildingSpaceActions — Centralized 4-icon action bar
 *
 * Used by all building space tabs (Units, Parking, Storage)
 * in both Table and Card views.
 *
 * Icons: Eye (view), Pencil (edit), Unlink2 (unlink), Trash2 (delete)
 *
 * @module components/building-management/shared/BuildingSpaceActions
 */

'use client';

import { Button } from '@/components/ui/button';
import { Eye, Pencil, Unlink2, Trash2, Loader2 } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';

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

// ============================================================================
// COMPONENT
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
  const { t } = useTranslation('building');

  return (
    <nav className="flex justify-end gap-1">
      {onView && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onView}
          title={t('spaceActions.view')}
        >
          <Eye className={iconSizes.xs} />
        </Button>
      )}

      {onEdit && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onEdit}
          title={t('spaceActions.edit')}
        >
          <Pencil className={iconSizes.xs} />
        </Button>
      )}

      {onUnlink && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-amber-600 hover:text-amber-700"
          onClick={onUnlink}
          disabled={isUnlinking}
          title={t('spaceActions.unlink')}
        >
          {isUnlinking ? <Loader2 className={`${iconSizes.xs} animate-spin`} /> : <Unlink2 className={iconSizes.xs} />}
        </Button>
      )}

      {onDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={onDelete}
          disabled={isDeleting}
          title={t('spaceActions.delete')}
        >
          {isDeleting ? <Loader2 className={`${iconSizes.xs} animate-spin`} /> : <Trash2 className={iconSizes.xs} />}
        </Button>
      )}
    </nav>
  );
}
