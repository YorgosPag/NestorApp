'use client';

/**
 * ADR-375 Phase C.1+C.2 — Pen Table Panel.
 *
 * Ribbon widget for editing the 16×6 pen table (pen index × print scale).
 * Phase C.2: preset tabs (Design / Construction / Presentation / Custom) above
 * the grid. Selecting a preset replaces the full table in one click.
 *
 * Each cell shows an ISO mm value; clicking opens an inline select with all
 * 24 ISO catalog values. Modified cells are highlighted amber.
 * "Reset all" reverts to Construction (ISO defaults).
 */

import React, { useCallback, useState } from 'react';
import { ChevronDown, RotateCcw } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
import { useBimPenTableStore } from '../../../state/bim-pen-table-store';
import { isOverridden } from '../../../config/bim-pen-table-types';
import { SCALE_COLUMNS, PEN_COUNT, type PenIndex } from '../../../config/bim-pen-table';
import { PEN_SET_NAMES, type PenSetName } from '../../../config/bim-pen-sets';
import type { ConcreteLineweightMm } from '../../../config/lineweight-iso-catalog';
import { BimLineweightSelect } from '../components/BimStyleSelects';

const PEN_INDICES = Array.from({ length: PEN_COUNT }, (_, i) => (i + 1) as PenIndex);

export const PenTablePanel: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const colors = useSemanticColors();
  const [open, setOpen] = useState(false);

  const effectivePenTable = useBimPenTableStore((s) => s.effectivePenTable);
  const overrides = useBimPenTableStore((s) => s.overrides);
  const activePresetName = useBimPenTableStore((s) => s.activePresetName);
  const setCell = useBimPenTableStore((s) => s.setCell);
  const resetCell = useBimPenTableStore((s) => s.resetCell);
  const resetAll = useBimPenTableStore((s) => s.resetAll);
  const applyPreset = useBimPenTableStore((s) => s.applyPreset);

  const handleChange = useCallback(
    (penIdx: PenIndex, colIdx: number, mm: number) => {
      if (!isNaN(mm)) setCell(penIdx, colIdx, mm);
    },
    [setCell],
  );

  const handleReset = useCallback(() => {
    resetAll();
    setOpen(false);
  }, [resetAll]);

  const overrideCount = overrides
    ? Object.values(overrides).reduce(
        (sum, row) => sum + Object.keys(row ?? {}).length,
        0,
      )
    : 0;

  return (
    <span className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label">
        {t('ribbon.commands.penTable.label')}
      </span>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            aria-label={t('ribbon.commands.penTable.openAriaLabel')}
            className={`flex items-center gap-1 ${PANEL_LAYOUT.SPACING.COMPACT} ${colors.bg.backgroundSecondary} ${colors.text.secondary} ${PANEL_LAYOUT.TYPOGRAPHY.XS} rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} ${PANEL_LAYOUT.TRANSITION.COLORS} select-none`}
          >
            <span>16×6</span>
            {overrideCount > 0 && (
              <span className={`${colors.text.warningLight} font-bold`}>{overrideCount}</span>
            )}
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="p-2" style={{ minWidth: '480px' }}>

          {/* Pen Set preset tabs */}
          <nav
            aria-label={t('ribbon.commands.penTable.penSets.tabsAriaLabel')}
            className="flex gap-1 mb-2"
          >
            {PEN_SET_NAMES.map((name) => {
              const isActive = activePresetName === name;
              return (
                <button
                  key={name}
                  onClick={() => applyPreset(name)}
                  className={`flex-1 ${PANEL_LAYOUT.SPACING.COMPACT} ${PANEL_LAYOUT.TYPOGRAPHY.XS} rounded ${PANEL_LAYOUT.TRANSITION.COLORS} ${
                    isActive
                      ? `${colors.bg.backgroundSecondary} ${colors.text.primary} ring-1 ring-inset ${colors.ring.primary}`
                      : `${colors.text.muted} ${HOVER_BACKGROUND_EFFECTS.MUTED}`
                  }`}
                  aria-pressed={isActive}
                >
                  {t(`ribbon.commands.penTable.penSets.${name}` as `ribbon.commands.penTable.penSets.${PenSetName}`)}
                </button>
              );
            })}
            <button
              disabled
              aria-pressed={activePresetName === 'custom'}
              className={`flex-1 ${PANEL_LAYOUT.SPACING.COMPACT} ${PANEL_LAYOUT.TYPOGRAPHY.XS} rounded ${PANEL_LAYOUT.TRANSITION.COLORS} ${
                activePresetName === 'custom'
                  ? `${colors.bg.backgroundSecondary} ${colors.text.warningLight} ring-1 ring-inset ${colors.ring.warning}`
                  : `${colors.text.muted} opacity-50`
              }`}
            >
              {t('ribbon.commands.penTable.penSets.custom')}
            </button>
          </nav>

          {/* Header row */}
          <div
            className="grid gap-x-1 gap-y-0.5 items-center mb-1"
            style={{ gridTemplateColumns: '2rem repeat(6, 1fr)' }}
          >
            <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} font-medium text-center`}>
              #
            </span>
            {SCALE_COLUMNS.map((col) => (
              <span
                key={col}
                className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} font-medium text-center`}
              >
                {col}
              </span>
            ))}
          </div>

          {/* Data rows */}
          {PEN_INDICES.map((penIdx) => (
            <div
              key={penIdx}
              className="grid gap-x-1 gap-y-0.5 items-center"
              style={{ gridTemplateColumns: '2rem repeat(6, 1fr)' }}
            >
              <span
                className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} font-mono text-center`}
              >
                {penIdx}
              </span>
              {SCALE_COLUMNS.map((_, colIdx) => {
                const val = effectivePenTable[penIdx - 1][colIdx] as ConcreteLineweightMm;
                const modified = isOverridden(overrides ?? null, penIdx, colIdx);
                return (
                  <BimLineweightSelect
                    key={colIdx}
                    value={val}
                    onChange={(mm) => handleChange(penIdx, colIdx, mm)}
                    modified={modified}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (modified) resetCell(penIdx, colIdx);
                    }}
                    aria-label={t('ribbon.commands.penTable.cellAriaLabel', {
                      pen: penIdx,
                      scale: SCALE_COLUMNS[colIdx],
                    })}
                  />
                );
              })}
            </div>
          ))}

          <DropdownMenuSeparator className="my-2" />

          <div className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} mb-1.5`}>
            {t('ribbon.commands.penTable.rightClickHint')}
          </div>

          <button
            onClick={handleReset}
            disabled={overrideCount === 0 && activePresetName === 'construction'}
            aria-label={t('ribbon.commands.penTable.resetAriaLabel')}
            className={`flex items-center gap-1.5 w-full ${PANEL_LAYOUT.SPACING.COMPACT} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.secondary} rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} ${PANEL_LAYOUT.TRANSITION.COLORS} disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <RotateCcw className="w-3 h-3" />
            {t('ribbon.commands.penTable.reset')}
            {overrideCount > 0 && (
              <span className={`ml-auto ${colors.text.warningLight}`}>({overrideCount})</span>
            )}
          </button>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
};
