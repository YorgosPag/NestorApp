'use client';

/**
 * ADR-453 — Print dialog · paper size + orientation controls.
 *
 * @module subapps/dxf-viewer/ui/components/print/PrintPaperControls
 */

import * as React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PaperOrientation, PaperSize } from '../../../print/config/paper-types';
import { PAPER_SIZE_ORDER } from '../../../print/config/paper-constants';
import { PrintRadioGroup } from './PrintRadioGroup';

interface PrintPaperControlsProps {
  size: PaperSize;
  onSizeChange: (s: PaperSize) => void;
  orientation: PaperOrientation;
  onOrientationChange: (o: PaperOrientation) => void;
}

export function PrintPaperControls({
  size,
  onSizeChange,
  orientation,
  onOrientationChange,
}: PrintPaperControlsProps): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-shell');

  return (
    <section className="space-y-3">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          {t('print.paperSize.label')}
        </label>
        <Select value={size} onValueChange={(v) => onSizeChange(v as PaperSize)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAPER_SIZE_ORDER.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <PrintRadioGroup<PaperOrientation>
        legend={t('print.orientation.label')}
        name="dxf-print-orientation"
        value={orientation}
        onChange={onOrientationChange}
        options={[
          { value: 'portrait', label: t('print.orientation.portrait') },
          { value: 'landscape', label: t('print.orientation.landscape') },
        ]}
      />
    </section>
  );
}
