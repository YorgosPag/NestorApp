'use client';

/**
 * ADR-435 Slice 1b — ClashReportPanel: the Navisworks "Clash Detective" results
 * card. A DRAGGABLE floating panel (centralized `FloatingPanel` SSoT, the same one
 * the overlay toolbar uses) that appears while a clash report is under review and
 * lists every clash. Draggable so it never permanently covers the 3D toggle / ViewCube
 * (both top-right); its default position is already clear of that corner.
 *
 * Subscribes ONLY to the low-frequency {@link useClashReport} store (ADR-040-safe —
 * it changes on Detect / Clear, never per frame). Each row is clickable → "zoom to
 * clash": in 3D it frames the camera via the clash-focus bus; in 2D it reuses the
 * existing `canvas-fit-to-view-selected` EventBus SSoT (same path as the Z key), so
 * no zoom logic is duplicated. Severity colours come from the shared SSoT palette.
 *
 * @see ../../../components/ui/floating/FloatingPanel.tsx (centralized draggable panel)
 * @see ../../systems/coordination/clash-report-store.ts
 * @see ../../systems/coordination/clash-focus-bus.ts
 * @see ../../systems/coordination/clash-severity-color.ts
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { ShieldAlert } from 'lucide-react';
import { FloatingPanel } from '@/components/ui/floating';
import { useClashReport, clashReportStore } from '../../systems/coordination/clash-report-store';
import { CLASH_SEVERITY_COLOR } from '../../systems/coordination/clash-severity-color';
import { requestClashFocus } from '../../systems/coordination/clash-focus-bus';
import type { Clash, ClashSeverity } from '../../systems/coordination/clash-types';
import { useViewMode3DStore, selectIs3D } from '../../bim-3d/stores/ViewMode3DStore';
import { sceneUnitsToMeters, type SceneUnits } from '../../utils/scene-units';
import { EventBus } from '../../systems/events';

/** Half-size (METRES) of the box fitted around a clash in the 2D view — converted to
 *  canvas units per scene at click time, so it is scale-correct for mm OR metre units
 *  (a fixed canvas-unit pad zooms a metre-unit drawing out to nothing). Matches the 3D
 *  focus extent (`CLASH_FOCUS_HALF_EXTENT_M`). */
const CLASH_2D_FOCUS_PAD_M = 0.6;
const SEVERITY_ORDER: readonly ClashSeverity[] = ['high', 'medium', 'low'];
/** Panel size — width drives the bounds clamp; height is the max for the scroll list. */
const CLASH_PANEL_DIMENSIONS = { width: 288, height: 420 };

/** Default spot: right edge but BELOW the 3D toggle / ViewCube (top-right). Draggable after. */
function getClashPanelPosition(): { x: number; y: number } {
  const margin = 16;
  return { x: window.innerWidth - CLASH_PANEL_DIMENSIONS.width - margin, y: 140 };
}

export function ClashReportPanel(): React.ReactElement | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const review = useClashReport();
  if (review === null) return null;

  const { clashes, scannedEntities, testedPairs } = review.report;
  const counts = countBySeverity(clashes);

  return (
    <FloatingPanel
      defaultPosition={{ x: 1100, y: 140 }}
      dimensions={CLASH_PANEL_DIMENSIONS}
      onClose={() => clashReportStore.reset()}
      draggableOptions={{ getClientPosition: getClashPanelPosition }}
      className="z-[9999] w-72"
      data-testid="clash-report-panel"
    >
      <FloatingPanel.Header showClose icon={<ShieldAlert className="text-[hsl(var(--text-destructive))]" />}>
        <h3 className="m-0 flex flex-1 items-center gap-1.5 text-sm font-semibold text-foreground">
          {t('clashReport.title')}
          <span className="rounded bg-accent px-1.5 py-0.5 font-mono text-[11px]">{clashes.length}</span>
        </h3>
      </FloatingPanel.Header>

      <FloatingPanel.Content className="flex max-h-[55vh] flex-col">
        {clashes.length === 0 ? (
          <p className="text-xs italic text-muted-foreground">{t('clashReport.none')}</p>
        ) : (
          <>
            <section className="flex flex-wrap gap-1.5">
              {SEVERITY_ORDER.filter((s) => counts[s] > 0).map((s) => (
                <SeverityChip key={s} severity={s} label={`${counts[s]} ${t(`clashReport.severity.${s}`)}`} />
              ))}
            </section>
            <ul className="-mx-1 min-h-0 flex-1 divide-y divide-white/5 overflow-y-auto">
              {clashes.map((clash, i) => (
                // `clash.id` can repeat when the same entity pair clashes more than once
                // (e.g. a segment vs several fittings of the same run) — suffix the index.
                <ClashRow key={`${clash.id}__${i}`} clash={clash} sceneUnits={review.sceneUnits} t={t} />
              ))}
            </ul>
          </>
        )}
        <footer className="mt-1 border-t border-white/10 pt-1.5 text-[11px] text-muted-foreground">
          {t('clashReport.stats', { scanned: scannedEntities, tested: testedPairs })}
        </footer>
      </FloatingPanel.Content>
    </FloatingPanel>
  );
}

