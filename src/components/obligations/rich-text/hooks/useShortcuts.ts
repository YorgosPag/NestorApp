"use client";

import { useCallback } from 'react';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useShortcuts');

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
          logger.info('Ctrl+B detected'); // DEBUG
          e.preventDefault();
          e.stopPropagation();
          actions.onBold();
          break;
        case 'i':
          logger.info('Ctrl+I detected'); // DEBUG
          e.preventDefault();
          e.stopPropagation();
          actions.onItalic();
          break;
        case 'u':
          logger.info('Ctrl+U detected'); // DEBUG
          e.preventDefault();
          e.stopPropagation();
          actions.onUnderline();
          break;
        case 'z':
          e.preventDefault();
          e.stopPropagation();
          if (e.shiftKey) {
            actions.onRedo();
          } else {
            actions.onUndo();
          }
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
