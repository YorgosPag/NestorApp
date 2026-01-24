/**
 * useProSnapShortcuts Hook
 * Handles F-key shortcuts for snap system toggles
 *
 * ⌨️ ENTERPRISE: Now uses centralized keyboard-shortcuts.ts (Single Source of Truth)
 * @version 2.0.0 - Centralized shortcuts migration
 *
 * Industry Reference:
 * - AutoCAD: F7=Grid, F8=Ortho, F9=Snap, F10=Polar, F11=Object Snap
 */

import { useEffect } from 'react';
import { ExtendedSnapType } from '../snapping/extended-types';
import { useSnapContext } from '../snapping/context/SnapContext';
// ⌨️ ENTERPRISE: Centralized keyboard shortcuts - Single source of truth
import { matchesShortcut } from '../config/keyboard-shortcuts';

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
      // ✅ GUARD: Skip if typing in input fields
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
        return;
      }

      // ⌨️ ENTERPRISE: Using centralized matchesShortcut()

      // Tab - Cycle snap modes
      if (matchesShortcut(e, 'cycleSnap')) {
        e.preventDefault();
        onCycleSnap?.();
        return;
      }

      // F9 - Toggle Grid snap (AutoCAD standard)
      if (matchesShortcut(e, 'gridSnap')) {
        e.preventDefault();
        const gridEnabled = snapContext.enabledModes.has(ExtendedSnapType.GRID);
        snapContext.toggleMode(ExtendedSnapType.GRID, !gridEnabled);
        return;
      }

      // F10 - Toggle Polar/Ortho mode (AutoCAD standard)
      if (matchesShortcut(e, 'polarTracking')) {
        e.preventDefault();
        const orthoEnabled = snapContext.enabledModes.has(ExtendedSnapType.ORTHO);
        snapContext.toggleMode(ExtendedSnapType.ORTHO, !orthoEnabled);
        return;
      }

      // F11 - Toggle Object Snap (OSNAP in AutoCAD)
      if (matchesShortcut(e, 'objectSnap')) {
        e.preventDefault();
        const autoEnabled = snapContext.enabledModes.has(ExtendedSnapType.AUTO);
        snapContext.toggleMode(ExtendedSnapType.AUTO, !autoEnabled);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggleSnap, onCycleSnap, snapEnabled, snapContext]);
}
