
import { useEffect } from 'react';
import { ExtendedSnapType } from '../snapping/extended-types';
import { useSnapContext } from '../snapping/context/SnapContext';

interface ProSnapShortcutsProps {
  onToggleSnap?: (enabled: boolean) => void;
  onCycleSnap?: () => void;
  snapEnabled?: boolean;
}

export function useProSnapShortcuts({
  onToggleSnap,
  onCycleSnap,
  snapEnabled = false
}: ProSnapShortcutsProps = {}) {
  const snapContext = useSnapContext();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore αν γράφουμε σε input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
        return;
      }

      switch (e.key) {
        case 'Tab':
          e.preventDefault();
          onCycleSnap?.();

          break;

        case 'F9':
          e.preventDefault();
          // Toggle Grid snap specifically
          const gridEnabled = snapContext.enabledModes.has(ExtendedSnapType.GRID);
          snapContext.toggleMode(ExtendedSnapType.GRID, !gridEnabled);

          break;

        case 'F10':
          e.preventDefault();
          // Toggle Ortho mode
          const orthoEnabled = snapContext.enabledModes.has(ExtendedSnapType.ORTHO);
          snapContext.toggleMode(ExtendedSnapType.ORTHO, !orthoEnabled);

          break;

        case 'F11':
          e.preventDefault();
          // Toggle Auto mode
          const autoEnabled = snapContext.enabledModes.has(ExtendedSnapType.AUTO);
          snapContext.toggleMode(ExtendedSnapType.AUTO, !autoEnabled);

          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggleSnap, onCycleSnap, snapEnabled, snapContext]);
}
