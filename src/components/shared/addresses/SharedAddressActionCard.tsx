'use client';

import React from 'react';
import { Pencil, Eraser, Trash2, Star, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import '@/lib/design-system';

// =============================================================================
// TYPES
// =============================================================================

export interface SharedAddressActionCardProps {
  id: string;
  streetLine: string;
  typeLabel: string;
  isPrimary?: boolean;
  isEditing: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onClear?: () => void;
  onSetPrimary?: () => void;
  className?: string;
  editLabel?: string;
  deleteLabel?: string;
  clearLabel?: string;
  setPrimaryLabel?: string;
  primaryLabel?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function SharedAddressActionCard({
  id,
  streetLine,
  typeLabel,
  isPrimary,
  isEditing,
  onEdit,
  onDelete,
  onClear,
  onSetPrimary,
  className,
  editLabel = 'Επεξεργασία',
  deleteLabel = 'Διαγραφή',
  clearLabel = 'Εκκαθάριση',
  setPrimaryLabel = 'Ορισμός ως κύρια',
  primaryLabel = 'Κύρια',
}: SharedAddressActionCardProps) {
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  const spacing = useSpacingTokens();

  return (
    <article
      id={`address-card-${id}`}
      className={cn(
        'relative border rounded-lg transition-shadow',
        isEditing && 'hover:shadow-md',
        spacing.padding.sm,
        className,
      )}
    >
      {/* Action buttons — top right */}
      <div className={cn('absolute top-3 right-3 flex', spacing.gap.xs)}>
        {isPrimary ? (
          <Badge variant="default" className="flex items-center gap-1">
            <Star className="h-3 w-3 fill-current" />
            {primaryLabel}
          </Badge>
        ) : (
          onSetPrimary && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onSetPrimary}
                  disabled={!isEditing}
                >
                  <Star className={iconSizes.sm} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{setPrimaryLabel}</TooltipContent>
            </Tooltip>
          )
        )}

        {onEdit && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onEdit}
                disabled={!isEditing}
                aria-label={editLabel}
              >
                <Pencil className={iconSizes.sm} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{editLabel}</TooltipContent>
          </Tooltip>
        )}

        {onClear && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClear}
                disabled={!isEditing}
                aria-label={clearLabel}
              >
                <Eraser className={iconSizes.sm} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{clearLabel}</TooltipContent>
          </Tooltip>
        )}

        {onDelete && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={onDelete}
                disabled={!isEditing}
                aria-label={deleteLabel}
              >
                <Trash2 className={iconSizes.sm} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{deleteLabel}</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Address content */}
      <div className={cn('flex items-start gap-2 pr-32', spacing.margin.bottom.xs)}>
        <MapPin className={cn(iconSizes.sm, 'shrink-0 mt-0.5', colors.text.muted)} />
        <p className="text-sm font-medium leading-snug">
          {streetLine || <span className={cn('italic', colors.text.muted)}>—</span>}
        </p>
      </div>

      {/* Type label */}
      <p className={cn('text-xs', colors.text.muted, 'pl-6')}>{typeLabel}</p>
    </article>
  );
}
