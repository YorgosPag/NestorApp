"use client";

/**
 * Accessibility3DPanelTab — per-user accessibility settings for the 3D viewer.
 * ADR-366 Phase 9 / C.5: entity nav order, reduced motion, announcements.
 */

import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/hooks/useAuth';
import { useViewMode3DStore } from '../stores/ViewMode3DStore';
import { Bim3DPreferencesService } from '../services/Bim3DPreferencesService';
import type { ReducedMotionOverride } from '../accessibility/use-reduced-motion';

const NAV_ORDER_OPTIONS = ['spatial', 'semantic'] as const;
const REDUCED_MOTION_OPTIONS = ['auto', 'force-on', 'force-off'] as const;

function i18nReducedMotion(v: ReducedMotionOverride): string {
  if (v === 'force-on') return 'forceOn';
  if (v === 'force-off') return 'forceOff';
  return 'auto';
}

export function Accessibility3DPanelTab() {
  const { t } = useTranslation('bim3d');
  const { user } = useAuth();

  const announcementsEnabled = useViewMode3DStore((s) => s.announcementsEnabled);
  const entityNavOrder = useViewMode3DStore((s) => s.accessibilityEntityNavOrder);
  const reducedMotion = useViewMode3DStore((s) => s.accessibilityReducedMotion);

  function persistAccessibility(partial: {
    announcementsEnabled?: boolean;
    entityNavOrder?: 'spatial' | 'semantic';
    reducedMotion?: ReducedMotionOverride;
  }) {
    if (!user?.uid) return;
    Bim3DPreferencesService.save(user.uid, {
      accessibility: {
        announcementsEnabled: partial.announcementsEnabled ?? announcementsEnabled,
        entityNavOrder: partial.entityNavOrder ?? entityNavOrder,
        reducedMotion: partial.reducedMotion ?? reducedMotion,
      },
    }).catch(() => { /* silently ignore — store already updated optimistically */ });
  }

  function handleAnnouncementsChange(enabled: boolean) {
    useViewMode3DStore.getState().setAnnouncementsEnabled(enabled);
    persistAccessibility({ announcementsEnabled: enabled });
  }

  function handleNavOrderChange(v: 'spatial' | 'semantic') {
    useViewMode3DStore.getState().setAccessibilityEntityNavOrder(v);
    persistAccessibility({ entityNavOrder: v });
  }

  function handleReducedMotionChange(v: ReducedMotionOverride) {
    useViewMode3DStore.getState().setAccessibilityReducedMotion(v);
    persistAccessibility({ reducedMotion: v });
  }

  return (
    <section className="space-y-4 p-3 text-xs text-white/80">
      <h3 className="font-semibold text-white">{t('accessibility.settings.title')}</h3>

      {/* Entity navigation order */}
      <fieldset className="space-y-1">
        <legend className="text-white/60">{t('accessibility.settings.entityNavOrderLabel')}</legend>
        {NAV_ORDER_OPTIONS.map((opt) => (
          <label key={opt} className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="entityNavOrder"
              value={opt}
              checked={entityNavOrder === opt}
              onChange={() => handleNavOrderChange(opt)}
              className="accent-primary"
            />
            {t(`accessibility.settings.entityNavOrder.${opt}`)}
          </label>
        ))}
      </fieldset>

      {/* Reduced motion */}
      <fieldset className="space-y-1">
        <legend className="text-white/60">{t('accessibility.settings.reducedMotionLabel')}</legend>
        {REDUCED_MOTION_OPTIONS.map((opt) => (
          <label key={opt} className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="reducedMotion"
              value={opt}
              checked={reducedMotion === opt}
              onChange={() => handleReducedMotionChange(opt)}
              className="accent-primary"
            />
            {t(`accessibility.settings.reducedMotion.${i18nReducedMotion(opt)}`)}
          </label>
        ))}
      </fieldset>

      {/* Announcements toggle */}
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={announcementsEnabled}
          onChange={(e) => handleAnnouncementsChange(e.target.checked)}
          className="accent-primary"
        />
        {t('accessibility.settings.announcementsEnabled')}
      </label>
    </section>
  );
}
