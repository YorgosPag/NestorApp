/**
 * @file Settings Core Types - Barrel Re-export
 * @module settings-core/types
 *
 * ENTERPRISE STANDARD - This file re-exports from the types/ folder
 * for backward compatibility with existing imports.
 *
 * The actual type definitions are in:
 * - types/domain.ts: Domain types (LineSettings, TextSettings, etc.)
 * - types/state.ts: State types (ViewerMode, SettingsState, etc.)
 *
 * @version 2.0.0
 * @since 2026-01-01
 */

// Re-export everything from the types folder (explicit path to index)
export * from './types/index';
