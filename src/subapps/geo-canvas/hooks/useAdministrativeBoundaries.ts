/**
 * 🏛️ USE ADMINISTRATIVE BOUNDARIES HOOK - Phase 4.3
 *
 * React hook για εύκολη χρήση των Greek administrative boundaries
 * Centralized state management και caching για boundaries
 *
 * @module hooks/useAdministrativeBoundaries
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { administrativeBoundaryService } from '../services/administrative-boundaries/AdministrativeBoundaryService';
import { searchHistoryService } from '../services/administrative-boundaries/SearchHistoryService';
import { GreekAdminLevel } from '../types/administrative-types';
import type {
  AdminSearchResult,
  AdminSearchQuery,
  AdvancedSearchFilters,
  BoundingBox,
  SearchHistoryEntry,
  SearchAnalytics
} from '../types/administrative-types';

// ? ENTERPRISE: GeoJSON type declarations for administrative boundaries
type AdminGeometry = GeoJSON.Geometry;
type AdminFeature = GeoJSON.Feature;
type AdminFeatureCollection = GeoJSON.FeatureCollection;

