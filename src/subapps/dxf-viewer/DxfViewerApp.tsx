/// <reference path="./types/dxf-modules.d.ts" />
'use client';
import React from 'react';
import { installProductionConsoleGuard } from './utils/production-console-guard';

// Layer 1: Silence console.log/warn/debug in production builds
installProductionConsoleGuard();
import { NotificationProvider } from '../../providers/NotificationProvider';
// CoordProvider removed - using only RulersGrid system now
import { GripProvider } from './providers/GripProvider';
import { SnapProvider } from './snapping/context/SnapContext';
import { LevelsSystem } from './systems/levels';
import { OverlayStoreProvider } from './overlays/overlay-store';
import { SelectionSystem } from './systems/selection';
import { CursorSystem } from './systems/cursor';
import { ToolbarsSystem } from './systems/toolbars';
import { RulersGridSystem } from './systems/rulers-grid/RulersGridSystem';
// 🏢 ENTERPRISE (2026-01-27): Use ErrorBoundary with Tour support for consistent UX
import { EnterpriseErrorBoundaryWithTour } from '@/components/ui/ErrorBoundary/ErrorBoundary';
import { ProjectHierarchyProvider } from './contexts/ProjectHierarchyContext';
// ✅ ΑΦΑΙΡΕΣΗ ΠΑΛΙΩΝ PREVIEW SETTINGS PROVIDERS - ΔΙΑΓΡΑΜΜΕΝΑ
// LineSettingsProvider REMOVED - χρησιμοποιείται πλέον μόνο το DxfSettingsProvider
// ✅ ΑΦΑΙΡΕΣΗ ΔΙΑΓΡΑΜΜΕΝΩΝ SPECIFIC CONTEXTS - ΧΡΗΣΙΜΟΠΟΙΟΥΝΤΑΙ ΠΛΕΟΝ UNIFIED HOOKS
// TextSettingsProvider REMOVED - χρησιμοποιείται πλέον μόνο το DxfSettingsProvider
import { DxfViewerContent } from './app/DxfViewerContent';
import type { DxfViewerAppProps } from './types';
// ===== ΝΕΑ UNIFIED PROVIDERS (για internal refactoring) =====
// 🗑️ REMOVED (2025-10-06): ConfigurationProvider - MERGED into DxfSettingsProvider
// import { ConfigurationProvider } from './providers/ConfigurationProvider';
import { StyleManagerProvider } from './providers/StyleManagerProvider';
// ===== ΚΕΝΤΡΙΚΟΣ AUTO-SAVE PROVIDER =====
// 🔄 MIGRATED (2025-10-09): Phase 3.2 - Direct Enterprise
import { EnterpriseDxfSettingsProvider as DxfSettingsProvider } from './settings-provider';
// ===== PORTS & ADAPTERS COMPOSITION ROOT =====
import { createSyncDependencies } from './settings/sync/compositionRoot';
import { useMemo } from 'react';
import { EXPERIMENTAL_FEATURES } from './config/experimental-features';

export function DxfViewerApp(props: DxfViewerAppProps) {
  // ===== DEPENDENCY INJECTION (Composition Root) =====
  // Create sync dependencies ONCE (stable reference)
  const syncDeps = useMemo(() => {
    return createSyncDependencies({
      enableSync: EXPERIMENTAL_FEATURES.ENABLE_SETTINGS_SYNC, // Feature flag
      ports: {
        toolStyle: true,
        textStyle: true,
        gripStyle: true,
        grid: true,
        ruler: true
      }
    });
  }, []); // Empty deps - create once and never change

  // Debug logging removed for performance
  return (
    <NotificationProvider>
      <EnterpriseErrorBoundaryWithTour
        componentName="DxfViewer"
        enableRetry
        maxRetries={2}
        enableReporting
        showErrorDetails
      >
          {/* ===== ΝΕΑ UNIFIED PROVIDERS (για internal use από contexts) ===== */}
          {/* 🗑️ REMOVED: ConfigurationProvider - MERGED into DxfSettingsProvider */}
              <ProjectHierarchyProvider>
                {/* ===== ΚΕΝΤΡΙΚΟΣ AUTO-SAVE PROVIDER (πρώτα από όλα) ===== */}
                <DxfSettingsProvider enabled syncDeps={syncDeps}>
                  <StyleManagerProvider>
                {/* LineSettingsProvider REMOVED - χρησιμοποιείται πλέον μόνο το DxfSettingsProvider */}
                {/* TextSettingsProvider REMOVED - χρησιμοποιείται πλέον μόνο το DxfSettingsProvider */}
                {/* 🔍 TESTING: Re-enable GripProvider to test for infinite loop */}
                <GripProvider>
                      {/* ✅ ΑΦΑΙΡΕΣΗ ΠΑΛΙΩΝ SPECIFIC PROVIDERS - ΧΡΗΣΙΜΟΠΟΙΟΥΝΤΑΙ ΠΛΕΟΝ UNIFIED HOOKS */}
                      {/* 🚫 TEMPORARY: Re-enable providers one-by-one */}
                      <SnapProvider>
                <RulersGridSystem enablePersistence persistenceKey="dxf-viewer-rulers-grid">
                  <CursorSystem>
                      <SelectionSystem>
                        <ToolbarsSystem>
                          <LevelsSystem enableFirestore={process.env.NODE_ENV === 'production'}>
                            <OverlayStoreProvider>
                                <DxfViewerContent {...props} />
                            </OverlayStoreProvider>
                          </LevelsSystem>
                        </ToolbarsSystem>
                      </SelectionSystem>
                    </CursorSystem>
                  </RulersGridSystem>
                      </SnapProvider>
                    {/* ✅ ΤΕΛΟΣ ΑΦΑΙΡΕΣΗΣ ΠΑΛΙΩΝ PROVIDERS */}
                </GripProvider>
                {/* TextSettingsProvider REMOVED - χρησιμοποιείται πλέον μόνο το DxfSettingsProvider */}
                {/* LineSettingsProvider REMOVED - χρησιμοποιείται πλέον μόνο το DxfSettingsProvider */}
                  </StyleManagerProvider>
                </DxfSettingsProvider>
              </ProjectHierarchyProvider>
          {/* 🗑️ REMOVED: ConfigurationProvider closing tag */}
      </EnterpriseErrorBoundaryWithTour>
    </NotificationProvider>
  );
}

export default DxfViewerApp;