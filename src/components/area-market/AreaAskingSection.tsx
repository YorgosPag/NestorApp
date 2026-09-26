'use client';

/**
 * **Μία προσφορά μιας περιοχής** — «Ζητούμενες τιμές πώλησης» ή «Ζητούμενα ενοίκια»: τα τμήματα αγοράς και η
 * λογιστική όσων δεν μέτρησαν (ADR-890 Φ1).
 *
 * 🔑 **Η λογιστική κλείνει στην οθόνη**: «Χ αγγελίες δεν μέτρησαν: α χωρίς τιμή · β χωρίς εμβαδόν …». Ο αναγνώστης
 * ξέρει από πόσες αγγελίες προκύπτει κάθε αριθμός, και γιατί όχι από όλες.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';

import { exclusionEntries, type OfferView } from './area-market-view';
import { AreaSegmentFigures } from './AreaSegmentFigures';

const NS = 'area-market';

interface AreaAskingSectionProps {
  readonly view: OfferView;
  readonly parentName: string | null;
}

function ExclusionNote({ view }: { readonly view: OfferView }) {
  const { t } = useTranslation([NS]);
  const entries = exclusionEntries(view.summary);
  if (entries.length === 0) return null;
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  return (
    <p className="m-0 text-sm text-muted-foreground">
      {t(`${NS}:excluded.title`, { count: total })}
      {': '}
      {entries.map(([reason, count]) => t(`${NS}:excluded.${reason}`, { count })).join(' · ')}
    </p>
  );
}

export function AreaAskingSection({ view, parentName }: AreaAskingSectionProps) {
  const { t } = useTranslation([NS]);
  const headingId = `area-offer-${view.offer}`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="m-0 text-xl font-semibold text-foreground">
        {t(`${NS}:offerHeading.${view.offer}`)}
      </h2>
      {view.segments.length === 0
        ? <p className="m-0 text-sm text-muted-foreground">{t(`${NS}:offerEmpty.${view.offer}`)}</p>
        : (
          <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-2">
            {view.segments.map((segment) => (
              <li key={segment.segment} className="min-w-0">
                <AreaSegmentFigures offer={view.offer} view={segment} parentName={parentName} />
              </li>
            ))}
          </ul>
        )}
      <ExclusionNote view={view} />
    </section>
  );
}
