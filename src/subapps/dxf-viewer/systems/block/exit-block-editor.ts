/**
 * ADR-641 Φ3 — close the Block Editor (BEDIT), SSoT for the exit gesture.
 *
 * Both exit affordances — the Escape-bus handler ({@link useBlockEditorExitEscape}) and the
 * clickable «Κλείσιμο» in the status-bar breadcrumb ({@link StatusBarActiveBlockLeaf}) — call THIS
 * one function, so the exit behaviour (leave the editor + re-select the exited block) lives in a
 * single place (N.18, no copy-paste twin).
 *
 * Re-selecting the exited block mirrors the GROUP step-out ladder (ADR-575): once the editor closes
 * the canvas is back on the world scene, so the whole block is highlighted again and a SECOND Escape
 * (now ENTITY_SELECTION) plainly deselects it. Reading the id BEFORE exiting keeps it live even
 * though `exitBlockEdit` clears the store.
 */

import { getActiveBlockEditId, exitBlockEdit } from './ActiveBlockEditStore';
import { SelectedEntitiesStore } from '../selection/SelectedEntitiesStore';

/** Close the Block Editor and re-select the exited block. No-op when not inside any editor. */
export function exitBlockEditAndReselect(): void {
  const exiting = getActiveBlockEditId();
  if (exiting === null) return;
  exitBlockEdit();
  SelectedEntitiesStore.replaceEntitySelection([exiting]);
}
