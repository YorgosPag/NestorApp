'use client';

import React, { useMemo } from 'react';
import { Pencil, Eraser, Trash2, Star, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { AddressLike } from '@/lib/geocoding/address-position';
import {
  AddressSourceLabel,
  AddressFreshnessIndicator,
  AddressCoordsBadge,
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
   * **Η αποθηκευμένη θέση, ΟΛΟΚΛΗΡΗ** — προέλευση, φρεσκάδα, συντεταγμένες και η
   * **απόδειξη** του ισχυρισμού ακρίβειας (ADR-332 §3.10 / Φ8 · D27 Ζ6). Απούσα ⇒ η σειρά
   * εμπλουτισμού κρύβεται.
   *
   * 🔑 **Ένα prop και όχι τρία, και ο λόγος είναι μετρημένος.** Ως το Ζ6 η κάρτα δεχόταν
   * `source` + `verifiedAt` + `hasCoordinates` **χωριστά**, δηλαδή κομμάτια του **ίδιου**
   * πράγματος — και ο μόνος καταναλωτής που τα περνούσε ήταν η καρτέλα Τοποθεσιών του
   * έργου· **οι επαφές περνούσαν μηδέν**, οπότε στην οθόνη όπου ζούσε το ζωντανό εύρημα του
   * Ζ6 τα τρία badges **δεν ήταν καν στη σελίδα**. Με ολόκληρη τη θέση, μια «μισή» παράδοση
   * παύει να είναι εκφράσιμη — ίδιο ιδίωμα με το `AddressPosition` του γραφέα.
   */
  position?: AddressLike;
  /**
   * Ό,τι θέλει να πει ο καταναλωτής **κάτω** από τη σειρά εμπλουτισμού.
   *
   * 🔑 **Υποδοχή και όχι νέο prop ανά πληροφορία**: η καρτέλα Τοποθεσιών του έργου
   * δείχνει εδώ **τι θα ζωγραφίσει ο δημόσιος χάρτης** ({@link AddressPublicShapeBadge}),
   * ενώ οι επαφές δεν έχουν δημόσιο χάρτη. Ένα ειδικό prop θα υποχρέωνε **κάθε**
   * καταναλωτή να έχει γνώμη για ερώτημα που δεν τον αφορά.
   */
  footer?: React.ReactNode;
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
  position,
  footer,
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

  const showEnrichment = position !== undefined;
  const freshness = useMemo(() => (position ? computeFreshness(position) : null), [position]);
  // Η προέλευση **συνάγεται όπως παντού**: ό,τι έγραψε ο γραφέας, αλλιώς «άγνωστη». Δεύτερο
  // κριτήριο εδώ θα ήταν δεύτερη αλήθεια για την ίδια ερώτηση (ADR-749).
  const source: AddressSourceType | undefined = position
    ? ((position.source as AddressSourceType | null | undefined) ?? 'unknown')
    : undefined;

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
          {position && <AddressCoordsBadge hasCoords={Boolean(position.coordinates)} />}
        </div>
      )}

      {footer && <div className={cn('pl-6', spacing.margin.top.xs)}>{footer}</div>}
    </article>
  );
}
