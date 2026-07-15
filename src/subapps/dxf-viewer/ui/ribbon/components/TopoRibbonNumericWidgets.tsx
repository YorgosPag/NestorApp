'use client';

/**
 * ADR-662 Φάση 1b — Store-backed numeric topo fields for the «Τοπογραφικό» ribbon.
 *
 * Ισοδιάσταση (contour interval), Index (major-every) and κάναβος export step —
 * each a ~6-line {@link RibbonNumericConfig} over the shared
 * {@link RibbonNumericFieldWidget} shell. The config hook subscribes the matching
 * persisted store and owns the display↔canonical unit conversion (interval is
 * stored in mm; ×1000 / ÷1000 lives here, mirroring `TopographyPanel`). ZERO new
 * logic — same getters/setters the left panel already drives (dual access).
 */

import React from 'react';
import {
  RibbonNumericFieldWidget,
  type RibbonNumericConfig,
} from './RibbonNumericFieldWidget';
import {
  getContourConfig,
  setContourIntervalMm,
  setContourMajorEvery,
  subscribeContourConfig,
} from '../../../systems/topography/contour-config-store';
import {
  getGridDisplayOptions,
  setTopoGridExportStepM,
  subscribeTopoGrid,
} from '../../../systems/topography/topo-grid-store';

const CONTOUR_INTERVAL: RibbonNumericConfig = {
  commandId: 'topo.contourInterval.field',
  labelKey: 'ribbon.commands.topo.intervalField.label',
  presets: [0.25, 0.5, 1, 2, 5],
  min: 0.01,
  allowDecimal: true,
  useNumericState: () => {
    const cfg = React.useSyncExternalStore(subscribeContourConfig, getContourConfig, getContourConfig);
    return { value: cfg.intervalMm / 1000, commit: (m) => setContourIntervalMm(m * 1000) };
  },
};

const CONTOUR_INDEX: RibbonNumericConfig = {
  commandId: 'topo.contourIndex.field',
  labelKey: 'ribbon.commands.topo.indexField.label',
  presets: [2, 4, 5, 10],
  min: 1,
  allowDecimal: false,
  useNumericState: () => {
    const cfg = React.useSyncExternalStore(subscribeContourConfig, getContourConfig, getContourConfig);
    return { value: cfg.majorEvery, commit: (n) => setContourMajorEvery(n) };
  },
};

const GRID_STEP: RibbonNumericConfig = {
  commandId: 'topo.gridStep.field',
  labelKey: 'ribbon.commands.topo.gridStepField.label',
  presets: [50, 100, 200],
  min: 1,
  allowDecimal: true,
  useNumericState: () => {
    const opts = React.useSyncExternalStore(subscribeTopoGrid, getGridDisplayOptions, getGridDisplayOptions);
    return { value: opts.exportStepM, commit: (m) => setTopoGridExportStepM(m) };
  },
};

export const ContourIntervalField: React.FC = () => <RibbonNumericFieldWidget config={CONTOUR_INTERVAL} />;
export const ContourIndexField: React.FC = () => <RibbonNumericFieldWidget config={CONTOUR_INDEX} />;
export const GridStepField: React.FC = () => <RibbonNumericFieldWidget config={GRID_STEP} />;
