'use client';

/**
 * =============================================================================
 * 🏢 ADDRESS CARD - Single Address Display
 * =============================================================================
 *
 * Read-only card for displaying a single project address
 *
 * Features:
 * - Primary/secondary badge
 * - Block side indicator
 * - Address type label
 * - Clean, minimal design
 */

import React from 'react';
import { MapPin, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ProjectAddress } from '@/types/project/addresses';
import { useIconSizes } from '@/hooks/useIconSizes';

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
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Format address for display
 */
function formatAddressLine(address: ProjectAddress): string {
  const parts = [
    address.street,
    address.number,
    address.city,
    address.postalCode
  ].filter(Boolean);

  return parts.join(', ');
}

// Labels are now provided by i18n namespace 'addresses' (types.*, blockSides.*)

// =============================================================================
// COMPONENT
// =============================================================================

export function AddressCard({ address, onEdit, className }: AddressCardProps) {
  const { t } = useTranslation('addresses');
  const iconSizes = useIconSizes();

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
            <Badge variant="outline">
              {t(`types.${address.type}`)}
            </Badge>
          </div>
        </div>

        {/* Address Line */}
        <div className="flex items-start gap-2 mb-2">
          <MapPin className={`${iconSizes.sm} shrink-0 mt-0.5 text-muted-foreground`} />
          <div className="flex-1">
            <p className="text-sm font-medium">
              {formatAddressLine(address)}
            </p>
            {address.label && (
              <p className="text-xs text-muted-foreground mt-1">
                {address.label}
              </p>
            )}
          </div>
        </div>

        {/* Block Side */}
        {address.blockSide && (
          <div className="mt-2 pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              {t('card.side')}: <span className="font-medium text-foreground">{t(`blockSides.${address.blockSide}`)}</span>
            </p>
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
