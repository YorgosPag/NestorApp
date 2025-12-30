/**
 * 🏛️ GREEK ADMINISTRATIVE TYPES - Phase 1.2
 *
 * TypeScript definitions για την Ελληνική διοικητική διαίρεση
 * Βασισμένα στην έρευνα Overpass API & OpenStreetMap data
 *
 * @module types/administrative-types
 */

// ============================================================================
// GEOJSON TYPE DEFINITIONS (Enterprise Local Types)
// ============================================================================

declare global {
  namespace GeoJSON {
    interface Geometry {
      type: string;
      coordinates?: any;
      geometries?: Geometry[];
    }

    interface Feature {
      type: 'Feature';
      geometry: Geometry | null;
      properties: Record<string, any> | null;
    }

    interface FeatureCollection {
      type: 'FeatureCollection';
      features: Feature[];
    }
  }
}

// ============================================================================
// CORE ADMINISTRATIVE TYPES
// ============================================================================

/**
 * Greek Administrative Levels - OpenStreetMap admin_level mapping
 */
export enum GreekAdminLevel {
  COUNTRY = 2,           // Εθνικά σύνορα - Ελλάδα
  REGION = 4,            // Περιφέρειες (13 σύνολο)
  MUNICIPALITY = 8,      // Δήμοι (325 σύνολο μετά Καλλικράτη)
  MUNICIPAL_UNIT = 9,    // Δημοτικές ενότητες (πρώην δήμοι)
  COMMUNITY = 10,        // Κοινότητες / Οικισμοί
  DISTRICT = 11,         // Εκλογικές περιφέρειες
  POSTAL_CODE = 12       // Ταχυδρομικοί Κώδικες (5ψήφιοι T.K.)
}

/**
 * Basic Geographic Information
 */
export interface GeographicInfo {
  name: string;           // Ελληνικό όνομα
  nameEn?: string;        // English name
  nameAlt?: string[];     // Alternative names
  code?: string;          // Official code (αν υπάρχει)
}

/**
 * Bounding Box για γεωγραφικά όρια
 */
export interface BoundingBox {
  north: number;   // Maximum latitude
  south: number;   // Minimum latitude
  east: number;    // Maximum longitude
  west: number;    // Minimum longitude
}

/**
 * Population Statistics (προαιρετικό)
 */
export interface PopulationInfo {
  total?: number;
  density?: number;  // per km²
  year?: number;     // Census year
}

// ============================================================================
// HIERARCHICAL ADMINISTRATIVE STRUCTURE
// ============================================================================

/**
 * Greek Community (Κοινότητα/Οικισμός)
 * admin_level = 10
 */
export interface GreekCommunity extends GeographicInfo {
  id: string;
  adminLevel: GreekAdminLevel.COMMUNITY;
  municipalUnitId: string;  // Parent municipal unit
  population?: PopulationInfo;
  geometry?: GeoJSON.Geometry;
}

/**
 * Greek Postal Code Area (Ταχυδρομική Περιοχή)
 * admin_level = 12 - 5ψήφιος ταχυδρομικός κώδικας
 */
export interface GreekPostalCode extends GeographicInfo {
  id: string;
  adminLevel: GreekAdminLevel.POSTAL_CODE;
  postalCode: string;       // 5-digit postal code (π.χ. "15124")
  municipalityId: string;   // Parent municipality
  coverage?: {
    streets?: string[];     // Streets covered by this postal code
    districts?: string[];   // Districts/areas covered
    landmarks?: string[];   // Notable landmarks
  };
  deliveryInfo?: {
    postOffice?: string;    // Closest post office
    deliveryRoutes?: number; // Number of delivery routes
  };
  population?: PopulationInfo;
  geometry?: GeoJSON.Geometry;
}

/**
 * Greek Municipal Unit (Δημοτική Ενότητα)
 * admin_level = 9 - Οι πρώην δήμοι πριν το Καλλικράτη
 */
