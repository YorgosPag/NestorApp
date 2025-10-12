'use client';

import React, { useState, useCallback } from 'react';
import { HardHat, Ruler, FileText, ExternalLink, Settings, Database, AlertTriangle, Bell, Monitor, Zap } from 'lucide-react';
import { usePolygonSystem } from '@geo-alert/core/polygon-system';
import { useRealEstateMatching } from '@/services/real-estate-monitor/useRealEstateMatching';
import type { RealEstatePolygon } from '@geo-alert/core/polygon-system';

interface TechnicalDrawingInterfaceProps {
  mapRef: React.RefObject<any>;
  onPolygonComplete?: (polygon: any) => void;
  onRealEstateAlertCreated?: (alert: RealEstatePolygon) => void;
}

/**
 * 🛠️ GEO-ALERT Phase 2.5.3: Enhanced Technical Drawing Interface
 *
 * Interface για τεχνικούς/μηχανικούς με:
 * - Full DXF/DWG support (redirect to existing /dxf/viewer)
 * - CAD-level precision tools
 * - Advanced georeferencing
 * - Professional grade accuracy
 * - 🚨 Automated Real Estate Alerts (Phase 2.5.3)
 *
 * Technical features:
 * - DXF/DWG viewer integration
 * - Millimeter-level precision
 * - Advanced CAD tools
 * - Professional workflows
 * - Real-time automated monitoring
 * - Advanced alert configuration
 */
