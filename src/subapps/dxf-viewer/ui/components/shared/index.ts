/**
 * SHARED COMPONENTS INDEX
 * Centralized exports για όλα τα shared components
 *
 * ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: Color pickers τώρα διαθέσιμα από ../../../color
 * ✅ BACKWARD COMPATIBLE: SharedColorPicker εξακολουθεί να λειτουργεί
 * ✅ ENTERPRISE: Όλα τα color components χρησιμοποιούν Enterprise Color System
 */

export { OverrideToggle } from './OverrideToggle';
export { SharedColorPicker } from './SharedColorPicker'; // ✅ Now redirects to centralized system
export { SubTabRenderer } from './SubTabRenderer';
export { LazyPanelWrapper } from './LazyPanelWrapper';
// REMOVED: AutoSaveIndicator - replaced with CentralizedAutoSaveStatus
// export { AutoSaveIndicator, AutoSaveIndicatorCompact } from './AutoSaveIndicator';
export type { SubTabType, SubTabContent } from './SubTabRenderer';

// Future shared components will be exported here
// export { SharedButton } from './SharedButton';
// export { SharedModal } from './SharedModal';