/* eslint-disable custom/no-hardcoded-strings */
/**
 * =============================================================================
 * 🗺️ ADDRESS MAP — Configuration, Types & SVG Components
 * =============================================================================
 *
 * Extracted from AddressMap.tsx for Google SRP compliance (<500 lines).
 * Contains: PIN_COLORS, BRANCH_PIN_COLORS, AUTO_PAN, DraggableMarkerPin,
 * AddressMapProps interface, and helper types.
 *
 * @file address-map-config.tsx
 * @created 2026-03-28
 * @see AddressMap.tsx
 */

import React from 'react';
import { colors } from '@/styles/design-tokens';
import { getStatusColor } from '@/lib/design-system';
import type { ProjectAddress, PartialProjectAddress } from '@/types/project/addresses';
import type { GeocodingServiceResult } from '@/lib/geocoding/geocoding-service';
import type { AddressMapHeightPreset } from '@/config/address-map-config';

// =============================================================================
// PIN COLOR CONSTANTS
// =============================================================================

/** Map pin SVG colors — SSoT: design-tokens */
export const PIN_COLORS = {
  body: colors.blue['500'],          // #3b82f6 — primary brand
  stroke: colors.background.primary, // white
  innerCircle: colors.background.primary, // white
  // eslint-disable-next-line design-system/no-hardcoded-colors
  shadow: 'rgba(0,0,0,0.3)',         // subtle shadow
  labelClass: `${getStatusColor('pending', 'text')} ${getStatusColor('pending', 'bg')}/90`,
} as const;

/** Branch pin colors — visually distinct from HQ */
export const BRANCH_PIN_COLORS = {
  body: colors.orange['500'],        // #f97316 — orange for branches
  stroke: colors.background.primary,
  innerCircle: colors.background.primary,
  // eslint-disable-next-line design-system/no-hardcoded-colors
  shadow: 'rgba(0,0,0,0.3)',
  labelClass: `${getStatusColor('construction', 'text')} ${getStatusColor('construction', 'bg')}/90`,
} as const;

/** Auto-pan configuration for edge dragging */
export const AUTO_PAN = {
  EDGE_THRESHOLD: 60,   // pixels from viewport edge to start panning
  PAN_SPEED: 8,         // pixels per pan step
} as const;

// =============================================================================
// COMPONENT INTERFACES
// =============================================================================

export interface AddressMapProps {
  /** Addresses to display on map */
  addresses: ProjectAddress[];

  /** Highlight primary address με larger marker */
  highlightPrimary?: boolean;

  /** Show geocoding status badges */
  showGeocodingStatus?: boolean;

  /** Map container height preset (centralized layout tokens) */
  heightPreset?: AddressMapHeightPreset;

  /** Enable click-to-focus interaction */
  enableClickToFocus?: boolean;

  /** Marker click callback */
  onMarkerClick?: (address: ProjectAddress, index: number) => void;

  /** Geocoding complete callback */
  onGeocodingComplete?: (results: Map<string, GeocodingServiceResult>) => void;

  /** Show "Locate me" button for user GPS position (default: true) */
  showLocateMe?: boolean;

  /** Enable draggable markers (for add/edit mode) */
  draggableMarkers?: boolean;

  /** Callback when user drags a marker — provides reverse-geocoded address data + address index */
  onAddressDragUpdate?: (addressData: Partial<PartialProjectAddress>, addressIndex: number) => void;

  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// GEOCODING TYPES
// =============================================================================

/** Status of the geocoding process */
export type GeocodingStatus = 'idle' | 'loading' | 'success' | 'partial' | 'error';

/** Position for a dragged marker */
export interface DragPosition {
  lng: number;
  lat: number;
}

// =============================================================================
// DRAGGABLE MARKER PIN — SVG Component
// =============================================================================

interface DraggableMarkerPinProps {
  isPrimary?: boolean;
  /** Show pulsating glow for new empty pins */
  pulsate?: boolean;
  /** Label shown below the pin */
  label?: string;
}

/** SVG map pin component — used for both draggable and read-only markers */
export function DraggableMarkerPin({ isPrimary, pulsate, label }: DraggableMarkerPinProps) {
  const size = isPrimary ? 40 : 32;
  const viewBoxHeight = Math.round(size * 1.25);
  const pinColors = isPrimary ? PIN_COLORS : BRANCH_PIN_COLORS;
  return (
    <figure className="flex flex-col items-center m-0">
      <svg
        width={size}
        height={viewBoxHeight}
        viewBox="0 0 40 50"
        xmlns="http://www.w3.org/2000/svg"
        className={`cursor-grab active:cursor-grabbing drop-shadow-md ${pulsate ? 'animate-bounce' : ''}`}
      >
        <ellipse cx="20" cy="47" rx="8" ry="3" fill={pinColors.shadow} />
        <path
          d="M 20 0 C 11.163 0 4 7.163 4 16 C 4 25 20 45 20 45 C 20 45 36 25 36 16 C 36 7.163 28.837 0 20 0 Z"
          fill={pinColors.body}
          stroke={pinColors.stroke}
          strokeWidth="2"
        />
        <circle cx="20" cy="16" r="6" fill={pinColors.innerCircle} />
      </svg>
      {label && (
        <figcaption
          className={`mt-0.5 text-[10px] font-semibold leading-none whitespace-nowrap rounded px-1 py-0.5 shadow-sm ${pinColors.labelClass}`}
        >
          {label}
        </figcaption>
      )}
    </figure>
  );
}
