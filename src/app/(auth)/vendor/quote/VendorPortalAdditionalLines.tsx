'use client';

/**
 * Πρόσθετες γραμμές του προμηθευτή — ό,τι περιλαμβάνει η τιμή του **χωρίς** να ζητήθηκε (BuildingConnected
 * «Additional Items»). Μετρούν στο σύνολο· στη σύγκριση εμφανίζονται χωριστά (ADR-327 §8.5).
 * Σε RFQ χωρίς ζητούμενες γραμμές, είναι ΟΛΗ η προσφορά.
 *
 * @module app/(auth)/vendor/quote/VendorPortalAdditionalLines
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { VISIBLE_LINK_CLASS } from '@/lib/ui/link-style';
import type { AdditionalLineDraft } from './types';
import type { VendorQuoteDraftActions } from './useVendorQuoteDraft';
import { VendorPortalLineFields } from './VendorPortalLineFields';

interface Props {
  lines: readonly AdditionalLineDraft[];
  actions: VendorQuoteDraftActions;
  /** RFQ χωρίς γραμμές: η μία γραμμή δεν αφαιρείται (η προσφορά χρειάζεται τουλάχιστον μία). */
  keepAtLeastOne: boolean;
}

export function VendorPortalAdditionalLines({ lines, actions, keepAtLeastOne }: Props) {
  const { t } = useTranslation(['vendor-portal']);
  const removable = !keepAtLeastOne || lines.length > 1;
  return (
    <>
      <ul className="space-y-3">
        {lines.map((line) => (
          <li key={line.key} className="rounded-md border border-border p-3">
            <label className="mb-2 block">
              <span className="text-xs font-medium text-foreground">{t('vendor-portal:form.description')}</span>
              <input
                value={line.description}
                onChange={(e) => actions.updateAdditional(line.key, { description: e.target.value })}
                className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
                required
              />
            </label>
            <VendorPortalLineFields line={line} onChange={(patch) => actions.updateAdditional(line.key, patch)} />
            {removable && (
              <button
                type="button"
                onClick={() => actions.removeAdditional(line.key)}
                className={`mt-1 text-xs text-destructive ${VISIBLE_LINK_CLASS}`}
              >
                {t('vendor-portal:form.removeLine')}
              </button>
            )}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={actions.addAdditional}
        className="mt-3 rounded-md border border-dashed border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
      >
        + {t('vendor-portal:form.addLine')}
      </button>
    </>
  );
}
