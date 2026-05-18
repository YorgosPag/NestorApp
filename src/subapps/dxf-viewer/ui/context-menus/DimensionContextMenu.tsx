'use client';

/**
 * ADR-362 Phase M1 — Dimension entity right-click context menu.
 *
 * AutoCAD-style contextual menu shown when the user right-clicks a selected
 * DimensionEntity (or a multi-selection containing dimensions). Follows the
 * imperative handle pattern used by all other DXF Viewer context menus
 * (ADR-040 micro-leaf compliant — no store subscriptions, no re-renders on
 * parent hover/move).
 *
 * 9 action groups:
 *   1. Precision submenu (0 → 0.0000, per-entity dimdec override)
 *   2. Flip Arrows (inside/outside)
 *   3. Reset Text Position (clear DIMTMOVE override)
 *   4. Text Override... (open inline editor)
 *   5. Apply Style submenu (list available DIMSTYLEs)
 *   6. Reassociate (DIMREASSOCIATE — re-link orphaned def points)
 *   7. Explode to Lines (irreversible — prompts confirmation via window.confirm)
 *   ─── separator ───
 *   8. Standard edit: Cut / Copy / Paste / Delete
 *   ─── separator ───
 *   9. Properties... (focus contextual ribbon tab "Διάσταση")
 *
 * @see docs/centralized-systems/reference/adrs/ADR-362-enterprise-dimension-system.md §D14
 */

import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import styles from '../components/DrawingContextMenu.module.css';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Imperative handle — parent calls open(x, y) to show the menu. */
export interface DimensionContextMenuHandle {
  open(x: number, y: number): void;
  close(): void;
}

export interface DimStyleOption {
  readonly id: string;
  readonly name: string;
}

export type DimPrecision = 0 | 1 | 2 | 3 | 4;

