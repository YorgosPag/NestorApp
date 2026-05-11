'use client';

/**
 * ADR-345 §7 — DXF status bar (bottom).
 * Phase 1: visual scaffold with local toggles for Grid/Snap/Ortho/Polar.
 * Coords/Scale/Layer show placeholders. Real wiring in Fasi 5-6.
 */

import React, { useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface ToggleItemProps {
  label: string;
  on: boolean;
  onClick: () => void;
}

const ToggleItem: React.FC<ToggleItemProps> = ({ label, on, onClick }) => (
  <button
    type="button"
    className="dxf-status-bar-item"
    data-on={on}
    aria-pressed={on}
    onClick={onClick}
  >
    {label}
  </button>
);

interface StaticItemProps {
  children: React.ReactNode;
  ariaLabel: string;
}

const StaticItem: React.FC<StaticItemProps> = ({ children, ariaLabel }) => (
  <span className="dxf-status-bar-item" data-static aria-label={ariaLabel}>
    {children}
  </span>
);

export const DxfStatusBar: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const [grid, setGrid] = useState(false);
  const [snap, setSnap] = useState(false);
  const [ortho, setOrtho] = useState(false);
  const [polar, setPolar] = useState(true);

  const coords = t('ribbon.statusBar.coordinates', { x: '0.00', y: '0.00' });
  const scale = `${t('ribbon.statusBar.scale')}: ${t('ribbon.statusBar.defaultScale')}`;
  const layer = `${t('ribbon.statusBar.layer')}: ${t('ribbon.statusBar.defaultLayer')}`;

  return (
    <footer className="dxf-status-bar" role="status" aria-live="off">
      <StaticItem ariaLabel={coords}>{coords}</StaticItem>
      <span className="dxf-status-bar-separator" />
      <ToggleItem
        label={t('ribbon.statusBar.grid')}
        on={grid}
        onClick={() => setGrid((v) => !v)}
      />
      <ToggleItem
        label={t('ribbon.statusBar.snap')}
        on={snap}
        onClick={() => setSnap((v) => !v)}
      />
      <ToggleItem
        label={t('ribbon.statusBar.ortho')}
        on={ortho}
        onClick={() => setOrtho((v) => !v)}
      />
      <ToggleItem
        label={t('ribbon.statusBar.polar')}
        on={polar}
        onClick={() => setPolar((v) => !v)}
      />
      <span className="dxf-status-bar-separator" />
      <StaticItem ariaLabel={scale}>{scale}</StaticItem>
      <StaticItem ariaLabel={layer}>{layer}</StaticItem>
    </footer>
  );
};

export default DxfStatusBar;
