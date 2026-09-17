'use client';

/**
 * @fileoverview **ΠΟΥ ΒΡΙΣΚΕΤΑΙ Η ΣΥΝΑΙΝΕΣΗ — ΜΕ ΟΝΟΜΑ** (ADR-864 §18.5 #1 · Α26).
 * @related lib/mandate/private-marketing-panel.ts · components/mandate/PrivateMarketingAgencySection.tsx ·
 *   components/owner-property/PrivateMarketingOwnerSection.tsx
 * @module components/mandate/PrivateMarketingStandingLine
 *
 * 🔴 **Πέντε καταστάσεις, πέντε κείμενα.** Το `outdated` λέει *«οι όροι της εντολής άλλαξαν»* — **ποτέ** «χωρίς
 * συναίνεση»: ο άνθρωπος που συναίνεσε και μετά παρατάθηκε η εντολή οφείλει να μάθει **γιατί** του ζητείται ξανά
 * (το DocuSign ακυρώνει σιωπηλά τον φάκελο· το OneTrust ξαναρωτά χωρίς λόγο — §18.3).
 *
 * 🔑 **Η συναίνεση σε ισχύ λέει έκδοση · ημερομηνία · κανάλι** (πρότυπο ιστορικού εκδόσεων Figma): «ποιο κείμενο,
 * πότε, πώς» — ό,τι χρειάζεται για να ελέγξει κανείς την απόδειξη χωρίς να ανοίξει τη βάση.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDate } from '@/lib/intl-formatting';
import type { PrivateMarketingStandingView } from '@/lib/mandate/private-marketing-panel';

const NS = 'property-market';
const K = `${NS}:mandate.privateMarketing.standing`;

export function PrivateMarketingStandingLine({ standing }: { readonly standing: PrivateMarketingStandingView }): React.ReactElement {
  const { t } = useTranslation([NS]);

  switch (standing.kind) {
    case 'granted':
      return (
        <p className="text-sm text-card-foreground">
          {t(`${K}.granted`, {
            version: standing.version,
            date: formatDate(standing.at),
            channel: t(`${K}.channel.${standing.channel}`),
          })}
        </p>
      );
    case 'requested':
      return <p className="text-sm text-card-foreground">{t(`${K}.requested`, { date: formatDate(standing.at) })}</p>;
    case 'outdated':
      return <p className="text-sm text-card-foreground">{t(`${K}.outdated`)}</p>;
    case 'revoked':
      return <p className="text-sm text-muted-foreground">{t(`${K}.revoked`)}</p>;
    case 'absent':
      return <p className="text-sm text-muted-foreground">{t(`${K}.absent`)}</p>;
  }
}
