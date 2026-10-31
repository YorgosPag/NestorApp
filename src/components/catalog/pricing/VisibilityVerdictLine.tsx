'use client';

/**
 * @fileoverview **Τι βλέπει αυτός ο θεατής** (ADR-923 §5.12 Δ6): η ίδια κρίση με την πραγματικότητα, δίπλα στο ποσό που
 *   ανήκει στον προμηθευτή.
 * @module components/catalog/pricing/VisibilityVerdictLine
 */

import React from 'react';

import type { VisibilityVerdict } from '@/subapps/catalog/types/visibility-rule';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { VISIBILITY_KEYS } from './pricing-labels';

export function VisibilityVerdictLine({ verdict }: { readonly verdict: VisibilityVerdict }) {
  const { t } = useCatalogText();
  const notes = [verdict.ruleId === null ? t('pricing.visibility.noRule') : null, verdict.tied ? t('pricing.visibility.tied') : null];
  return (
    <p className="m-0 text-xs" role="status">
      {[t('pricing.visibility.seesThis', { answer: t(VISIBILITY_KEYS[verdict.visibility]) }), ...notes].filter(Boolean).join(' ')}
    </p>
  );
}
