'use client';

/**
 * **Η κατάσταση αποθήκευσης μιας ενότητας** (ADR-898 Φ3β-2): «Αποθήκευση… / Αποθηκεύτηκε» όπως το Google Docs, με την
 * **κοινή** ένδειξη του ADR-248 (`AutoSaveStatusIndicator`) — και, σε αποτυχία, **τι** δεν αποθηκεύτηκε και γιατί.
 *
 * 🔑 Η τιμή στην οθόνη έχει ήδη γυρίσει στην αλήθεια (η ουρά αφαίρεσε την αποτυχημένη διόρθωση)· εδώ μόνο εξηγούμε.
 * Δίκτυο ⇒ «Δοκιμάστε ξανά» · άρνηση του server ⇒ ο λόγος, χωρίς επανάληψη (δεν θα βοηθούσε).
 */

import React from 'react';

import { AutoSaveStatusIndicator } from '@/components/shared/AutoSaveStatusIndicator';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ObjectiveValueWriteRejection } from '@/lib/objective-value/objective-value-improve-subject';

import type { ImproveSave } from './useObjectiveValueImprove';

const NS = 'objective-value';
const I = `${NS}:improve`;

function useFailureText(): (failure: NonNullable<ImproveSave['failure']>) => string {
  const { t } = useTranslation([NS]);
  // Κλειστό λεξιλόγιο (`OBJECTIVE_VALUE_WRITE_REJECTIONS`) — κάθε λόγος έχει κλειδί· το `other` καλύπτει τα υπόλοιπα.
  const reasonText = (reason: ObjectiveValueWriteRejection) => t(`${I}.rejected.${reason}`);
  return (failure) =>
    failure.outcome.kind === 'failed'
      ? t(`${I}.failed`)
      : [...new Set(failure.outcome.reasons.map(reasonText))].join(' ');
}

export function ImproveSaveStatus({ save }: { readonly save: ImproveSave }) {
  const { t } = useTranslation([NS]);
  const failureText = useFailureText();
  const { status, lastSavedAt, failure } = save;
  return (
    <>
      <AutoSaveStatusIndicator
        status={status}
        lastSaved={lastSavedAt === null ? null : new Date(lastSavedAt)}
        showTimestamp={false}
      />
      {failure !== null && (
        <p role="alert" className="m-0 flex flex-wrap items-center gap-2 text-sm text-destructive">
          <span>{failureText(failure)}</span>
          {failure.outcome.kind === 'failed' && (
            <Button type="button" variant="outline" size="sm" onClick={save.retry}>
              {t(`${I}.retry`)}
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={save.dismissFailure}>
            {t(`${I}.dismiss`)}
          </Button>
        </p>
      )}
    </>
  );
}
