'use client';

/**
 * @fileoverview **Η πόρτα προς τις «Άδειες»** — από τη σελίδα της βιτρίνας (ADR-915 §21).
 * @related ShowcaseCardDoor.tsx (το ίδιο ιδίωμα) · ShowcaseLicencesContent.tsx (η υποσελίδα) · ShowcaseDoorLink.tsx
 * @module components/mandate/ShowcaseLicencesDoor
 *
 * 🔑 Η λεπτομέρεια λέει **τι ισχύει σήμερα** («καμία» ή πόσες) — η πόρτα δεν είναι σκέτος σύνδεσμος, είναι κατάσταση.
 * ⚠️ Χωρίς βιτρίνα δεν υπάρχει πόρτα: οι άδειες ζουν μέσα στο έγγραφό της (ίδιο με την κάρτα).
 */

import React from 'react';
import { BadgeCheck } from 'lucide-react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { AGENCY_SHOWCASE_LICENCES_ROUTE } from '@/lib/mandate/mandate-routes';
import type { PublicShowcase } from '@/types/agency-profile';
import { SHOWCASE_KEYS, SHOWCASE_NS } from '@/components/mandate/agency-showcase-labels';
import { ShowcaseDoorLink } from '@/components/mandate/ShowcaseDoorLink';

export function ShowcaseLicencesDoor({ published }: { readonly published: PublicShowcase | null }): React.ReactElement | null {
  const { t } = useTranslation([SHOWCASE_NS]);
  if (published === null) return null;
  const count = published.licences.length;

  return (
    <ShowcaseDoorLink
      href={AGENCY_SHOWCASE_LICENCES_ROUTE}
      icon={BadgeCheck}
      title={t(SHOWCASE_KEYS.licencesDoor)}
      detail={count === 0 ? t(SHOWCASE_KEYS.licencesDoorNone) : t(SHOWCASE_KEYS.licencesDoorCount, { count })}
    />
  );
}
