import { useCallback, useRef } from 'react';
import { setSelection, selectSingle } from './selection';
// 🏢 ADR: Centralized Clamp Function
import { clamp } from '../../../../rendering/entities/shared/geometry-utils';
import { useUniversalSelection } from '../../../../systems/selection';

interface KeyboardNavigationProps {
  focusedEntityId: string | null;
  setFocusedEntityId: (id: string | null) => void;
  focusEntityDom?: (id: string) => void;
  setSelectedEntitiesForMerge?: (set: Set<string>) => void;
}

export function useKeyboardNavigation({
  focusedEntityId,
  setFocusedEntityId,
  focusEntityDom,
  setSelectedEntitiesForMerge
}: KeyboardNavigationProps) {

  const universalSelection = useUniversalSelection();

  const anchorRef = useRef<string | null>(null);
  
  // Keyboard navigation για entities
  const handleEntityKeyDown = useCallback((e: React.KeyboardEvent, allVisibleEntities: Array<{ id: string }>) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    
    if (!allVisibleEntities.length) return;

    const list = allVisibleEntities;
    const curIdx = focusedEntityId
      ? list.findIndex(x => x.id === focusedEntityId)
      : 0;
    if (curIdx < 0) return;

    const delta = e.key === 'ArrowDown' ? 1 : -1;
    const nextIdx = clamp(curIdx + delta, 0, list.length - 1);
    const nextId = list[nextIdx]?.id;
    if (!nextId) return;

    // Μετακίνηση focus (state + πραγματικό DOM focus αν δώσεις callback)
    setFocusedEntityId(nextId);
    focusEntityDom?.(nextId);

    if (e.shiftKey) {
      // Αν δεν υπάρχει anchor, το ορίζουμε στο "από πού ξεκίνησες"
      if (!anchorRef.current) {
        anchorRef.current = list[curIdx].id;
      }
      const anchorIdx = list.findIndex(x => x.id === anchorRef.current);
      if (anchorIdx < 0) return;

      const start = Math.min(anchorIdx, nextIdx);
      const end = Math.max(anchorIdx, nextIdx);
      const rangeIds = list.slice(start, end + 1).map(x => x.id);
      
      // 🔊 Χρησιμοποιούμε το helper για ενιαία διαχείριση selection + grips + merge
      setSelection(rangeIds, { setSelectedEntitiesForMerge }, { forMerge: true });
      universalSelection.replaceEntitySelection(rangeIds);
    } else {
      // Χωρίς Shift: single select και reset anchor
      anchorRef.current = nextId;
      selectSingle(nextId, { setSelectedEntitiesForMerge });
      universalSelection.replaceEntitySelection(nextId ? [nextId] : []);
    }
  }, [focusedEntityId, universalSelection, setFocusedEntityId, focusEntityDom, setSelectedEntitiesForMerge]);

  // Optionally αν θες reset όταν αφήνεις το Shift/χάνεις focus
  const resetSelectionAnchor = useCallback(() => {
    anchorRef.current = null;
  }, []);

  return { 
    handleEntityKeyDown, 
    resetSelectionAnchor 
  };
}