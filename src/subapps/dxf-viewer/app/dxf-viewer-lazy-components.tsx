'use client';

/**
 * Lazy-loaded UI subtree for DxfViewerContent.
 *
 * Extracted from DxfViewerContent.tsx to keep the host file under the
 * 500-line Google SRP limit (CHECK 4). Components are loaded lazily so
 * the initial DXF Viewer route bundle stays small.
 */
import React from 'react';

export const TestsModal = React.lazy(() => import('../ui/components/TestsModal').then(mod => ({ default: mod.TestsModal })));
export const CreditsDialog = React.lazy(() => import('../ui/components/CreditsDialog').then(mod => ({ default: mod.CreditsDialog })));
export const FloorplanBackgroundPanel = React.lazy(() => import('../floorplan-background').then(mod => ({ default: mod.FloorplanBackgroundPanel })));
export const ReplaceConfirmDialog = React.lazy(() => import('../floorplan-background').then(mod => ({ default: mod.ReplaceConfirmDialog })));
export const CalibrationDialog = React.lazy(() => import('../floorplan-background').then(mod => ({ default: mod.CalibrationDialog })));
export const DxfAiChatPanel = React.lazy(() => import('../ai-assistant/components/DxfAiChatPanel'));
export const DxfFindReplaceHost = React.lazy(() => import('../ui/text-toolbar/DxfFindReplaceHost').then(mod => ({ default: mod.DxfFindReplaceHost })));
export const DxfSymbolPickerHost = React.lazy(() => import('../ui/text-toolbar/DxfSymbolPickerHost').then(mod => ({ default: mod.DxfSymbolPickerHost })));
export const RenumberOpeningsHost = React.lazy(() => import('../ui/components/bim-openings/RenumberOpeningsHost').then(mod => ({ default: mod.RenumberOpeningsHost })));
export const OpeningTagStyleHost = React.lazy(() => import('../ui/components/bim-openings/OpeningTagStyleHost').then(mod => ({ default: mod.OpeningTagStyleHost })));
export const OpeningSchedulePdfHost = React.lazy(() => import('../ui/components/bim-openings/OpeningSchedulePdfHost').then(mod => ({ default: mod.OpeningSchedulePdfHost })));
// ADR-396 P6 — Thermal Envelope (ETICS) authoring dialog host
export const ThermalEnvelopeHost = React.lazy(() => import('../ui/components/bim-envelope/ThermalEnvelopeHost').then(mod => ({ default: mod.ThermalEnvelopeHost })));
// ADR-363 §6 Phase 8 — BIM Schedule («Πίνακας BIM») dialog host
export const BimScheduleHost = React.lazy(() => import('./BimScheduleHost').then(mod => ({ default: mod.BimScheduleHost })));
// ADR-453 — Print/Export («Εκτύπωση») dialog host
export const PrintHost = React.lazy(() => import('./PrintHost').then(mod => ({ default: mod.PrintHost })));
// ADR-505 — Export («Εξαγωγή») dialog host (DXF/IFC/PDF, scope-filtered, multi-floor)
export const ExportHost = React.lazy(() => import('./ExportHost').then(mod => ({ default: mod.ExportHost })));
// ADR-457 — Column Reinforcement Detail Sheet («Λεπτομέρεια Οπλισμού») dialog host
export const ColumnDetailHost = React.lazy(() => import('../ui/components/column-detail/ColumnDetailHost').then(mod => ({ default: mod.ColumnDetailHost })));
// ADR-463 — Footing Reinforcement Detail Sheet («Λεπτομέρεια Οπλισμού») dialog host
export const FoundationDetailHost = React.lazy(() => import('../ui/components/foundation-detail/FoundationDetailHost').then(mod => ({ default: mod.FoundationDetailHost })));
// ADR-471 — Beam Reinforcement Detail Sheet («Λεπτομέρεια Οπλισμού») dialog host
export const BeamDetailHost = React.lazy(() => import('../ui/components/beam-detail/BeamDetailHost').then(mod => ({ default: mod.BeamDetailHost })));
// ADR-476 — Slab Reinforcement Detail Sheet («Λεπτομέρεια Οπλισμού») dialog host
export const SlabDetailHost = React.lazy(() => import('../ui/components/slab-detail/SlabDetailHost').then(mod => ({ default: mod.SlabDetailHost })));
// ADR-391 — AdminLayerManager dialog host
export const AdminLayerManagerDialogHost = React.lazy(() => import('./AdminLayerManagerDialogHost').then(mod => ({ default: mod.AdminLayerManagerDialogHost })));
// Floor management («Όροφοι Κτιρίου») dialog host — open from Levels panel ⚙️ / floor-tab right-click
export const FloorManagementDialogHost = React.lazy(() => import('./FloorManagementDialogHost').then(mod => ({ default: mod.FloorManagementDialogHost })));
// ADR-363 Φ3c — «Κολώνα από περίγραμμα» confirm dialog (self-subscribing, zero props)
export const ColumnPerimeterConfirmDialog = React.lazy(() => import('../ui/dialogs/ColumnPerimeterConfirmDialog').then(mod => ({ default: mod.ColumnPerimeterConfirmDialog })));
// ADR-398 §3.17 — «Υιοθέτηση μεγέθους ορθογωνίου» confirm dialog (self-subscribing, zero props)
export const ColumnAdoptSizeDialog = React.lazy(() => import('../ui/dialogs/ColumnAdoptSizeDialog').then(mod => ({ default: mod.ColumnAdoptSizeDialog })));
export const DxfImportModal = React.lazy(() => import('../components/DxfImportModal'));
export const SimpleProjectDialog = React.lazy(() => import('../components/SimpleProjectDialog').then(mod => ({ default: mod.SimpleProjectDialog })));
export const ConstructionLayerScaffoldDialog = React.lazy(() => import('../hooks/useConstructionLayerScaffold').then(mod => ({ default: mod.ConstructionLayerScaffoldDialog })));
export const FloorplanImportWizard = React.lazy(() => import('@/features/floorplan-import').then(mod => ({ default: mod.FloorplanImportWizard })));
export const MainContentSection = React.lazy(() => import('../layout/MainContentSection').then(mod => ({ default: mod.MainContentSection })));
export const FloatingPanelsSection = React.lazy(() => import('../layout/FloatingPanelsSection').then(mod => ({ default: mod.FloatingPanelsSection })));
