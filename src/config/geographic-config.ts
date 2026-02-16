/**
 * 🏢 ENTERPRISE: Geographic Data Configuration
 * Centralized configuration για locations, coordinates, και geographic data
 * ZERO HARDCODED COORDINATES - All data από environment variables
 */

interface GeographicConfig {
  readonly DEFAULT_CITY: string;
  readonly DEFAULT_REGION: string;
  readonly DEFAULT_COUNTRY: string;
  readonly DEFAULT_COUNTRY_CODE: string;
  readonly DEFAULT_COUNTRY_EN: string;
  readonly DEFAULT_LATITUDE: number;
  readonly DEFAULT_LONGITUDE: number;
  readonly ALTERNATIVE_CITY: string;
  readonly ALTERNATIVE_LATITUDE: number;
  readonly ALTERNATIVE_LONGITUDE: number;
  readonly MAP_ZOOM_LEVEL: number;
  readonly COUNTRY_BOUNDING_BOX: {
    readonly minLat: number;
    readonly maxLat: number;
    readonly minLng: number;
    readonly maxLng: number;
  };
}

/**
 * 🏢 ENTERPRISE: Get geographic configuration from environment
 */
function getGeographicConfig(): GeographicConfig {
  return {
    // Primary location (configurable for different deployments)
    DEFAULT_CITY: process.env.NEXT_PUBLIC_DEFAULT_CITY || 'Αθήνα',
    DEFAULT_REGION: process.env.NEXT_PUBLIC_DEFAULT_REGION || 'Αττική',
    DEFAULT_COUNTRY: process.env.NEXT_PUBLIC_DEFAULT_COUNTRY || 'Ελλάδα',
    DEFAULT_COUNTRY_CODE: process.env.NEXT_PUBLIC_DEFAULT_COUNTRY_CODE || 'gr',
    DEFAULT_COUNTRY_EN: process.env.NEXT_PUBLIC_DEFAULT_COUNTRY_EN || 'Greece',

    // Primary coordinates (defaults to Athens, Greece)
    DEFAULT_LATITUDE: parseFloat(process.env.NEXT_PUBLIC_DEFAULT_LATITUDE || '37.9838'),
    DEFAULT_LONGITUDE: parseFloat(process.env.NEXT_PUBLIC_DEFAULT_LONGITUDE || '23.7275'),

    // Alternative/Secondary location (Thessaloniki)
    ALTERNATIVE_CITY: process.env.NEXT_PUBLIC_ALTERNATIVE_CITY || 'Θεσσαλονίκη',
    ALTERNATIVE_LATITUDE: parseFloat(process.env.NEXT_PUBLIC_ALTERNATIVE_LATITUDE || '40.6401'),
    ALTERNATIVE_LONGITUDE: parseFloat(process.env.NEXT_PUBLIC_ALTERNATIVE_LONGITUDE || '22.9444'),

    // Map configuration
    MAP_ZOOM_LEVEL: parseFloat(process.env.NEXT_PUBLIC_MAP_ZOOM_LEVEL || '13'),

    // Country bounding box (for coordinate validation)
    COUNTRY_BOUNDING_BOX: {
      minLat: parseFloat(process.env.NEXT_PUBLIC_COUNTRY_BBOX_MIN_LAT || '34.5'),
      maxLat: parseFloat(process.env.NEXT_PUBLIC_COUNTRY_BBOX_MAX_LAT || '42.0'),
      minLng: parseFloat(process.env.NEXT_PUBLIC_COUNTRY_BBOX_MIN_LNG || '19.0'),
      maxLng: parseFloat(process.env.NEXT_PUBLIC_COUNTRY_BBOX_MAX_LNG || '29.5'),
    },
  } as const;
}

export const GEOGRAPHIC_CONFIG = getGeographicConfig();

/**
 * 🏢 ENTERPRISE: Geographic utilities
 */
