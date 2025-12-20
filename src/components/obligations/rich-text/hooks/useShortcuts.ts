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
    // Enterprise Standard: Ctrl+B/I/U με preventDefault() - όπως Google Docs, Office 365
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          console.log('Ctrl+B detected in useShortcuts'); // DEBUG
          e.preventDefault();
          e.stopPropagation();
          actions.onBold();
          break;
        case 'i':
          console.log('Ctrl+I detected in useShortcuts'); // DEBUG
          e.preventDefault();
          e.stopPropagation();
          actions.onItalic();
          break;
        case 'u':
          console.log('Ctrl+U detected in useShortcuts'); // DEBUG
          e.preventDefault();
          e.stopPropagation();
          actions.onUnderline();
          break;
        case 'z':
          e.preventDefault();
          e.stopPropagation();
          e.shiftKey ? actions.onRedo() : actions.onUndo();
          break;
        case 'y':
          e.preventDefault();
          e.stopPropagation();
          actions.onRedo();
          break;
      }
    }
  }, [actions]);

  return handleKeyDown;
}