export interface GreekMunicipalUnit extends GeographicInfo {
  id: string;
  adminLevel: GreekAdminLevel.MUNICIPAL_UNIT;
  municipalityId: string;  // Parent municipality
  communities?: GreekCommunity[];
  population?: PopulationInfo;
  geometry?: GeoJSON.Geometry;
}

/**
 * Greek Municipality (Δήμος)
 * admin_level = 8 - 325 δήμοι σύνολο (μετά Καλλικράτη 2011)
 */
export interface GreekMunicipality extends GeographicInfo {
  id: string;
  adminLevel: GreekAdminLevel.MUNICIPALITY;
  regionId: string;        // Parent region

  // Hierarchy
  municipalUnits?: GreekMunicipalUnit[];
  communities?: GreekCommunity[];

  // Geographic info
  area?: number;           // km²
  population?: PopulationInfo;
  geometry?: GeoJSON.Geometry;
  bounds?: BoundingBox;

  // Administrative info
  capital?: string;        // Έδρα δήμου
  website?: string;
  phone?: string;
  email?: string;
}

/**
 * Greek Region (Περιφέρεια)
 * admin_level = 4 - 13 περιφέρειες σύνολο
 */
export interface GreekRegion extends GeographicInfo {
  id: string;
  adminLevel: GreekAdminLevel.REGION;

  // Hierarchy
  municipalities: GreekMunicipality[];

  // Geographic info
  area?: number;           // km²
  population?: PopulationInfo;
  geometry?: GeoJSON.Geometry;
  bounds?: BoundingBox;

  // Administrative info
  capital: string;         // Πρωτεύουσα περιφέρειας
  website?: string;
}

/**
 * Complete Greek Administrative Structure
 */
export interface GreekAdministrativeStructure {
  country: {
    name: "Ελλάδα";
    nameEn: "Greece";
    iso: "GR";
    adminLevel: GreekAdminLevel.COUNTRY;
  };
  regions: GreekRegion[];
  lastUpdated: Date;
  dataSource: "OpenStreetMap" | "Official" | "Combined";
}

// ============================================================================
// SEARCH & QUERY TYPES
// ============================================================================

/**
 * Administrative Search Query
 */
export interface AdminSearchQuery {
  query: string;                    // Search text
  adminLevel?: GreekAdminLevel;     // Specific level filter
  regionId?: string;                // Limit to specific region
  includeGeometry?: boolean;        // Include boundary geometry
  language?: "el" | "en";           // Preferred language
}

/**
 * Administrative Search Result
 */
export interface AdminSearchResult {
  id: string;
  name: string;
  nameEn?: string;
  adminLevel: GreekAdminLevel;
  hierarchy: AdminHierarchyPath;
  geometry?: GeoJSON.Geometry;
  bounds?: BoundingBox;
  confidence: number;               // Search relevance (0-1)
  // ✅ ENTERPRISE FIX: Add simplification property for geometry optimization
  simplification?: {
    originalPoints: number;
    simplifiedPoints: number;
    tolerance?: number;
    reductionRatio?: number;
    optimizationLevel?: 'none' | 'light' | 'medium' | 'heavy';
    qualityScore?: number;
  };
}

/**
 * Hierarchy Path για search results
 */
export interface AdminHierarchyPath {
  country: string;                  // "Ελλάδα"
  region: string;                   // "Αττική"
  municipality?: string;            // "Δήμος Αθηναίων"
  municipalUnit?: string;           // "Κολωνάκι"
  community?: string;               // Specific community
}

// ============================================================================
// OVERPASS API TYPES
// ============================================================================

/**
 * Overpass API Query Configuration
 */
export interface OverpassQueryConfig {
  timeout: number;          // Query timeout in seconds
  maxSize?: number;         // Memory limit
  dateFilter?: Date;        // Data since date
  format: "json" | "xml";   // Response format
}

