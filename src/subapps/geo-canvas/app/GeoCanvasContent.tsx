'use client';

import React, { useState } from 'react';
import { GeoreferencingPanel } from '../components/GeoreferencingPanel';
import type { GeoCanvasAppProps } from '../types';

/**
 * GEO-CANVAS CONTENT COMPONENT
 * Κεντρικό component για το Geo-Alert system interface
 *
 * Phase 1: Basic skeleton και structure
 * Phase 2: DXF transformation engine
 * Phase 3: MapLibre GL JS integration
 * Phase 4-8: Advanced features από roadmap
 */
export function GeoCanvasContent(props: GeoCanvasAppProps) {
  const [activeView, setActiveView] = useState<'foundation' | 'georeferencing' | 'map'>('georeferencing');
  return (
    <div className="w-full h-full flex flex-col bg-gray-900 text-white">
      {/* 📊 HEADER SECTION */}
      <header className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-blue-400">
              🌍 Geo-Canvas System
            </h1>
            <p className="text-gray-400 text-sm">
              Enterprise Geo-Alert Platform (Phase 1: Foundation)
            </p>
          </div>

          <div className="flex items-center space-x-4">
            <div className="px-3 py-1 bg-green-600 rounded-full text-xs">
              Phase 2
            </div>
            <div className="px-3 py-1 bg-blue-600 rounded-full text-xs">
              Transformation Ready
            </div>
          </div>
        </div>
      </header>

      {/* 🗺️ MAIN CONTENT AREA */}
      <main className="flex-1 flex">
        {/* 🛠️ LEFT SIDEBAR - Georeferencing Panel */}
        <aside className="w-96 bg-gray-800 border-r border-gray-700 p-4 overflow-y-auto">
          <GeoreferencingPanel />
        </aside>

        {/* 🎯 CENTER AREA - Map/Canvas */}
        <div className="flex-1 flex flex-col">
          {/* 🔧 TOP TOOLBAR */}
          <div className="bg-gray-800 border-b border-gray-700 p-3">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-gray-400">View:</span>
                <select
                  value={activeView}
                  onChange={(e) => setActiveView(e.target.value as any)}
                  className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm"
                >
                  <option value="georeferencing">🗺️ Georeferencing (Phase 2)</option>
                  <option value="foundation">📋 Foundation Overview</option>
                  <option disabled>Map View (Phase 3)</option>
                  <option disabled>Split View (Phase 6)</option>
                </select>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-gray-400">CRS:</span>
                <select className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm">
                  <option>WGS84 (EPSG:4326)</option>
                  <option>Greek Grid (EPSG:2100)</option>
                  <option>UTM 34N (EPSG:32634)</option>
                </select>
              </div>
            </div>
          </div>

          {/* 🖥️ MAIN CONTENT - Canvas/Map Area */}
          <div className="flex-1 bg-gray-900 relative">
            {activeView === 'foundation' && (
              /* Phase 1: Foundation Display */
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center max-w-2xl p-8">
                  <div className="text-8xl mb-6">🌍</div>
                  <h2 className="text-3xl font-bold mb-4 text-blue-400">
                    Geo-Canvas System
                  </h2>
                  <p className="text-xl text-gray-400 mb-8">
                    Enterprise Geo-Alert Platform
                  </p>

                  <div className="grid grid-cols-2 gap-6 text-left">
                    <div className="bg-gray-800 p-6 rounded-lg">
                      <h3 className="text-lg font-semibold mb-3 text-green-400">
                        ✅ Phase 1 Complete
                      </h3>
                      <ul className="space-y-2 text-sm text-gray-300">
                        <li>• Foundation structure</li>
                        <li>• Enterprise type system</li>
                        <li>• Configuration setup</li>
                        <li>• Router integration ready</li>
                      </ul>
                    </div>

                    <div className="bg-gray-800 p-6 rounded-lg">
                      <h3 className="text-lg font-semibold mb-3 text-green-400">
                        ✅ Phase 2 Complete
                      </h3>
                      <ul className="space-y-2 text-sm text-gray-300">
                        <li>• DXF transformation engine</li>
                        <li>• Coordinate system support</li>
                        <li>• Georeferencing tools</li>
                        <li>• Control point management</li>
                      </ul>
                    </div>
                  </div>

                  {/* Architecture Overview */}
                  <div className="mt-8 p-6 bg-gray-800 rounded-lg">
                    <h3 className="text-lg font-semibold mb-4 text-blue-400">
                      🏗️ Architecture Overview
                    </h3>
                    <div className="text-sm text-gray-300 space-y-2">
                      <p>
                        <strong>Centralized System:</strong> Ενσωματωμένο στο DXF Viewer ecosystem
                      </p>
                      <p>
                        <strong>Technology Stack:</strong> React + TypeScript + MapLibre GL JS
                      </p>
                      <p>
                        <strong>Data Flow:</strong> DXF → Transformation → GeoJSON → Map → Alerts
                      </p>
                      <p>
                        <strong>Standards:</strong> ISO 19107, OGC, AutoCAD conventions
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeView === 'georeferencing' && (
              /* Phase 2: Georeferencing Workspace */
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center max-w-4xl p-8">
                  <div className="text-6xl mb-6">🗺️</div>
                  <h2 className="text-3xl font-bold mb-4 text-blue-400">
                    DXF Georeferencing Workspace
                  </h2>
                  <p className="text-xl text-gray-400 mb-8">
                    Phase 2: Transform DXF coordinates → Geographic coordinates
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                    <div className="bg-gray-800 p-6 rounded-lg">
                      <h3 className="text-lg font-semibold mb-3 text-green-400">
                        ✅ Control Points
                      </h3>
                      <ul className="space-y-2 text-sm text-gray-300">
                        <li>• Add/Edit control points</li>
                        <li>• DXF ↔ Geographic mapping</li>
                        <li>• Accuracy validation</li>
                        <li>• Spatial distribution</li>
                      </ul>
                    </div>

                    <div className="bg-gray-800 p-6 rounded-lg">
                      <h3 className="text-lg font-semibold mb-3 text-blue-400">
                        🔧 Transformation Engine
                      </h3>
                      <ul className="space-y-2 text-sm text-gray-300">
                        <li>• Affine transformation</li>
                        <li>• Least squares calibration</li>
                        <li>• RMS accuracy calculation</li>
                        <li>• Inverse transformation</li>
                      </ul>
                    </div>

                    <div className="bg-gray-800 p-6 rounded-lg">
                      <h3 className="text-lg font-semibold mb-3 text-yellow-400">
                        ⏳ Next: Phase 3
                      </h3>
                      <ul className="space-y-2 text-sm text-gray-300">
                        <li>• MapLibre GL integration</li>
                        <li>• Visual coordinate picker</li>
                        <li>• Real-time preview</li>
                        <li>• Basemap layers</li>
                      </ul>
                    </div>
                  </div>

                  <div className="mt-8 p-6 bg-blue-900/20 border border-blue-600 rounded-lg">
                    <h3 className="text-lg font-semibold mb-3 text-blue-400">
                      📋 Workflow Instructions
                    </h3>
                    <div className="text-sm text-gray-300 space-y-2">
                      <p><strong>Step 1:</strong> Add control points με DXF και Geographic coordinates</p>
                      <p><strong>Step 2:</strong> Ensure good spatial distribution (corners + center)</p>
                      <p><strong>Step 3:</strong> Calibrate transformation για coordinate mapping</p>
                      <p><strong>Step 4:</strong> Validate accuracy (target: &lt;5m RMS error)</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 📊 RIGHT SIDEBAR - System Status */}
        <aside className="w-80 bg-gray-800 border-l border-gray-700 p-4">
          <div className="space-y-6">
            {/* Phase Progress */}
            <section>
              <h3 className="text-lg font-semibold mb-4 text-blue-400">
                📊 Phase Progress
              </h3>
              <div className="space-y-3">
                <div className="p-3 bg-green-900 border border-green-600 rounded">
                  <div className="text-sm font-medium text-green-300">✅ Phase 1: Foundation</div>
                  <div className="text-xs text-green-400">Architecture + Types Complete</div>
                </div>
                <div className="p-3 bg-green-900 border border-green-600 rounded">
                  <div className="text-sm font-medium text-green-300">✅ Phase 2: Transformation</div>
                  <div className="text-xs text-green-400">DXF Georeferencing Ready</div>
                </div>
                <div className="p-3 bg-gray-700 rounded">
                  <div className="text-sm font-medium text-yellow-400">⏳ Phase 3: MapLibre</div>
                  <div className="text-xs text-gray-400">Interactive mapping</div>
                </div>
                <div className="p-3 bg-gray-700 rounded">
                  <div className="text-sm font-medium text-gray-400">⭕ Phase 4: PostGIS</div>
                  <div className="text-xs text-gray-400">Spatial database</div>
                </div>
                <div className="p-3 bg-gray-700 rounded">
                  <div className="text-sm font-medium text-gray-400">⭕ Phase 5: Alerts</div>
                  <div className="text-xs text-gray-400">Geo-alert engine</div>
                </div>
              </div>
            </section>

            {/* Current Features */}
            <section>
              <h3 className="text-lg font-semibold mb-4 text-green-400">
                ✅ Available Features
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                  <span>Control Point Management</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                  <span>Affine Transformation</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                  <span>Accuracy Validation</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                  <span>Spatial Distribution Analysis</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                  <span>RMS Error Calculation</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                  <span>Coordinate Transformation</span>
                </div>
              </div>
            </section>

            {/* Technical Specs */}
            <section>
              <h3 className="text-lg font-semibold mb-4 text-blue-400">
                🔧 Technical Specs
              </h3>
              <div className="space-y-2 text-sm text-gray-300">
                <div className="flex justify-between">
                  <span>Transformation:</span>
                  <span className="text-blue-300">Affine + Least Squares</span>
                </div>
                <div className="flex justify-between">
                  <span>Accuracy:</span>
                  <span className="text-green-300">Millimeter-level</span>
                </div>
                <div className="flex justify-between">
                  <span>CRS Support:</span>
                  <span className="text-purple-300">WGS84, GGRS87, UTM</span>
                </div>
                <div className="flex justify-between">
                  <span>Math Engine:</span>
                  <span className="text-yellow-300">Enterprise TypeScript</span>
                </div>
                <div className="flex justify-between">
                  <span>Standards:</span>
                  <span className="text-blue-300">ISO 19107, OGC</span>
                </div>
              </div>
            </section>

            {/* Next Steps */}
            <section>
              <h3 className="text-lg font-semibold mb-4 text-yellow-400">
                ⏭️ Coming Next (Phase 3)
              </h3>
              <div className="space-y-2 text-sm text-gray-300">
                <div>• MapLibre GL JS integration</div>
                <div>• Interactive coordinate picking</div>
                <div>• Real-time transformation preview</div>
                <div>• Multiple basemap layers</div>
                <div>• Visual accuracy indicators</div>
              </div>
            </section>
          </div>
        </aside>
      </main>

      {/* 📋 FOOTER STATUS */}
      <footer className="bg-gray-800 border-t border-gray-700 p-3">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4">
            <span className="text-green-400">● Active</span>
            <span className="text-green-400">Phase 2: DXF Transformation</span>
            <span className="text-blue-400">Georeferencing Ready</span>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-gray-400">
              ISO 19107 | OGC Standards | Enterprise TypeScript
            </span>
            <span className="text-blue-400">
              🏢 Pagonis-Nestor Geo-Canvas v2.0
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default GeoCanvasContent;