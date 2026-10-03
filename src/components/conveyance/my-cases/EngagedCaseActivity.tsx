'use client';

/**
 * ADR-901 Φ4 §5.9 — το ίχνος της υπόθεσης για τον επαγγελματία: οι **δικές του** ενέργειες και όσοι άνοιξαν
 * τα **δικά του** αρχεία. Ο server στέλνει **ήδη** προβολή (`CaseActivityItem`): ο άλλος φαίνεται μόνο με τον
 * ρόλο του, ποτέ με όνομα ή email.
 *
 * Τρεις εκβάσεις, ποτέ δύο: φόρτωση · «δεν φορτώθηκε» · λίστα (που μπορεί να είναι κενή, με δικό της κείμενο).
 *
 * @module components/conveyance/my-cases/EngagedCaseActivity
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { fetchEngagedCaseActivity } from '@/services/conveyance/conveyance-engagement-gateway';
import { formatDateTime } from '@/lib/intl-utils';
import { cn } from '@/lib/utils';
import type { CaseActivityItem } from '@/types/conveyance-case';

type ActivityState = { readonly kind: 'loading' } | { readonly kind: 'failed' } | { readonly kind: 'ready'; readonly items: readonly CaseActivityItem[] };

function useCaseActivity(engagementId: string): ActivityState {
  const [state, setState] = useState<ActivityState>({ kind: 'loading' });
  useEffect(() => {
    let alive = true;
    fetchEngagedCaseActivity(engagementId)
      .then((result) => { if (alive) setState({ kind: 'ready', items: result.items }); })
      .catch(() => { if (alive) setState({ kind: 'failed' }); });
    return () => { alive = false; };
  }, [engagementId]);
  return state;
}

/** Κλειστός πίνακας ετικετών (ADR-744): νέο είδος γεγονότος δεν μεταγλωττίζεται χωρίς τα λόγια του. */
const ACTIVITY_KIND_KEY: Readonly<Record<CaseActivityItem['kind'], string>> = {
  viewed: 'engagement.case.activity.viewed',
  downloaded: 'engagement.case.activity.downloaded',
  answered: 'engagement.case.activity.answered',
};

function ActivityLine({ item }: { readonly item: CaseActivityItem }) {
  const { t } = useTranslation(['conveyance']);
  const colors = useSemanticColors();
  const who = item.byViewer
    ? t('engagement.case.activity.you')
    : item.actorRole ? t(`engagement.roles.${item.actorRole}`) : t('engagement.case.activity.someone');
  const what = t(ACTIVITY_KIND_KEY[item.kind], { name: item.documentName ?? t('engagement.case.activity.unnamed') });
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-border py-2 text-sm last:border-b-0">
      <span className="text-foreground">{who} · {what}</span>
      <time dateTime={item.at} className={cn('text-xs', colors.text.muted)}>{formatDateTime(item.at)}</time>
    </li>
  );
}

export function EngagedCaseActivity({ engagementId }: { readonly engagementId: string }) {
  const { t } = useTranslation(['conveyance']);
  const colors = useSemanticColors();
  const state = useCaseActivity(engagementId);
  return (
    <section className="space-y-2" aria-labelledby="engaged-case-activity" aria-busy={state.kind === 'loading'}>
      <h2 id="engaged-case-activity" className="m-0 text-base font-semibold text-foreground">{t('engagement.case.activity.title')}</h2>
      {state.kind === 'loading' && <p className={cn('text-sm', colors.text.muted)}>{t('engagement.case.activity.loading')}</p>}
      {state.kind === 'failed' && <p className={cn('text-sm', colors.text.error)}>{t('engagement.case.activity.loadError')}</p>}
      {state.kind === 'ready' && state.items.length === 0 && <p className={cn('text-sm', colors.text.muted)}>{t('engagement.case.activity.empty')}</p>}
      {state.kind === 'ready' && state.items.length > 0 && (
        <ol className="m-0 list-none rounded-md border border-border bg-card px-3">
          {state.items.map((item) => <ActivityLine key={item.id} item={item} />)}
        </ol>
      )}
    </section>
  );
}
