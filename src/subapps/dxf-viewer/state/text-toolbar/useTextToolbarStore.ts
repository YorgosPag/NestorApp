/**
 * ADR-344 Phase 5.A — Toolbar pending values store.
 *
 * Holds the user-pending values shown in the TextToolbar before they are
 * committed via a text command (Phase 6, ADR-031 CommandHistory). When a
 * single text entity is selected the values mirror that entity; when many
 * are selected each field independently becomes `null` (MixedValue) if the
 * selection disagrees on that field.
 *
 * Commits are NOT done from this store — toolbar buttons read values from
 * here and dispatch the matching ICommand. The store is one-way state for
 * the UI; CommandHistory is the source of truth for the document.
 *
 * ADR-557 grip-drag live-preview — a SECOND suppression flag `isPreviewing`
 * (sibling of `isPopulating`, DIFFERENT lifecycle owner: populate = selection
 * sync effect, preview = grip-drag pointer-move) lets a canvas-level publisher
 * push live `fontHeight` / `widthFactor` values through `setPreview()` while the
 * user drags a text resize handle, WITHOUT the command bridge dispatching an
 * `UpdateTextStyleCommand` per frame. Both flags carry the SAME semantics toward
 * the command bridge: any write made while either is on is ignored by it.
 */

import { create } from 'zustand';
import type {
  DxfColor,
  MixedValue,
  TextJustification,
  LineSpacingMode,
} from '../../text-engine/types';
import { DXF_COLOR_BY_LAYER } from '../../text-engine/types';

export interface TextToolbarValues {
  fontFamily: MixedValue<string>;
  fontHeight: MixedValue<number>;
  bold: MixedValue<boolean>;
  italic: MixedValue<boolean>;
  underline: MixedValue<boolean>;
  overline: MixedValue<boolean>;
  strikethrough: MixedValue<boolean>;
  color: MixedValue<DxfColor>;
  widthFactor: MixedValue<number>;
  obliqueAngle: MixedValue<number>;
  tracking: MixedValue<number>;
  justification: MixedValue<TextJustification>;
  lineSpacingMode: MixedValue<LineSpacingMode>;
  lineSpacingFactor: MixedValue<number>;
  rotation: MixedValue<number>;
  layerId: MixedValue<string>;
  currentScale: MixedValue<string>;
}

export const DEFAULT_TOOLBAR_VALUES: TextToolbarValues = {
  fontFamily: 'Arial',
  fontHeight: 2.5,
  bold: false,
  italic: false,
  underline: false,
  overline: false,
  strikethrough: false,
  color: DXF_COLOR_BY_LAYER,
  widthFactor: 1,
  obliqueAngle: 0,
  tracking: 1,
  justification: 'ML',
  lineSpacingMode: 'multiple',
  lineSpacingFactor: 1,
  rotation: 0,
  layerId: '0',
  currentScale: '',
};

/**
 * ADR-557 — the ONLY shape `setPreview` accepts: the 2 fields a text-resize grip
 * drag can change (`fontHeight` / `widthFactor`). Deliberately excludes rotation /
 * colour / etc. so the live grip-drag preview channel can never write anything but
 * the height/width the user is dragging.
 */
export type TextStylePreviewPatch = Partial<Pick<TextToolbarValues, 'fontHeight' | 'widthFactor'>>;

interface TextToolbarStore extends TextToolbarValues {
  /**
   * True while the toolbar is being populated from the current selection
   * (Phase 6.E — useTextToolbarSelectionSync). The command bridge
   * (useTextToolbarCommandBridge) ignores `setValue` / `setMany` events
   * fired while this flag is on, so populate cycles never re-enter the
   * CommandHistory.
   *
   * ADR-557 — see the sibling `isPreviewing` flag below: same suppression
   * semantics toward the command bridge, but a different lifecycle owner
   * (populate = selection-sync effect; preview = grip-drag pointer-move).
   */
  isPopulating: boolean;
  /**
   * ADR-557 grip-drag live-preview — true for the microtask during which
   * `setPreview()` pushes a live `fontHeight` / `widthFactor` value while the
   * user drags a text resize handle. Sibling of `isPopulating` (SAME suppression
   * meaning toward `useTextToolbarCommandBridge` — it early-returns while either
   * is on — but a DIFFERENT owner: populate = selection-sync, preview = grip
   * drag). Self-clearing (queueMicrotask) so it can NEVER stay stuck true if the
   * drag is interrupted (Esc / blur / mouse-leave-window).
   */
  isPreviewing: boolean;
  setValue: <K extends keyof TextToolbarValues>(key: K, value: TextToolbarValues[K]) => void;
  setMany: (values: Partial<TextToolbarValues>) => void;
  /** Populate the store atomically (sets isPopulating true → false). */
  populate: (values: Partial<TextToolbarValues>) => void;
  /**
   * ADR-557 — push a LIVE grip-drag preview value (height / widthFactor). Sets
   * `isPreviewing` true then self-clears in the next microtask (belt-and-suspenders:
   * the flag never stays stuck true even if the drag ends abnormally). The command
   * bridge ignores the write, so no command / undo entry is created per frame.
   */
  setPreview: (values: TextStylePreviewPatch) => void;
  reset: () => void;
}

export const useTextToolbarStore = create<TextToolbarStore>((set) => ({
  ...DEFAULT_TOOLBAR_VALUES,
  isPopulating: false,
  isPreviewing: false,
  setValue: (key, value) => set((state) => ({ ...state, [key]: value })),
  setMany: (values) => set((state) => ({ ...state, ...values })),
  populate: (values) => {
    set((state) => ({ ...state, ...values, isPopulating: true }));
    queueMicrotask(() => set(() => ({ isPopulating: false })));
  },
  setPreview: (values) => {
    set((state) => ({ ...state, ...values, isPreviewing: true }));
    queueMicrotask(() => set(() => ({ isPreviewing: false })));
  },
  reset: () => set(() => ({ ...DEFAULT_TOOLBAR_VALUES, isPopulating: false, isPreviewing: false })),
}));
