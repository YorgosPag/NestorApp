'use client';

/**
 * useDxfViewerUiState — ephemeral UI toggle state extracted from DxfViewerContent.
 * ADR-065 SRP split: owns the local `useState` cluster for dialogs/panels/canvas
 * visibility that is NOT domain state (those live in useDxfViewerState / stores).
 *
 * Growth sink: new modal/panel/dialog toggles land here, NOT in DxfViewerContent,
 * so the orchestrator stays under the 500-line Google SRP limit (N.7.1 / CHECK 4).
 *
 * Related files:
 * - DxfViewerContent.tsx (main orchestrator)
 * - DxfViewerDialogs.tsx (consumer — renders the modal/host portals)
 */

import React from 'react';
import type { UnifiedTestReport } from '../debug/unified-test-runner';

/** Bundle returned by useDxfViewerUiState. */
export interface DxfViewerUiState {
  // Responsive sidebar drawer
  sidebarOpen: boolean;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  // Test runner
  testModalOpen: boolean;
  setTestModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  testReport: UnifiedTestReport | null;
  setTestReport: React.Dispatch<React.SetStateAction<UnifiedTestReport | null>>;
  formattedTestReport: string;
  setFormattedTestReport: React.Dispatch<React.SetStateAction<string>>;
  testsModalOpen: boolean;
  setTestsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  // Third-party asset credits / licences (ADR-409 §B-θετικό.2)
  creditsModalOpen: boolean;
  setCreditsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  // PDF + AI panels
  pdfPanelOpen: boolean;
  setPdfPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  aiChatOpen: boolean;
  setAiChatOpen: React.Dispatch<React.SetStateAction<boolean>>;
  // Import dialogs (ADR-345 Fase 6 — lifted from EnhancedDXFToolbar, SSOT)
  showEnhancedImport: boolean;
  setShowEnhancedImport: React.Dispatch<React.SetStateAction<boolean>>;
  showImportWizard: boolean;
  setShowImportWizard: React.Dispatch<React.SetStateAction<boolean>>;
  showLegacyImport: boolean;
  setShowLegacyImport: React.Dispatch<React.SetStateAction<boolean>>;
  // Canvas visibility toggles
  dxfCanvasVisible: boolean;
  setDxfCanvasVisible: React.Dispatch<React.SetStateAction<boolean>>;
  layerCanvasVisible: boolean;
  setLayerCanvasVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * Owns the ephemeral UI toggle state for the DXF viewer shell. Pure state
 * container: zero subscriptions to high-frequency stores (CHECK 6B/6C safe).
 */
export function useDxfViewerUiState(): DxfViewerUiState {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [testModalOpen, setTestModalOpen] = React.useState(false);
  const [testReport, setTestReport] = React.useState<UnifiedTestReport | null>(null);
  const [formattedTestReport, setFormattedTestReport] = React.useState<string>('');
  const [testsModalOpen, setTestsModalOpen] = React.useState(false);
  const [creditsModalOpen, setCreditsModalOpen] = React.useState(false);
  const [pdfPanelOpen, setPdfPanelOpen] = React.useState(false);
  const [aiChatOpen, setAiChatOpen] = React.useState(false);
  const [showEnhancedImport, setShowEnhancedImport] = React.useState(false);
  const [showImportWizard, setShowImportWizard] = React.useState(false);
  const [showLegacyImport, setShowLegacyImport] = React.useState(false);
  const [dxfCanvasVisible, setDxfCanvasVisible] = React.useState(true);
  const [layerCanvasVisible, setLayerCanvasVisible] = React.useState(true);

  return {
    sidebarOpen, setSidebarOpen,
    testModalOpen, setTestModalOpen,
    testReport, setTestReport,
    formattedTestReport, setFormattedTestReport,
    testsModalOpen, setTestsModalOpen,
    creditsModalOpen, setCreditsModalOpen,
    pdfPanelOpen, setPdfPanelOpen,
    aiChatOpen, setAiChatOpen,
    showEnhancedImport, setShowEnhancedImport,
    showImportWizard, setShowImportWizard,
    showLegacyImport, setShowLegacyImport,
    dxfCanvasVisible, setDxfCanvasVisible,
    layerCanvasVisible, setLayerCanvasVisible,
  };
}
