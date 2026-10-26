'use client';
/**
 * ADR-920 Β4.8 Β3.5 — one committed breakline in the «Ασυνέχειες επιφάνειας» list (Civil 3D Prospector › Breaklines,
 * plus what Prospector does not say): legend swatch · #n (the QA number) · z-source IN WORDS · length · Z range ·
 * vertices · link health (source line deleted ⇒ the surface still uses its LAST shape — said, not hidden) · how many
 * conflicts it is part of · Zoom To (the main button) · Remove (one undoable command).
 *
 * The row IS the `<li>` (semantic list, no wrapper soup). i18n via `t()` (N.11) · CSS module (N.3) · Radix tooltips
 * (CHECK 3.23: never a native `title=`).
 */

import * as React from 'react';
import { Trash2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/i18n';
import type { BreaklineInventoryRow } from '../../../systems/topography/topo-breakline-inventory';
import { mmToMetreString } from '../../../systems/topography/qa/topo-qa-format';
import { TopoBreaklinePatternSwatch } from './TopoBreaklinePatternSwatch';
import styles from './TopographyPanel.module.css';

interface Props {
  readonly row: BreaklineInventoryRow;
  readonly focused: boolean;
  readonly onFocus: (row: BreaklineInventoryRow) => void;
  readonly onRemove: (row: BreaklineInventoryRow) => void;
}

const NS = 'topography.breaklines';

function useRowText(row: BreaklineInventoryRow): { readonly name: string; readonly meta: string } {
  const { t } = useTranslation('dxf-viewer-panels');
  const z = row.zRangeMm;
  const zText = z === null
    ? t(`${NS}.zNone`)
    : t(`${NS}.zRange`, { min: mmToMetreString(z.min), max: mmToMetreString(z.max) });
  return {
    name: t(`${NS}.name`, { label: row.label, closed: row.closed ? 'yes' : 'no' }),
    meta: t(`${NS}.meta`, {
      source: t(`${NS}.source.${row.source}`),
      length: mmToMetreString(row.lengthMm, 1),
      z: zText,
      vertices: row.vertexCount,
    }),
  };
}

export function TopoBreaklineRow({ row, focused, onFocus, onRemove }: Props): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-panels');
  const { name, meta } = useRowText(row);
  const missing = row.link === 'missing';

  return (
    <li
      className={`${styles.bkItem} ${missing ? styles.bkItemMissing : ''} ${focused ? styles.bkItemFocused : ''}`}
      aria-current={focused ? 'true' : undefined}
    >
      <button
        type="button"
        className={styles.bkFocus}
        onClick={() => onFocus(row)}
        aria-label={t(`${NS}.focusHint`, { name })}
      >
        <TopoBreaklinePatternSwatch source={row.breakline.elevationSource} />
        <span className={styles.bkText}>
          <span className={styles.bkName}>{name}</span>
          <span className={styles.bkMeta}>{meta}</span>
          {missing && <span className={styles.bkWarn}>{t(`${NS}.linkMissing`)}</span>}
          {row.conflictCount > 0 && (
            <span className={styles.bkConflict}>{t(`${NS}.conflictCount`, { count: row.conflictCount })}</span>
          )}
        </span>
      </button>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={styles.bkRemove}
            onClick={() => onRemove(row)}
            aria-label={t(`${NS}.remove`, { name })}
          >
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">{t(`${NS}.removeHint`)}</TooltipContent>
      </Tooltip>
    </li>
  );
}
