'use client';
import {
  Undo, Redo, Crosshair, Grid, EyeOff, Eye, PanelRight,
  BarChart3, Crop, Focus, Download, FlaskConical, Activity, Sparkles,
} from 'lucide-react';
import type { ActionDefinition } from './types';
import { DXF_UTILITY_TOOL_LABELS } from '../../../../constants/property-statuses-enterprise';
import { DXF_ACTION_COLORS } from '../../config/toolbar-colors';
import { getShortcutDisplayLabel } from '../../config/keyboard-shortcuts';

export const createActionButtons = (props: {
  canUndo: boolean;
  canRedo: boolean;
  snapEnabled: boolean;
  showGrid: boolean;
  autoCrop: boolean;
  showCursorSettings?: boolean;
  guidesVisible?: boolean;
  showGuidePanel?: boolean;
  onAction: (action: string, data?: number | string | boolean) => void;
}): ActionDefinition[] => [
  {
    id: 'undo',
    icon: Undo,
    label: DXF_UTILITY_TOOL_LABELS.UNDO,
    hotkey: getShortcutDisplayLabel('undo'),
    disabled: !props.canUndo,
    colorClass: DXF_ACTION_COLORS.undo,
    onClick: () => props.onAction('undo')
  },
  {
    id: 'redo',
    icon: Redo,
    label: DXF_UTILITY_TOOL_LABELS.REDO,
    hotkey: getShortcutDisplayLabel('redo'),
    disabled: !props.canRedo,
    colorClass: DXF_ACTION_COLORS.redo,
    onClick: () => props.onAction('redo')
  },
  {
    id: 'cursor-settings',
    icon: Crosshair,
    label: DXF_UTILITY_TOOL_LABELS.CURSOR_SETTINGS,
    hotkey: getShortcutDisplayLabel('toggleCursorSettings'),
    active: props.showCursorSettings,
    colorClass: DXF_ACTION_COLORS.cursorSettings,
    onClick: () => props.onAction('toggle-cursor-settings')
  },
  {
    id: 'grid',
    icon: Grid,
    label: props.showGrid ? 'actionButtons.hideGrid' : 'actionButtons.showGrid',
    hotkey: getShortcutDisplayLabel('grid'),
    active: props.showGrid,
    colorClass: DXF_ACTION_COLORS.grid,
    onClick: () => props.onAction('grid')
  },
  {
    id: 'toggle-guides',
    icon: props.guidesVisible ? EyeOff : Eye,
    label: props.guidesVisible ? 'actionButtons.hideGuides' : 'actionButtons.showGuides',
    hotkey: 'G→V',
    active: props.guidesVisible,
    colorClass: DXF_ACTION_COLORS.grid,
    onClick: () => props.onAction('toggle-guides')
  },
  {
    id: 'toggle-guide-panel',
    icon: PanelRight,
    label: props.showGuidePanel ? 'actionButtons.hideGuidePanel' : 'actionButtons.showGuidePanel',
    hotkey: 'G→L',
    active: props.showGuidePanel,
    colorClass: DXF_ACTION_COLORS.grid,
    onClick: () => props.onAction('toggle-guide-panel')
  },
  {
    id: 'toggle-guide-analysis',
    icon: BarChart3,
    label: DXF_UTILITY_TOOL_LABELS.GUIDE_ANALYSIS,
    hotkey: '',
    colorClass: DXF_ACTION_COLORS.grid,
    onClick: () => props.onAction('toggle-guide-analysis-panel')
  },
  {
    id: 'autocrop',
    icon: Crop,
    label: props.autoCrop ? 'actionButtons.autoCropOn' : 'actionButtons.autoCropOff',
    hotkey: getShortcutDisplayLabel('autocrop'),
    active: props.autoCrop,
    colorClass: DXF_ACTION_COLORS.autocrop,
    onClick: () => props.onAction('autocrop')
  },
  {
    id: 'fit',
    icon: Focus,
    label: DXF_UTILITY_TOOL_LABELS.FIT_TO_VIEW,
    hotkey: getShortcutDisplayLabel('fit'),
    active: false,
    disabled: false,
    colorClass: DXF_ACTION_COLORS.fit,
    onClick: () => props.onAction('fit-to-view')
  },
  {
    id: 'export',
    icon: Download,
    label: DXF_UTILITY_TOOL_LABELS.EXPORT,
    hotkey: getShortcutDisplayLabel('export'),
    colorClass: DXF_ACTION_COLORS.export,
    onClick: () => props.onAction('export')
  },
  {
    id: 'tests',
    icon: FlaskConical,
    label: DXF_UTILITY_TOOL_LABELS.RUN_TESTS,
    hotkey: getShortcutDisplayLabel('runTests'),
    colorClass: DXF_ACTION_COLORS.tests,
    onClick: () => props.onAction('run-tests')
  },
  {
    id: 'toggle-perf',
    icon: Activity,
    label: DXF_UTILITY_TOOL_LABELS.TOGGLE_PERF,
    hotkey: getShortcutDisplayLabel('togglePerf'),
    colorClass: DXF_ACTION_COLORS.togglePerf,
    onClick: () => props.onAction('toggle-perf')
  },
  {
    id: 'toggle-ai-assistant',
    icon: Sparkles,
    label: DXF_UTILITY_TOOL_LABELS.AI_ASSISTANT,
    hotkey: '',
    colorClass: DXF_ACTION_COLORS.aiAssistant,
    onClick: () => props.onAction('toggle-ai-assistant')
  }
];
