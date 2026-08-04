'use client';

/**
 * ADR-739 §39 — **το μενού του κουμπιού «Πίνακας»** (μοτίβο Word).
 *
 * Αντικαθιστά τη μέχρι τώρα συμπεριφορά «κλικ = οπλίζει αμέσως το εργαλείο με 3×3/40mm»: ο
 * χρήστης δηλώνει **πρώτα** μέγεθος και **μετά** κλικάρει στον καμβά για θέση.
 *
 * ## Τι ζωντάνεψε
 * Ο `state/table-options-store.ts` υπήρχε από τη Φ.Δ βήμα 1 με setters που καθαρίζουν, και ο
 * builder διάβαζε ήδη το ζωντανό στιγμιότυπο — αλλά **κανένα UI δεν έγραφε ποτέ σε αυτόν**.
 * Το σχόλιό του υποσχόταν «contextual καρτέλα της ribbon» που δεν γράφτηκε ποτέ. **Αυτό** το
 * widget είναι ο γραφέας που έλειπε· δεν προστέθηκε υποδομή.
 *
 * ## Γιατί `type: 'widget'` και όχι `'dropdown'`
 * Το `RibbonSplitButton`/`RibbonSplitDropdown` είναι το SSoT για ribbon dropdowns, αλλά
 * αποδίδει `<menu role="menu">` με `role="menuitem"` παιδιά: ένα `role="grid"` και ένα
 * αριθμητικό πεδίο μέσα του θα ήταν παραβίαση WAI-ARIA (και θα άλλαζε το keyboard-yield
 * προφίλ). Το `widgetId → component` μητρώο είναι **ήδη** ο μηχανισμός για custom περιεχόμενο.
 *
 * Το αντίτιμο: το widget factory δεν παίρνει props, οπότε ο trigger ζωγραφίζεται εδώ — με τις
 * **υπάρχουσες** κλάσεις. Δεν προστίθεται `onClick` prop στο `RibbonLargeButton`, γιατί είναι
 * `React.memo` πάνω σε **σταθερό** `command` (ADR-547 Stage 4) και ένα μη-σταθερό prop θα
 * ακύρωνε το bail-out σε **όλα** τα large buttons.
 *
 * @module subapps/dxf-viewer/ui/ribbon/components/table/RibbonTableMenuWidget
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §39
 */

import React, { useCallback, useId, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTableOptionsStore } from '../../../../state/table-options-store';
import { ESC_PRIORITY } from '../../../../systems/escape-bus/escape-priority';
import { useEscapeHandler } from '../../../../systems/escape-bus/useEscapeHandler';
import { useRibbonDispatch } from '../../context/RibbonCommandContext';
import { TABLE_MENU_COMMAND } from '../../data/table-menu-command';
import { RibbonButtonIcon } from '../buttons/RibbonButtonIcon';
import { Tooltip, TooltipContent, TooltipTrigger } from '../RibbonTooltip';
import { TableInsertDialog } from './TableInsertDialog';
import { TableSizeGrid } from './TableSizeGrid';
import { useTableSizeCommit } from './use-table-size-commit';
import {
  TABLE_SIZE_GRID_COLUMNS,
  TABLE_SIZE_GRID_ROWS,
  type TableMenuSize,
  toMenuSize,
} from './table-size-menu-model';

const GRID_DIMS = { columns: TABLE_SIZE_GRID_COLUMNS, rows: TABLE_SIZE_GRID_ROWS };

