/**
 * ADMINISTRATIVE BOUNDARY DEMO - Testing Component
 *
 * Demo component για testing των administrative boundaries
 * Temporary component για να δοκιμάσουμε τη functionality
 *
 * @module components/AdminBoundaryDemo
 */

'use client';

import React, { useState } from 'react';
import { useAdministrativeBoundaries } from '../hooks/useAdministrativeBoundaries';
import type { AdminSearchResult } from '../types/administrative-types';
import { INTERACTIVE_PATTERNS, HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { Building2, Search } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

export function AdminBoundaryDemo() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedResult, setSelectedResult] = useState<AdminSearchResult | null>(null);
  const { quick, radius } = useBorderTokens();
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();

  const {
    isLoading,
    error,
    searchResults,
    currentBoundary,
    detectedType,
    suggestions,
    smartSearch,
    getMunicipalityBoundary,
    getRegionBoundary,
    clearResults,
    getCacheStats
  } = useAdministrativeBoundaries({
    autoPreload: true,
    cacheResults: true,
    maxResults: 8
  });

  const handleSearch = async () => {
    if (searchQuery.trim()) {
      await smartSearch(searchQuery);
    }
  };

  const handleResultSelect = async (result: AdminSearchResult) => {
    setSelectedResult(result);

    if (result.adminLevel === 8) { // Municipality
      await getMunicipalityBoundary(result.name);
    } else if (result.adminLevel === 4) { // Region
      await getRegionBoundary(result.name);
    }
  };

  const handleQuickSearch = async (query: string) => {
    setSearchQuery(query);
    await smartSearch(query);
  };

  const cacheStats = getCacheStats();

  return (
    <div className={`p-6 max-w-4xl mx-auto ${colors.bg.primary} ${quick.card} shadow-lg`}>
      <h2 className="text-2xl font-bold mb-6 text-gray-800">
        <Building2 className={`${iconSizes.lg} inline-block mr-3`} />
        Administrative Boundaries Demo
      </h2>

      {/* Search Section */}
      <div className="mb-6">
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="π.χ. Δήμος Αθηναίων, Αττική, Θεσσαλονίκη..."
            className={`flex-1 px-4 py-2 ${quick.input} focus:ring-2 focus:ring-blue-500 ${quick.focus}`}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button
            onClick={handleSearch}
            disabled={isLoading || !searchQuery.trim()}
            className={`px-6 py-2 ${colors.bg.info} text-white ${radius.lg} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isLoading ? 'Αναζήτηση...' : 'Αναζήτηση'}
          </button>
          <button
            onClick={clearResults}
            className={`px-4 py-2 ${colors.bg.secondary} text-white ${radius.lg} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`}
          >
            Καθαρισμός
          </button>
        </div>

        {/* Quick Search Buttons */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <h3 className="w-full text-sm font-medium text-gray-600 mb-2">Γρήγορη αναζήτηση:</h3>
          {[
            'Δήμος Αθηναίων',
            'Δήμος Θεσσαλονίκης',
            'Περιφέρεια Αττικής',
            'Περιφέρεια Κεντρικής Μακεδονίας',
            'Δήμος Πατρέων',
            'Κρήτη'
          ].map(query => (
            <button
              key={query}
              onClick={() => handleQuickSearch(query)}
              className={`px-3 py-1 text-sm ${colors.bg.hover} ${HOVER_BACKGROUND_EFFECTS.LIGHT} ${radius.full} transition-colors`}
              disabled={isLoading}
            >
              {query}
            </button>
          ))}
        </div>
      </div>

      {/* Status Section */}
      <div className={`mb-6 p-4 ${colors.bg.secondary} ${quick.card}`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <strong>Status:</strong>{' '}
            <span className={`ml-2 px-2 py-1 rounded ${
              isLoading ? `${colors.bg.warning} text-yellow-800` :
              error ? `${colors.bg.error} text-red-800` :
              `${colors.bg.success} text-green-800`
            }`}>
              {isLoading ? 'Loading...' : error ? 'Error' : 'Ready'}
            </span>
          </div>
          <div>
            <strong>Detected Type:</strong>{' '}
            <span className="ml-2 font-mono text-blue-600">
              {detectedType || 'N/A'}
            </span>
          </div>
          <div>
            <strong>Results:</strong>{' '}
            <span className="ml-2 font-bold text-green-600">
              {searchResults.length}
            </span>
          </div>
        </div>

        {error && (
          <div className="mt-2 text-red-600 text-sm">
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Search Results */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Αποτελέσματα Αναζήτησης</h3>

          {suggestions.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-600 mb-2">Προτάσεις:</h4>
              <div className="flex gap-2 flex-wrap">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleQuickSearch(suggestion)}
                    className={`px-2 py-1 text-xs ${colors.bg.info} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} rounded text-blue-700 transition-colors`}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {searchResults.length === 0 && !isLoading ? (
              <div className="text-gray-500 text-center py-8">
                Δεν βρέθηκαν αποτελέσματα
              </div>
            ) : (
              searchResults.map((result, index) => (
                <div
                  key={`${result.id}-${index}`}
                  onClick={() => handleResultSelect(result)}
                  className={`p-3 cursor-pointer transition-all ${
                    selectedResult?.id === result.id
                      ? `${quick.selected} ${colors.bg.info}`
                      : `${quick.card} ${HOVER_BACKGROUND_EFFECTS.LIGHT} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">
                        {result.name}
                      </div>
                      {result.nameEn && (
                        <div className="text-sm text-gray-500">
                          {result.nameEn}
                        </div>
                      )}
                      <div className="text-xs text-gray-400">
                        Level: {result.adminLevel} •
                        Confidence: {(result.confidence * 100).toFixed(0)}% •
                        {result.hierarchy.region && ` ${result.hierarchy.region}`}
                      </div>
                    </div>
                    <div className={`px-2 py-1 text-xs rounded ${
                      result.adminLevel === 4 ? `${colors.bg.accent} text-purple-800` :
                      result.adminLevel === 8 ? `${colors.bg.info} text-blue-800` :
                      `${colors.bg.muted} text-gray-800`
                    }`}>
                      {result.adminLevel === 4 ? 'Περιφέρεια' :
                       result.adminLevel === 8 ? 'Δήμος' :
                       `Level ${result.adminLevel}`}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Boundary Information */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Boundary Information</h3>

          {currentBoundary ? (
            <div className="space-y-4">
              {/* Boundary Type */}
              <div className={`p-4 ${colors.bg.success} ${quick.success}`}>
                <div className="font-medium text-green-800 mb-2">
                  ✅ Boundary Loaded
                </div>
                <div className="text-sm text-green-700">
                  <div><strong>Type:</strong> {currentBoundary.type}</div>
                  {currentBoundary.type === 'Feature' && (
                    <>
                      <div><strong>Name:</strong> {(currentBoundary as GeoJSON.Feature).properties?.name}</div>
                      <div><strong>Admin Level:</strong> {(currentBoundary as GeoJSON.Feature).properties?.adminLevel}</div>
                    </>
                  )}
                  {currentBoundary.type === 'FeatureCollection' && (
                    <div><strong>Features:</strong> {(currentBoundary as GeoJSON.FeatureCollection).features.length}</div>
                  )}
                </div>
              </div>

              {/* Geometry Preview */}
              <div className={`p-4 ${colors.bg.secondary} ${radius.lg}`}>
                <h4 className="font-medium text-gray-800 mb-2">Geometry Preview</h4>
                <div className="text-xs font-mono text-gray-600 max-h-32 overflow-y-auto">
                  <pre>{JSON.stringify(currentBoundary, null, 2).slice(0, 500)}...</pre>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-gray-500 text-center py-8">
              Επιλέξτε ένα αποτέλεσμα για να δείτε το boundary
            </div>
          )}

          {/* Cache Stats */}
          <div className={`mt-6 p-4 ${colors.bg.info} ${quick.info}`}>
            <h4 className="font-medium text-blue-800 mb-2">Cache Statistics</h4>
            <div className="text-sm text-blue-700 space-y-1">
              <div>Total Entries: {cacheStats.totalEntries}</div>
              <div>Valid Entries: {cacheStats.validEntries}</div>
              <div>Search Cache: {cacheStats.searchCacheEntries}</div>
              <div>Cache Expiry: {cacheStats.cacheExpiryHours}h</div>
            </div>
          </div>
        </div>
      </div>

      {/* Debug Section */}
      {process.env.NODE_ENV === 'development' && (
        <div className={`mt-8 p-4 ${colors.bg.warning} ${quick.warning}`}>
          <h3 className="font-medium text-yellow-800 mb-2">🐛 Debug Information</h3>
          <div className="text-xs font-mono text-yellow-700">
            <div>Search Query: "{searchQuery}"</div>
            <div>Detected Type: {detectedType}</div>
            <div>Results Count: {searchResults.length}</div>
            <div>Suggestions Count: {suggestions.length}</div>
            <div>Current Boundary: {currentBoundary ? currentBoundary.type : 'None'}</div>
            <div>Loading: {isLoading.toString()}</div>
            <div>Error: {error || 'None'}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminBoundaryDemo;
