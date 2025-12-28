'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Search, MapPin, Navigation, X, Clock, CheckCircle, AlertCircle, Loader2, Building2 } from 'lucide-react';
import { INTERACTIVE_PATTERNS, HOVER_TEXT_EFFECTS, HOVER_BACKGROUND_EFFECTS, HOVER_BORDER_EFFECTS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// ✅ Enterprise Address Resolver Integration
import { useAddressResolver, type GreekAddress, type GeocodingResult } from '@/services/real-estate-monitor/AddressResolver';

// ✅ Administrative Boundaries Integration
import { useAdministrativeBoundaries } from '../hooks/useAdministrativeBoundaries';
import type { AdminSearchResult } from '../types/administrative-types';

interface AddressSearchPanelProps {
  onLocationSelected?: (lat: number, lng: number, address?: GreekAddress) => void;
  onAdminBoundarySelected?: (boundary: GeoJSON.Feature | GeoJSON.FeatureCollection, result: AdminSearchResult) => void;
  onClose?: () => void;
  className?: string;
}

interface GPSLocation {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

/**
 * 🏢 ENTERPRISE LOCATION SEARCH PANEL
 *
 * Features:
 * - Greek address search με οδός, αριθμός, Τ.Κ.
 * - Administrative boundaries search (municipalities, regions)
 * - GPS location detection
 * - Recent searches με localStorage
 * - Integration με AddressResolver & AdministrativeBoundaries
 * - Tabbed interface για διαφορετικούς τύπους αναζήτησης
 * - Mobile-first UX design
 */
export function AddressSearchPanel({
  onLocationSelected,
  onAdminBoundarySelected,
  onClose,
  className = ''
}: AddressSearchPanelProps) {
  const iconSizes = useIconSizes();
  const { quick, getFocusBorder, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();

  // ✅ Enterprise AddressResolver Hook
  const { resolve, getCacheStats } = useAddressResolver();

  // ✅ Administrative Boundaries Hook
  const {
    isLoading: isLoadingBoundaries,
    error: boundariesError,
    searchResults: boundaryResults,
    currentBoundary,
    detectedType,
    suggestions,
    smartSearch: searchBoundaries,
    getMunicipalityBoundary,
    getRegionBoundary,
    clearResults: clearBoundaryResults
  } = useAdministrativeBoundaries({
    autoPreload: true,
    cacheResults: true,
    maxResults: 8
  });

  // Tab State
  const [activeTab, setActiveTab] = useState<'address' | 'boundaries'>('address');

  // Search State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  // GPS State
  const [isGettingLocation, setIsGettingLocation] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [lastGpsLocation, setLastGpsLocation] = useState<GPSLocation | null>(null);

  // Recent Searches
  const [recentSearches, setRecentSearches] = useState<GeocodingResult[]>([]);

  // Load recent searches από localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('geo_alert_recent_searches');
      if (stored) {
        const recent: GeocodingResult[] = JSON.parse(stored);
        setRecentSearches(recent.slice(0, 5)); // Κρατάμε τα 5 πιο πρόσφατα
      }
    } catch (error) {
      console.warn('Failed to load recent searches:', error);
    }
  }, []);

  // Save recent search
  const saveRecentSearch = useCallback((result: GeocodingResult) => {
    try {
      const updated = [result, ...recentSearches.filter(r =>
        r.lat !== result.lat || r.lng !== result.lng
      )].slice(0, 5);

      setRecentSearches(updated);
      localStorage.setItem('geo_alert_recent_searches', JSON.stringify(updated));
    } catch (error) {
      console.warn('Failed to save recent search:', error);
    }
  }, [recentSearches]);

  // ============================================================================
  // ADDRESS SEARCH
  // ============================================================================

  /**
   * Perform search (address or boundaries based on active tab)
   */
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;

    if (activeTab === 'address') {
      setIsSearching(true);
      setSearchError(null);
      setSearchResults([]);

      try {
        console.log('🔍 Searching for address:', searchQuery);

        const result = await resolve(searchQuery.trim());

        if (result) {
          setSearchResults([result]);
          console.log('✅ Address found:', result);
        } else {
          setSearchError('Δεν βρέθηκε η διεύθυνση. Δοκιμάστε με πιο συγκεκριμένα στοιχεία.');
          setSearchResults([]);
        }
      } catch (error) {
        console.error('❌ Address search error:', error);
        setSearchError('Σφάλμα κατά την αναζήτηση. Δοκιμάστε ξανά.');
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    } else {
      // Administrative boundaries search
      try {
        console.log('🏛️ Searching for boundaries:', searchQuery);
        await searchBoundaries(searchQuery.trim());
      } catch (error) {
        console.error('❌ Boundaries search error:', error);
      }
    }
  }, [activeTab, searchQuery, resolve, searchBoundaries]);

  // Handle Enter key
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }, [handleSearch]);

  // ============================================================================
  // GPS LOCATION
  // ============================================================================

  /**
   * Get current GPS location
   */
  const handleGetGpsLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('Η συσκευή σας δεν υποστηρίζει GPS.');
      return;
    }

    setIsGettingLocation(true);
    setGpsError(null);

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000, // 10 seconds
      maximumAge: 300000 // 5 minutes
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const gpsLocation: GPSLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        };

        setLastGpsLocation(gpsLocation);
        setIsGettingLocation(false);

        console.log('GPS location obtained:', gpsLocation);

        // Call parent callback
        if (onLocationSelected) {
          onLocationSelected(gpsLocation.lat, gpsLocation.lng);
        }
      },
      (error) => {
        setIsGettingLocation(false);

        let errorMessage = 'Αδυναμία λήψης GPS θέσης.';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Δεν έχετε δώσει άδεια για πρόσβαση στη θέση σας.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Η θέση σας δεν είναι διαθέσιμη.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Η αναζήτηση GPS έληξε. Δοκιμάστε ξανά.';
            break;
        }

        setGpsError(errorMessage);
        console.error('❌ GPS error:', error);
      },
      options
    );
  }, [onLocationSelected]);

  // ============================================================================
  // LOCATION SELECTION
  // ============================================================================

  /**
   * Handle location selection (search result or recent)
   */
  const handleLocationSelect = useCallback((result: GeocodingResult) => {
    console.log('Location selected:', result);

    // Save to recent searches
    saveRecentSearch(result);

    // Call parent callback
    if (onLocationSelected) {
      onLocationSelected(result.lat, result.lng, result.address);
    }
  }, [onLocationSelected, saveRecentSearch]);

  /**
   * Handle administrative boundary selection
   */
  const handleBoundarySelect = useCallback(async (result: AdminSearchResult) => {
    console.log('🏛️ Boundary selected:', result);

    try {
      let boundary: GeoJSON.Feature | GeoJSON.FeatureCollection | null = null;

      if (result.adminLevel === 8) { // Municipality
        boundary = await getMunicipalityBoundary(result.name);
      } else if (result.adminLevel === 4) { // Region
        boundary = await getRegionBoundary(result.name);
      }

      if (boundary && onAdminBoundarySelected) {
        onAdminBoundarySelected(boundary, result);
      }
    } catch (error) {
      console.error('❌ Error loading boundary:', error);
    }
  }, [getMunicipalityBoundary, getRegionBoundary, onAdminBoundarySelected]);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderSearchResult = (result: GeocodingResult, index: number) => (
    <div
      key={`search-${index}`}
      onClick={() => handleLocationSelect(result)}
      className={`flex items-center gap-3 p-3 ${quick.card} cursor-pointer ${HOVER_BACKGROUND_EFFECTS.LIGHT}`}
    >
      <MapPin className={`${iconSizes.md} ${colors.text.info} flex-shrink-0`} />
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${colors.text.foreground} truncate`}>
          {result.address.fullAddress || `${result.address.street} ${result.address.number || ''}`}
        </div>
        {result.address.area && (
          <div className={`text-xs ${colors.text.muted}`}>
            {result.address.area}{result.address.postalCode ? `, ${result.address.postalCode}` : ''}
          </div>
        )}
        <div className="flex items-center gap-2 mt-1">
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            result.accuracy === 'exact' ? '${colors.bg.success} ${colors.text.success}' :
            result.accuracy === 'interpolated' ? '${colors.bg.warning} ${colors.text.warning}' :
            '${colors.bg.secondary} ${colors.text.muted}'
          }`}>
            {result.accuracy === 'exact' ? 'Ακριβής' :
             result.accuracy === 'interpolated' ? 'Προσεγγιστική' : 'Περιοχή'}
          </span>
          <span className={`text-xs ${colors.text.muted}`}>
            {Math.round(result.confidence * 100)}% εμπιστοσύνη
          </span>
        </div>
      </div>
    </div>
  );

  const renderRecentSearch = (result: GeocodingResult, index: number) => (
    <div
      key={`recent-${index}`}
      onClick={() => handleLocationSelect(result)}
      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer ${HOVER_BACKGROUND_EFFECTS.LIGHT}`}
    >
      <Clock className={`${iconSizes.sm} ${colors.text.muted} flex-shrink-0`} />
      <div className="flex-1 min-w-0">
        <div className={`text-sm ${colors.text.foreground} truncate`}>
          {result.address.fullAddress || `${result.address.street} ${result.address.number || ''}`}
        </div>
        {result.address.area && (
          <div className={`text-xs ${colors.text.muted} truncate`}>
            {result.address.area}
          </div>
        )}
      </div>
    </div>
  );

  const renderBoundaryResult = (result: AdminSearchResult, index: number) => (
    <div
      key={`boundary-${result.id}-${index}`}
      onClick={() => handleBoundarySelect(result)}
      className={`flex items-center gap-3 p-3 ${quick.card} cursor-pointer ${HOVER_BACKGROUND_EFFECTS.LIGHT} ${HOVER_BORDER_EFFECTS.BLUE} transition-all`}
    >
      <div className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center text-xs font-medium ${
        result.adminLevel === 4 ? `${colors.bg.warning} ${colors.text.warning}` :
        result.adminLevel === 8 ? `${colors.bg.info} ${colors.text.info}` :
        `${colors.bg.secondary} ${colors.text.muted}`
      }`}>
        {result.adminLevel === 4 ? 'Π' : result.adminLevel === 8 ? 'Δ' : result.adminLevel}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${colors.text.foreground} truncate`}>
          {result.name}
        </div>
        {result.nameEn && (
          <div className={`text-xs ${colors.text.muted} truncate`}>
            {result.nameEn}
          </div>
        )}
        <div className="flex items-center gap-2 mt-1">
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            result.adminLevel === 4 ? `${colors.bg.warning} ${colors.text.warning}` :
            result.adminLevel === 8 ? `${colors.bg.info} ${colors.text.info}` :
            `${colors.bg.secondary} ${colors.text.muted}`
          }`}>
            {result.adminLevel === 4 ? 'Περιφέρεια' :
             result.adminLevel === 8 ? 'Δήμος' :
             `Level ${result.adminLevel}`}
          </span>
          <span className={`text-xs ${colors.text.muted}`}>
            {Math.round(result.confidence * 100)}% εμπιστοσύνη
          </span>
          {result.hierarchy.region && (
            <span className={`text-xs ${colors.text.muted}`}>
              • {result.hierarchy.region}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={`${colors.bg.primary} rounded-lg shadow-lg ${quick.card} p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-lg font-semibold ${colors.text.foreground} flex items-center gap-2`}>
          <Search className={`${iconSizes.md} ${colors.text.info}`} />
          Αναζήτηση Θέσης
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            className={`${colors.text.muted} ${HOVER_TEXT_EFFECTS.DARKER} transition-colors`}
          >
            <X className={iconSizes.md} />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className={`flex ${quick.separatorH} mb-4`}>
        <button
          onClick={() => setActiveTab('address')}
          className={`flex-1 py-2 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 justify-center ${
            activeTab === 'address'
              ? `${getStatusBorder('info')} ${colors.text.info}`
              : 'border-transparent ${colors.text.muted} ${HOVER_TEXT_EFFECTS.DARKER}'
          }`}
        >
          <MapPin className={iconSizes.xs} />
          Διευθύνσεις
        </button>
        <button
          onClick={() => setActiveTab('boundaries')}
          className={`flex-1 py-2 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 justify-center ${
            activeTab === 'boundaries'
              ? `${getStatusBorder('info')} ${colors.text.info}`
              : 'border-transparent ${colors.text.muted} ${HOVER_TEXT_EFFECTS.DARKER}'
          }`}
        >
          <Building2 className={iconSizes.xs} />
          Διοικητικά Όρια
        </button>
      </div>

      {/* Search Input */}
      <div className="mb-4">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder={
                activeTab === 'address'
                  ? "π.χ. Λεωφόρος Κηφισίας 123, Μαρούσι 15124"
                  : "π.χ. Δήμος Αθηναίων, Περιφέρεια Αττικής, Θεσσαλονίκη"
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className={`w-full px-3 py-2 ${quick.input} text-sm focus:ring-2 focus:ring-${colors.text.info} ${getFocusBorder('input')}`}
              disabled={isSearching || isLoadingBoundaries}
            />
            {(isSearching || isLoadingBoundaries) && (
              <Loader2 className={`absolute right-3 top-2.5 ${iconSizes.sm} ${colors.text.muted} animate-spin`} />
            )}
          </div>
          <button
            onClick={handleSearch}
            disabled={isSearching || isLoadingBoundaries || !searchQuery.trim()}
            className={`px-4 py-2 ${colors.bg.info} text-white rounded-lg ${INTERACTIVE_PATTERNS.BUTTON_PRIMARY_HOVER} disabled:${colors.bg.muted} disabled:cursor-not-allowed transition-colors`}
          >
            <Search className={iconSizes.sm} />
          </button>
        </div>

        {/* Search Helper Text */}
        <div className={`mt-2 text-xs ${colors.text.muted}`}>
          {activeTab === 'address'
            ? 'Μπορείτε να αναζητήσετε με: οδός + αριθμός, περιοχή, ταχυδρομικός κώδικας'
            : 'Μπορείτε να αναζητήσετε: δήμους, περιφέρειες, διοικητικές ενότητες'
          }
        </div>
      </div>

      {/* GPS Button */}
      <div className="mb-4">
        <button
          onClick={handleGetGpsLocation}
          disabled={isGettingLocation}
          className={`w-full flex items-center justify-center gap-2 px-4 py-3 ${colors.bg.success} text-white rounded-lg ${INTERACTIVE_PATTERNS.SUCCESS_HOVER} disabled:${colors.bg.muted} disabled:cursor-not-allowed transition-colors`}
        >
          {isGettingLocation ? (
            <Loader2 className={`${iconSizes.md} animate-spin`} />
          ) : (
            <Navigation className={iconSizes.md} />
          )}
          <span className="font-medium">
            {isGettingLocation ? 'Εντοπισμός θέσης...' : 'Βρες τη θέση μου'}
          </span>
        </button>

        {/* GPS Status */}
        {lastGpsLocation && (
          <div className={`mt-2 p-2 ${colors.bg.success} ${quick.card} ${getStatusBorder('success')}`}>
            <div className={`flex items-center gap-2 text-sm ${colors.text.success}`}>
              <CheckCircle className={iconSizes.sm} />
              <span>
                Τελευταία θέση: Ακρίβεια ±{Math.round(lastGpsLocation.accuracy)}m
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Errors */}
      {(searchError || gpsError || boundariesError) && (
        <div className={`mb-4 p-3 ${colors.bg.error} ${quick.card} ${getStatusBorder('error')}`}>
          <div className={`flex items-center gap-2 text-sm ${colors.text.error}`}>
            <AlertCircle className={`${iconSizes.sm} flex-shrink-0`} />
            <span>{searchError || gpsError || boundariesError}</span>
          </div>
        </div>
      )}

      {/* Address Search Results */}
      {activeTab === 'address' && searchResults.length > 0 && (
        <div className="mb-4">
          <h4 className={`text-sm font-medium ${colors.text.foreground} mb-2`}>Αποτελέσματα Αναζήτησης</h4>
          <div className="space-y-2">
            {searchResults.map(renderSearchResult)}
          </div>
        </div>
      )}

      {/* Boundary Search Results */}
      {activeTab === 'boundaries' && boundaryResults.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className={`text-sm font-medium ${colors.text.foreground}`}>Διοικητικά Όρια</h4>
            {detectedType && (
              <span className={`text-xs px-2 py-1 ${colors.bg.info} ${colors.text.info} rounded-full`}>
                {detectedType === 'municipality' ? 'Δήμοι' :
                 detectedType === 'region' ? 'Περιφέρειες' : 'Γενικά'}
              </span>
            )}
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {boundaryResults.map(renderBoundaryResult)}
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className={`mt-3 pt-3 ${quick.separatorH}`}>
              <h5 className={`text-xs font-medium ${colors.text.muted} mb-2`}>Προτάσεις:</h5>
              <div className="flex gap-1 flex-wrap">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setSearchQuery(suggestion);
                      handleSearch();
                    }}
                    className={`px-2 py-1 text-xs ${colors.bg.secondary} ${HOVER_BACKGROUND_EFFECTS.LIGHT} rounded ${colors.text.foreground} transition-colors`}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Searches (Address tab only) */}
      {activeTab === 'address' && recentSearches.length > 0 && searchResults.length === 0 && (
        <div className="mb-4">
          <h4 className={`text-sm font-medium ${colors.text.foreground} mb-2`}>Πρόσφατες Αναζητήσεις</h4>
          <div className="space-y-1">
            {recentSearches.map(renderRecentSearch)}
          </div>
        </div>
      )}

      {/* Cache Stats (Development Info) */}
      {process.env.NODE_ENV === 'development' && (
        <div className={`mt-4 p-2 ${colors.bg.secondary} rounded-lg`}>
          <div className={`text-xs ${colors.text.muted}`}>
            {activeTab === 'address' ? (
              <>Cache: {getCacheStats().size} διευθύνσεις | Recent: {recentSearches.length} αναζητήσεις</>
            ) : (
              <>Boundaries: {boundaryResults.length} αποτελέσματα | Detected: {detectedType || 'N/A'} | Suggestions: {suggestions.length}</>
            )}
          </div>
        </div>
      )}
    </div>
  );
}