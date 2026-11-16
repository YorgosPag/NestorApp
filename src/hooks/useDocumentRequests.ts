'use client';

/**
 * ADR-901 Φ4.5 — «Ζήτησε έγγραφο» για **κάθε** όψη της μεταβίβασης (οικοδεσπότης · επαγγελματίας): ένα πάτημα ανά γραμμή, ή «Ζήτησε
 * όλα τα ελλείποντα» με **ένα** αίτημα.
 *
 * - **Αισιόδοξο**: μόλις ο server απαντήσει, η γραμμή δείχνει «Εκκρεμεί από … · ζητήθηκε σήμερα» αμέσως — η όψη
 *   ξαναδιαβάζεται στο παρασκήνιο και το τοπικό ίχνος **συγχωνεύεται** (ποτέ διπλό) με ό,τι φέρει ο server.
 * - Το «εκκρεμεί» και το «τι ζητείται τώρα» τα παράγει ο **κοινός** καθαρός πυρήνας — ίδιος με τον server.
 * - Ο παραλήπτης **δεν** στέλνεται ποτέ: τον ορίζει ο server (Α29).
 * - Η αποστολή + το αισιόδοξο ίχνος ζουν **μία** φορά (`useDocumentRequestSend`, ADR-942 Φ1)· εδώ μόνο ο κατάλογος.
 *
 * @module hooks/useDocumentRequests
 */

import { useCallback, useMemo } from 'react';
import type { CaseFileTarget } from '@/hooks/useCaseFileOpener';
import { useDocumentRequestSend } from '@/hooks/document-requests/useDocumentRequestSend';
import { isRequestableRow, pendingRequestOf, requestableNow } from '@/lib/conveyance/document-request-policy';
import { requestCaseDocumentsRequest } from '@/services/conveyance/conveyance-document-request-gateway';
import type { ChecklistRow } from '@/types/conveyance-case';
import type { CaseDocumentRequests } from '@/types/conveyance-document-request';
import type { RowRequest } from '@/components/sales/conveyance/ConveyanceRowRequest';

interface DocumentRequestsApi {
  readonly rowRequest: RowRequest;
  /** Οι γραμμές που ζητούνται **τώρα** με ένα πάτημα — για το «Ζήτησε όλα». */
  readonly requestable: readonly ChecklistRow[];
  readonly requestAll: () => void;
}

export function useDocumentRequests(
  door: CaseFileTarget,
  panel: CaseDocumentRequests,
  rows: readonly ChecklistRow[],
  onChanged: () => void,
): DocumentRequestsApi {
  const post = useCallback((itemIds: readonly string[]) => requestCaseDocumentsRequest(door, itemIds), [door]);
  const { log, requestingIds, send } = useDocumentRequestSend(post, panel.log, panel.today, onChanged);
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
