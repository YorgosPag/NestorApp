// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_SELECTION_BUS = false;

export const HILITE_EVENT = 'dxf.highlightByIds';

export type HighlightPayload = {
  ids: string[];
  layerName?: string;
  mode?: 'hover' | 'select'; // << νέο
};

// fire-and-forget: ενημερώνει τον καμβά να κάνει dashed+grips στα ids
export function publishHighlight(payload: HighlightPayload) {
  const detail = { mode: 'select', ...payload }; // ✅ default

  window.dispatchEvent(new CustomEvent(HILITE_EVENT, { detail }));
}