const RibbonTableMenuWidgetInner: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const { activeTool, getCommandRecommendation } = useRibbonDispatch();
  const commit = useTableSizeCommit();
  const captionId = useId();

  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [preview, setPreview] = useState<TableMenuSize | null>(null);

  // Χαμηλής συχνότητας κατάσταση (αλλάζει μόνο με ρητή επιλογή) — ασφαλής συνδρομή.
  const columnCount = useTableOptionsStore((s) => s.columnCount);
  const dataRowCount = useTableOptionsStore((s) => s.dataRowCount);
  const columnWidthMm = useTableOptionsStore((s) => s.columnWidthMm);
  const current = toMenuSize(columnCount, dataRowCount);
  const shown = preview ?? current;

  // ΧΩΡΙΣ `allowWhenEditable`: όταν η εστίαση είναι στο πεδίο mm, ο bus παρακάμπτει αυτόν τον
  // handler και το Escape ακυρώνει πρώτα το draft του πεδίου — μετά κλείνει το μενού.
  useEscapeHandler(
    open
      ? {
          id: 'ribbon/table-size-menu',
          priority: ESC_PRIORITY.POPOVER_DROPDOWN,
          canHandle: () => true,
          handle: () => {
            setOpen(false);
            return true;
          },
        }
      : null,
  );

  const handleCommit = useCallback(
    (size: TableMenuSize) => {
      commit(size);
      setPreview(null);
      setOpen(false);
    },
    [commit],
  );

  const handleDialogConfirm = useCallback(
    (size: TableMenuSize, widthMm: number) => {
      commit(size, widthMm);
      setOpen(false);
    },
    [commit],
  );

  const isActive = activeTool === TABLE_MENU_COMMAND.commandKey;
  const recommended = getCommandRecommendation(TABLE_MENU_COMMAND.commandKey);

  return (
    <span className="dxf-ribbon-widget-table-menu">
      <Popover open={open} onOpenChange={setOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={
                  recommended
                    ? 'dxf-ribbon-btn dxf-ribbon-btn-large'
                    : 'dxf-ribbon-btn dxf-ribbon-btn-large opacity-40'
                }
                data-command-id={TABLE_MENU_COMMAND.id}
                data-active={isActive ? 'true' : undefined}
                data-storey-recommended={recommended ? undefined : 'false'}
                aria-haspopup="dialog"
                aria-expanded={open}
              >
                <span className="dxf-ribbon-btn-icon-wrap">
                  <RibbonButtonIcon icon={TABLE_MENU_COMMAND.icon} size="large" />
                </span>
                <span className="dxf-ribbon-btn-label">
                  {t(TABLE_MENU_COMMAND.labelKey)}
                  <span aria-hidden="true"> ▾</span>
                </span>
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>{t(TABLE_MENU_COMMAND.tooltipKey ?? TABLE_MENU_COMMAND.labelKey)}</TooltipContent>
        </Tooltip>

        <PopoverContent align="start" className="dxf-ribbon-table-menu-body">
          <p id={captionId} className="dxf-ribbon-table-menu-caption" aria-live="polite">
            {t('ribbon.commands.tableMenu.caption', {
              columns: shown.columnCount,
              rows: shown.totalRowCount,
            })}
          </p>

          <TableSizeGrid
            dims={GRID_DIMS}
            current={current}
            onPreview={setPreview}
            onCommit={handleCommit}
            captionId={captionId}
          />

          <p className="dxf-ribbon-table-menu-field">
            <label htmlFor="dxf-ribbon-table-column-width">
              {t('ribbon.commands.tableMenu.columnWidth')}
            </label>
            <input
              id="dxf-ribbon-table-column-width"
              type="number"
              inputMode="decimal"
              value={columnWidthMm}
              onChange={(e) =>
                useTableOptionsStore.getState().setColumnWidthMm(Number.parseFloat(e.target.value))
              }
              aria-label={t('ribbon.commands.tableMenu.columnWidth')}
            />
          </p>

          <footer className="dxf-ribbon-table-menu-footer">
            <button
              type="button"
              className="dxf-ribbon-table-menu-action"
              onClick={() => {
                setOpen(false);
                setDialogOpen(true);
              }}
            >
              <RibbonButtonIcon icon={TABLE_MENU_COMMAND.icon} size="small" />
              {t('ribbon.commands.tableMenu.insertDialog')}
            </button>
          </footer>
        </PopoverContent>
      </Popover>

      <TableInsertDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialSize={current}
        initialColumnWidthMm={columnWidthMm}
        onConfirm={handleDialogConfirm}
      />
    </span>
  );
};

export const RibbonTableMenuWidget = React.memo(RibbonTableMenuWidgetInner);
