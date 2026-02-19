/**
 * @module systems/prompt-dialog
 * @description Centralized prompt dialog system — barrel exports
 *
 * Provides a reusable input dialog triggered from any hook via:
 * ```ts
 * const { prompt } = usePromptDialog();
 * const value = await prompt({ title: '...', label: '...' });
 * ```
 *
 * @see ADR-189 (Construction Grid & Guide System)
 * @since 2026-02-20
 */

// Store
export { PromptDialogStore, getPromptDialogStore } from './prompt-dialog-store';
export type { PromptDialogOptions, PromptDialogSnapshot } from './prompt-dialog-store';

// Hook
export { usePromptDialog } from './usePromptDialog';
export type { UsePromptDialogReturn } from './usePromptDialog';

// Component
export { PromptDialog } from './PromptDialog';
