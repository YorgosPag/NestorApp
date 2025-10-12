'use client';

import React, { useState, useCallback } from 'react';
import { Building, Tag, Palette, Eye, EyeOff, Settings, Info } from 'lucide-react';
import {
  PropertyStatus,
  PROPERTY_STATUS_LABELS,
  getStatusClasses,
  getAllStatuses
} from '@/constants/statuses';
import { STATUS_COLORS_MAPPING } from '@/subapps/dxf-viewer/config/color-mapping';

interface PropertyStatusManagerProps {
  onStatusChange?: (newStatus: PropertyStatus) => void;
  onColorSchemeChange?: (scheme: 'status' | 'price' | 'type') => void;
  onLayerVisibilityChange?: (statusList: PropertyStatus[], visible: boolean) => void;
  className?: string;
}

/**
 * 🏠 Property Status Manager - Phase 2.5 Real Estate Innovation
 *
 * Enterprise component για property status management και color-coded visualization.
 * Supports:
 * - Status selection and filtering
 * - Color scheme management
 * - Layer visibility controls
 * - Real-time preview
 *
 * Integration με το centralized STATUS_COLORS_MAPPING system.
 */
export function PropertyStatusManager({
  onStatusChange,
  onColorSchemeChange,
  onLayerVisibilityChange,
  className = ''
}: PropertyStatusManagerProps) {
  const [selectedStatuses, setSelectedStatuses] = useState<PropertyStatus[]>(getAllStatuses());
  const [colorScheme, setColorScheme] = useState<'status' | 'price' | 'type'>('status');
  const [showLegend, setShowLegend] = useState(true);

  // Handle status visibility toggle
  const handleStatusToggle = useCallback((status: PropertyStatus) => {
    const newSelection = selectedStatuses.includes(status)
      ? selectedStatuses.filter(s => s !== status)
      : [...selectedStatuses, status];

    setSelectedStatuses(newSelection);
    onLayerVisibilityChange?.(newSelection, true);
  }, [selectedStatuses, onLayerVisibilityChange]);

  // Handle color scheme change
  const handleColorSchemeChange = useCallback((scheme: 'status' | 'price' | 'type') => {
    setColorScheme(scheme);
    onColorSchemeChange?.(scheme);
  }, [onColorSchemeChange]);

  // Handle select all/none
  const handleSelectAll = useCallback(() => {
    const newSelection = selectedStatuses.length === getAllStatuses().length ? [] : getAllStatuses();
    setSelectedStatuses(newSelection);
    onLayerVisibilityChange?.(newSelection, true);
  }, [selectedStatuses, onLayerVisibilityChange]);

  // Get status color from centralized mapping
  const getStatusColor = useCallback((status: PropertyStatus): string => {
    return STATUS_COLORS_MAPPING[status]?.stroke || '#6b7280';
  }, []);

  // Check if status is visible
  const isStatusVisible = useCallback((status: PropertyStatus): boolean => {
    return selectedStatuses.includes(status);
  }, [selectedStatuses]);

  return (
    <div className={`bg-white rounded-lg shadow-lg border border-gray-200 p-4 ${className}`}>
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Building className="w-5 h-5 text-blue-600" />
            Διαχείριση Ακινήτων
          </h3>
          <button
            onClick={() => setShowLegend(!showLegend)}
            className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
            title="Toggle Legend"
          >
            {showLegend ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Color-coded visualization για property status management
        </p>
      </div>

      {/* Color Scheme Selector */}
      <div className="mb-4">
        <label className="text-sm font-medium text-gray-700 mb-2 block flex items-center gap-2">
          <Palette className="w-4 h-4" />
          Χρωματικό Σχήμα
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => handleColorSchemeChange('status')}
            className={`px-3 py-2 text-sm rounded-md font-medium transition-colors ${
              colorScheme === 'status'
                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Status
          </button>
          <button
            onClick={() => handleColorSchemeChange('price')}
            className={`px-3 py-2 text-sm rounded-md font-medium transition-colors ${
              colorScheme === 'price'
                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Τιμή
          </button>
          <button
            onClick={() => handleColorSchemeChange('type')}
            className={`px-3 py-2 text-sm rounded-md font-medium transition-colors ${
              colorScheme === 'type'
                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Τύπος
          </button>
        </div>
      </div>

      {/* Status Legend & Controls */}
      {showLegend && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Status Categories
            </label>
            <button
              onClick={handleSelectAll}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              {selectedStatuses.length === getAllStatuses().length ? 'Κανένα' : 'Όλα'}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
            {getAllStatuses().map((status) => {
              const isVisible = isStatusVisible(status);
              const statusColor = getStatusColor(status);
              const statusClasses = getStatusClasses(status);

              return (
                <div
                  key={status}
                  className={`flex items-center gap-3 p-2 rounded-md border transition-all ${
                    isVisible
                      ? 'bg-gray-50 border-gray-300'
                      : 'bg-gray-25 border-gray-200 opacity-60'
                  }`}
                >
                  {/* Color Indicator */}
                  <div
                    className="w-4 h-4 rounded border-2 border-white shadow-sm"
                    style={{ backgroundColor: statusColor }}
                  />

                  {/* Status Label */}
                  <span className={`flex-1 text-sm font-medium ${isVisible ? 'text-gray-900' : 'text-gray-500'}`}>
                    {PROPERTY_STATUS_LABELS[status]}
                  </span>

                  {/* Visibility Toggle */}
                  <button
                    onClick={() => handleStatusToggle(status)}
                    className={`p-1 rounded transition-colors ${
                      isVisible
                        ? 'text-blue-600 hover:text-blue-800'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                    title={isVisible ? 'Απόκρυψη' : 'Εμφάνιση'}
                  >
                    {isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Statistics */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
        <div className="flex items-center gap-2 mb-2">
          <Info className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-900">Στατιστικά</span>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-blue-700">Ορατά Status:</span>
            <span className="ml-2 font-semibold text-blue-900">{selectedStatuses.length}/{getAllStatuses().length}</span>
          </div>
          <div>
            <span className="text-blue-700">Σχήμα:</span>
            <span className="ml-2 font-semibold text-blue-900 capitalize">{colorScheme}</span>
          </div>
        </div>
      </div>

      {/* Usage Instructions */}
      <div className="mt-4 p-3 bg-gray-50 rounded-md">
        <p className="text-xs text-gray-600">
          <strong>💡 Tip:</strong> Χρησιμοποιήστε τα color schemes για διαφορετικές απεικονίσεις.
          Το Status scheme δείχνει την κατάσταση του ακινήτου, το Price scheme την τιμή,
          και το Type scheme τον τύπο ακινήτου.
        </p>
      </div>
    </div>
  );
}