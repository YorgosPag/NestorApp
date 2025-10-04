/// <reference path="./types/dxf-modules.d.ts" />
'use client';
import React from 'react';
import { Toaster } from 'react-hot-toast';
// CoordProvider removed - using only RulersGrid system now
import { GripProvider } from './providers/GripProvider';
import { SnapProvider } from './snapping/context/SnapContext';
import { LevelsSystem } from './systems/levels';
import { isFeatureEnabled } from './config/feature-flags';
import { OverlayStoreProvider } from './overlays/overlay-store';
import { SelectionSystem } from './systems/selection';
import { CursorSystem } from './systems/cursor';
import { ToolbarsSystem } from './systems/toolbars';
import { RulersGridSystem } from './systems/rulers-grid/RulersGridSystem';
import { DxfViewerErrorBoundary } from './components/ErrorBoundary';
import { StorageErrorBoundary } from './components/StorageErrorBoundary';
import { ProjectHierarchyProvider } from './contexts/ProjectHierarchyContext';
// ✅ ΑΦΑΙΡΕΣΗ ΠΑΛΙΩΝ PREVIEW SETTINGS PROVIDERS - ΔΙΑΓΡΑΜΜΕΝΑ
// LineSettingsProvider REMOVED - χρησιμοποιείται πλέον μόνο το DxfSettingsProvider
// ✅ ΑΦΑΙΡΕΣΗ ΔΙΑΓΡΑΜΜΕΝΩΝ SPECIFIC CONTEXTS - ΧΡΗΣΙΜΟΠΟΙΟΥΝΤΑΙ ΠΛΕΟΝ UNIFIED HOOKS
// TextSettingsProvider REMOVED - χρησιμοποιείται πλέον μόνο το DxfSettingsProvider
import { DxfViewerContent } from './app/DxfViewerContent';
import type { DxfViewerAppProps } from './types';
// ===== ΝΕΑ UNIFIED PROVIDERS (για internal refactoring) =====
import { ConfigurationProvider } from './providers/ConfigurationProvider';
import { StyleManagerProvider } from './providers/StyleManagerProvider';
// ===== ΚΕΝΤΡΙΚΟΣ AUTO-SAVE PROVIDER =====
import { DxfSettingsProvider } from './providers/DxfSettingsProvider';

export function DxfViewerApp(props: DxfViewerAppProps) {
  // Debug logging removed for performance
  return (
    <StorageErrorBoundary>
      <DxfViewerErrorBoundary>
        {/* ===== ΝΕΑ UNIFIED PROVIDERS (για internal use από contexts) ===== */}
        <ConfigurationProvider>
          <StyleManagerProvider>
            <ProjectHierarchyProvider>
              {/* ===== ΚΕΝΤΡΙΚΟΣ AUTO-SAVE PROVIDER (πρώτα από όλα) ===== */}
              <DxfSettingsProvider>
                {/* LineSettingsProvider REMOVED - χρησιμοποιείται πλέον μόνο το DxfSettingsProvider */}
                {/* TextSettingsProvider REMOVED - χρησιμοποιείται πλέον μόνο το DxfSettingsProvider */}
                <GripProvider>
                      {/* ✅ ΑΦΑΙΡΕΣΗ ΠΑΛΙΩΝ SPECIFIC PROVIDERS - ΧΡΗΣΙΜΟΠΟΙΟΥΝΤΑΙ ΠΛΕΟΝ UNIFIED HOOKS */}
                      <SnapProvider>
                <RulersGridSystem enablePersistence={true} persistenceKey="dxf-viewer-rulers-grid">
                  <CursorSystem>
                      <SelectionSystem>
                        <ToolbarsSystem>
                        {isFeatureEnabled('ENABLE_LEVELS_SYSTEM') ? (
                          <LevelsSystem enableFirestore={true}>
                            <OverlayStoreProvider>
                              <DxfViewerContent {...props} />
                              <Toaster
                                position="top-right"
                                toastOptions={{
                                  style: {
                                    background: '#374151',
                                    color: '#fff',
                                    border: '1px solid #6B7280'
                                  }
                                }}
                              />
                            </OverlayStoreProvider>
                          </LevelsSystem>
                        ) : (
                          <OverlayStoreProvider>
                            <DxfViewerContent {...props} />
                            <Toaster
                              position="top-right"
                              toastOptions={{
                                style: {
                                  background: '#374151',
                                  color: '#fff',
                                  border: '1px solid #6B7280'
                                }
                              }}
                            />
                          </OverlayStoreProvider>
                        )}
                        </ToolbarsSystem>
                      </SelectionSystem>
                    </CursorSystem>
                  </RulersGridSystem>
                      </SnapProvider>
                    {/* ✅ ΤΕΛΟΣ ΑΦΑΙΡΕΣΗΣ ΠΑΛΙΩΝ PROVIDERS */}
                </GripProvider>
                {/* TextSettingsProvider REMOVED - χρησιμοποιείται πλέον μόνο το DxfSettingsProvider */}
                {/* LineSettingsProvider REMOVED - χρησιμοποιείται πλέον μόνο το DxfSettingsProvider */}
              </DxfSettingsProvider>
            </ProjectHierarchyProvider>
          </StyleManagerProvider>
        </ConfigurationProvider>
      </DxfViewerErrorBoundary>
    </StorageErrorBoundary>
  );
}

export default DxfViewerApp;