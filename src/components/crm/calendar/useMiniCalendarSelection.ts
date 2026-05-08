'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { isSameDay, eachDayOfInterval, min, max } from 'date-fns';

export interface MiniCalendarSelectionReturn {
  selectedDays: Date[];
  setSelectedDays: React.Dispatch<React.SetStateAction<Date[]>>;
  handleDayMouseDown: (day: Date, e: React.MouseEvent) => void;
  handleDayMouseEnter: (day: Date) => void;
}

export function useMiniCalendarSelection(initialDate?: Date): MiniCalendarSelectionReturn {
  const [selectedDays, setSelectedDays] = useState<Date[]>(() => [initialDate ?? new Date()]);
  const dragAnchorRef = useRef<Date | null>(null);
  const isDraggingRef = useRef(false);

  const handleDayMouseDown = useCallback((day: Date, e: React.MouseEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      setSelectedDays(prev => {
        const exists = prev.some(d => isSameDay(d, day));
        if (exists) {
          const next = prev.filter(d => !isSameDay(d, day));
          return next.length > 0 ? next : [day];
        }
        return [...prev, day];
      });
      return;
    }
    isDraggingRef.current = true;
    dragAnchorRef.current = day;
    setSelectedDays([day]);
  }, []);

  const handleDayMouseEnter = useCallback((day: Date) => {
    if (!isDraggingRef.current || !dragAnchorRef.current) return;
    const start = min([dragAnchorRef.current, day]);
    const end = max([dragAnchorRef.current, day]);
    setSelectedDays(eachDayOfInterval({ start, end }));
  }, []);

  useEffect(() => {
    const stopDrag = () => { isDraggingRef.current = false; };
    document.addEventListener('mouseup', stopDrag);
    return () => document.removeEventListener('mouseup', stopDrag);
  }, []);

  return { selectedDays, setSelectedDays, handleDayMouseDown, handleDayMouseEnter };
}
