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

  switch (provenance) {
    case 'zone':
      return (
        <span className="text-xs text-[hsl(var(--text-success))] inline-flex items-center">
          <span className={`${DOT_BASE} bg-[hsl(var(--text-success))]`} aria-hidden />
          {t('provenance.fromZone', { zoneId })}
        </span>
      );
    case 'survey':
      return (
        <span className="text-xs text-[hsl(var(--text-info))] inline-flex items-center">
          <span className={`${DOT_BASE} bg-[hsl(var(--status-info))]`} aria-hidden />
          {t('provenance.fromSurvey')}
        </span>
      );
    case 'user':
      return (
        <span className="text-xs text-[hsl(var(--text-warning))] inline-flex items-center">
          <span className={`${DOT_BASE} bg-[hsl(var(--status-warning))]`} aria-hidden />
          {t('provenance.userOverride')}
        </span>
      );
    default: {
      // Exhaustiveness guard. Before ADR-759 this component ended in a bare
      // `return <userOverride/>`, so widening `FieldProvenance` painted the new
      // member with the wrong label and nothing anywhere could notice. Now the
      // compiler refuses the widening until this switch is updated.
      const never: never = provenance;
      return <>{String(never)}</>;
    }
  }
}
