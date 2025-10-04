"use client";

import { useCallback } from 'react';

interface ShortcutActions {
  onBold: () => void;
  onItalic: () => void;
  onUnderline: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

export function useShortcuts(actions: ShortcutActions) {
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          actions.onBold();
          break;
        case 'i':
          e.preventDefault();
          actions.onItalic();
          break;
        case 'u':
          e.preventDefault();
          actions.onUnderline();
          break;
        case 'z':
          e.preventDefault();
          e.shiftKey ? actions.onRedo() : actions.onUndo();
          break;
        case 'y':
          e.preventDefault();
          actions.onRedo();
          break;
      }
    }
  }, [actions]);

  return handleKeyDown;
}
