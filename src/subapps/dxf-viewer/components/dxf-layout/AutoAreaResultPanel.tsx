'use client';

/**
 * AutoAreaResultPanel — floating card for auto area measurement results.
 * Subscribes to AutoAreaResultStore (zero props, zero canvas interference).
 * ADR-040 compliant: updates only on click (not high-frequency).
 */

import React, { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { X, ScanLine } from 'lucide-react';
import {
  getAutoAreaState,
  subscribeAutoAreaState,
  clearAutoAreaState,
} from '../../systems/auto-area/AutoAreaResultStore';

// ============================================================================
// HELPERS
// ============================================================================

function formatArea(area: number): string {
  if (area >= 10_000) return `${(area / 10_000).toFixed(4)} ha (${area.toFixed(1)} m²)`;
  return `${area.toFixed(2)} m²`;
}

function formatPerimeter(p: number): string {
  if (p >= 1000) return `${(p / 1000).toFixed(3)} km`;
  return `${p.toFixed(2)} m`;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function AutoAreaResultPanel(): React.ReactElement | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const state = useSyncExternalStore(subscribeAutoAreaState, getAutoAreaState, getAutoAreaState);

  if (state === null) return null;

  // Clamp panel within viewport — only dynamic values use inline style
  const left = Math.min(state.screenX + 16, window.innerWidth - 280);
  const top = Math.max(8, Math.min(state.screenY - 8, window.innerHeight - 200));

  return (
    <aside
      style={{ left, top } as React.CSSProperties}
      className="fixed z-[9999] w-64 rounded-lg border border-white/20 bg-gray-900/95 shadow-xl backdrop-blur-sm pointer-events-auto"
      role="status"
      aria-live="polite"
    >
      {/* Header */}
      <header className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
          <ScanLine size={13} />
          {t('autoArea.title')}
        </span>
        <button
          onClick={clearAutoAreaState}
          aria-label={t('autoArea.dismiss')}
          className="p-0.5 rounded text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X size={13} />
        </button>
      </header>

      {/* Body */}
      <section className="px-3 py-2">
        {!state.found ? (
          <p className="text-xs text-gray-400 italic">{t('autoArea.noPolygon')}</p>
        ) : (
          <dl className="space-y-1">
            <Row label={t('autoArea.area')} value={formatArea(state.netArea)} highlight />
            {state.holesCount > 0 && (
              <>
                <Row label={t('autoArea.grossArea')} value={formatArea(state.area)} muted />
                <Row
                  label="−"
                  value={t('autoArea.deductions', { count: state.holesCount, area: formatArea(state.holesArea) })}
                  muted
                />
              </>
            )}
            <Row label={t('autoArea.perimeter')} value={formatPerimeter(state.perimeter)} />
            {state.layerName && (
              <Row label={t('autoArea.layer')} value={state.layerName} />
            )}
            <Row
              label="—"
              value={state.source === 'dxf-polyline' ? t('autoArea.sourceDxf') : t('autoArea.sourceOverlay')}
              muted
            />
          </dl>
        )}
      </section>
    </aside>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

interface RowProps {
  label: string;
  value: string;
  highlight?: boolean;
  muted?: boolean;
}

function Row({ label, value, highlight, muted }: RowProps): React.ReactElement {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-xs text-gray-400 shrink-0">{label}</dt>
      <dd className={`text-xs font-mono truncate ${highlight ? 'text-emerald-300 font-semibold' : muted ? 'text-gray-500' : 'text-white'}`}>
        {value}
      </dd>
    </div>
  );
}

export default AutoAreaResultPanel;
