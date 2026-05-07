/**
 * Keyboard shortcuts hook for CRM Calendar.
 * T=today, M=month, W=week, D=day, A=agenda, left/right=navigate, N=new event
 */

'use client';

import { useEffect, useCallback } from 'react';

interface UseCalendarKeyboardShortcutsOptions {
  onMonth: () => void;
  onWeek: () => void;
  onDay: () => void;
  onAgenda: () => void;
  onToday: () => void;
  onBack: () => void;
  onNext: () => void;
  onNewEvent: () => void;
}

export function useCalendarKeyboardShortcuts({
  onMonth,
  onWeek,
  onDay,
  onAgenda,
  onToday,
  onBack,
  onNext,
  onNewEvent,
}: UseCalendarKeyboardShortcutsOptions): void {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.key.toLowerCase()) {
        case 't':
          e.preventDefault();
          onToday();
          break;
        case 'm':
          e.preventDefault();
          onMonth();
          break;
        case 'w':
          e.preventDefault();
          onWeek();
          break;
        case 'd':
          e.preventDefault();
          onDay();
          break;
        case 'a':
          e.preventDefault();
          onAgenda();
          break;
        case 'n':
          e.preventDefault();
          onNewEvent();
          break;
        case 'arrowleft':
          e.preventDefault();
          onBack();
          break;
        case 'arrowright':
          e.preventDefault();
          onNext();
          break;
      }
    },
    [onMonth, onWeek, onDay, onAgenda, onToday, onBack, onNext, onNewEvent]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
