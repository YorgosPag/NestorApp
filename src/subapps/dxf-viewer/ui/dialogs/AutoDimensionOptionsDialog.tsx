'use client';

/**
 * ADR-563 — «Αυτόματη Διαστασιολόγηση» options dialog (ArchiCAD-style).
 *
 * Self-subscribing (zero props) — mirror του `ColumnBatchFillConfirmDialog`.
 * Κρατά τοπικά τα editable options (seeded από το store κάθε φορά που ανοίγει)
 * και επιστρέφει την επιλογή του χρήστη μέσω `resolveAutoDimensionDialog`.
 *
 * @see ../../systems/dimensions/auto/auto-dimension-dialog-store.ts
 */

import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useEscapeHandler } from '../../systems/escape-bus/useEscapeHandler';
import { ESC_PRIORITY } from '../../systems/escape-bus/escape-priority';
import {
  subscribeAutoDimensionDialog,
  getAutoDimensionDialogState,
  resolveAutoDimensionDialog,
} from '../../systems/dimensions/auto/auto-dimension-dialog-store';
import {
  AUTO_DIMENSION_DEFAULTS,
  type AutoDimensionOptions,
  type AutoDimReferenceBasis,
  type AutoDimSide,
  type AutoDimTier,
} from '../../systems/dimensions/auto/auto-dimension-types';

const BASIS_ITEMS: readonly { value: AutoDimReferenceBasis; labelKey: string }[] = [
  { value: 'smart', labelKey: 'autoDimension.dialog.basisSmart' },
  { value: 'faces', labelKey: 'autoDimension.dialog.basisFaces' },
  { value: 'axes', labelKey: 'autoDimension.dialog.basisAxes' },
];

export const AutoDimensionOptionsDialog: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const state = useSyncExternalStore(
    subscribeAutoDimensionDialog,
    getAutoDimensionDialogState,
    getAutoDimensionDialogState,
  );
  const [options, setOptions] = useState<AutoDimensionOptions>(AUTO_DIMENSION_DEFAULTS);

  // Reseed the editable options each time the dialog opens.
  useEffect(() => {
    if (state.open) setOptions(state.initialOptions);
  }, [state]);

  useEscapeHandler({
    id: 'auto-dimension-options',
    priority: ESC_PRIORITY.MODAL_DIALOG,
    canHandle: () => state.open,
    handle: () => {
      resolveAutoDimensionDialog({ kind: 'cancel' });
      return true;
    },
  });

  if (!state.open || typeof document === 'undefined') return null;

  const setTier = (key: AutoDimTier, value: boolean): void =>
    setOptions((o) => ({ ...o, tiers: { ...o.tiers, [key]: value } }));
  const setSide = (key: AutoDimSide, value: boolean): void =>
    setOptions((o) => ({ ...o, sides: { ...o.sides, [key]: value } }));
  const setDistance = (raw: string): void => {
    const n = Number.parseInt(raw, 10);
    setOptions((o) => ({ ...o, distanceBetweenLines: Number.isFinite(n) && n >= 0 ? n : o.distanceBetweenLines }));
  };

  const submit = (e: React.FormEvent): void => {
    e.preventDefault();
    resolveAutoDimensionDialog({ kind: 'run', options });
  };

  return createPortal(
    <div className="dxf-modal-overlay" role="dialog" aria-modal="true">
      <div className="dxf-modal-card">
        <h2 className="dxf-modal-title">{t('autoDimension.dialog.title')}</h2>
        <form className="dxf-modal-body" onSubmit={submit}>
          <fieldset>
            <legend>{t('autoDimension.dialog.tiersLegend')}</legend>
            <label>
              <input type="checkbox" checked={options.tiers.detail} onChange={(e) => setTier('detail', e.target.checked)} />
              {t('autoDimension.dialog.tierDetail')}
            </label>
            <label>
              <input type="checkbox" checked={options.tiers.axes} onChange={(e) => setTier('axes', e.target.checked)} />
              {t('autoDimension.dialog.tierAxes')}
            </label>
            <label>
              <input type="checkbox" checked={options.tiers.overall} onChange={(e) => setTier('overall', e.target.checked)} />
              {t('autoDimension.dialog.tierOverall')}
            </label>
          </fieldset>

          <fieldset>
            <legend>{t('autoDimension.dialog.sidesLegend')}</legend>
            <label>
              <input type="checkbox" checked={options.sides.south} onChange={(e) => setSide('south', e.target.checked)} />
              {t('autoDimension.dialog.sideSouth')}
            </label>
            <label>
              <input type="checkbox" checked={options.sides.north} onChange={(e) => setSide('north', e.target.checked)} />
              {t('autoDimension.dialog.sideNorth')}
            </label>
            <label>
              <input type="checkbox" checked={options.sides.west} onChange={(e) => setSide('west', e.target.checked)} />
              {t('autoDimension.dialog.sideWest')}
            </label>
            <label>
              <input type="checkbox" checked={options.sides.east} onChange={(e) => setSide('east', e.target.checked)} />
              {t('autoDimension.dialog.sideEast')}
            </label>
          </fieldset>

          <fieldset>
            <legend>{t('autoDimension.dialog.basisLegend')}</legend>
            {BASIS_ITEMS.map((item) => (
              <label key={item.value}>
                <input
                  type="radio"
                  name="auto-dim-basis"
                  checked={options.referenceBasis === item.value}
                  onChange={() => setOptions((o) => ({ ...o, referenceBasis: item.value }))}
                />
                {t(item.labelKey)}
              </label>
            ))}
          </fieldset>

          <label>
            <input
              type="checkbox"
              checked={options.includeOpenings}
              onChange={(e) => setOptions((o) => ({ ...o, includeOpenings: e.target.checked }))}
            />
            {t('autoDimension.dialog.includeOpenings')}
          </label>

          <label>
            {t('autoDimension.dialog.distance')}
            <input
              type="number"
              min={0}
              step={50}
              value={options.distanceBetweenLines}
              onChange={(e) => setDistance(e.target.value)}
            />
          </label>

          <div className="dxf-modal-actions">
            <button type="submit" autoFocus className="dxf-modal-button dxf-modal-button-primary">
              {t('autoDimension.dialog.apply')}
            </button>
            <button
              type="button"
              className="dxf-modal-button"
              onClick={() => resolveAutoDimensionDialog({ kind: 'cancel' })}
            >
              {t('autoDimension.dialog.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
};
