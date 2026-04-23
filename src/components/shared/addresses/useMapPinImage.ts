'use client';

import { useCallback, useRef, useState, type MutableRefObject } from 'react';
import { PIN_COLORS } from '@/components/shared/addresses/address-map-config';
import type { MapInstance } from '@/subapps/geo-canvas/hooks/map/useMapInteractions';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useMapPinImage');

const PIN_SVG = `
  <svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="20" cy="47" rx="8" ry="3" fill="${PIN_COLORS.shadow}"/>
    <path d="M 20 0 C 11.163 0 4 7.163 4 16 C 4 25 20 45 20 45 C 20 45 36 25 36 16 C 36 7.163 28.837 0 20 0 Z"
          fill="${PIN_COLORS.body}"
          stroke="${PIN_COLORS.stroke}"
          stroke-width="2"/>
    <circle cx="20" cy="16" r="6" fill="${PIN_COLORS.innerCircle}"/>
  </svg>
`.trim();

export interface UseMapPinImageResult {
  mapRef: MutableRefObject<MapInstance | null>;
  mapReady: boolean;
  mapLoaded: boolean;
  handleMapReady: (map: MapInstance) => void;
}

/**
 * Register the `address-pin` raster on the map as soon as it becomes ready.
 * Guards against stale refs: the SVG load is async, so by the time onload
 * fires the map (or its style) may have been torn down.
 */
export function useMapPinImage(): UseMapPinImageResult {
  const mapRef = useRef<MapInstance | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  const handleMapReady = useCallback((map: MapInstance) => {
    mapRef.current = map;
    setMapReady(true);

    const pinImage = new Image(40, 50);
    pinImage.onload = () => {
      const currentMap = mapRef.current;
      const styleLoaded = typeof currentMap?.isStyleLoaded === 'function'
        ? currentMap.isStyleLoaded()
        : false;
      if (!currentMap || !styleLoaded) {
        setMapLoaded(true);
        return;
      }
      try {
        if (!currentMap.hasImage('address-pin')) {
          currentMap.addImage('address-pin', pinImage);
        }
      } catch (err) {
        logger.warn('Failed to register address-pin image', { error: err });
      }
      setMapLoaded(true);
    };
    pinImage.onerror = () => {
      logger.warn('Pin SVG image failed to load, using Marker component fallback');
      setMapLoaded(true);
    };
    pinImage.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(PIN_SVG)}`;
  }, []);

  return { mapRef, mapReady, mapLoaded, handleMapReady };
}
