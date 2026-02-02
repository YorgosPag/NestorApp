/**
 * =============================================================================
 * 🗺️ ADDRESS MARKER COMPONENT
 * =============================================================================
 *
 * Pure presentation component για map marker rendering
 * Pattern: Google Maps Marker, MapLibre GL Marker
 *
 * Features:
 * - Visual distinction (Primary vs Secondary)
 * - Selection state (ring effect)
 * - Tooltip με address details
 * - Responsive sizing
 *
 * @file AddressMarker.tsx
 * @created 2026-02-02
 */

import React, { memo } from 'react';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import type { ProjectAddress } from '@/types/project/addresses';
import { formatAddressLine } from '@/types/project/address-helpers';
import { ADDRESS_MAP_CONFIG } from '@/config/address-map-config';

// =============================================================================
// COMPONENT INTERFACE
// =============================================================================

export interface AddressMarkerProps {
  /** Address data to display */
  address: ProjectAddress;

  /** Is this the primary address? */
  isPrimary: boolean;

  /** Is this marker currently selected? */
  isSelected: boolean;

  /** Click handler */
  onClick?: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * AddressMarker - Pure presentation component
 * Renders a single address marker με tooltip
 */
export const AddressMarker: React.FC<AddressMarkerProps> = memo(({
  address,
  isPrimary,
  isSelected,
  onClick
}) => {
  // Compute marker size based on state
  const size = isSelected
    ? ADDRESS_MAP_CONFIG.MARKER_SIZE.HOVER
    : isPrimary
      ? ADDRESS_MAP_CONFIG.MARKER_SIZE.PRIMARY
      : ADDRESS_MAP_CONFIG.MARKER_SIZE.SECONDARY;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            'rounded-full border-2 flex items-center justify-center',
            'transition-all cursor-pointer shadow-md hover:shadow-lg',
            isPrimary
              ? 'border-primary bg-primary/20'
              : 'border-accent bg-accent/20',
            isSelected && 'ring-4 ring-primary/30'
          )}
          style={{
            width: size,
            height: size,
            transition: `all ${ADDRESS_MAP_CONFIG.ANIMATION.MARKER_HIGHLIGHT}ms ease-in-out`
          }}
          onClick={onClick}
          role="button"
          tabIndex={0}
          aria-label={`Marker: ${formatAddressLine(address)}`}
        >
          <MapPin
            className={cn(
              'fill-current',
              isPrimary ? 'text-primary' : 'text-accent'
            )}
            size={size * 0.6} // Icon size = 60% of marker size
          />
        </div>
      </TooltipTrigger>

      <TooltipContent side="top" className="max-w-xs">
        <div className="text-xs space-y-1">
          {/* Address label or type */}
          <div className="font-semibold">
            {address.label || address.type}
          </div>

          {/* Formatted address line */}
          <div className="text-muted-foreground">
            {formatAddressLine(address)}
          </div>

          {/* Primary badge */}
          {isPrimary && (
            <Badge size="sm" variant="default">
              Κύρια Διεύθυνση
            </Badge>
          )}

          {/* Additional info */}
          {address.blockSide && (
            <div className="text-muted-foreground text-xs">
              {address.blockSideDescription || address.blockSide}
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
});

AddressMarker.displayName = 'AddressMarker';

export default AddressMarker;
