/**
 * Dynamic Input System
 * Centralized system for dynamic input functionality
 */

export { default as DynamicInputSystem } from './DynamicInputSystem';
export * from './useDynamicInput';

// Components
export { default as DynamicInputOverlay } from './components/DynamicInputOverlay';
export { DynamicInputContainer } from './components/DynamicInputContainer';
export { DynamicInputHeader } from './components/DynamicInputHeader';
export { DynamicInputFooter } from './components/DynamicInputFooter';
export { DynamicInputField } from './components/DynamicInputField';

// Utils
export * from './utils/events';
export * from './utils/number';

// Types
export * from './types';

// Keyboard Handlers (Strategy Pattern)
// Note: Phase type already exported from ./useDynamicInput, so we explicitly export other types
export {
  getKeyboardHandler,
  hasCustomKeyboardHandler,
  getRegisteredKeyboardTools,
  handleLineKeyboard,
  handleCircleKeyboard,
  handleDefaultKeyboard,
  type KeyboardHandler,
  type KeyboardHandlerContext,
  type KeyboardHandlerActions,
  type KeyboardHandlerRefs,
  type DynamicSubmitPayload
} from './keyboard-handlers';