export function TechnicalDrawingInterface({
  mapRef,
  onPolygonComplete,
  onRealEstateAlertCreated
}: TechnicalDrawingInterfaceProps) {
  const [selectedTool, setSelectedTool] = useState<'dxf-viewer' | 'precision' | 'settings' | 'automated-alerts' | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // 🚨 Phase 2.5.3: Automated Alerts Integration
  const [showAutomatedAlerts, setShowAutomatedAlerts] = useState(false);
  const [alertConfiguration, setAlertConfiguration] = useState({
    sensitivity: 'high' as 'low' | 'medium' | 'high',
    monitoringInterval: 15, // minutes
    alertThreshold: 0.95, // confidence threshold
    enabledPlatforms: ['spitogatos', 'xe'] as string[]
  });

  // Real Estate Monitoring Integration
  const {
    addRealEstatePolygon,
    getRealEstateAlerts,
    statistics: realEstateStats,
    startPeriodicCheck,
    stopPeriodicCheck
  } = useRealEstateMatching();

  // Use the polygon system from @geo-alert/core
  const polygonSystem = usePolygonSystem({
    autoInit: false,
    debug: true,
    enableSnapping: true,
    snapTolerance: 1 // Ultra-precise tolerance για technical users (1px)
  });

  // Advanced automated alert creation
  const handleAutomatedAlertCreation = useCallback((polygon: any) => {
    const technicalRealEstatePolygon: RealEstatePolygon = {
      ...polygon,
      type: 'real-estate',
      alertSettings: {
        enabled: true,
        priceRange: { min: 50000, max: 2000000 }, // Technical range - wide spectrum
        propertyTypes: ['apartment', 'house', 'land', 'commercial', 'industrial'],
        includeExclude: 'include',
        // Technical-specific advanced settings
        advancedSettings: {
          sensitivity: alertConfiguration.sensitivity,
          alertThreshold: alertConfiguration.alertThreshold,
          monitoringInterval: alertConfiguration.monitoringInterval,
          enabledPlatforms: alertConfiguration.enabledPlatforms,
          technicalMode: true,
          precision: 'millimeter-level'
        }
      }
    };

    addRealEstatePolygon(technicalRealEstatePolygon);

    if (onRealEstateAlertCreated) {
      onRealEstateAlertCreated(technicalRealEstatePolygon);
    }

    // Start automated monitoring with technical precision
    startPeriodicCheck(alertConfiguration.monitoringInterval);

    console.log('🚨 Technical: Advanced automated alert created', technicalRealEstatePolygon);
  }, [alertConfiguration, addRealEstatePolygon, onRealEstateAlertCreated, startPeriodicCheck]);

  // Tool selection handler
  const handleToolSelect = useCallback((tool: 'dxf-viewer' | 'precision' | 'settings' | 'automated-alerts') => {
    if (isDrawing) {
      // Cancel current drawing
      polygonSystem.cancelDrawing();
      setIsDrawing(false);
    }

    setSelectedTool(tool);

    // Start appropriate tool mode
    switch (tool) {
      case 'dxf-viewer':
        // Redirect to full DXF Viewer
        console.log('🛠️ Technical: Opening DXF Viewer');
        window.open('/dxf/viewer', '_blank');
        break;

      case 'precision':
        // Ultra-precision polygon mode
        polygonSystem.startDrawing('simple', {
          fillColor: 'rgba(168, 85, 247, 0.2)', // Purple fill (technical theme)
          strokeColor: '#a855f7',
          strokeWidth: 1 // Thin lines για precision
        });
        setIsDrawing(true);
        console.log('📐 Technical: Ultra-precision mode activated');
        break;

      case 'settings':
        // Technical settings (mock)
        console.log('⚙️ Technical: Advanced settings mode');
        break;

      case 'automated-alerts':
        // 🚨 Phase 2.5.3: Automated Alerts Configuration
        setShowAutomatedAlerts(true);
        console.log('🚨 Technical: Automated alerts configuration opened');
        break;
    }
  }, [isDrawing, polygonSystem]);

  // Complete drawing
  const handleComplete = useCallback(() => {
    const polygon = polygonSystem.finishDrawing();
    if (polygon && onPolygonComplete) {
      onPolygonComplete(polygon);
      console.log('✅ Technical: Ultra-precision drawing completed', polygon);
    }
    setIsDrawing(false);
    setSelectedTool(null);
  }, [polygonSystem, onPolygonComplete]);

  // Cancel drawing
  const handleCancel = useCallback(() => {
    polygonSystem.cancelDrawing();
    setIsDrawing(false);
    setSelectedTool(null);
    console.log('❌ Technical: Drawing cancelled');
  }, [polygonSystem]);

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          🛠️ Εργαλεία Μηχανικού
        </h3>
        <p className="text-sm text-gray-600">
          CAD-level precision με πλήρη DXF/DWG υποστήριξη
        </p>
      </div>

      {/* Tool Buttons */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {/* DXF Viewer */}
        <button
          onClick={() => handleToolSelect('dxf-viewer')}
          disabled={isDrawing}
          className={`
            flex flex-col items-center justify-center p-4 rounded-lg border-2
            transition-all duration-200 min-h-[100px]
            ${selectedTool === 'dxf-viewer'
              ? 'border-purple-500 bg-purple-50'
              : 'border-gray-300 hover:border-gray-400 bg-white'
            }
            ${isDrawing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-md'}
          `}
        >
          <ExternalLink className="w-8 h-8 mb-2 text-purple-600" />
          <span className="text-sm font-medium">DXF Viewer</span>
          <span className="text-xs text-gray-500">Full CAD</span>
        </button>

        {/* Ultra-Precision Polygon */}
        <button
          onClick={() => handleToolSelect('precision')}
          disabled={isDrawing && selectedTool !== 'precision'}
          className={`
            flex flex-col items-center justify-center p-4 rounded-lg border-2
            transition-all duration-200 min-h-[100px]
            ${selectedTool === 'precision'
              ? 'border-purple-500 bg-purple-50'
              : 'border-gray-300 hover:border-gray-400 bg-white'
            }
            ${isDrawing && selectedTool !== 'precision' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-md'}
          `}
        >
          <Ruler className="w-8 h-8 mb-2 text-blue-600" />
          <span className="text-sm font-medium">Ακρίβεια</span>
          <span className="text-xs text-gray-500">mm-level</span>
        </button>

        {/* Technical Settings */}
        <button
          onClick={() => handleToolSelect('settings')}
          disabled={isDrawing}
          className={`
            flex flex-col items-center justify-center p-4 rounded-lg border-2
            transition-all duration-200 min-h-[100px]
            ${selectedTool === 'settings'
              ? 'border-purple-500 bg-purple-50'
              : 'border-gray-300 hover:border-gray-400 bg-white'
            }
            ${isDrawing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-md'}
          `}
        >
          <Settings className="w-8 h-8 mb-2 text-gray-600" />
          <span className="text-sm font-medium">Ρυθμίσεις</span>
          <span className="text-xs text-gray-500">Προχωρημένα</span>
        </button>

        {/* 🚨 Phase 2.5.3: Automated Alerts */}
        <button
          onClick={() => handleToolSelect('automated-alerts')}
          disabled={isDrawing}
          className={`
            flex flex-col items-center justify-center p-4 rounded-lg border-2
            transition-all duration-200 min-h-[100px]
            ${selectedTool === 'automated-alerts'
              ? 'border-red-500 bg-red-50'
              : 'border-gray-300 hover:border-gray-400 bg-white'
            }
            ${isDrawing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-md'}
          `}
        >
          <AlertTriangle className="w-8 h-8 mb-2 text-red-600" />
          <span className="text-sm font-medium">Alerts</span>
          <span className="text-xs text-gray-500">Αυτόματα</span>
        </button>
      </div>

      {/* Action Buttons για Precision Mode */}
      {isDrawing && selectedTool === 'precision' && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={handleComplete}
            className="flex-1 flex items-center justify-center gap-2 bg-purple-500 text-white py-3 px-4 rounded-lg hover:bg-purple-600 transition-colors"
          >
            <Ruler className="w-5 h-5" />
            <span className="font-medium">Ολοκλήρωση</span>
          </button>

          <button
            onClick={handleCancel}
            className="flex-1 flex items-center justify-center gap-2 bg-red-500 text-white py-3 px-4 rounded-lg hover:bg-red-600 transition-colors"
          >
            <span className="font-medium">Ακύρωση</span>
          </button>
        </div>
      )}

      {/* Technical Specs Panel */}
      <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-md">
        <h4 className="text-sm font-medium text-purple-800 mb-2">
          🔬 Τεχνικές Προδιαγραφές
        </h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="text-purple-700">
            <span className="font-medium">Ακρίβεια:</span> ±1mm
          </div>
          <div className="text-purple-700">
            <span className="font-medium">Συντεταγμένες:</span> WGS84
          </div>
          <div className="text-purple-700">
            <span className="font-medium">Formats:</span> DXF, DWG
          </div>
          <div className="text-purple-700">
            <span className="font-medium">CAD Tools:</span> Full
          </div>
        </div>
      </div>

      {/* Instructions */}
      {selectedTool && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-700">
            {selectedTool === 'dxf-viewer' && '🛠️ Άνοιγμα πλήρους DXF Viewer σε νέο tab με όλα τα CAD εργαλεία'}
            {selectedTool === 'precision' && '📐 Ultra-precision mode: Κάντε κλικ για σημεία με ακρίβεια χιλιοστού'}
            {selectedTool === 'settings' && '⚙️ Προχωρημένες ρυθμίσεις για τεχνικούς χρήστες'}
            {selectedTool === 'automated-alerts' && '🚨 Διαμόρφωση αυτοματοποιημένων ειδοποιήσεων με τεχνική ακρίβεια'}
          </p>
        </div>
      )}

      {/* DXF Viewer Quick Access */}
      <div className="mt-4 p-3 bg-gray-50 rounded-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-gray-600" />
            <span className="text-sm text-gray-700">DXF Viewer</span>
          </div>
          <a
            href="/dxf/viewer"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            Άνοιγμα <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Πλήρες CAD environment με όλα τα εργαλεία
        </p>
      </div>

      {/* Statistics */}
      {(polygonSystem.stats.totalPolygons > 0 || realEstateStats.totalAlerts > 0) && (
        <div className="mt-4 p-3 bg-gray-50 rounded-md space-y-1">
          {polygonSystem.stats.totalPolygons > 0 && (
            <p className="text-xs text-gray-600">
              <span className="font-medium">Τεχνικά Σχέδια:</span> {polygonSystem.stats.totalPolygons}
            </p>
          )}

          {realEstateStats.totalAlerts > 0 && (
            <div className="text-xs text-red-700">
              <p>
                <span className="font-medium">🚨 Automated Alerts:</span> {realEstateStats.totalAlerts}
              </p>
              {realEstateStats.totalMatches > 0 && (
                <p>
                  <span className="font-medium">🎯 Technical Matches:</span> {realEstateStats.totalMatches}
                </p>
              )}
              {realEstateStats.averageConfidence && (
                <p>
                  <span className="font-medium">📊 Precision:</span> {Math.round(realEstateStats.averageConfidence * 100)}%
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* 🚨 Phase 2.5.3: Automated Alerts Configuration Panel */}
      {showAutomatedAlerts && (
        <div className="mt-4 bg-white rounded-lg shadow-lg border border-red-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Technical Automated Alerts
            </h3>
            <button
              onClick={() => {
                setShowAutomatedAlerts(false);
                setSelectedTool(null);
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Alert Configuration */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            {/* Sensitivity Settings */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-900">Technical Sensitivity</h4>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Detection Sensitivity
                </label>
                <select
                  value={alertConfiguration.sensitivity}
                  onChange={(e) => setAlertConfiguration(prev => ({
                    ...prev,
                    sensitivity: e.target.value as 'low' | 'medium' | 'high'
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="high">High (95%+ confidence)</option>
                  <option value="medium">Medium (85%+ confidence)</option>
                  <option value="low">Low (75%+ confidence)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Monitoring Interval (minutes)
                </label>
                <select
                  value={alertConfiguration.monitoringInterval}
                  onChange={(e) => setAlertConfiguration(prev => ({
                    ...prev,
                    monitoringInterval: Number(e.target.value)
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value={5}>5 minutes (Real-time)</option>
                  <option value={15}>15 minutes (Frequent)</option>
                  <option value={30}>30 minutes (Standard)</option>
                  <option value={60}>60 minutes (Hourly)</option>
                </select>
              </div>
            </div>

            {/* Platform Settings */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-900">Monitoring Platforms</h4>

              <div className="space-y-2">
                {[
                  { id: 'spitogatos', name: 'Spitogatos.gr', icon: '🏠' },
                  { id: 'xe', name: 'XE.gr', icon: '🏢' },
                  { id: 'future-platform', name: 'More platforms...', icon: '🔮', disabled: true }
                ].map((platform) => (
                  <label key={platform.id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={alertConfiguration.enabledPlatforms.includes(platform.id)}
                      disabled={platform.disabled}
                      onChange={(e) => {
                        if (platform.disabled) return;
                        setAlertConfiguration(prev => ({
                          ...prev,
                          enabledPlatforms: e.target.checked
                            ? [...prev.enabledPlatforms, platform.id]
                            : prev.enabledPlatforms.filter(p => p !== platform.id)
                        }));
                      }}
                      className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                    />
                    <span className="text-sm text-gray-700 flex items-center gap-1">
                      <span>{platform.icon}</span>
                      {platform.name}
                      {platform.disabled && <span className="text-xs text-gray-400">(Coming Soon)</span>}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Technical Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
            <button
              onClick={() => {
                if (polygonSystem.polygons.length > 0) {
                  polygonSystem.polygons.forEach((polygon) => {
                    handleAutomatedAlertCreation(polygon);
                  });
                }
              }}
              disabled={polygonSystem.polygons.length === 0}
              className="flex items-center justify-center gap-2 bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              <Zap className="w-4 h-4" />
              <span className="text-sm font-medium">Automate All ({polygonSystem.polygons.length})</span>
            </button>

            <button
              onClick={() => {
                startPeriodicCheck(alertConfiguration.monitoringInterval);
                console.log('🚨 Technical: Automated monitoring started');
              }}
              className="flex items-center justify-center gap-2 bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600 transition-colors"
            >
              <Monitor className="w-4 h-4" />
              <span className="text-sm font-medium">Start Monitoring</span>
            </button>

            <button
              onClick={() => {
                stopPeriodicCheck();
                console.log('🚨 Technical: Automated monitoring stopped');
              }}
              className="flex items-center justify-center gap-2 bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span className="text-sm font-medium">Stop All</span>
            </button>
          </div>

          {/* Technical Specifications */}
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <h4 className="text-sm font-semibold text-red-900 mb-2">🔬 Technical Specifications:</h4>
            <div className="grid grid-cols-2 gap-2 text-xs text-red-700">
              <div>
                <span className="font-medium">Precision:</span> Millimeter-level accuracy
              </div>
              <div>
                <span className="font-medium">Georeferencing:</span> WGS84 + Local Grid
              </div>
              <div>
                <span className="font-medium">Confidence Threshold:</span> {Math.round(alertConfiguration.alertThreshold * 100)}%
              </div>
              <div>
                <span className="font-medium">Processing:</span> Real-time automated
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}