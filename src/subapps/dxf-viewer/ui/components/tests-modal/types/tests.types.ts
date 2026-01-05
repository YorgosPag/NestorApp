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
