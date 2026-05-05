'use client';

/**
 * =============================================================================
 * 🏢 ADDRESS CARD - Single Address Display
 * =============================================================================
 *
 * Read-only card for displaying a single project address.
 *
 * Features:
 * - Primary/secondary badge
 * - Block side indicator
 * - Address type label
 * - Source label + freshness indicator + has-coords badge (ADR-332 Phase 8)
 */

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ProjectAddress } from '@/types/project/addresses';
import {
  AddressSourceLabel,
  AddressFreshnessIndicator,
  AddressCoordsBadge,
  computeFreshness,
} from '@/components/shared/addresses/editor';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';

// =============================================================================
// COMPONENT PROPS
// =============================================================================

interface AddressCardProps {
  /** Address to display */
  address: ProjectAddress;
  /** Show edit button? (placeholder for future) */
  onEdit?: (address: ProjectAddress) => void;
  /** Custom className */
  className?: string;
  /** Hide the source/freshness/coords enrichment row (default: false) */
  hideEnrichment?: boolean;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatAddressLine(address: ProjectAddress): string {
  const parts = [address.street, address.number, address.city, address.postalCode].filter(Boolean);
  return parts.join(', ');
}

// =============================================================================
// COMPONENT
// =============================================================================

export function AddressCard({ address, onEdit, className, hideEnrichment }: AddressCardProps) {
  const { t } = useTranslation('addresses');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  const freshness = useMemo(() => computeFreshness(address.verifiedAt), [address.verifiedAt]);
  const hasCoords = !!address.coordinates;
  const sourceType = address.source ?? 'unknown';

  return (
    <Card className={className}>
      <CardContent className="p-4">
        {/* Header: Primary badge + Type */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {address.isPrimary && (
              <Badge variant="default" className="flex items-center gap-1">
                <Star className={iconSizes.xs} />
                {t('card.primary')}
              </Badge>
            )}
            <Badge variant="outline">{t(`types.${address.type}`)}</Badge>
          </div>
        </div>

        {/* Address Line */}
        <div className="flex items-start gap-2 mb-2">
          <MapPin className={cn(iconSizes.sm, 'shrink-0 mt-0.5', colors.text.muted)} />
          <div className="flex-1">
            <p className="text-sm font-medium">{formatAddressLine(address)}</p>
            {address.label && (
              <p className={cn('text-xs mt-1', colors.text.muted)}>{address.label}</p>
            )}
          </div>
        </div>

        {/* Block Side */}
        {address.blockSide && (
          <div className="mt-2 pt-2 border-t border-border">
            <p className={cn('text-xs', colors.text.muted)}>
              {t('card.side')}:{' '}
              <span className="font-medium text-foreground">
                {t(`blockSides.${address.blockSide}`)}
              </span>
            </p>
          </div>
        )}

        {/* Enrichment row: source + freshness + has-coords (ADR-332 Phase 8) */}
        {!hideEnrichment && (
          <div className="mt-3 pt-2 border-t border-border flex flex-wrap items-center gap-2">
            <AddressSourceLabel source={sourceType} />
            <AddressFreshnessIndicator freshness={freshness} />
            <AddressCoordsBadge hasCoords={hasCoords} />
          </div>
        )}

        {/* Edit button (placeholder) */}
        {onEdit && (
          <div className="mt-3 pt-3 border-t border-border">
            <button
              onClick={() => onEdit(address)}
              className="text-xs text-primary hover:underline"
            >
              {t('card.edit')}
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
