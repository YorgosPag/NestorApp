/**
 * ADR-364 — Escape Command Bus barrel export
 *
 * Canonical import path for ALL ESC handling in the DXF viewer:
 *
 *   import { useEscapeHandler, ESC_PRIORITY } from '@/subapps/dxf-viewer/systems/escape-bus';
 *
 * Direct imports of `EscapeCommandBus.ts` are forbidden outside this folder
 * (see `.ssot-registry.json` module `escape-command-bus`).
 */

export { escapeBus } from './EscapeCommandBus';
export { useEscapeHandler } from './useEscapeHandler';
export type { UseEscapeHandlerOptions } from './useEscapeHandler';
// ADR-364 §10.15 — δήλωση θεσμοθετημένου τοπικού ιδιοκτήτη ESC (Κ3 του §10.5).
export { noteLocalEscapeOwner } from './escape-dev-audit';
export { ESC_PRIORITY } from './escape-priority';
export type { EscapePriority } from './escape-priority';
export type {
  EscapeHandler,
  EscapeBusInspection,
  EscapeDispatchResult,
} from './types';
