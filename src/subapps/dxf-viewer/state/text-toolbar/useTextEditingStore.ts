/**
 * ADR-344 Phase 5.A — Live edit session store.
 *
 * Tracks the TipTap editor mounted over the canvas while the user is
 * actively editing a text entity. `activeEntityId === null` means no
 * editor is open; any value means the overlay is visible and bound to
 * that entity.
 *
 * `draft` holds the un-committed `DxfTextNode` produced by tipTapToDxfText
 * during typing — useful for live preview but never written to the scene
 * until the user commits (Enter+Ctrl or click-outside).
 */

import { create } from 'zustand';
import type { DxfTextNode } from '../../text-engine/types';

interface TextEditingStore {
  activeEntityId: string | null;
  draft: DxfTextNode | null;
  beginEdit: (entityId: string, initial: DxfTextNode) => void;
  updateDraft: (next: DxfTextNode) => void;
  endEdit: () => void;
}

export const useTextEditingStore = create<TextEditingStore>((set) => ({
  activeEntityId: null,
  draft: null,
  beginEdit: (entityId, initial) =>
    set(() => ({ activeEntityId: entityId, draft: initial })),
  updateDraft: (next) => set(() => ({ draft: next })),
  endEdit: () => set(() => ({ activeEntityId: null, draft: null })),
}));
