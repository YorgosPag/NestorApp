'use client';

import React, { useMemo } from 'react';
import { Pencil, Eraser, Trash2, Star, MapPin, MapPinOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  AddressSourceLabel,
  AddressFreshnessIndicator,
  computeFreshness,
  type AddressSourceType,
} from '@/components/shared/addresses/editor';
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
  /** Override default i18n label for the edit action. */
  editLabel?: string;
  /** Override default i18n label for the delete action. */
  deleteLabel?: string;
  /** Override default i18n label for the clear action. */
  clearLabel?: string;
  /** Override default i18n label for the "set as primary" action. */
  setPrimaryLabel?: string;
  /** Override default i18n label for the primary chip. */
  primaryLabel?: string;
  /**
   * Provenance of this address (ADR-332 §3.10 / Phase 8). When omitted the
   * source enrichment row is hidden.
   */
  source?: AddressSourceType;
  /** Unix-ms timestamp of last successful geocoding cycle. */
  verifiedAt?: number | null;
  /** Whether the address has stored map coordinates. */
  hasCoordinates?: boolean;
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
  editLabel,
  deleteLabel,
  clearLabel,
  setPrimaryLabel,
  primaryLabel,
  source,
  verifiedAt,
  hasCoordinates,
}: SharedAddressActionCardProps) {
  const { t } = useTranslation('addresses');
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  const spacing = useSpacingTokens();

  const editText = editLabel ?? t('actionCard.edit');
  const deleteText = deleteLabel ?? t('actionCard.delete');
  const clearText = clearLabel ?? t('actionCard.clear');
  const setPrimaryText = setPrimaryLabel ?? t('actionCard.setPrimary');
  const primaryText = primaryLabel ?? t('actionCard.primary');

  const showEnrichment = source !== undefined || verifiedAt != null || hasCoordinates !== undefined;
  const freshness = useMemo(
    () => (verifiedAt !== undefined ? computeFreshness(verifiedAt) : null),
    [verifiedAt],
  );

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
            {primaryText}
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
              <TooltipContent>{setPrimaryText}</TooltipContent>
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
                aria-label={editText}
              >
                <Pencil className={iconSizes.sm} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{editText}</TooltipContent>
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
                aria-label={clearText}
              >
                <Eraser className={iconSizes.sm} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{clearText}</TooltipContent>
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
                aria-label={deleteText}
              >
                <Trash2 className={iconSizes.sm} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{deleteText}</TooltipContent>
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

      {/* Enrichment row (ADR-332 Phase 8) */}
      {showEnrichment && (
        <div className="mt-2 pl-6 flex flex-wrap items-center gap-2">
          {source !== undefined && <AddressSourceLabel source={source} />}
          {freshness && <AddressFreshnessIndicator freshness={freshness} />}
          {hasCoordinates !== undefined && <CoordsBadge hasCoords={hasCoordinates} />}
        </div>
      )}
    </article>
  );
}

// =============================================================================
// SUB-COMPONENT — has-coords badge (mirrors AddressCard)
// =============================================================================

function CoordsBadge({ hasCoords }: { hasCoords: boolean }) {
  const { t } = useTranslation('addresses');
  const Icon = hasCoords ? MapPin : MapPinOff;
  const variant = hasCoords ? 'success' : 'muted';
  const labelKey = hasCoords ? 'card.coords.has' : 'card.coords.none';
  const tooltipKey = hasCoords ? 'card.coords.tooltipHas' : 'card.coords.tooltipNone';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant={variant} className="gap-1 cursor-default select-none">
          <Icon className="h-3 w-3" />
          <span>{t(labelKey)}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{t(tooltipKey)}</TooltipContent>
    </Tooltip>
  );
}
