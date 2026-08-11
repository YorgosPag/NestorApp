'use client';

/**
 * Το πλέγμα φωτογραφιών του showcase ακινήτου.
 *
 * ⚠️ **Δεν ζωγραφίζει πια τίποτα το ίδιο** (ADR-784 §10): ήταν το **πέμπτο** αντίγραφο ενός
 * πλέγματος που ζούσε αυτούσιο και μέσα στους τέσσερις άλλους showcase clients. Κρατά **μόνο**
 * την ευθύνη που είναι πραγματικά δική του — τα **κλειδιά μετάφρασης** αυτής της επιφάνειας —
 * και αναθέτει τη ζωγραφική στο `ShowcaseMediaGrid` του `showcase-core`.
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ShowcaseMediaGrid } from '@/components/showcase-core';
import type { ShowcaseMedia } from './types';

interface ShowcasePhotoGridProps {
  photos: ShowcaseMedia[];
}

export function ShowcasePhotoGrid({ photos }: ShowcasePhotoGridProps) {
  const { t } = useTranslation('showcase');
  return (
    <ShowcaseMediaGrid
      media={photos}
      title={t('photos.title')}
      emptyAlt={t('photos.defaultAlt')}
    />
  );
}
