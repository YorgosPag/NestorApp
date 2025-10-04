/**
 * SHARED COMPONENTS INDEX
 * Centralized exports για όλα τα shared components
 * ΒΗΜΑ 7-8 του FloatingPanelContainer refactoring
 */

export { OverrideToggle } from './OverrideToggle';
export { SharedColorPicker } from './SharedColorPicker';
export { SubTabRenderer } from './SubTabRenderer';
export { LazyPanelWrapper } from './LazyPanelWrapper';
// REMOVED: AutoSaveIndicator - replaced with CentralizedAutoSaveStatus
// export { AutoSaveIndicator, AutoSaveIndicatorCompact } from './AutoSaveIndicator';
export type { SubTabType, SubTabContent } from './SubTabRenderer';

// Future shared components will be exported here
// export { SharedButton } from './SharedButton';
// export { SharedModal } from './SharedModal';