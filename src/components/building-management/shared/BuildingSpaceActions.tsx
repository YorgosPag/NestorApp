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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Eye, Pencil, Unlink2, Trash2 } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import '@/lib/design-system';

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
  const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);

  return (
    <TooltipProvider delayDuration={300}>
      <nav className="flex justify-end gap-1">
        {onView && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onView}
              >
                <Eye className={iconSizes.xs} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('spaceActions.view')}</TooltipContent>
          </Tooltip>
        )}

        {onEdit && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onEdit}
              >
                <Pencil className={iconSizes.xs} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('spaceActions.edit')}</TooltipContent>
          </Tooltip>
        )}

        {onUnlink && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-amber-600 hover:text-amber-700"
                onClick={onUnlink}
                disabled={isUnlinking}
              >
                {isUnlinking ? <Spinner size="small" color="inherit" /> : <Unlink2 className={iconSizes.xs} />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('spaceActions.unlink')}</TooltipContent>
          </Tooltip>
        )}

        {onDelete && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={onDelete}
                disabled={isDeleting}
              >
                {isDeleting ? <Spinner size="small" color="inherit" /> : <Trash2 className={iconSizes.xs} />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('spaceActions.delete')}</TooltipContent>
          </Tooltip>
        )}
      </nav>
    </TooltipProvider>
  );
}