// ── Row ──────────────────────────────────────────────────────────────────────

interface ClashRowProps {
  readonly clash: Clash;
  readonly sceneUnits: SceneUnits;
  readonly t: TFunction;
}

function ClashRow({ clash, sceneUnits, t }: ClashRowProps): React.ReactElement {
  const mm = Math.round(Math.abs(clash.separationMm));
  const sepKey = clash.type === 'hard' ? 'clashReport.separationHard' : 'clashReport.separationClearance';
  return (
    <li>
      <button
        onClick={() => focusClash(clash, sceneUnits)}
        aria-label={t('clashReport.focusHint')}
        className="flex w-full items-start gap-2 px-2 py-1.5 text-left transition-colors hover:bg-accent/60"
      >
        <SeverityDot severity={clash.severity} className="mt-1" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs text-foreground">
            {t(`clashReport.kind.${clash.aKind}`)} ↔ {t(`clashReport.kind.${clash.bKind}`)}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="rounded bg-accent px-1 py-px">{t(`clashReport.type.${clash.type}`)}</span>
            <span className="font-mono">{t(sepKey, { mm })}</span>
          </span>
        </span>
      </button>
    </li>
  );
}

// ── Focus dispatch (3D bus ⟷ 2D EventBus SSoT) ─────────────────────────────────

function focusClash(clash: Clash, sceneUnits: SceneUnits): void {
  if (selectIs3D(useViewMode3DStore.getState())) {
    requestClashFocus(clash.point);
    return;
  }
  // 2D: reuse the canonical fit-to-bounds path (clash point metres → canvas units).
  const toCanvas = 1 / sceneUnitsToMeters(sceneUnits);
  const cx = clash.point.x * toCanvas;
  const cy = clash.point.y * toCanvas;
  const pad = CLASH_2D_FOCUS_PAD_M * toCanvas; // metres → canvas units (scale-correct)
  EventBus.emit('canvas-fit-to-view-selected', {
    bounds: { min: { x: cx - pad, y: cy - pad }, max: { x: cx + pad, y: cy + pad } },
  });
}

// ── Severity visuals (read the SSoT palette — dynamic colour ⇒ inline style only) ──

function SeverityDot({ severity, className = '' }: { readonly severity: ClashSeverity; readonly className?: string }): React.ReactElement {
  return (
    <span
      className={`h-2 w-2 shrink-0 rounded-full ${className}`}
      style={{ backgroundColor: CLASH_SEVERITY_COLOR[severity] }}
      aria-hidden="true"
    />
  );
}

function SeverityChip({ severity, label }: { readonly severity: ClashSeverity; readonly label: string }): React.ReactElement {
  return (
    <span className="flex items-center gap-1 rounded bg-accent/60 px-1.5 py-0.5 text-[11px] text-foreground">
      <SeverityDot severity={severity} />
      {label}
    </span>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function countBySeverity(clashes: readonly Clash[]): Record<ClashSeverity, number> {
  const counts: Record<ClashSeverity, number> = { high: 0, medium: 0, low: 0 };
  for (const c of clashes) counts[c.severity] += 1;
  return counts;
}

export default ClashReportPanel;
