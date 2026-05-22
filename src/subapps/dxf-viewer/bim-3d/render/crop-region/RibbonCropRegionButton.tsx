'use client';

/**
 * ADR-366 §C.6.Q4 — Crop Region ribbon button (Render contextual tab).
 *
 * Activates/deactivates the crop region tool. Shows committed state with
 * a "Reset" secondary action when crop is active.
 */

import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useCropRegionStore } from './CropRegionStore';

interface Props {
  onActivate: () => void;
  onDeactivate: () => void;
}

export function RibbonCropRegionButton({ onActivate, onDeactivate }: Props) {
  const { t } = useTranslation('bim3d');

  const editState = useSyncExternalStore(
    useCropRegionStore.subscribe,
    () => useCropRegionStore.getState().editState,
    () => useCropRegionStore.getState().editState,
  );

  const isActive = editState !== 'idle';

  function handleClick() {
    if (isActive) {
      useCropRegionStore.getState().cancelEdit();
      onDeactivate();
    } else {
      onActivate();
    }
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-pressed={isActive}
        className={[
          'rounded px-2 py-1 text-[11px] font-medium transition-colors',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'bg-white/10 text-white/80 hover:bg-white/15 hover:text-white',
        ].join(' ')}
        onClick={handleClick}
      >
        {t('crop.toolName')}
      </button>
      {isActive && (
        <button
          type="button"
          className="rounded px-1.5 py-1 text-[10px] text-white/50 transition-colors hover:text-destructive"
          onClick={() => {
            useCropRegionStore.getState().reset();
            onDeactivate();
          }}
          aria-label={t('crop.reset')}
        >
          ✕
        </button>
      )}
    </div>
  );
}
