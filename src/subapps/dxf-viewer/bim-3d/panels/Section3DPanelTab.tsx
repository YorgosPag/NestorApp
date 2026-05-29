'use client';

/**
 * Section3DPanelTab — ADR-366 §A.3 + §C.6.
 *
 * Phase 7.0: basic enable toggle + box/plane mode.
 * Phase 9 C.6: per-plane axis/distance/label, Y-axis horizontal cuts,
 *   linked plane groups, empty state CTA, group delta slider.
 *
 * ADR-040 micro-leaf: 2 useSyncExternalStore subscriptions max.
 */

import { useSyncExternalStore, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from '@/components/ui/switch';
import {
  useSectionStore,
  SECTION_MAX_PLANES,
  type SectionMode,
  type Vec3Tuple,
} from '../stores/SectionStore';
import { useSection2DPanelStore } from '../stores/Section2DPanelStore';
import { deriveAvailablePlanes } from '../2d-section/active-plane-derivation';
import { PlaneListItem } from './section/PlaneListItem';

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

const DEFAULT_NEW_PLANE_NORMAL: Vec3Tuple = [1, 0, 0];

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

  const { enabled, mode, planes, linkPlanes, boxBounds, linkedGroups } = state;
  const { visible: panel2dVisible, activePlaneId } = panel2dState;
  const canAddPlane = planes.length < SECTION_MAX_PLANES;

  const [selectedPlaneIds, setSelectedPlaneIds] = useState<Set<string>>(new Set());
  const [groupDelta, setGroupDelta] = useState(0);

  const availablePlanes2d = deriveAvailablePlanes({ mode, boxBounds, planes });
  const effectiveActiveId =
    activePlaneId && availablePlanes2d.some((p) => p.id === activePlaneId)
      ? activePlaneId
      : availablePlanes2d[0]?.id ?? null;

  const groupedPlaneIds = new Set(linkedGroups.flatMap((g) => g.planeIds));

  function togglePlaneSelection(id: string) {
    setSelectedPlaneIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleLinkSelected() {
    const ids = [...selectedPlaneIds];
    if (ids.length < 2) return;
    useSectionStore.getState().addGroup(ids);
    setSelectedPlaneIds(new Set());
  }

  function handleApplyGroupDelta(groupId: string) {
    if (groupDelta === 0) return;
    useSectionStore.getState().applyGroupDelta(groupId, groupDelta);
    setGroupDelta(0);
  }

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
            <section className="flex flex-col gap-2">
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
                      normal: DEFAULT_NEW_PLANE_NORMAL,
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
                <div className="flex flex-col items-center gap-2 py-3 text-center">
                  <p className="text-[11px] text-white/40">{t('section.noPlanes')}</p>
                  <button
                    type="button"
                    className="rounded bg-white/10 px-3 py-1 text-[11px] text-white/70 transition-colors hover:bg-white/15 hover:text-white"
                    onClick={() =>
                      useSectionStore.getState().addPlane({
                        normal: DEFAULT_NEW_PLANE_NORMAL,
                        constant: 0,
                        enabled: true,
                        label: t('section.planeLabel', { n: 1 }),
                      })
                    }
                  >
                    {t('section.addFirst')}
                  </button>
                </div>
              )}

              {planes.map((plane) => (
                <div
                  key={plane.id}
                  className={[
                    'cursor-pointer rounded outline outline-1 transition-colors',
                    selectedPlaneIds.has(plane.id)
                      ? 'outline-primary/60'
                      : 'outline-transparent',
                  ].join(' ')}
                  onClick={(e) => {
                    if (e.ctrlKey || e.metaKey) togglePlaneSelection(plane.id);
                  }}
                >
                  <PlaneListItem
                    plane={plane}
                    isLinked={groupedPlaneIds.has(plane.id)}
                  />
                </div>
              ))}

              {planes.length >= SECTION_MAX_PLANES && (
                <p className="text-[10px] text-[hsl(var(--text-warning))]/80">{t('section.maxPlanes')}</p>
              )}

              {selectedPlaneIds.size >= 2 && (
                <button
                  type="button"
                  className="rounded bg-white/10 px-2 py-1 text-[11px] text-white/70 transition-colors hover:bg-white/15 hover:text-white"
                  onClick={handleLinkSelected}
                >
                  🔗 {t('section.groups.chain')}
                </button>
              )}

              {linkedGroups.length > 0 && (
                <div className="flex flex-col gap-1 border-t border-white/10 pt-2">
                  {linkedGroups.map((group) => (
                    <div key={group.id} className="flex flex-col gap-1 rounded bg-white/5 px-2 py-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-white/60">
                          {t('section.linkedBadge')} ({group.planeIds.length})
                        </span>
                        <button
                          type="button"
                          className="text-[10px] text-white/40 hover:text-white"
                          onClick={() => useSectionStore.getState().removeGroup(group.id)}
                        >
                          {t('section.groups.ungroup')}
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] uppercase tracking-wide text-white/40 w-10 shrink-0">
                          {t('section.groupDeltaLabel')}
                        </span>
                        <input
                          type="range"
                          min={-10}
                          max={10}
                          step={0.1}
                          value={groupDelta}
                          className="flex-1 accent-primary"
                          onChange={(e) => setGroupDelta(parseFloat(e.target.value))}
                        />
                        <button
                          type="button"
                          className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground"
                          onClick={() => handleApplyGroupDelta(group.id)}
                        >
                          ✓
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {planes.length >= 2 && linkedGroups.length === 0 && (
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
