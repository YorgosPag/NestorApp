'use client';

/**
 * Unified Dynamic Input Hook
 * Re-exports all dynamic input hooks for easy consumption
 */

export { useDynamicInputState } from './hooks/useDynamicInputState';
export { useDynamicInputKeyboard } from './hooks/useDynamicInputKeyboard';
export { useDynamicInputPhase } from './hooks/useDynamicInputPhase';
export { useDynamicInputLayout } from './hooks/useDynamicInputLayout';
export { useDynamicInputRealtime } from './hooks/useDynamicInputRealtime';
export { useDynamicInputAnchoring } from './hooks/useDynamicInputAnchoring';
export { useDynamicInputToolReset } from './hooks/useDynamicInputToolReset';
export { useDynamicInputHandler } from './hooks/useDynamicInputHandler';

// Re-export types and interfaces
export type * from './hooks/interfaces';
export type * from './types';