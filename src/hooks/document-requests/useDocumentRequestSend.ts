'use client';

/**
 * ADR-942 Φ1 — η **αποστολή** του «Ζήτησε έγγραφο», κοινή για κάθε είδος υπόθεσης (μεταβίβαση · ανάθεση έκδοσης).
 *
 * - **Αισιόδοξο**: μόλις ο server απαντήσει, το στοιχείο δείχνει «ζητήθηκε σήμερα» αμέσως· η όψη ξαναδιαβάζεται στο
 *   παρασκήνιο και το τοπικό ίχνος **συγχωνεύεται** (ποτέ διπλό) με ό,τι φέρει ο server.
 * - Ο παραλήπτης **δεν** στέλνεται ποτέ: τον ορίζει ο server (Α29).
 * - Ό,τι ξέρει **μόνο** το είδος (ποια πόρτα, ποιος κατάλογος) το δίνει ο καλών — εδώ ζει μόνο η μηχανική.
 *
 * @module hooks/document-requests/useDocumentRequestSend
 */

import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { nowISO } from '@/lib/date-local';
import { useNotifications } from '@/providers/NotificationProvider';
import { documentRequestRejectionOf } from '@/services/conveyance/conveyance-document-request-gateway';
import type { DocumentRequestItemOutcome, DocumentRequestView } from '@/types/document-request';

/** Η πόρτα του είδους: στέλνει τα στοιχεία, επιστρέφει το αποτέλεσμα ανά στοιχείο. */
export type DocumentRequestPost<Role extends string> = (itemIds: readonly string[]) => Promise<{ readonly items: readonly DocumentRequestItemOutcome<Role>[] }>;

/** Το ίχνος του server + τα τοπικά (αισιόδοξα) — ένα ανά (στοιχείο, ημέρα), ποτέ διπλό. */
function mergeLog<Role extends string>(server: readonly DocumentRequestView<Role>[], local: readonly DocumentRequestView<Role>[]): readonly DocumentRequestView<Role>[] {
  const known = (entry: DocumentRequestView<Role>) => server.some((s) => s.itemId === entry.itemId && s.dayKey === entry.dayKey && s.byViewer);
  return [...server, ...local.filter((entry) => !known(entry))];
}

function optimisticEntries<Role extends string>(items: readonly DocumentRequestItemOutcome<Role>[], today: string): DocumentRequestView<Role>[] {
  const at = nowISO();
  return items.flatMap((item): DocumentRequestView<Role>[] => (
    item.kind === 'refused' ? [] : [{ itemId: item.itemId, recipient: item.recipient, requestedAt: at, dayKey: today, byViewer: true }]
  ));
}

export interface DocumentRequestSend<Role extends string> {
  /** Το ίχνος του server συγχωνευμένο με τα αισιόδοξα τοπικά. */
  readonly log: readonly DocumentRequestView<Role>[];
  readonly requestingIds: ReadonlySet<string>;
  readonly send: (itemIds: readonly string[]) => Promise<void>;
}

/** Μία αποστολή για όσα στοιχεία δοθούν + τα μηνύματά της + το συγχωνευμένο ίχνος. */
export function useDocumentRequestSend<Role extends string>(
  post: DocumentRequestPost<Role>,
  serverLog: readonly DocumentRequestView<Role>[],
  today: string,
  onChanged: () => void,
): DocumentRequestSend<Role> {
  const { t } = useTranslation(['conveyance']);
  const { success, info, error } = useNotifications();
  const [requestingIds, setRequestingIds] = useState<ReadonlySet<string>>(new Set());
  const [local, setLocal] = useState<readonly DocumentRequestView<Role>[]>([]);
  const send = useCallback(async (itemIds: readonly string[]) => {
    setRequestingIds((ids) => new Set([...ids, ...itemIds]));
    try {
      const { items } = await post(itemIds);
      setLocal((current) => [...current, ...optimisticEntries(items, today)]);
      const fresh = items.filter((item) => item.kind === 'requested').length;
      if (fresh > 0) success(t('requests.sent', { count: fresh }));
      else if (items.some((item) => item.kind === 'already-requested')) info(t('requests.alreadyToday'));
      onChanged();
    } catch (cause) {
      error(t(`requests.errors.${documentRequestRejectionOf(cause)}`));
    } finally {
      setRequestingIds((ids) => new Set([...ids].filter((id) => !itemIds.includes(id))));
    }
  }, [post, today, onChanged, success, info, error, t]);
  const log = useMemo(() => mergeLog(serverLog, local), [serverLog, local]);
  return { log, requestingIds, send };
}
