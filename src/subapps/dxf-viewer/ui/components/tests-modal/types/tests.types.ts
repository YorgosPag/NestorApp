/**
 * 🏢 TESTS MODAL - TypeScript Type Definitions
 *
 * Centralized type definitions για όλο το tests modal system
 * Single source of truth for interfaces
 */

import type { LucideIcon } from 'lucide-react';

export type TabType = 'automated' | 'unit' | 'standalone';

export type NotificationFn = (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;

export interface TestDefinition {
  id: string;
  name: string;
  description: string;
  action: () => Promise<void>;
  /** 🏢 ENTERPRISE: Lucide icon component for the test */
  icon?: LucideIcon;
}

export interface TestState {
  runningTests: Set<string>;
  completedTests: Set<string>;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  startTest: (id: string) => void;
  completeTest: (id: string) => void;
  failTest: (id: string) => void;
}

export interface DraggableState {
  position: { x: number; y: number };
  isDragging: boolean;
  modalRef: React.RefObject<HTMLDivElement>;
  handleMouseDown: (e: React.MouseEvent) => void;
}

export interface ApiTestHandlers {
  handleRunVitest: () => Promise<void>;
  handleRunJest: () => Promise<void>;
  handleRunPlaywright: () => Promise<void>;
}

export interface TestExecutionHandlers {
  handleRunTest: (testId: string, testFunction: () => Promise<void>) => Promise<void>;
  handleRunAllTests: () => Promise<void>;
}

export interface StandaloneTestHandlers {
  handleRunCoordinateReversibility: () => Promise<void>;
  handleRunGridWorkflow: () => Promise<void>;
}

export interface TestsModalProps {
  isOpen: boolean;
  onClose: () => void;
  showCopyableNotification: NotificationFn;
}

// ============================================================================
// 🏢 ENTERPRISE: Test Result Types - Used by automated tests
// ============================================================================

/**
 * Result of a line drawing check
 * Used by Line Drawing Test in automatedTests.ts
 */
export interface LineDrawingCheckResult {
  passed: boolean;
  description: string;
}

/**
 * Result of a workflow step
 * Used by Layering Workflow Test in automatedTests.ts
 */
export interface WorkflowStepResult {
  status: 'success' | 'failed' | 'skipped';
  name?: string;
  error?: string;
}

/**
 * Floating panel detection result
 * Used by DOM Inspector Test in automatedTests.ts
 */
export interface FloatingPanelResult {
  found: boolean;
  name?: string;
  element?: HTMLElement;
}

/**
 * Basic DXF entity structure
 * Used for entity validation in custom-tests.tsx
 */
export interface DxfEntity {
  type: string;
  handle?: string;
  layer?: string;
}

/**
 * DXF data structure for validation tests
 */
export interface DxfValidationData {
  entities: DxfEntity[];
  tables?: {
    layer?: Record<string, unknown>;
  };
  header?: Record<string, unknown>;
}

// ============================================================================
// 🏢 ENTERPRISE: Global Window Extensions for Debug Tools
// ============================================================================

/**
 * DXF Transform state stored on window for debug tools
 */
export interface DxfTransformState {
  scale: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Extended Window interface for debug tools
 * Use: (window as WindowWithDxfTransform).dxfTransform
 */
export interface WindowWithDxfTransform extends Window {
  dxfTransform?: DxfTransformState;
}
