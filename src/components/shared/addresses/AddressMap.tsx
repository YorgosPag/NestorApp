/**
 * =============================================================================
 * 🗺️ ADDRESS MAP COMPONENT
 * =============================================================================
 *
 * Enterprise map component για visualization of project addresses
 * Pattern: SAP Real Estate, Autodesk Construction Cloud, Procore
 *
 * Features:
 * - Automatic geocoding με AddressResolver
 * - Interactive markers με primary/secondary distinction
 * - Auto-fit bounds to markers
 * - Click-to-focus interaction
 * - Loading/Error states
 * - Caching for performance
 *
 * Architecture:
 * AddressMap (Domain-specific) → InteractiveMap (Generic GeoCanvas)
 *
 * @file AddressMap.tsx
 * @created 2026-02-02
 */

'use client';

import React, { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
import { Source, Layer } from 'react-map-gl/maplibre';
import { Loader2, AlertTriangle } from 'lucide-react';
import { LngLatBounds } from 'maplibre-gl';
import type { Map as MaplibreMap } from 'maplibre-gl';

import { InteractiveMap } from '@/subapps/geo-canvas/components/InteractiveMap';
import { PolygonSystemProvider } from '@/subapps/geo-canvas/systems/polygon-system';
import { AddressMarker } from './AddressMarker';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { TooltipProvider } from '@/components/ui/tooltip';

import type { ProjectAddress } from '@/types/project/addresses';
import {
  formatAddressForGeocoding,
  getGeocodableAddresses
} from '@/types/project/address-helpers';
import {
  AddressResolver,
  type GeocodingResult
} from '@/services/real-estate-monitor/AddressResolver';
import { ADDRESS_MAP_CONFIG } from '@/config/address-map-config';

// =============================================================================
// COMPONENT INTERFACE
// =============================================================================

export interface AddressMapProps {
  /** Addresses to display on map */
  addresses: ProjectAddress[];

  /** Highlight primary address με larger marker */
  highlightPrimary?: boolean;

  /** Show geocoding status badges */
  showGeocodingStatus?: boolean;

  /** Map container height (pixels or CSS string) */
  height?: string | number;

  /** Enable click-to-focus interaction */
  enableClickToFocus?: boolean;

  /** Marker click callback */
  onMarkerClick?: (address: ProjectAddress, index: number) => void;

  /** Geocoding complete callback */
  onGeocodingComplete?: (results: Map<string, GeocodingResult>) => void;

  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * AddressMap - Enterprise address visualization component
 * Wraps InteractiveMap με domain-specific address logic
 */
export const AddressMap: React.FC<AddressMapProps> = memo(({
  addresses,
  highlightPrimary = true,
  showGeocodingStatus = true,
  height = ADDRESS_MAP_CONFIG.DEFAULT_HEIGHT,
  enableClickToFocus = true,
  onMarkerClick,
  onGeocodingComplete,
  className = ''
}) => {
  // ===========================================================================
  // STATE MANAGEMENT
  // ===========================================================================

  const [geocodedAddresses, setGeocodedAddresses] = useState<Map<string, GeocodingResult>>(new Map());
  const [geocodingStatus, setGeocodingStatus] = useState<'idle' | 'loading' | 'success' | 'partial' | 'error'>('idle');
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  const mapRef = useRef<MaplibreMap | null>(null);
  const addressResolver = useRef(new AddressResolver({
    useCache: true,
    fallbackToArea: true,
    providers: ['nominatim'],
    timeout: 5000
  }));

  // ===========================================================================
  // GEOCODING EFFECT
  // ===========================================================================

  /**
   * Geocode all addresses on mount/change
   * Uses AddressResolver με caching για performance
   */
  useEffect(() => {
    const geocodeAllAddresses = async () => {
      if (addresses.length === 0) {
        setGeocodingStatus('idle');
        return;
      }

      setGeocodingStatus('loading');

      try {
        // Filter geocodable addresses (have street + city)
        const geocodable = getGeocodableAddresses(addresses);

        if (geocodable.length === 0) {
          setGeocodingStatus('error');
          return;
        }

        // Resolve all addresses
        const results = await Promise.allSettled(
          geocodable.map(addr =>
            addressResolver.current.resolveAddress(formatAddressForGeocoding(addr))
          )
        );

        // Build result map
        const geocodedMap = new Map<string, GeocodingResult>();
        let successCount = 0;

        results.forEach((result, idx) => {
          if (result.status === 'fulfilled' && result.value) {
            geocodedMap.set(geocodable[idx].id, result.value);
            successCount++;
          }
        });

        setGeocodedAddresses(geocodedMap);

        // 🐛 DEBUG: Log geocoding results
        console.log('🗺️ AddressMap: Geocoding complete', {
          totalAddresses: addresses.length,
          geocodableAddresses: geocodable.length,
          successCount,
          geocodedMap: Array.from(geocodedMap.entries()),
        });

        // Determine status
        if (successCount === 0) {
          setGeocodingStatus('error');
        } else if (successCount < geocodable.length) {
          setGeocodingStatus('partial');
        } else {
          setGeocodingStatus('success');
        }

        // Notify parent
        if (onGeocodingComplete) {
          onGeocodingComplete(geocodedMap);
        }
      } catch (error) {
        console.error('❌ Geocoding failed:', error);
        setGeocodingStatus('error');
      }
    };

    geocodeAllAddresses();
  }, [addresses, onGeocodingComplete]);

  // ===========================================================================
  // FIT BOUNDS EFFECT
  // ===========================================================================

  /**
   * Auto-fit map bounds to include all markers
   * Runs when geocoding completes και map is ready
   */
  useEffect(() => {
    console.log('🎯 fitBounds effect triggered', {
      hasMapRef: !!mapRef.current,
      mapReady,
      geocodedCount: geocodedAddresses.size,
    });

    if (!mapRef.current || !mapReady || geocodedAddresses.size === 0) {
      console.warn('⚠️ fitBounds skipped - conditions not met');
      return;
    }

    try {
      const bounds = new LngLatBounds();

      geocodedAddresses.forEach(result => {
        console.log('📍 Adding to bounds:', { lat: result.lat, lng: result.lng });
        bounds.extend([result.lng, result.lat]);
      });

      // Only fit bounds if we have valid bounds
      if (!bounds.isEmpty()) {
        console.log('✅ Calling fitBounds', { bounds });
        mapRef.current.fitBounds(bounds, {
          padding: ADDRESS_MAP_CONFIG.FIT_BOUNDS_PADDING,
          maxZoom: ADDRESS_MAP_CONFIG.DEFAULT_MAX_ZOOM,
          duration: ADDRESS_MAP_CONFIG.ANIMATION.FIT_BOUNDS
        });
      } else {
        console.warn('⚠️ Bounds is empty!');
      }
    } catch (error) {
      console.error('❌ fitBounds failed:', error);
    }
  }, [geocodedAddresses, mapReady]);

  // ===========================================================================
  // GEOJSON DATA
  // ===========================================================================

  /**
   * Create GeoJSON FeatureCollection from geocoded addresses
   */
  const markersGeoJSON = useMemo(() => {
    const features = addresses
      .map(address => {
        const geocoded = geocodedAddresses.get(address.id);
        if (!geocoded) return null;

        return {
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [geocoded.lng, geocoded.lat]
          },
          properties: {
            id: address.id,
            street: address.street,
            city: address.city,
            isPrimary: address.isPrimary,
            label: address.label || address.type
          }
        };
      })
      .filter(Boolean);

    return {
      type: 'FeatureCollection' as const,
      features: features as any[]
    };
  }, [addresses, geocodedAddresses]);

  // ===========================================================================
  // EVENT HANDLERS
  // ===========================================================================

  /**
   * Handle map ready event
   * Enterprise pattern: Load custom marker icon into map sprite
   */
  const handleMapReady = useCallback((map: MaplibreMap) => {
    console.log('🗺️ Map ready!', { map });
    mapRef.current = map;
    setMapReady(true);

    // 🏢 ENTERPRISE: Load custom pin marker icon
    // SVG data URL for a professional map pin (teardrop shape)
    // Uses primary blue color (#3b82f6) for brand consistency
    const pinSVG = `
      <svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
        <!-- Pin shadow -->
        <ellipse cx="20" cy="47" rx="8" ry="3" fill="rgba(0,0,0,0.3)"/>
        <!-- Pin body (teardrop) -->
        <path d="M 20 0 C 11.163 0 4 7.163 4 16 C 4 25 20 45 20 45 C 20 45 36 25 36 16 C 36 7.163 28.837 0 20 0 Z"
              fill="#3b82f6"
              stroke="#fff"
              stroke-width="2"/>
        <!-- Inner circle -->
        <circle cx="20" cy="16" r="6" fill="#fff"/>
      </svg>
    `.trim();

    const pinImage = new Image(40, 50);
    pinImage.onload = () => {
      if (!map.hasImage('address-pin')) {
        map.addImage('address-pin', pinImage);
      }
      setMapLoaded(true);
      console.log('✅ Map fully loaded - custom pin icon added');
    };
    pinImage.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(pinSVG)}`;
  }, []);

  /**
   * Handle marker click
   */
  const handleMarkerClick = useCallback((address: ProjectAddress, index: number) => {
    setSelectedMarkerId(address.id);

    // Notify parent
    if (onMarkerClick) {
      onMarkerClick(address, index);
    }

    // Auto-deselect after animation duration
    setTimeout(() => {
      setSelectedMarkerId(null);
    }, ADDRESS_MAP_CONFIG.ANIMATION.MARKER_HIGHLIGHT * 6);
  }, [onMarkerClick]);

  // ===========================================================================
  // RENDERING
  // ===========================================================================

  // Loading state
  if (geocodingStatus === 'loading') {
    return (
      <div
        className={`flex items-center justify-center bg-muted rounded-lg ${className}`}
        style={{ height }}
      >
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">
            Εντοπισμός διευθύνσεων στον χάρτη...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (geocodingStatus === 'error') {
    return (
      <Alert variant="destructive" className={className}>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Δεν ήταν δυνατός ο εντοπισμός των διευθύνσεων στον χάρτη.
          Βεβαιωθείτε ότι οι διευθύνσεις είναι έγκυρες.
        </AlertDescription>
      </Alert>
    );
  }

  // Success/Partial: Render map (ONLY after geocoding completes)
  const shouldRenderMap = geocodingStatus === 'success' || geocodingStatus === 'partial';

  console.log('🎯 AddressMap render', {
    geocodingStatus,
    shouldRenderMap,
    geocodedCount: geocodedAddresses.size,
  });

  return (
    <div className={`relative ${className}`} style={{ height }}>
      <PolygonSystemProvider>
        <TooltipProvider>
          {/* 🗺️ Interactive Map (GeoCanvas) - Render ONLY after geocoding */}
          {shouldRenderMap && (
            <InteractiveMap
              transformState={{
                scale: 1,
                offsetX: 0,
                offsetY: 0
              }}
              onMapReady={handleMapReady}
              showStatusBar={false}
              className="w-full h-full rounded-lg overflow-hidden"
            >
            {/* 📍 Address Markers - Enterprise Symbol Layer με custom pin icon */}
            {mapLoaded && markersGeoJSON.features.length > 0 && (
              <Source
                id="address-markers"
                type="geojson"
                data={markersGeoJSON}
              >
                {/* Symbol layer με professional pin icon */}
                <Layer
                  id="address-markers-symbols"
                  type="symbol"
                  layout={{
                    'icon-image': 'address-pin',
                    'icon-size': 1,
                    'icon-anchor': 'bottom',
                    'icon-allow-overlap': true,
                    'text-field': ['get', 'label'],
                    'text-size': 12,
                    'text-anchor': 'top',
                    'text-offset': [0, 0.5],
                    'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular']
                  }}
                  paint={{
                    'text-color': '#1e293b', // slate-800 for readability
                    'text-halo-color': '#ffffff',
                    'text-halo-width': 2
                  }}
                />
              </Source>
            )}
            </InteractiveMap>
          )}

          {/* 🏷️ Geocoding Status Badge */}
          {showGeocodingStatus && geocodingStatus === 'partial' && (
            <div className="absolute top-4 right-4">
              <Badge variant="secondary" className="shadow-md">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {geocodedAddresses.size} από {getGeocodableAddresses(addresses).length} διευθύνσεις
              </Badge>
            </div>
          )}
        </TooltipProvider>
      </PolygonSystemProvider>
    </div>
  );
});

AddressMap.displayName = 'AddressMap';

export default AddressMap;