/**
 * Overpass API Response για administrative boundaries
 */
export interface OverpassAdminResponse {
  version: number;
  generator: string;
  elements: OverpassElement[];
}

/**
 * Overpass Element Structure
 */
export interface OverpassElement {
  type: "relation" | "way" | "node";
  id: number;
  timestamp?: string;
  version?: number;
  changeset?: number;
  user?: string;
  uid?: number;
  tags?: Record<string, string>;
  members?: OverpassMember[];
  geometry?: OverpassGeometry[];
  // Node-specific coordinates (for postal code points)
  lat?: number;
  lon?: number;
}

/**
 * Overpass Member (για relations)
 */
export interface OverpassMember {
  type: "relation" | "way" | "node";
  ref: number;
  role: string;
  geometry?: OverpassGeometry[];
}

/**
 * Overpass Geometry
 */
export interface OverpassGeometry {
  lat: number;
  lon: number;
}

// ============================================================================
// BOUNDARY RENDERING TYPES
// ============================================================================

/**
 * Boundary Display Configuration
 */
export interface BoundaryDisplayConfig {
  visible: boolean;
  strokeColor: string;
  strokeWidth: number;
  strokeOpacity: number;
  fillColor: string;
  fillOpacity: number;
  zIndex: number;
  interactive: boolean;
  showLabels: boolean;
}

/**
 * Administrative Layer Configuration
 */
export interface AdminLayerConfig {
  [GreekAdminLevel.REGION]: BoundaryDisplayConfig;
  [GreekAdminLevel.MUNICIPALITY]: BoundaryDisplayConfig;
  [GreekAdminLevel.MUNICIPAL_UNIT]: BoundaryDisplayConfig;
  [GreekAdminLevel.COMMUNITY]: BoundaryDisplayConfig;
}

/**
 * Boundary Interaction Event
 */
export interface BoundaryInteractionEvent {
  type: "click" | "hover" | "select";
  adminId: string;
  adminLevel: GreekAdminLevel;
  coordinates: [number, number];  // [lng, lat]
  properties: Record<string, unknown>;
}

// ============================================================================
// CACHING & PERFORMANCE TYPES
// ============================================================================

/**
 * Administrative Data Cache Entry
 */
export interface AdminCacheEntry {
  id: string;
  data: GreekMunicipality | GreekRegion | GreekMunicipalUnit;
  geometry?: GeoJSON.Geometry;
  timestamp: number;
  expiresAt: number;
  size: number;  // Bytes
}

/**
 * Cache Statistics
 */
export interface AdminCacheStats {
  totalEntries: number;
  totalSize: number;       // Bytes
  hitRate: number;         // Percentage
  evictions: number;
  lastCleanup: number;     // Timestamp
  memoryUsage: number;     // MB
}

// ============================================================================
// WELL-KNOWN GREEK ADMINISTRATIVE ENTITIES
// ============================================================================

/**
 * Major Greek Regions
 */
export enum MajorGreekRegions {
  ATTICA = "Αττική",
  CENTRAL_MACEDONIA = "Κεντρική Μακεδονία",
  THESSALY = "Θεσσαλία",
  CRETE = "Κρήτη",
  WESTERN_GREECE = "Δυτική Ελλάδα",
  CENTRAL_GREECE = "Στερεά Ελλάδα",
  PELOPONNESE = "Πελοπόννησος",
  IONIAN_ISLANDS = "Ιόνια Νησιά",
  NORTH_AEGEAN = "Βόρειο Αιγαίο",
  SOUTH_AEGEAN = "Νότιο Αιγαίο",
  EPIRUS = "Ήπειρος",
  WESTERN_MACEDONIA = "Δυτική Μακεδονία",
  EASTERN_MACEDONIA_THRACE = "Ανατολική Μακεδονία και Θράκη"
}

/**
 * Major Greek Municipalities
 */
