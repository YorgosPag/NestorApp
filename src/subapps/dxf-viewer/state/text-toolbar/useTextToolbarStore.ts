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

interface TextToolbarStore extends TextToolbarValues {
  /**
   * True while the toolbar is being populated from the current selection
   * (Phase 6.E — useTextToolbarSelectionSync). The command bridge
   * (useTextToolbarCommandBridge) ignores `setValue` / `setMany` events
   * fired while this flag is on, so populate cycles never re-enter the
   * CommandHistory.
   */
  isPopulating: boolean;
  setValue: <K extends keyof TextToolbarValues>(key: K, value: TextToolbarValues[K]) => void;
  setMany: (values: Partial<TextToolbarValues>) => void;
  /** Populate the store atomically (sets isPopulating true → false). */
  populate: (values: Partial<TextToolbarValues>) => void;
  reset: () => void;
}

export const useTextToolbarStore = create<TextToolbarStore>((set) => ({
  ...DEFAULT_TOOLBAR_VALUES,
  isPopulating: false,
  setValue: (key, value) => set((state) => ({ ...state, [key]: value })),
  setMany: (values) => set((state) => ({ ...state, ...values })),
  populate: (values) => {
    set((state) => ({ ...state, ...values, isPopulating: true }));
    queueMicrotask(() => set(() => ({ isPopulating: false })));
  },
  reset: () => set(() => ({ ...DEFAULT_TOOLBAR_VALUES, isPopulating: false })),
}));
