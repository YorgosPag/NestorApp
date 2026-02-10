'use client';

/**
 * =============================================================================
 * 🏢 ADDRESS LIST CARD - Multiple Addresses Display
 * =============================================================================
 *
 * Card showing all project addresses with primary indicator
 *
 * Features:
 * - List of AddressCard components
 * - Primary address highlighted
 * - Add new address button
 * - Empty state
 */

import React from 'react';
import { Plus, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { AddressCard } from './AddressCard';
import type { ProjectAddress } from '@/types/project/addresses';
import { useIconSizes } from '@/hooks/useIconSizes';

// =============================================================================
// COMPONENT PROPS
// =============================================================================

interface AddressListCardProps {
  /** List of addresses to display */
  addresses: ProjectAddress[];
  /** Callback when "Add Address" is clicked */
  onAddAddress?: () => void;
  /** Callback when editing an address */
  onEditAddress?: (address: ProjectAddress) => void;
  /** Custom className */
  className?: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Sort addresses: primary first, then by sortOrder
 */
function sortAddresses(addresses: ProjectAddress[]): ProjectAddress[] {
  return [...addresses].sort((a, b) => {
    // Primary addresses first
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;

    // Then by sortOrder
    const orderA = a.sortOrder ?? 999;
    const orderB = b.sortOrder ?? 999;
    return orderA - orderB;
  });
}

// =============================================================================
// COMPONENT
// =============================================================================

export function AddressListCard({
  addresses,
  onAddAddress,
  onEditAddress,
  className
}: AddressListCardProps) {
  const { t } = useTranslation('addresses');
  const iconSizes = useIconSizes();
  const sortedAddresses = sortAddresses(addresses);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">
            {t('list.title')}
          </CardTitle>
          {onAddAddress && (
            <Button
              variant="outline"
              size="sm"
              onClick={onAddAddress}
              className="flex items-center gap-2"
            >
              <Plus className={iconSizes.sm} />
              {t('list.addButton')}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Empty state */}
        {sortedAddresses.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <MapPin className={`${iconSizes.lg} text-muted-foreground mb-3`} />
            <p className="text-sm text-muted-foreground mb-1">
              {t('list.empty')}
            </p>
            {onAddAddress && (
              <Button
                variant="link"
                size="sm"
                onClick={onAddAddress}
                className="text-xs"
              >
                {t('list.addFirst')}
              </Button>
            )}
          </div>
        )}

        {/* Address list */}
        {sortedAddresses.map((address) => (
          <AddressCard
            key={address.id}
            address={address}
            onEdit={onEditAddress}
          />
        ))}

        {/* Address count */}
        {sortedAddresses.length > 0 && (
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              {t('list.total', { count: sortedAddresses.length })}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
