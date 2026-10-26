'use client';

/**
 * @fileoverview **Οι λέξεις της δήλωσης δικαιωμάτων στο πλαίσιο του καταλόγου** — για το γενικό `MediaRightsFields`
 *   (ADR-923 §5.10.4).
 * @module components/catalog/assets/use-catalog-rights-words
 *
 * 🔑 Οι χάρτες σκοπών/διαρκειών/ευρημάτων είναι δεμένοι στις ρίζες τους (`asset-labels.ts`), άρα κι αυτό το αντικείμενο:
 *    νέος σκοπός στο πλαίσιο `catalog` σπάει τη μεταγλώττιση εδώ, όχι σιωπηλά στην οθόνη.
 */

import { useMemo } from 'react';

import type { MediaRightsWords } from '@/components/shared/media-rights/MediaRightsFields';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { CATALOG_LICENSE_PURPOSE_KEYS, LICENSE_DRAFT_ISSUE_KEYS, LICENSE_TERM_KIND_KEYS } from './asset-labels';

export function useCatalogRightsWords(): MediaRightsWords<'catalog'> {
  const { t } = useCatalogText();
  return useMemo(() => ({
    legend: t('assets.licence.legend'),
    creator: t('assets.licence.creator'),
    copyrightNotice: t('assets.licence.copyrightNotice'),
    copyrightNoticeHint: t('assets.licence.copyrightNoticeHint'),
    purpose: t('assets.licence.purpose'),
    term: t('assets.licence.term'),
    termUntil: t('assets.licence.termUntil'),
    termUntilPlaceholder: t('assets.licence.termUntilPlaceholder'),
    // Ρητά ανά τιμή (όχι βρόχος): οι γεννήτορες i18n λύνουν στατικά το `t(ΧΑΡΤΗΣ[τιμή])`, όχι ένα `t` περασμένο σε βοηθό.
    purposes: {
      'catalog-publication': t(CATALOG_LICENSE_PURPOSE_KEYS['catalog-publication']),
      'reseller-reuse': t(CATALOG_LICENSE_PURPOSE_KEYS['reseller-reuse']),
      unrestricted: t(CATALOG_LICENSE_PURPOSE_KEYS.unrestricted),
    },
    termKinds: { perpetual: t(LICENSE_TERM_KIND_KEYS.perpetual), date: t(LICENSE_TERM_KIND_KEYS.date) },
    issues: {
      creatorRequired: t(LICENSE_DRAFT_ISSUE_KEYS.creatorRequired),
      termDateRequired: t(LICENSE_DRAFT_ISSUE_KEYS.termDateRequired),
    },
  }), [t]);
}
