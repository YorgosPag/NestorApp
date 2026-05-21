'use client';

/**
 * Section3DPanelTab — UI controls για ADR-366 §A.3 Section Cuts (Phase 7.0).
 *
 * Sections:
 *  A) Master Enable toggle
 *  B) Mode buttons (Box / Plane) — visible όταν enabled
 *  C) Reset box button + planes list + Add plane + Link planes toggle
 *
 * ADR-040 micro-leaf: 1 useSyncExternalStore → useSectionStore.
 */

import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from '@/components/ui/switch';
import {
  useSectionStore,
  SECTION_MAX_PLANES,
  type SectionMode,
} from '../stores/SectionStore';
import { useSection2DPanelStore } from '../stores/Section2DPanelStore';
import { deriveAvailablePlanes } from '../2d-section/active-plane-derivation';

function ModeButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const cls = [
    'flex-1 rounded px-2 py-1 text-[11px] font-medium transition-colors',
    active
      ? 'bg-primary text-primary-foreground'
      : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white',
  ].join(' ');
  return (
    <button type="button" aria-label={label} aria-pressed={active} className={cls} onClick={onClick}>
      {label}
    </button>
  );
}

export function Section3DPanelTab() {
  const { t } = useTranslation('bim3d');

  const state = useSyncExternalStore(
    useSectionStore.subscribe,
    useSectionStore.getState,
    useSectionStore.getState,
  );

  const panel2dState = useSyncExternalStore(
    useSection2DPanelStore.subscribe,
    useSection2DPanelStore.getState,
    useSection2DPanelStore.getState,
  );

  const { enabled, mode, planes, linkPlanes, boxBounds } = state;
  const { visible: panel2dVisible, activePlaneId } = panel2dState;
  const canAddPlane = planes.length < SECTION_MAX_PLANES;

  const availablePlanes2d = deriveAvailablePlanes({ mode, boxBounds, planes });
  const effectiveActiveId =
    activePlaneId && availablePlanes2d.some((p) => p.id === activePlaneId)
      ? activePlaneId
      : availablePlanes2d[0]?.id ?? null;

  return (
    <div className="flex flex-col gap-3 p-3 text-xs text-white/80">
      <section className="flex items-center justify-between gap-2">
        <span>{t('section.enable')}</span>
        <Switch
          checked={enabled}
          onCheckedChange={(v) => useSectionStore.getState().setEnabled(v)}
          aria-label={t('section.enableAria')}
        />
      </section>

      {enabled && (
        <>
          <section>
            <div className="mb-1 text-[10px] uppercase tracking-wide text-white/40">
              {t('section.modeLabel')}
            </div>
            <div className="flex gap-1">
              <ModeButton
                label={t('section.modeBox')}
                active={mode === 'box'}
                onClick={() => useSectionStore.getState().setMode('box' satisfies SectionMode)}
              />
              <ModeButton
                label={t('section.modePlane')}
                active={mode === 'plane'}
                onClick={() => useSectionStore.getState().setMode('plane' satisfies SectionMode)}
              />
            </div>
          </section>

          {mode === 'box' && (
            <section>
              <button
                type="button"
                className="w-full rounded border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
                disabled={!boxBounds}
                onClick={() => useSectionStore.getState().setBoxBounds(boxBounds)}
              >
                {t('section.resetBox')}
              </button>
            </section>
          )}

          {mode === 'plane' && (
            <section className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-wide text-white/40">
                  {t('section.planesTitle')}
                </span>
                <button
                  type="button"
                  className="rounded bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-40"
                  disabled={!canAddPlane}
                  onClick={() => {
                    if (!canAddPlane) return;
                    useSectionStore.getState().addPlane({
                      normal: [1, 0, 0],
                      constant: 0,
                      enabled: true,
                      label: t('section.planeLabel', { n: planes.length + 1 }),
                    });
                  }}
                >
                  {t('section.addPlane')}
                </button>
              </div>

              {planes.length === 0 && (
                <p className="text-[11px] text-white/40">{t('section.noPlanes')}</p>
              )}

              {planes.map((plane, idx) => (
                <div
                  key={plane.id}
                  className="flex items-center justify-between gap-2 rounded bg-white/5 px-2 py-1"
                >
                  <Switch
                    checked={plane.enabled}
                    onCheckedChange={(v) =>
                      useSectionStore.getState().setPlaneEnabled(plane.id, v)
                    }
                  />
                  <span className="flex-1 text-[11px]">
                    {t('section.planeLabel', { n: idx + 1 })}
                  </span>
                  <button
                    type="button"
                    aria-label={t('section.removeAria')}
                    className="rounded px-1 text-white/40 transition-colors hover:bg-destructive/20 hover:text-destructive"
                    onClick={() => useSectionStore.getState().removePlane(plane.id)}
                  >
                    ×
                  </button>
                </div>
              ))}

              {planes.length >= SECTION_MAX_PLANES && (
                <p className="text-[10px] text-white/40">{t('section.maxPlanes')}</p>
              )}

              {planes.length >= 2 && (
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-[11px]">{t('section.linkPlanes')}</span>
                  <Switch
                    checked={linkPlanes}
                    onCheckedChange={(v) => useSectionStore.getState().setLinkPlanes(v)}
                    aria-label={t('section.linkAria')}
                  />
                </div>
              )}
            </section>
          )}

          <section className="flex flex-col gap-1 border-t border-white/10 pt-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px]">{t('section.show2dPanel')}</span>
              <Switch
                checked={panel2dVisible}
                onCheckedChange={(v) => useSection2DPanelStore.getState().setVisible(v)}
                aria-label={t('section.show2dPanelAria')}
              />
            </div>
            {panel2dVisible && (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wide text-white/40">
                  {t('section.activePlaneLabel')}
                </span>
                {availablePlanes2d.length === 0 ? (
                  <p className="text-[11px] text-white/40">{t('section.noActivePlane')}</p>
                ) : (
                  <select
                    className="rounded border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-white/80 transition-colors hover:bg-white/10"
                    value={effectiveActiveId ?? ''}
                    onChange={(e) =>
                      useSection2DPanelStore.getState().setActivePlaneId(e.target.value || null)
                    }
                  >
                    {availablePlanes2d.map((opt) => (
                      <option key={opt.id} value={opt.id} className="bg-black text-white">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
