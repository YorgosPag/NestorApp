'use client';

/**
 * SSoT — «λίστα warning text από `validation.violationKeys`».
 *
 * ΕΝΑ presentational component που αποδίδει τα i18n-resolved violation keys μιας
 * BIM οντότητας ως αναγνώσιμη λίστα (soft-warning look). Το χρησιμοποιούν τα
 * per-entity warnings sections (Wall / Slab-opening / …) αντί για hand-rolled
 * δίδυμα (N.0.2/N.18 — πριν υπήρχε copy-paste μεταξύ `WallWarningsSection` και
 * του soft `ViolationList` του `StairWarningsSection`).
 *
 * Κάθε key ΕΙΝΑΙ το i18n key: namespace `tool-hints` όταν ξεκινά με `tools.`
 * (validator-emitted hints), αλλιώς `dxf-viewer-shell`. Επιστρέφει `null` όταν
 * δεν υπάρχουν violations (ο caller δεν χρειάζεται guard).
 *
 * @see ../wall-advanced-panel/sections/WallWarningsSection.tsx
 * @see ../slab-opening-advanced-panel/sections/SlabOpeningWarningsSection.tsx
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export interface ViolationKeyWarningsSectionProps {
  /** `entity.validation.violationKeys` — i18n keys (soft/hard code violations). */
  readonly violationKeys: readonly string[];
  /** i18n key για τον τίτλο του section (π.χ. `wallAdvancedPanel.sections.warnings.title`). */
  readonly titleKey: string;
}

export function ViolationKeyWarningsSection({
  violationKeys,
  titleKey,
}: ViolationKeyWarningsSectionProps): React.ReactElement | null {
  const { t } = useTranslation(['dxf-viewer-shell', 'tool-hints']);
  if (violationKeys.length === 0) return null;

  return (
    <section
      role="alert"
      aria-label={t(titleKey)}
      className="flex flex-col gap-1.5 rounded border border-[hsl(var(--text-warning))]/40 bg-[hsl(var(--bg-warning))]/20 p-2"
    >
      <header className="flex items-center gap-2">
        <span aria-hidden="true" className="text-[hsl(var(--text-warning))]">
          !
        </span>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--text-warning))]">
          {t(titleKey)}
        </h4>
      </header>
      <ul className="flex flex-col gap-1 text-xs text-[hsl(var(--text-warning))]">
        {violationKeys.map((key) => {
          const ns = key.startsWith('tools.') ? 'tool-hints' : 'dxf-viewer-shell';
          return (
            <li key={key} className="leading-snug">
              {t(key, { ns, defaultValue: '' }) || key}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
