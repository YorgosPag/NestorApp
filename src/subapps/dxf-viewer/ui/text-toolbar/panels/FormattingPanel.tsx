'use client';

/**
 * ADR-344 Phase 5.D — Formatting panel.
 *
 * Font family + size + color + width factor + oblique + tracking.
 * Reads/writes via `useTextToolbarStore`. Layer + scale handled by their
 * own controls in the toolbar root.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  useTextToolbarStore,
  type TextToolbarValues,
} from '../../../state/text-toolbar';
import {
  FontFamilyCombobox,
  SizeInput,
  ColorPickerPopover,
} from '../controls';
import { DxfDocumentVersion, versionSupportsTrueColor } from '../../../text-engine/types';

interface FormattingPanelProps {
  readonly availableFonts: readonly string[];
  readonly documentVersion: DxfDocumentVersion;
  readonly onRequestFontUpload: () => void;
  readonly canUploadFont: boolean;
  readonly disabled?: boolean;
}

export function FormattingPanel({
  availableFonts,
  documentVersion,
  onRequestFontUpload,
  canUploadFont,
  disabled,
}: FormattingPanelProps) {
  const { t } = useTranslation(['textToolbar']);
  void t;
  const fontFamily = useTextToolbarStore((s) => s.fontFamily);
  const fontHeight = useTextToolbarStore((s) => s.fontHeight);
  const color = useTextToolbarStore((s) => s.color);
  const widthFactor = useTextToolbarStore((s) => s.widthFactor);
  const obliqueAngle = useTextToolbarStore((s) => s.obliqueAngle);
  const tracking = useTextToolbarStore((s) => s.tracking);
  const setValue = useTextToolbarStore((s) => s.setValue);

  const set = <K extends keyof TextToolbarValues>(key: K) => (next: TextToolbarValues[K]) => {
    setValue(key, next);
  };

  const trueColor = versionSupportsTrueColor(documentVersion);

  return (
    <section className="flex flex-wrap items-center gap-2">
      <FontFamilyCombobox
        value={fontFamily}
        availableFonts={availableFonts}
        onChange={set('fontFamily')}
        onRequestUpload={onRequestFontUpload}
        canUpload={canUploadFont}
        disabled={disabled}
      />
      <SizeInput
        value={fontHeight}
        onChange={set('fontHeight')}
        min={0.01}
        max={10000}
        step={0.1}
        unitLabelKey="textToolbar:font.heightLabel"
        disabled={disabled}
      />
      <ColorPickerPopover
        value={color}
        onChange={set('color')}
        trueColorSupported={trueColor}
        disabled={disabled}
      />
      <SizeInput
        value={widthFactor}
        onChange={set('widthFactor')}
        min={0.1}
        max={10}
        step={0.05}
        unitLabelKey="textToolbar:font.widthFactorLabel"
        disabled={disabled}
      />
      <SizeInput
        value={obliqueAngle}
        onChange={set('obliqueAngle')}
        min={-85}
        max={85}
        step={1}
        unitLabelKey="textToolbar:font.obliqueLabel"
        disabled={disabled}
      />
      <SizeInput
        value={tracking}
        onChange={set('tracking')}
        min={0.1}
        max={5}
        step={0.05}
        unitLabelKey="textToolbar:font.trackingLabel"
        disabled={disabled}
      />
    </section>
  );
}
