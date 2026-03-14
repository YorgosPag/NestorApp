/**
 * Keyboard shortcuts hook for CRM Calendar.
 * T=today, M=month, W=week, D=day, A=agenda, left/right=navigate, N=new event
 */

'use client';

import { useEffect, useCallback } from 'react';
import { Views, type View } from 'react-big-calendar';

interface UseCalendarKeyboardShortcutsOptions {
  onViewChange: (view: View) => void;
  onNavigateToday: () => void;
  onNavigateBack: () => void;
  onNavigateNext: () => void;
  onNewEvent: () => void;
}

export function useCalendarKeyboardShortcuts({
  onViewChange,
  onNavigateToday,
  onNavigateBack,
  onNavigateNext,
  onNewEvent,
}: UseCalendarKeyboardShortcutsOptions): void {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Skip when focus is in an input, textarea, or contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Skip when modifier keys are held (allow browser shortcuts)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.key.toLowerCase()) {
        case 't':
          e.preventDefault();
          onNavigateToday();
          break;
        case 'm':
          e.preventDefault();
          onViewChange(Views.MONTH);
          break;
        case 'w':
          e.preventDefault();
          onViewChange(Views.WEEK);
          break;
        case 'd':
          e.preventDefault();
          onViewChange(Views.DAY);
          break;
        case 'a':
          e.preventDefault();
          onViewChange(Views.AGENDA);
          break;
        case 'n':
          e.preventDefault();
          onNewEvent();
          break;
        case 'arrowleft':
          e.preventDefault();
          onNavigateBack();
          break;
        case 'arrowright':
          e.preventDefault();
          onNavigateNext();
          break;
      }
    },
    [onViewChange, onNavigateToday, onNavigateBack, onNavigateNext, onNewEvent]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
