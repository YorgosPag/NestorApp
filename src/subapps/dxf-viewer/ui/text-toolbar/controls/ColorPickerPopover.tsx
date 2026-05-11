'use client';

/**
 * ADR-344 Phase 5.C + Q13 — Text color picker.
 *
 * Three tabs: True-color (react-colorful HexColorPicker), ACI (256-entry
 * palette grid), ByLayer/ByBlock. Eyedropper button reuses the existing
 * SSoT eyedropper service (`@/subapps/dxf-viewer/ui/color/eyedropper`) so
 * no new screen-capture / OS-API code is introduced here.
 */

import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HexColorPicker } from 'react-colorful';
import { Pipette } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { openEyedropper, hasNativeEyedropper } from '../../color/eyedropper';
import { aciToRgb, dxfColorToHex, hexToAci, rgbToHex } from './aci-palette';
import type { DxfColor, MixedValue } from '../../../text-engine/types';
import { DXF_COLOR_BY_LAYER, DXF_COLOR_BY_BLOCK } from '../../../text-engine/types';

type Tab = 'true' | 'aci' | 'inherited';

interface ColorPickerPopoverProps {
  readonly value: MixedValue<DxfColor>;
  readonly onChange: (color: DxfColor) => void;
  readonly trueColorSupported: boolean;
  readonly disabled?: boolean;
}

export function ColorPickerPopover({
  value,
  onChange,
  trueColorSupported,
  disabled,
}: ColorPickerPopoverProps) {
  const { t } = useTranslation(['textToolbar']);
  const [tab, setTab] = useState<Tab>(trueColorSupported ? 'true' : 'aci');
  const swatch = value === null ? '#cccccc' : dxfColorToHex(value);

  const handleEyedropper = useCallback(async () => {
    try {
      const { sRGBHex } = await openEyedropper();
      if (trueColorSupported) {
        const rgb = parseInt(sRGBHex.slice(1), 16);
        onChange({
          kind: 'TrueColor',
          r: (rgb >> 16) & 0xff,
          g: (rgb >> 8) & 0xff,
          b: rgb & 0xff,
        });
      } else {
        onChange({ kind: 'ACI', index: hexToAci(sRGBHex) });
      }
    } catch {
      // User cancelled — no-op.
    }
  }, [onChange, trueColorSupported]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          aria-label={t('textToolbar:color.label')}
          className="min-h-[44px] sm:min-h-[36px] gap-2"
          data-state={value === null ? 'indeterminate' : 'determinate'}
        >
          <span
            aria-hidden="true"
            className="h-4 w-4 rounded border"
            style={{ backgroundColor: swatch }}
          />
          <span className="text-xs">{value === null ? t('textToolbar:color.mixed') : t('textToolbar:color.label')}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2">
        <nav className="mb-2 flex gap-1" role="tablist" aria-label={t('textToolbar:color.tabsLabel')}>
          {trueColorSupported && (
            <Button
              variant={tab === 'true' ? 'default' : 'ghost'}
              size="sm"
              role="tab"
              aria-selected={tab === 'true'}
              onClick={() => setTab('true')}
            >
              {t('textToolbar:color.tab.true')}
            </Button>
          )}
          <Button
            variant={tab === 'aci' ? 'default' : 'ghost'}
            size="sm"
            role="tab"
            aria-selected={tab === 'aci'}
            onClick={() => setTab('aci')}
          >
            {t('textToolbar:color.tab.aci')}
          </Button>
          <Button
            variant={tab === 'inherited' ? 'default' : 'ghost'}
            size="sm"
            role="tab"
            aria-selected={tab === 'inherited'}
            onClick={() => setTab('inherited')}
          >
            {t('textToolbar:color.tab.inherited')}
          </Button>
          {hasNativeEyedropper() && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleEyedropper}
              aria-label={t('textToolbar:color.eyedropper')}
              className="ml-auto"
            >
              <Pipette className="h-4 w-4" />
            </Button>
          )}
        </nav>

        {tab === 'true' && trueColorSupported && (
          <div role="tabpanel">
            <HexColorPicker
              color={value && value.kind === 'TrueColor' ? rgbToHex(value.r, value.g, value.b) : '#ffffff'}
              onChange={(hex) => {
                const rgb = parseInt(hex.slice(1), 16);
                onChange({
                  kind: 'TrueColor',
                  r: (rgb >> 16) & 0xff,
                  g: (rgb >> 8) & 0xff,
                  b: rgb & 0xff,
                });
              }}
            />
          </div>
        )}

        {tab === 'aci' && (
          <div
            role="tabpanel"
            className="grid grid-cols-16 gap-px max-h-48 overflow-auto"
            aria-label={t('textToolbar:color.aciGridLabel')}
          >
            {Array.from({ length: 255 }, (_, i) => i + 1).map((index) => {
              const rgb = aciToRgb(index);
              if (!rgb) return null;
              const isActive = value !== null && value.kind === 'ACI' && value.index === index;
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => onChange({ kind: 'ACI', index })}
                  aria-label={t('textToolbar:color.aciIndex', { index })}
                  aria-pressed={isActive}
                  className={cn(
                    'h-4 w-4 border',
                    isActive && 'ring-2 ring-primary',
                  )}
                  style={{ backgroundColor: rgbToHex(rgb[0], rgb[1], rgb[2]) }}
                />
              );
            })}
          </div>
        )}

        {tab === 'inherited' && (
          <div role="tabpanel" className="flex flex-col gap-1">
            <Button
              variant={value?.kind === 'ByLayer' ? 'default' : 'outline'}
              onClick={() => onChange(DXF_COLOR_BY_LAYER)}
            >
              {t('textToolbar:color.byLayer')}
            </Button>
            <Button
              variant={value?.kind === 'ByBlock' ? 'default' : 'outline'}
              onClick={() => onChange(DXF_COLOR_BY_BLOCK)}
            >
              {t('textToolbar:color.byBlock')}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
