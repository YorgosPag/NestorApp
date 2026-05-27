'use client';

/**
 * Lazy-loaded UI subtree for DxfViewerContent.
 *
 * Extracted from DxfViewerContent.tsx to keep the host file under the
 * 500-line Google SRP limit (CHECK 4). Components are loaded lazily so
 * the initial DXF Viewer route bundle stays small.
 */
import React from 'react';

export const OverlayToolbar = React.lazy(() => import('../ui/OverlayToolbar').then(mod => ({ default: mod.OverlayToolbar })));
export const ColorManager = React.lazy(() => import('../ui/components/ColorManager').then(mod => ({ default: mod.ColorManager })));
export const ProSnapToolbar = React.lazy(() => import('../ui/components/ProSnapToolbar').then(mod => ({ default: mod.ProSnapToolbar })));
export const TestsModal = React.lazy(() => import('../ui/components/TestsModal').then(mod => ({ default: mod.TestsModal })));
export const CursorSettingsPanel = React.lazy(() => import('../ui/CursorSettingsPanel'));
export const CoordinateCalibrationOverlay = React.lazy(() => import('../ui/CoordinateCalibrationOverlay'));
export const AutoSaveStatus = React.lazy(() => import('../ui/components/AutoSaveStatus').then(mod => ({ default: mod.AutoSaveStatus })));
export const CentralizedAutoSaveStatus = React.lazy(() => import('../ui/components/CentralizedAutoSaveStatus').then(mod => ({ default: mod.CentralizedAutoSaveStatus })));
export const OverlayProperties = React.lazy(() => import('../ui/OverlayProperties').then(mod => ({ default: mod.OverlayProperties })));
export const DraggableOverlayToolbar = React.lazy(() => import('../ui/components/DraggableOverlayToolbar').then(mod => ({ default: mod.DraggableOverlayToolbar })));
export const DraggableOverlayProperties = React.lazy(() => import('../ui/components/DraggableOverlayProperties').then(mod => ({ default: mod.DraggableOverlayProperties })));
export const FloorplanBackgroundPanel = React.lazy(() => import('../floorplan-background').then(mod => ({ default: mod.FloorplanBackgroundPanel })));
export const ReplaceConfirmDialog = React.lazy(() => import('../floorplan-background').then(mod => ({ default: mod.ReplaceConfirmDialog })));
export const CalibrationDialog = React.lazy(() => import('../floorplan-background').then(mod => ({ default: mod.CalibrationDialog })));
export const DxfAiChatPanel = React.lazy(() => import('../ai-assistant/components/DxfAiChatPanel'));
export const DxfFindReplaceHost = React.lazy(() => import('../ui/text-toolbar/DxfFindReplaceHost').then(mod => ({ default: mod.DxfFindReplaceHost })));
export const DxfSymbolPickerHost = React.lazy(() => import('../ui/text-toolbar/DxfSymbolPickerHost').then(mod => ({ default: mod.DxfSymbolPickerHost })));
export const RenumberOpeningsHost = React.lazy(() => import('../ui/components/bim-openings/RenumberOpeningsHost').then(mod => ({ default: mod.RenumberOpeningsHost })));
export const OpeningTagStyleHost = React.lazy(() => import('../ui/components/bim-openings/OpeningTagStyleHost').then(mod => ({ default: mod.OpeningTagStyleHost })));
export const OpeningSchedulePdfHost = React.lazy(() => import('../ui/components/bim-openings/OpeningSchedulePdfHost').then(mod => ({ default: mod.OpeningSchedulePdfHost })));
// ADR-391 — AdminLayerManager dialog host
export const AdminLayerManagerDialogHost = React.lazy(() => import('./AdminLayerManagerDialogHost').then(mod => ({ default: mod.AdminLayerManagerDialogHost })));
export const DxfImportModal = React.lazy(() => import('../components/DxfImportModal'));
export const SimpleProjectDialog = React.lazy(() => import('../components/SimpleProjectDialog').then(mod => ({ default: mod.SimpleProjectDialog })));
export const ConstructionLayerScaffoldDialog = React.lazy(() => import('../hooks/useConstructionLayerScaffold').then(mod => ({ default: mod.ConstructionLayerScaffoldDialog })));
export const FloorplanImportWizard = React.lazy(() => import('@/features/floorplan-import').then(mod => ({ default: mod.FloorplanImportWizard })));
export const MainContentSection = React.lazy(() => import('../layout/MainContentSection').then(mod => ({ default: mod.MainContentSection })));
export const FloatingPanelsSection = React.lazy(() => import('../layout/FloatingPanelsSection').then(mod => ({ default: mod.FloatingPanelsSection })));
