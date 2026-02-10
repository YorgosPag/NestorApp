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
    <div
      className={cn(
        'rounded-full border-4 flex items-center justify-center',
        'transition-all cursor-pointer shadow-xl',
        isSelected && 'ring-4 ring-blue-500/50'
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: isPrimary ? '#3b82f6' : '#f97316', // Blue for primary, Orange for secondary
        borderColor: isPrimary ? '#1e40af' : '#ea580c',
        transition: `all ${ADDRESS_MAP_CONFIG.ANIMATION.MARKER_HIGHLIGHT}ms ease-in-out`,
        zIndex: 1000 // Ensure marker is on top
      }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`Marker: ${formatAddressLine(address)}`}
      title={formatAddressLine(address)} // Simple tooltip
    >
      <MapPin
        className="text-white"
        size={size * 0.6} // Icon size = 60% of marker size
        fill="white"
      />
    </div>
  );
});

AddressMarker.displayName = 'AddressMarker';

export default AddressMarker;

