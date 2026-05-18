'use client';

/**
 * XLineToolContextMenu — right-click context menu for the XLine drawing tool.
 *
 * Mount when activeTool === 'xline' AND DrawingStateMachine in
 * [TOOL_READY, COLLECTING_POINTS].
 *
 * Items: 6 modes (Through/Horizontal/Vertical/Angle…/Bisect/Offset…)
 *        + separator + Cancel current + Finish chain.
 * Hotkeys shown right of each item (BricsCAD pattern).
 *
 * Imperative handle: parent calls open(x, y) on right-click.
 * Pattern: DrawingContextMenu (ADR-047). ADR-359 Phase 2.
 */

import React, {
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
  forwardRef,
  useSyncExternalStore,
} from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import styles from '../../components/DrawingContextMenu.module.css';
import {
  getXLineModeState,
  setMode,
  subscribe,
  type XLineMode,
} from '../../../systems/tools/xline-mode-store';
import type { ToolType } from '../../toolbar/types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface XLineToolContextMenuHandle {
  open: (x: number, y: number) => void;
  close: () => void;
}

interface XLineToolContextMenuProps {
  activeTool: ToolType;
  /** Cancel the currently-drawing xline entity */
  onCancelCurrent: () => void;
  /** Finish the active chain (ADR-357 §5.4) */
  onFinishChain: () => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

type ModeItem = {
  mode: XLineMode;
  shortcut: string;
  hasParams: boolean;
};

const MODE_ITEMS: ReadonlyArray<ModeItem> = [
  { mode: 'through',    shortcut: 'T', hasParams: false },
  { mode: 'horizontal', shortcut: 'H', hasParams: false },
  { mode: 'vertical',   shortcut: 'V', hasParams: false },
  { mode: 'angle',      shortcut: 'A', hasParams: true  },
  { mode: 'bisect',     shortcut: 'B', hasParams: true  },
  { mode: 'offset',     shortcut: 'O', hasParams: true  },
];

// ─── Component ───────────────────────────────────────────────────────────────

const XLineToolContextMenuInner = forwardRef<XLineToolContextMenuHandle, XLineToolContextMenuProps>(
  ({ activeTool, onCancelCurrent, onFinishChain }, ref) => {
    const { t } = useTranslation(['dxf-viewer']);
    const triggerRef = useRef<HTMLSpanElement>(null);
    const [isOpen, setIsOpen] = useState(false);
    const modeState = useSyncExternalStore(subscribe, getXLineModeState, getXLineModeState);

    useImperativeHandle(ref, () => ({
      open: (x: number, y: number) => {
        if (triggerRef.current) {
          triggerRef.current.style.left = `${x}px`;
          triggerRef.current.style.top = `${y}px`;
        }
        setIsOpen(true);
      },
      close: () => setIsOpen(false),
    }), []);

    const handleOpenChange = useCallback((open: boolean) => {
      setIsOpen(open);
    }, []);

    const handleModeSelect = useCallback((mode: XLineMode) => {
      setMode(mode);
      setIsOpen(false);
    }, []);

    const handleCancelCurrent = useCallback(() => {
      onCancelCurrent();
      setIsOpen(false);
    }, [onCancelCurrent]);

    const handleFinishChain = useCallback(() => {
      onFinishChain();
      setIsOpen(false);
    }, [onFinishChain]);

    if (activeTool !== 'xline') return null;

    return (
      <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
        <DropdownMenuTrigger asChild>
          <span
            ref={triggerRef}
            className={styles.hiddenTrigger}
            aria-hidden="true"
          />
        </DropdownMenuTrigger>

        <DropdownMenuContent
          className={styles.menuContent}
          side="bottom"
          align="start"
          sideOffset={0}
          avoidCollisions={false}
        >
          {MODE_ITEMS.map(({ mode, shortcut, hasParams }) => {
            const label = t(`tools.xline.modes.${mode}`);
            const isActive = modeState.mode === mode;
            return (
              <DropdownMenuItem
                key={mode}
                className={styles.menuItem}
                onClick={() => handleModeSelect(mode)}
              >
                <span className={cn(styles.menuItemIcon, 'flex items-center justify-center')}>
                  {isActive && <Check size={14} />}
                </span>
                <span className={styles.menuItemLabel}>
                  {label}
                  {hasParams && <span style={{ opacity: 0.5 }}>…</span>}
                </span>
                <span className={styles.menuItemShortcut}>{shortcut}</span>
              </DropdownMenuItem>
            );
          })}

          <DropdownMenuSeparator className={styles.menuSeparator} />

          <DropdownMenuItem
            className={styles.menuItem}
            onClick={handleCancelCurrent}
          >
            <span className={styles.menuItemIcon} />
            <span className={styles.menuItemLabel}>{t('tools.xline.contextMenu.cancelCurrent')}</span>
            <span className={styles.menuItemShortcut}>Esc</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            className={styles.menuItem}
            onClick={handleFinishChain}
          >
            <span className={styles.menuItemIcon} />
            <span className={styles.menuItemLabel}>{t('tools.xline.contextMenu.finishChain')}</span>
            <span className={styles.menuItemShortcut}>Enter</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  },
);

XLineToolContextMenuInner.displayName = 'XLineToolContextMenu';

export default XLineToolContextMenuInner;
export { XLineToolContextMenuInner as XLineToolContextMenu };
export type { XLineToolContextMenuProps };