export interface DimensionContextMenuProps {
  /** Number of currently selected dimension entities. */
  selectedCount: number;
  /** Available DIMSTYLE options for the Apply Style submenu. */
  availableStyles: ReadonlyArray<DimStyleOption>;
  onPrecision: (decimals: DimPrecision) => void;
  onFlipArrows: () => void;
  onResetText: () => void;
  onTextOverride: () => void;
  onApplyStyle: (styleId: string) => void;
  onReassociate: () => void;
  onExplode: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onProperties: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

const DimensionContextMenuInner = forwardRef<
  DimensionContextMenuHandle,
  DimensionContextMenuProps
>(function DimensionContextMenu(props, ref) {
  const {
    selectedCount,
    availableStyles,
    onPrecision,
    onFlipArrows,
    onResetText,
    onTextOverride,
    onApplyStyle,
    onReassociate,
    onExplode,
    onCut,
    onCopy,
    onPaste,
    onDelete,
    onProperties,
  } = props;

  const { t } = useTranslation('dxf-viewer-shell');
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  useImperativeHandle(ref, () => ({
    open(x: number, y: number) {
      if (triggerRef.current) {
        triggerRef.current.style.left = `${x}px`;
        triggerRef.current.style.top = `${y}px`;
      }
      setIsOpen(true);
    },
    close() {
      setIsOpen(false);
    },
  }), []);

  const close = useCallback(() => setIsOpen(false), []);

  const handlePrecision = useCallback((dec: DimPrecision) => {
    onPrecision(dec);
    close();
  }, [onPrecision, close]);

  const handleFlipArrows = useCallback(() => { onFlipArrows(); close(); }, [onFlipArrows, close]);
  const handleResetText = useCallback(() => { onResetText(); close(); }, [onResetText, close]);
  const handleTextOverride = useCallback(() => { onTextOverride(); close(); }, [onTextOverride, close]);

  const handleApplyStyle = useCallback((styleId: string) => {
    onApplyStyle(styleId);
    close();
  }, [onApplyStyle, close]);

  const handleReassociate = useCallback(() => { onReassociate(); close(); }, [onReassociate, close]);

  const handleExplode = useCallback(() => {
    if (!window.confirm(t('ribbon.commands.dimContextMenu.explodeWarning'))) return;
    onExplode();
    close();
  }, [onExplode, close, t]);

  const handleCut = useCallback(() => { onCut(); close(); }, [onCut, close]);
  const handleCopy = useCallback(() => { onCopy(); close(); }, [onCopy, close]);
  const handlePaste = useCallback(() => { onPaste(); close(); }, [onPaste, close]);
  const handleDelete = useCallback(() => { onDelete(); close(); }, [onDelete, close]);
  const handleProperties = useCallback(() => { onProperties(); close(); }, [onProperties, close]);

  const precisionLabels: Record<DimPrecision, string> = {
    0: t('ribbon.commands.dimContextMenu.precision0'),
    1: t('ribbon.commands.dimContextMenu.precision1'),
    2: t('ribbon.commands.dimContextMenu.precision2'),
    3: t('ribbon.commands.dimContextMenu.precision3'),
    4: t('ribbon.commands.dimContextMenu.precision4'),
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <span ref={triggerRef} className={styles.hiddenTrigger} aria-hidden="true" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className={styles.menuContent}
        side="bottom"
        align="start"
        sideOffset={0}
        avoidCollisions={false}
      >
        {/* ── Precision submenu ───────────────────────────────────────────── */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className={styles.menuItem}>
            <span className={styles.menuItemLabel}>
              {t('ribbon.commands.dimContextMenu.precision')}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {([0, 1, 2, 3, 4] as DimPrecision[]).map((dec) => (
              <DropdownMenuItem
                key={dec}
                className={styles.menuItem}
                onClick={() => handlePrecision(dec)}
              >
                <span className={styles.menuItemLabel}>{precisionLabels[dec]}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* ── Flip Arrows ─────────────────────────────────────────────────── */}
        <DropdownMenuItem className={styles.menuItem} onClick={handleFlipArrows}>
          <span className={styles.menuItemLabel}>
            {t('ribbon.commands.dimContextMenu.flipArrows')}
          </span>
        </DropdownMenuItem>

        {/* ── Reset Text ──────────────────────────────────────────────────── */}
        <DropdownMenuItem className={styles.menuItem} onClick={handleResetText}>
          <span className={styles.menuItemLabel}>
            {t('ribbon.commands.dimContextMenu.resetText')}
          </span>
        </DropdownMenuItem>

        {/* ── Text Override ───────────────────────────────────────────────── */}
        <DropdownMenuItem className={styles.menuItem} onClick={handleTextOverride}>
          <span className={styles.menuItemLabel}>
            {t('ribbon.commands.dimContextMenu.textOverride')}
          </span>
        </DropdownMenuItem>

        {/* ── Apply Style submenu ─────────────────────────────────────────── */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger
            className={cn(styles.menuItem, availableStyles.length === 0 && styles.menuItemDisabled)}
            disabled={availableStyles.length === 0}
          >
            <span className={styles.menuItemLabel}>
              {t('ribbon.commands.dimContextMenu.applyStyle')}
            </span>
          </DropdownMenuSubTrigger>
          {availableStyles.length > 0 && (
            <DropdownMenuSubContent>
              {availableStyles.map((s) => (
                <DropdownMenuItem
                  key={s.id}
                  className={styles.menuItem}
                  onClick={() => handleApplyStyle(s.id)}
                >
                  <span className={styles.menuItemLabel}>{s.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          )}
        </DropdownMenuSub>

        <DropdownMenuSeparator className={styles.menuSeparator} />

        {/* ── Reassociate ─────────────────────────────────────────────────── */}
        <DropdownMenuItem className={styles.menuItem} onClick={handleReassociate}>
          <span className={styles.menuItemLabel}>
            {t('ribbon.commands.dimContextMenu.reassociate')}
          </span>
        </DropdownMenuItem>

        {/* ── Explode ─────────────────────────────────────────────────────── */}
        <DropdownMenuItem className={styles.menuItem} onClick={handleExplode}>
          <span className={styles.menuItemLabel}>
            {t('ribbon.commands.dimContextMenu.explode')}
          </span>
        </DropdownMenuItem>

        <DropdownMenuSeparator className={styles.menuSeparator} />

        {/* ── Standard edit ───────────────────────────────────────────────── */}
        <DropdownMenuItem className={styles.menuItem} onClick={handleCut}>
          <span className={styles.menuItemLabel}>
            {t('ribbon.commands.dimContextMenu.cut')}
          </span>
          <span className={styles.menuItemShortcut}>Ctrl+X</span>
        </DropdownMenuItem>

        <DropdownMenuItem className={styles.menuItem} onClick={handleCopy}>
          <span className={styles.menuItemLabel}>
            {t('ribbon.commands.dimContextMenu.copy')}
          </span>
          <span className={styles.menuItemShortcut}>Ctrl+C</span>
        </DropdownMenuItem>

        <DropdownMenuItem className={styles.menuItem} onClick={handlePaste}>
          <span className={styles.menuItemLabel}>
            {t('ribbon.commands.dimContextMenu.paste')}
          </span>
          <span className={styles.menuItemShortcut}>Ctrl+V</span>
        </DropdownMenuItem>

        <DropdownMenuItem className={styles.menuItem} onClick={handleDelete}>
          <span className={styles.menuItemLabel}>
            {t('ribbon.commands.dimContextMenu.delete')} ({selectedCount})
          </span>
          <span className={styles.menuItemShortcut}>Del</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator className={styles.menuSeparator} />

        {/* ── Properties ──────────────────────────────────────────────────── */}
        <DropdownMenuItem className={styles.menuItem} onClick={handleProperties}>
          <span className={styles.menuItemLabel}>
            {t('ribbon.commands.dimContextMenu.properties')}
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

export { DimensionContextMenuInner as DimensionContextMenu };
