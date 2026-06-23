'use client';

/**
 * ADR-376 Phase C.2 — Ribbon color swatch widgets for opening tag style.
 *
 * Two zero-arg leaf exports (ADR-040 compliant):
 *   - `OpeningTagPillColorWidget`   → mutates `pillBgColor`
 *   - `OpeningTagLeaderColorWidget` → mutates `leaderColor`
 *
 * Uses `ColorDialogTrigger` (EnterpriseColorPicker) — same picker as DXF
 * viewer settings (crosshair, text, grid colors). Hex string in/out.
 * Subscribes to `opening-tag-style-service` for live sync when the dialog
 * changes the same field concurrently.
 */

import React, { useCallback, useEffect, useReducer } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { RibbonColorField } from './RibbonColorField';
import {
  getOpeningTagStyleService,
  type OpeningTagStyle,
} from '../../../bim/services/opening-tag-style-service';
import { markAllCanvasDirty } from '../../../rendering/core/UnifiedFrameScheduler';

// ─── Internal helpers ─────────────────────────────────────────────────────────

type ColorField = 'pillBgColor' | 'leaderColor';

function normaliseHex(raw: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw;
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
  }
  const rgba = raw.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgba) {
    const hex = (n: string) => Number(n).toString(16).padStart(2, '0');
    return `#${hex(rgba[1]!)}${hex(rgba[2]!)}${hex(rgba[3]!)}`;
  }
  return '#ffffff';
}

// ─── Shared parametric widget ─────────────────────────────────────────────────

interface OpeningTagStyleColorWidgetProps {
  readonly field: ColorField;
  readonly labelKey: string;
}

function OpeningTagStyleColorWidget({ field, labelKey }: OpeningTagStyleColorWidgetProps) {
  const { t } = useTranslation('dxf-viewer-shell');
  const [, forceRender] = useReducer((n: number) => n + 1, 0);

  useEffect(() => getOpeningTagStyleService().subscribe(forceRender), []);

  const style = getOpeningTagStyleService().getCurrentStyle();
  const hex = normaliseHex(style[field]);

  const handleChange = useCallback(
    (color: string) => {
      const patch: Partial<OpeningTagStyle> = field === 'pillBgColor'
        ? { pillBgColor: color }
        : { leaderColor: color };
      getOpeningTagStyleService().mutateStyle(patch);
      markAllCanvasDirty();
    },
    [field],
  );

  return <RibbonColorField label={t(labelKey)} value={hex} onChange={handleChange} />;
}

// ─── Zero-arg leaf exports (ADR-040: no props = no orchestrator dependency) ───

export function OpeningTagPillColorWidget() {
  return (
    <OpeningTagStyleColorWidget
      field="pillBgColor"
      labelKey="ribbon.commands.openingEditor.tagStyle.ribbon.bgColorLabel"
    />
  );
}

export function OpeningTagLeaderColorWidget() {
  return (
    <OpeningTagStyleColorWidget
      field="leaderColor"
      labelKey="ribbon.commands.openingEditor.tagStyle.ribbon.leaderColorLabel"
    />
  );
}
