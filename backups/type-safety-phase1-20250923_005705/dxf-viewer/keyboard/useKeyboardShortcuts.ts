import { useEffect } from 'react';
import type { ToolType } from '../ui/toolbar/types';

interface UseKeyboardShortcutsProps {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  onAction: (action: string) => void;
}

export const useKeyboardShortcuts = ({
  activeTool,
  onToolChange,
  onAction
}: UseKeyboardShortcutsProps) => {
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        handleControlShortcuts(e);
      } else {
        handleNormalShortcuts(e);
      }
    };

    const handleControlShortcuts = (e: KeyboardEvent) => {
      switch (e.key.toLowerCase()) {
        case 'z':
          e.preventDefault();
          if (e.shiftKey) {
            onAction('redo');
          } else {
            onAction('undo');
          }
          break;
        case 'y':
          e.preventDefault();
          onAction('redo');
          break;
        case 'c':
          if (activeTool === 'select') {
            e.preventDefault();
            onAction('copy-selected');
          }
          break;
        case 'a':
          e.preventDefault();
          onAction('select-all');
          break;
        case 'l':
          e.preventDefault();
          onAction('toggle-layers');
          break;
        case 'p':
          e.preventDefault();
          onAction('toggle-properties');
          break;
        case 'e':
          e.preventDefault();
          onAction('export');
          break;
      }
    };

    const handleNormalShortcuts = (e: KeyboardEvent) => {
      switch (e.key.toLowerCase()) {
        case 's':
          e.preventDefault();
          onToolChange('select');
          break;
        case 'p':
          e.preventDefault();
          onToolChange('pan');
          break;
        case 'l':
          e.preventDefault();
          onToolChange('line');
          break;
        case 'r':
          e.preventDefault();
          onToolChange('rectangle');
          break;
        case 'c':
          e.preventDefault();
          onToolChange('circle');
          break;
        case 'm':
          e.preventDefault();
          onToolChange('move');
          break;
        case 'd':
          e.preventDefault();
          onToolChange('measure');
          break;
        case 'w':
          e.preventDefault();
          onToolChange('zoom-window' as ToolType);
          break;
        case 'g':
          e.preventDefault();
          onAction('grid');
          break;
        case 'f':
          e.preventDefault();
          onAction('fit');
          break;
        case '=':
        case '+':
          e.preventDefault();
          onAction('zoom-in-action');
          break;
        case '-':
          e.preventDefault();
          onAction('zoom-out-action');
          break;
        case 'f9':
          e.preventDefault();
          onAction('toggle-snap');
          break;
        case 'delete':
          e.preventDefault();
          onAction('delete-selected');
          break;
        case 'escape':
          e.preventDefault();
          onToolChange('select');
          onAction('clear-selection');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTool, onToolChange, onAction]);
};