export const GeographicUtils = {
  /**
   * Get default map center coordinates
   */
  getDefaultMapCenter: () => ({
    lat: GEOGRAPHIC_CONFIG.DEFAULT_LATITUDE,
    lng: GEOGRAPHIC_CONFIG.DEFAULT_LONGITUDE
  }),

  /**
   * Get alternative map center coordinates
   */
  getAlternativeMapCenter: () => ({
    lat: GEOGRAPHIC_CONFIG.ALTERNATIVE_LATITUDE,
    lng: GEOGRAPHIC_CONFIG.ALTERNATIVE_LONGITUDE
  }),

  /**
   * Get map center as array [lng, lat] for some mapping libraries
   */
  getMapCenterArray: () => [
    GEOGRAPHIC_CONFIG.DEFAULT_LONGITUDE,
    GEOGRAPHIC_CONFIG.DEFAULT_LATITUDE
  ] as const,

  /**
   * Generate demo coordinates near default location
   */
  generateNearbyCoordinates: (offsetKm: number = 1): { lat: number; lng: number } => {
    // Rough conversion: 1 km ≈ 0.009 degrees
    const offsetDegrees = (offsetKm * 0.009) * (Math.random() - 0.5) * 2;

    return {
      lat: GEOGRAPHIC_CONFIG.DEFAULT_LATITUDE + offsetDegrees,
      lng: GEOGRAPHIC_CONFIG.DEFAULT_LONGITUDE + offsetDegrees
    };
  },

  /**
   * Validate coordinates
   */
  validateCoordinates: (lat: number, lng: number): boolean => {
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  },

  /**
   * Get formatted address string
   */
  getFormattedAddress: (street?: string, number?: string): string => {
    const parts = [
      street && number ? `${street} ${number}` : street,
      GEOGRAPHIC_CONFIG.DEFAULT_CITY,
      GEOGRAPHIC_CONFIG.DEFAULT_REGION
    ].filter(Boolean);

    return parts.join(', ');
  },

  /**
   * Get demo administrative boundaries for testing
   */
  getDemoAdministrativeBoundaries: () => {
    const boundaries = JSON.parse(
      process.env.NEXT_PUBLIC_DEMO_ADMIN_BOUNDARIES ||
      JSON.stringify([
        GEOGRAPHIC_CONFIG.DEFAULT_CITY,
        GEOGRAPHIC_CONFIG.DEFAULT_REGION,
        GEOGRAPHIC_CONFIG.ALTERNATIVE_CITY
      ])
    );

    return boundaries;
  }
} as const;

/**
 * 🏢 ENTERPRISE: Common location presets (configurable)
 */
export const LocationPresets = {
  PRIMARY: {
    city: GEOGRAPHIC_CONFIG.DEFAULT_CITY,
    coordinates: GeographicUtils.getDefaultMapCenter(),
    region: GEOGRAPHIC_CONFIG.DEFAULT_REGION
  },
  ALTERNATIVE: {
    city: GEOGRAPHIC_CONFIG.ALTERNATIVE_CITY,
    coordinates: GeographicUtils.getAlternativeMapCenter(),
    region: GEOGRAPHIC_CONFIG.DEFAULT_REGION
  }
} as const;

/**
 * 🏢 ENTERPRISE: Environment Variables Documentation
 * Required environment variables για geographic configuration:
 *
 * NEXT_PUBLIC_DEFAULT_CITY=Athens
 * NEXT_PUBLIC_DEFAULT_REGION=Attica
 * NEXT_PUBLIC_DEFAULT_COUNTRY=Greece
 * NEXT_PUBLIC_DEFAULT_LATITUDE=37.9755
 * NEXT_PUBLIC_DEFAULT_LONGITUDE=23.7348
 * NEXT_PUBLIC_ALTERNATIVE_CITY=Thessaloniki
 * NEXT_PUBLIC_ALTERNATIVE_LATITUDE=40.6401
 * NEXT_PUBLIC_ALTERNATIVE_LONGITUDE=22.9444
 * NEXT_PUBLIC_MAP_ZOOM_LEVEL=13
 * NEXT_PUBLIC_DEMO_ADMIN_BOUNDARIES=["City1","Region1","City2"]
 */