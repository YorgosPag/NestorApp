/**
 * @related ADR-186 §8 Q3 — Provenance visual badge
 *
 * Tiny inline badge that tells the user where a numeric value came from:
 *   🟢 zone (auto-filled)
 *   🟡 user override (edited away from zone default)
 *   ⚪ default (no zone selected — free input)
 */
'use client';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { FieldProvenance } from '@/types/project-building-code';

interface ProvenanceBadgeProps {
  /** Provenance source for this field. */
  provenance: FieldProvenance;
  /** Selected zone id, if any — affects the dot color and label. */
  zoneId: string | null;
}

const DOT_BASE = 'inline-block h-2 w-2 rounded-full mr-1.5 align-middle';

export function ProvenanceBadge({ provenance, zoneId }: ProvenanceBadgeProps) {
  const { t } = useTranslation('buildingCode');

  if (!zoneId) {
    return (
      <span className="text-xs text-muted-foreground inline-flex items-center">
        <span className={`${DOT_BASE} bg-muted-foreground/40`} aria-hidden />
        {t('provenance.default')}
      </span>
    );
  }

  if (provenance === 'zone') {
    return (
      <span className="text-xs text-emerald-700 dark:text-emerald-400 inline-flex items-center">
        <span className={`${DOT_BASE} bg-emerald-500`} aria-hidden />
        {t('provenance.fromZone', { zoneId })}
      </span>
    );
  }

  return (
    <span className="text-xs text-amber-700 dark:text-amber-400 inline-flex items-center">
      <span className={`${DOT_BASE} bg-amber-500`} aria-hidden />
      {t('provenance.userOverride')}
    </span>
  );
}
