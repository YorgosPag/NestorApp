'use client';

/**
 * @fileoverview **Το πλαίσιο εκδόσεων μιας συνταγής** — το κουμπί «Έκδοση» και η λίστα των εκδόσεων της (ADR-923 §5.6.1).
 * @module components/catalog/publishing/PublicationRunPanel
 *
 * 🔑 Η έκδοση φτιάχνεται από την **αποθηκευμένη** συνταγή (ο διακομιστής δεν δέχεται σώμα)· με μη αποθηκευμένες αλλαγές
 *    το κουμπί κλειδώνει, ώστε ο άνθρωπος να μην εκδώσει κάτι άλλο από αυτό που βλέπει.
 * 🔑 Ιδεμπότητο: ίδιες είσοδοι ⇒ η ίδια έκδοση (ο διακομιστής επιστρέφει την υπάρχουσα) — διπλό κλικ δεν διπλασιάζει δουλειά.
 *    Το κουμπί κλειδώνει όσο η αίτηση πετά, και η όψη ανανεώνεται αμέσως ώστε να ξεκινήσει η παρακολούθηση της προόδου.
 */

import React, { useCallback, useState } from 'react';
import { BookOpen } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useNotifications } from '@/providers/NotificationProvider';
import { catalogFailureOf } from '@/services/catalog/catalog-failure';
import { requestPublicationRun } from '@/services/catalog/catalog-publishing-api.client';
import type { PublicationRunWire } from '@/subapps/catalog/types/publication';
import { useCatalogAccess, useCatalogFailureNotice, useCatalogText } from '../shared/catalog-ui-hooks';
import { PublicationRunList } from './PublicationRunList';

interface RunPanelProps {
  readonly recipeId: string;
  readonly runs: readonly PublicationRunWire[];
  /** Υπάρχουν μη αποθηκευμένες αλλαγές στη συνταγή. */
  readonly dirty: boolean;
  readonly revalidate: () => Promise<void>;
}

function useRequestRun(recipeId: string, revalidate: () => Promise<void>) {
  const { t } = useCatalogText();
  const { success } = useNotifications();
  const notifyFailure = useCatalogFailureNotice();
  const [requesting, setRequesting] = useState(false);
  const request = useCallback(async () => {
    setRequesting(true);
    try {
      await requestPublicationRun(recipeId);
      success(t('publishing.requested'));
    } catch (cause) {
      notifyFailure(catalogFailureOf(cause));
    } finally {
      setRequesting(false);
    }
    await revalidate();
  }, [recipeId, revalidate, success, t, notifyFailure]);
  return { requesting, request };
}

export function PublicationRunPanel({ recipeId, runs, dirty, revalidate }: RunPanelProps) {
  const { t } = useCatalogText();
  const canRun = useCatalogAccess('pricing') === 'granted';
  const { requesting, request } = useRequestRun(recipeId, revalidate);
  return (
    <section className="flex flex-col gap-3 border-b p-4">
      {canRun ? (
        <p className="m-0">
          <Button type="button" disabled={dirty || requesting} onClick={() => { void request(); }}>
            <BookOpen className="mr-1 h-4 w-4" aria-hidden />{t('publishing.publish')}
          </Button>
        </p>
      ) : null}
      <PublicationRunList runs={runs} />
    </section>
  );
}
