"use client";

import { useMemo } from 'react';
import type { ObligationSection } from '@/types/obligations';

export function useCounters(sections: ObligationSection[]) {
  const { sectionsCount, articlesCount, paragraphsCount } = useMemo(() => {
    const sCount = sections.length;
    const aCount = sections.reduce(
      (sum, s) => sum + (s.articles?.length || 0),
      0
    );
    const pCount = sections.reduce(
      (sum, s) => sum + (s.articles?.reduce((aSum, a) => aSum + (a.paragraphs?.length || 0), 0) || 0),
      0
    );
    return { sectionsCount: sCount, articlesCount: aCount, paragraphsCount: pCount };
  }, [sections]);

  return { sectionsCount, articlesCount, paragraphsCount };
}
