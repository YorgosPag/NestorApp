'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Search, MapPin, Navigation, X, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

// ✅ Enterprise Address Resolver Integration
import { useAddressResolver, type GreekAddress, type GeocodingResult } from '@/services/real-estate-monitor/AddressResolver';

interface AddressSearchPanelProps {
  onLocationSelected?: (lat: number, lng: number, address?: GreekAddress) => void;
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
 * 🏢 ENTERPRISE ADDRESS SEARCH PANEL
 *
 * Features:
 * - Greek address search με οδός, αριθμός, Τ.Κ.
 * - GPS location detection
 * - Recent searches με localStorage
 * - Integration με existing AddressResolver
 * - Mobile-first UX design
 */
export function AddressSearchPanel({
  onLocationSelected,
  onClose,
  className = ''
}: AddressSearchPanelProps) {

  // ✅ Enterprise AddressResolver Hook
  const { resolve, getCacheStats } = useAddressResolver();

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
   * Perform address search using AddressResolver
   */
  const handleAddressSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;

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
  }, [searchQuery, resolve]);

  // Handle Enter key
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddressSearch();
    }
  }, [handleAddressSearch]);

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

        console.log('📍 GPS location obtained:', gpsLocation);

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
    console.log('📍 Location selected:', result);

    // Save to recent searches
    saveRecentSearch(result);

    // Call parent callback
    if (onLocationSelected) {
      onLocationSelected(result.lat, result.lng, result.address);
    }
  }, [onLocationSelected, saveRecentSearch]);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderSearchResult = (result: GeocodingResult, index: number) => (
    <div
      key={`search-${index}`}
      onClick={() => handleLocationSelect(result)}
      className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
    >
      <MapPin className="w-5 h-5 text-blue-600 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 truncate">
          {result.address.fullAddress || `${result.address.street} ${result.address.number || ''}`}
        </div>
        {result.address.area && (
          <div className="text-xs text-gray-500">
            {result.address.area}{result.address.postalCode ? `, ${result.address.postalCode}` : ''}
          </div>
        )}
        <div className="flex items-center gap-2 mt-1">
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            result.accuracy === 'exact' ? 'bg-green-100 text-green-700' :
            result.accuracy === 'interpolated' ? 'bg-yellow-100 text-yellow-700' :
            'bg-gray-100 text-gray-600'
          }`}>
            {result.accuracy === 'exact' ? 'Ακριβής' :
             result.accuracy === 'interpolated' ? 'Προσεγγιστική' : 'Περιοχή'}
          </span>
          <span className="text-xs text-gray-400">
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
      className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
    >
      <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-gray-700 truncate">
          {result.address.fullAddress || `${result.address.street} ${result.address.number || ''}`}
        </div>
        {result.address.area && (
          <div className="text-xs text-gray-500 truncate">
            {result.address.area}
          </div>
        )}
      </div>
    </div>
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={`bg-white rounded-lg shadow-lg border border-gray-200 p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Search className="w-5 h-5 text-blue-600" />
          Αναζήτηση Διεύθυνσης
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Search Input */}
      <div className="mb-4">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="π.χ. Λεωφόρος Κηφισίας 123, Μαρούσι 15124"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isSearching}
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-2.5 w-4 h-4 text-gray-400 animate-spin" />
            )}
          </div>
          <button
            onClick={handleAddressSearch}
            disabled={isSearching || !searchQuery.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>

        {/* Search Helper Text */}
        <div className="mt-2 text-xs text-gray-500">
          Μπορείτε να αναζητήσετε με: οδός + αριθμός, περιοχή, ταχυδρομικός κώδικας
        </div>
      </div>

      {/* GPS Button */}
      <div className="mb-4">
        <button
          onClick={handleGetGpsLocation}
          disabled={isGettingLocation}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {isGettingLocation ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Navigation className="w-5 h-5" />
          )}
          <span className="font-medium">
            {isGettingLocation ? 'Εντοπισμός θέσης...' : 'Βρες τη θέση μου'}
          </span>
        </button>

        {/* GPS Status */}
        {lastGpsLocation && (
          <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-green-700">
              <CheckCircle className="w-4 h-4" />
              <span>
                Τελευταία θέση: Ακρίβεια ±{Math.round(lastGpsLocation.accuracy)}m
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Errors */}
      {(searchError || gpsError) && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{searchError || gpsError}</span>
          </div>
        </div>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Αποτελέσματα Αναζήτησης</h4>
          <div className="space-y-2">
            {searchResults.map(renderSearchResult)}
          </div>
        </div>
      )}

      {/* Recent Searches */}
      {recentSearches.length > 0 && searchResults.length === 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Πρόσφατες Αναζητήσεις</h4>
          <div className="space-y-1">
            {recentSearches.map(renderRecentSearch)}
          </div>
        </div>
      )}

      {/* Cache Stats (Development Info) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-4 p-2 bg-gray-50 rounded-lg">
          <div className="text-xs text-gray-500">
            Cache: {getCacheStats().size} διευθύνσεις |
            Recent: {recentSearches.length} αναζητήσεις
          </div>
        </div>
      )}
    </div>
  );
}