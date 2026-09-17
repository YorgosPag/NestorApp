'use client';

/**
 * @fileoverview **Η ΕΚΒΑΣΗ ΜΙΑΣ ΠΡΑΞΗΣ ΚΛΕΙΣΤΗΣ ΔΙΑΘΕΣΗΣ, ΜΕ ΟΝΟΜΑ** (ADR-864 Α21 · §18).
 * @related services/owner-property/private-marketing.client.ts
 * @module components/mandate/PrivateMarketingActionNotice
 *
 * 🔑 **Μία απόδοση για γραφείο και ιδιοκτήτη**. Ο λόγος άρνησης είναι κλειδί του **ήδη υπάρχοντος**
 * λεξιλογίου `mandate.privateMarketing.reason.*`.
 *
 * ⚠️ Η έκβαση του **αιτήματος** («στάλθηκε» · «χωρίς email» · «απέτυχε η αποστολή») **δεν** ζει εδώ: την
 * αποδίδει μόνο η οθόνη του γραφείου (`PrivateMarketingAgencySection`), ώστε τα κείμενά της να μη
 * φορτώνονται στη σελίδα του ιδιοκτήτη, που δεν ζητά ποτέ (CHECK 3.34 · ADR-864 §19).
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { PrivateMarketingActionOutcome } from '@/services/owner-property/private-marketing.client';

const NS = 'property-market';
const K = `${NS}:mandate.privateMarketing`;

export function PrivateMarketingActionNotice({ outcome }: { readonly outcome: PrivateMarketingActionOutcome | null }): React.ReactElement | null {
  const { t } = useTranslation([NS]);
  if (outcome === null) return null;

  switch (outcome.kind) {
    case 'saved':
      return <p role="status" className="text-sm font-medium text-card-foreground">{t(`${K}.saved`)}</p>;
    case 'refused':
      return <p role="alert" className="text-sm font-medium text-destructive">{t(`${K}.reason.${outcome.reason}`)}</p>;
    case 'failed':
      return <p role="alert" className="text-sm font-medium text-destructive">{t(`${K}.failed`)}</p>;
  }
}
