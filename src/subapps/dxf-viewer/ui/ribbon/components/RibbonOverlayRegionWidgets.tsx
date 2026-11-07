'use client';

/**
 * ADR-933 — Widgets της contextual καρτέλας «Περιοχή» (εντολή σχεδίασης περιοχής κάτοψης).
 *
 *   • «Είδος»   — ξαναχρησιμοποιεί το `KindSelector` (Revit Type Selector για Room/Area).
 *   • «Μέθοδος» — μέθοδος γεωμετρίας (ArchiCAD Zone «Geometry Method»), πάνω στο κοινό
 *                 `RibbonGlyphModeGroup` (ίδια σήμανση με τη Draw gallery του τοίχου).
 *
 * Και τα δύο διαβάζουν/γράφουν το ΕΝΑ SSoT `overlayDrawSettingsStore`· ο καμβάς το διαβάζει
 * τη στιγμή του κλικ/αποθήκευσης (`get()`), όχι μέσω props — καμία νέα συνδρομή στον
 * orchestrator (ADR-040).
 */

import React, { useCallback, useMemo } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { KindSelector } from '../../toolbar/overlay-section/KindSelector';
import {
  OVERLAY_DRAW_METHODS,
  overlayDrawSettingsStore,
  useOverlayDrawSettings,
  type OverlayDrawMethod,
} from '../../../stores/overlay-draw-settings-store';
import type { OverlayKind } from '../../../overlays/types';
import { RibbonGlyphModeGroup, RIBBON_GLYPH_PROPS } from './RibbonGlyphModeGroup';

/** Στατικά κλειδιά i18n ανά μέθοδο (ορατά στις πύλες i18n — όχι δυναμικά template strings). */
const METHOD_KEYS: Readonly<Record<OverlayDrawMethod, { readonly label: string; readonly tooltip: string }>> = {
  polygon: {
    label: 'ribbon.commands.overlayRegion.method.polygon.label',
    tooltip: 'ribbon.commands.overlayRegion.method.polygon.tooltip',
  },
  rectangle: {
    label: 'ribbon.commands.overlayRegion.method.rectangle.label',
    tooltip: 'ribbon.commands.overlayRegion.method.rectangle.tooltip',
  },
};

export function RibbonOverlayKindWidget(): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-shell');
  const { kind } = useOverlayDrawSettings();
  const onKindChange = useCallback((next: OverlayKind) => overlayDrawSettingsStore.update({ kind: next }), []);
  return (
    <KindSelector
      currentKind={kind}
      onKindChange={onKindChange}
      groupLabel={t('ribbon.commands.overlayRegion.kind.section')}
    />
  );
}

/** Ανά-μέθοδο glyph (αναγνωρίσιμο εικονίδιο Draw gallery). */
function MethodGlyph({ method }: { readonly method: OverlayDrawMethod }): React.JSX.Element {
  return (
    <svg {...RIBBON_GLYPH_PROPS} aria-hidden="true">
      {method === 'polygon' && <path d="M10 3 L17 8 L14.5 16.5 L5.5 16.5 L3 8 Z" />}
      {method === 'rectangle' && (
        <>
          <rect x="3.5" y="5" width="13" height="10" />
          <circle cx="3.5" cy="15" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="16.5" cy="5" r="1.3" fill="currentColor" stroke="none" />
        </>
      )}
    </svg>
  );
}

export function RibbonOverlayMethodWidget(): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-shell');
  const { method } = useOverlayDrawSettings();

  const modes = useMemo(
    () => OVERLAY_DRAW_METHODS.map((id) => ({
      id,
      ariaLabel: `${t(METHOD_KEYS[id].label)} — ${t(METHOD_KEYS[id].tooltip)}`,
    })),
    [t],
  );
  const onPick = useCallback(
    (mode: { readonly id: OverlayDrawMethod }) => overlayDrawSettingsStore.update({ method: mode.id }),
    [],
  );

  return (
    <RibbonGlyphModeGroup
      label={t('ribbon.commands.overlayRegion.method.section')}
      modes={modes}
      activeId={method}
      onPick={onPick}
      renderGlyph={(mode) => <MethodGlyph method={mode.id} />}
    />
  );
}
