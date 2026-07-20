'use client';

import { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from '@/components/ui/switch';
import { useViewMode3DStore } from '../stores/ViewMode3DStore';
import { useEnvironmentStore } from '../stores/EnvironmentStore';
import { useBimRenderSettingsStore } from '../../state/bim-render-settings-store';
import { PRESET_ORDER } from '../lighting/lighting-presets';
import { HDRI_PRESETS } from '../lighting/hdri-environment';
import { HdriUploader } from '../lighting/HdriUploader';
import { computeSolarPosition, timeOfDayToDate } from '../lighting/solar-position';
import { SliderInput } from '../../ui/components/shared/SliderInput';

/**
 * Fractional hour → zero-padded `hh:mm` clock text.
 * Pure: derives the string from its ARGUMENT only, so it can be handed to
 * `SliderInput.formatValue` without closing over render-scope state.
 */
function formatHourMinute(hourFloat: number): string {
  const hh = String(Math.floor(hourFloat)).padStart(2, '0');
  const mm = String(Math.floor((hourFloat % 1) * 60)).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function Lighting3DPanelTab() {
  const { t } = useTranslation('bim3d');
  const { sunPreset, sunAnimating, solarDate, solarLatDeg, solarLngDeg, autoPreviewEnabled } = useSyncExternalStore(
    useViewMode3DStore.subscribe,
    useViewMode3DStore.getState,
    useViewMode3DStore.getState,
  );

  const { hdriPresetId, isLoading, loadError, customHdriUrl } = useSyncExternalStore(
    useEnvironmentStore.subscribe,
    useEnvironmentStore.getState,
    useEnvironmentStore.getState,
  );

  // ADR-446 §2 — background mode lives on the per-view appearance SSoT (bim-render-settings),
  // alongside visualStyle — NOT the lighting EnvironmentStore. Subscribe to that primitive.
  const backgroundMode = useSyncExternalStore(
    useBimRenderSettingsStore.subscribe,
    () => useBimRenderSettingsStore.getState().backgroundMode,
    () => useBimRenderSettingsStore.getState().backgroundMode,
  );

  const [timeHour, setTimeHour] = useState(12);
  const [advanced, setAdvanced] = useState(false);
  const timeHourRef = useRef(12);

  const applyTime = (h: number) => {
    timeHourRef.current = h;
    setTimeHour(h);
    const pos = computeSolarPosition(timeOfDayToDate(h), solarLatDeg, solarLngDeg);
    useViewMode3DStore.getState().setSunPosition(pos.azimuthDeg, pos.elevationDeg);
  };

  useEffect(() => {
    if (!sunAnimating) return;
    const id = setInterval(() => {
      const next = (timeHourRef.current + 0.25) % 24;
      timeHourRef.current = next;
      setTimeHour(next);
      const pos = computeSolarPosition(timeOfDayToDate(next), solarLatDeg, solarLngDeg);
      useViewMode3DStore.getState().setSunPosition(pos.azimuthDeg, pos.elevationDeg);
    }, 2000);
    return () => clearInterval(id);
  }, [sunAnimating, solarLatDeg, solarLngDeg]);

  return (
    <div className="space-y-3 p-3 text-xs text-white/80">
      <div className="flex items-center justify-between rounded border border-white/10 px-2 py-1.5">
        <label htmlFor="bim3d-auto-preview" className="flex cursor-pointer select-none flex-col">
          <span>{t('lighting.autoPreview.label')}</span>
          <span className="text-[10px] text-white/40">{t('lighting.autoPreview.hint')}</span>
        </label>
        <Switch
          id="bim3d-auto-preview"
          checked={autoPreviewEnabled}
          onCheckedChange={(v) => useViewMode3DStore.getState().setAutoPreviewEnabled(v)}
          className="scale-90 origin-right data-[state=checked]:bg-[hsl(var(--text-success))]"
        />
      </div>

      {/* ADR-446 §2 — «σαν 2Δ» dark background: black bg + bright per-category edge lines. */}
      <div className="flex items-center justify-between rounded border border-white/10 px-2 py-1.5">
        <label htmlFor="bim3d-dark-bg" className="flex cursor-pointer select-none flex-col">
          <span>{t('lighting.darkBackground.label')}</span>
          <span className="text-[10px] text-white/40">{t('lighting.darkBackground.hint')}</span>
        </label>
        <Switch
          id="bim3d-dark-bg"
          checked={backgroundMode === 'dark'}
          onCheckedChange={(v) => useBimRenderSettingsStore.getState().setBackgroundMode(v ? 'dark' : 'environment')}
          className="scale-90 origin-right data-[state=checked]:bg-[hsl(var(--text-success))]"
        />
      </div>

      <div className="grid grid-cols-3 gap-1">
        {PRESET_ORDER.map((id) => (
          <button
            key={id}
            onClick={() => useViewMode3DStore.getState().setLightPreset(id)}
            className={[
              'rounded border px-1 py-0.5 text-[10px] transition-colors',
              sunPreset === id
                ? 'border-primary text-white'
                : 'border-transparent text-white/40 hover:text-white/70',
            ].join(' ')}
          >
            {t(`lighting.preset.${id}`)}
          </button>
        ))}
      </div>

      <SliderInput
        label={t('lighting.timeLabel')}
        value={timeHour}
        min={0}
        max={23.75}
        step={0.25}
        onChange={applyTime}
        showValue
        formatValue={formatHourMinute}
      />

      <button
        onClick={() => setAdvanced((v) => !v)}
        className="w-full text-left text-white/40 hover:text-white/70"
      >
        {t('lighting.advancedTitle')} {advanced ? '▲' : '▼'}
      </button>

      {advanced && (
        <div className="space-y-2">
          <div>
            <label className="block text-white/50">{t('lighting.dateLabel')}</label>
            <input
              type="date"
              value={solarDate.toISOString().slice(0, 10)}
              onChange={(e) => {
                const d = new Date(e.target.value);
                useViewMode3DStore.getState().setSolarConfig(d, solarLatDeg, solarLngDeg);
              }}
              className="w-full rounded bg-white/10 px-1 py-0.5 text-white"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-white/50">{t('lighting.latLabel')}</label>
              <input
                type="number"
                step={0.01}
                value={solarLatDeg}
                onChange={(e) => useViewMode3DStore.getState().setSolarConfig(solarDate, Number(e.target.value), solarLngDeg)}
                className="w-full rounded bg-white/10 px-1 py-0.5 text-white"
              />
            </div>
            <div className="flex-1">
              <label className="block text-white/50">{t('lighting.lngLabel')}</label>
              <input
                type="number"
                step={0.01}
                value={solarLngDeg}
                onChange={(e) => useViewMode3DStore.getState().setSolarConfig(solarDate, solarLatDeg, Number(e.target.value))}
                className="w-full rounded bg-white/10 px-1 py-0.5 text-white"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span>{t('lighting.animateLabel')}</span>
            <button
              onClick={() => useViewMode3DStore.getState().toggleSunAnimating()}
              className={[
                'rounded border px-2 py-0.5 transition-colors',
                sunAnimating ? 'border-primary text-white' : 'border-white/20 text-white/40',
              ].join(' ')}
            >
              {sunAnimating ? '■' : '▶'}
            </button>
          </div>
        </div>
      )}

      {/* Section D — HDRI Environment picker */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-white/60">{t('lighting.hdri.label')}</span>
          {isLoading && (
            <span className="text-[10px] text-white/40">{t('lighting.hdri.loading')}</span>
          )}
          {loadError && !isLoading && (
            <span className="text-[10px] text-destructive">{t('lighting.hdri.error')}</span>
          )}
        </div>
        <div className="grid grid-cols-4 gap-1">
          {HDRI_PRESETS.map((preset) => {
            const selected = !customHdriUrl && hdriPresetId === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => {
                  useEnvironmentStore.getState().clearCustomHdri();
                  useEnvironmentStore.getState().setHdriPreset(preset.id);
                }}
                className={[
                  'flex flex-col items-center overflow-hidden rounded border transition-all',
                  selected
                    ? 'border-primary ring-1 ring-primary'
                    : 'border-white/20 hover:border-white/40',
                ].join(' ')}
              >
                <img
                  src={preset.thumbnail}
                  alt={t(`lighting.hdri.${preset.labelKey}`)}
                  className="h-8 w-full object-cover"
                  loading="lazy"
                />
                <span className="w-full truncate px-0.5 py-0.5 text-center text-[9px] text-white/70">
                  {t(`lighting.hdri.${preset.labelKey}`)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <HdriUploader />
    </div>
  );
}
