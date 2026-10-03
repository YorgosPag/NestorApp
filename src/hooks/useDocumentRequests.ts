'use client';

/**
 * ADR-901 Φ4.5 — «Ζήτησε έγγραφο» για **κάθε** όψη (οικοδεσπότης · επαγγελματίας): ένα πάτημα ανά γραμμή, ή «Ζήτησε
 * όλα τα ελλείποντα» με **ένα** αίτημα.
 *
 * - **Αισιόδοξο**: μόλις ο server απαντήσει, η γραμμή δείχνει «Εκκρεμεί από … · ζητήθηκε σήμερα» αμέσως — η όψη
 *   ξαναδιαβάζεται στο παρασκήνιο και το τοπικό ίχνος **συγχωνεύεται** (ποτέ διπλό) με ό,τι φέρει ο server.
 * - Το «εκκρεμεί» και το «τι ζητείται τώρα» τα παράγει ο **κοινός** καθαρός πυρήνας — ίδιος με τον server.
 * - Ο παραλήπτης **δεν** στέλνεται ποτέ: τον ορίζει ο server (Α29).
 *
 * @module hooks/useDocumentRequests
 */

import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { nowISO } from '@/lib/date-local';
import type { CaseFileTarget } from '@/hooks/useCaseFileOpener';
import { isRequestableRow, pendingRequestOf, requestableNow } from '@/lib/conveyance/document-request-policy';
import { useNotifications } from '@/providers/NotificationProvider';
import { documentRequestRejectionOf, requestCaseDocumentsRequest } from '@/services/conveyance/conveyance-document-request-gateway';
import type { ChecklistRow } from '@/types/conveyance-case';
import type { CaseDocumentRequests, DocumentRequestItemOutcome, DocumentRequestView } from '@/types/conveyance-document-request';
import type { RowRequest } from '@/components/sales/conveyance/ConveyanceRowRequest';

interface DocumentRequestsApi {
  readonly rowRequest: RowRequest;
  /** Οι γραμμές που ζητούνται **τώρα** με ένα πάτημα — για το «Ζήτησε όλα». */
  readonly requestable: readonly ChecklistRow[];
  readonly requestAll: () => void;
}

/** Το ίχνος του server + τα τοπικά (αισιόδοξα) — ένα ανά (γραμμή, ημέρα), ποτέ διπλό. */
function mergeLog(server: readonly DocumentRequestView[], local: readonly DocumentRequestView[]): readonly DocumentRequestView[] {
  const known = (entry: DocumentRequestView) => server.some((s) => s.itemId === entry.itemId && s.dayKey === entry.dayKey && s.byViewer);
  return [...server, ...local.filter((entry) => !known(entry))];
}

function optimisticEntries(items: readonly DocumentRequestItemOutcome[], today: string): DocumentRequestView[] {
  const at = nowISO();
  return items.flatMap((item) => (item.kind === 'refused' ? [] : [{ itemId: item.itemId, recipient: item.recipient, requestedAt: at, dayKey: today, byViewer: true }]));
}

/** Η αποστολή + τα μηνύματά της — ένα αίτημα για όσες γραμμές δοθούν. */
function useSend(door: CaseFileTarget, today: string, onChanged: () => void) {
  const { t } = useTranslation(['conveyance']);
  const { success, info, error } = useNotifications();
  const [requestingIds, setRequestingIds] = useState<ReadonlySet<string>>(new Set());
  const [local, setLocal] = useState<readonly DocumentRequestView[]>([]);
  const send = useCallback(async (itemIds: readonly string[]) => {
    setRequestingIds((ids) => new Set([...ids, ...itemIds]));
    try {
      const { items } = await requestCaseDocumentsRequest(door, itemIds);
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
  }, [door, today, onChanged, success, info, error, t]);
  return { requestingIds, local, send };
}

export function useDocumentRequests(
  door: CaseFileTarget,
  panel: CaseDocumentRequests,
  rows: readonly ChecklistRow[],
  onChanged: () => void,
): DocumentRequestsApi {
  const { requestingIds, local, send } = useSend(door, panel.today, onChanged);
  const log = useMemo(() => mergeLog(panel.log, local), [panel.log, local]);
  const requestable = useMemo(() => requestableNow(rows, panel.targets, log, panel.today), [rows, panel.targets, log, panel.today]);
  const rowRequest: RowRequest = {
    targetOf: (row) => (isRequestableRow(row) ? panel.targets[row.itemId] ?? null : null),
    pendingOf: (row) => pendingRequestOf(row, log, panel.today),
    requestingIds,
    onRequest: (row) => { void send([row.itemId]); },
  };
  const requestAll = useCallback(() => { void send(requestable.map((row) => row.itemId)); }, [send, requestable]);
  return { rowRequest, requestable, requestAll };
}
