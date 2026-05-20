"use client";

import { useTranslation } from 'react-i18next';
import { useSyncExternalStore } from 'react';
import { useViewMode3DStore } from '../stores/ViewMode3DStore';

interface RenderProgressOverlayProps {
  onCancel: () => void;
}

export function RenderProgressOverlay({ onCancel }: RenderProgressOverlayProps) {
  const { t } = useTranslation('bim3d');

  const progress = useSyncExternalStore(
    useViewMode3DStore.subscribe,
    () => useViewMode3DStore.getState().finalRenderProgress,
    () => -1,
  );

  const config = useSyncExternalStore(
    useViewMode3DStore.subscribe,
    () => useViewMode3DStore.getState().finalRenderConfig,
    () => null,
  );

  if (progress < 0 || !config) return null;

  const sppDone = Math.round((progress / 100) * config.presetSPP);
  const secondsEstimated = 60; // rough; real estimate shown in dialog
  const secondsRemaining = Math.max(0, Math.round(secondsEstimated * (1 - progress / 100)));

  return (
    <div className="absolute inset-x-0 bottom-12 z-[80] flex justify-center">
      <div className="flex w-80 flex-col gap-2 rounded-lg border border-white/20 bg-black/70 px-4 py-3 text-white backdrop-blur-sm">
        <p className="text-sm font-semibold">{t('render.progress.title')}</p>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-white/70">
          <span>
            {t('render.progress.samples', {
              current: sppDone,
              total: config.presetSPP,
            })}
          </span>
          {secondsRemaining < 60 ? (
            <span>{t('render.progress.remainingSec', { seconds: secondsRemaining })}</span>
          ) : (
            <span>
              {t('render.progress.remaining', {
                minutes: Math.ceil(secondsRemaining / 60),
              })}
            </span>
          )}
        </div>

        <button
          onClick={onCancel}
          className="mt-1 self-end rounded border border-white/20 px-3 py-1 text-xs font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          {t('render.progress.cancel')}
        </button>
      </div>
    </div>
  );
}