export enum MajorGreekMunicipalities {
  ATHENS = "Δήμος Αθηναίων",
  THESSALONIKI = "Δήμος Θεσσαλονίκης",
  PATRAS = "Δήμος Πατρέων",
  PIRAEUS = "Δήμος Πειραιώς",
  LARISSA = "Δήμος Λαρισαίων",
  HERAKLION = "Δήμος Ηρακλείου",
  VOLOS = "Δήμος Βόλου",
  IOANNINA = "Δήμος Ιωαννιτών"
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Generic API Response Wrapper
 */
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
  metadata?: {
    source: string;
    timestamp: number;
    version: string;
  };
}

/**
 * Geographic Coordinate
 */
export interface Coordinate {
  lat: number;
  lng: number;
}

/**
 * Administrative Entity Reference
 */
export interface AdminEntityRef {
  id: string;
  name: string;
  adminLevel: GreekAdminLevel;
}

// ============================================================================
// SEARCH HISTORY & ADVANCED FEATURES TYPES (Phase 6)
// ============================================================================

/**
 * Search History Entry
 */
export interface SearchHistoryEntry {
  id: string;
  query: string;
  searchType: 'address' | 'administrative' | 'postal_code';
  timestamp: number;
  results: AdminSearchResult[];
  selectedResult?: AdminSearchResult;
  location?: {
    lat: number;
    lng: number;
  };
  metadata?: {
    source: 'manual' | 'suggestion' | 'quick_search';
    confidence: number;
    duration: number; // Search duration in ms
  };
}

/**
 * Advanced Search Filters
 */
export interface AdvancedSearchFilters {
  adminLevels?: GreekAdminLevel[];
  regions?: string[];          // Filter by specific regions
  postalCodes?: string[];      // Filter by postal code ranges
  population?: {
    min?: number;
    max?: number;
  };
  area?: {                     // Geographic area filters
    min?: number;              // Minimum area in km²
    max?: number;              // Maximum area in km²
  };
  bbox?: BoundingBox;          // Spatial bounding box filter
  fuzzyMatch?: boolean;        // Enable fuzzy string matching
  includeHistorical?: boolean; // Include historical boundaries
}

/**
 * Spatial Relationship Query
 */
export interface SpatialQuery {
  type: 'intersects' | 'contains' | 'within' | 'touches' | 'crosses';
  geometry: GeoJSON.Geometry;
  targetAdminLevels?: GreekAdminLevel[];
  maxResults?: number;
}

/**
 * Search Suggestions Configuration
 */
export interface SearchSuggestionConfig {
  maxSuggestions: number;
  includeAlternative: boolean;  // Include alternative spellings
  includeTransliterated: boolean; // Include transliterated names
  popularityBoost: boolean;     // Boost popular searches
  locationBias?: {              // Bias suggestions based on location
    lat: number;
    lng: number;
    radius: number;             // Bias radius in km
  };
}

/**
 * Enhanced Search Query με Advanced Features
 */
export interface EnhancedSearchQuery extends AdminSearchQuery {
  filters?: AdvancedSearchFilters;
  spatialQuery?: SpatialQuery;
  suggestionConfig?: SearchSuggestionConfig;
  includePostalCodes?: boolean;
  searchHistory?: boolean;      // Include results from search history
}

/**
 * Search Analytics Data
 */
export interface SearchAnalytics {
  totalSearches: number;
  successfulSearches: number;
  averageResponseTime: number;
  popularQueries: Array<{
    query: string;
    count: number;
    successRate: number;
  }>;
  spatialDistribution: {
    [regionName: string]: number;
  };
  temporalPatterns: {
    hourly: number[];   // 24 hours
    daily: number[];    // 7 days
    monthly: number[];  // 12 months
  };
}

export default {
  GreekAdminLevel,
  MajorGreekRegions,
  MajorGreekMunicipalities
};