'use client';

/**
 * @fileoverview **«ΑΠΟ ΤΑ ΣΤΟΙΧΕΙΑ ΤΗΣ ΕΤΑΙΡΕΙΑΣ» / «ΑΠΟ ΤΟ ΓΕΜΗ»** — η σήμανση προέλευσης ενός πεδίου
 *   (ADR-841 §7 Α21.19).
 * @related lib/agency/showcase-card-import.ts (`withoutProvenance`)
 * @module components/mandate/ShowcaseImportProvenance
 *
 * 🔑 **Πρόταση, όχι γεγονός** (Stripe prefill): ο άνθρωπος βλέπει **γιατί** το πεδίο έχει τιμή που δεν έγραψε.
 * Η σήμανση φεύγει μόλις το αλλάξει — από εκεί και πέρα η τιμή είναι δική του.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatMonthYear } from '@/lib/intl-formatting';
import type { ImportOrigin } from '@/types/showcase-card-import';
import {
  SHOWCASE_CARD_IMPORT_KEYS,
  SHOWCASE_CARD_IMPORT_ORIGIN_KEYS,
} from '@/components/mandate/agency-showcase-import-labels';
import { SHOWCASE_NS } from '@/components/mandate/agency-showcase-labels';

export function ShowcaseImportProvenance({
  origin,
  checkedAt = null,
}: {
  readonly origin: ImportOrigin | undefined | null;
  /** Πότε ρωτήθηκε το μητρώο — φαίνεται **πάντα** δίπλα σε ό,τι ήρθε από αυτό. */
  readonly checkedAt?: string | null;
}): React.ReactElement | null {
  const { t } = useTranslation([SHOWCASE_NS]);
  if (origin === undefined || origin === null) return null;
  return (
    <small className="text-xs text-muted-foreground">
      {t(SHOWCASE_CARD_IMPORT_ORIGIN_KEYS[origin])}
      {checkedAt !== null ? ` · ${t(SHOWCASE_CARD_IMPORT_KEYS.checkedOn, { date: formatMonthYear(checkedAt) })}` : null}
    </small>
  );
}
