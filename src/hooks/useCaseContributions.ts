'use client';

/**
 * ADR-901 Φ4.4 — οι ενέργειες transmittal του επαγγελματία: **αποστολή** και **απόσυρση**.
 *
 * - **Απόσυρση = αισιόδοξη** (Gmail «Undo»): το αρχείο κρύβεται αμέσως από τη γραμμή (`withdrawingIds`) και
 *   **επανέρχεται** αν ο server αρνηθεί. Η όψη ξαναδιαβάζεται στο παρασκήνιο για την τελική κατάσταση.
 * - **Αποστολή = ρητή επιβεβαίωση**: η γραμμή δείχνει «Αποστέλλεται…» (`sendingItemId`) — η κατάσταση της γραμμής
 *   (`uploaded` κ.λπ.) την **παράγει ο server**, ο client δεν τη μαντεύει.
 * - **Νέα έκδοση στους ίδιους** (Φ4.5): ένα πάτημα, χωρίς διάλογο — ποια έκδοση φεύγει το αποφασίζει ο server (κεφαλή
 *   της στοίβας). Η γραμμή δείχνει «Αποστέλλεται…» (`reissuingIds`) ως την ανανέωση της όψης.
 * - Ένα αίτημα τη φορά ανά ενέργεια: δεύτερο κλικ όσο τρέχει το πρώτο δεν στέλνει δεύτερο (και ο server είναι
 *   ιδεμποτής έτσι κι αλλιώς — ADR-872 + ίδια έκδοση ⇒ `already-issued`).
 *
 * @module hooks/useCaseContributions
 */

import { useCallback, useRef, useState } from 'react';
import {
  contributionRejectionOf,
  issueContributionRequest,
  reissueContributionRequest,
  withdrawContributionRequest,
  type ContributionRejection,
  type ContributionRequest,
} from '@/services/conveyance/conveyance-engagement-gateway';

export type ContributionActionOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: ContributionRejection | 'failed' };

interface CaseContributionsApi {
  readonly sendingItemId: string | null;
  readonly withdrawingIds: ReadonlySet<string>;
  readonly transmit: (request: ContributionRequest) => Promise<ContributionActionOutcome>;
  readonly withdraw: (contributionId: string) => Promise<ContributionActionOutcome>;
  readonly reissuingIds: ReadonlySet<string>;
  readonly reissue: (contributionId: string) => Promise<ContributionActionOutcome>;
}

function failureOf(error: unknown): ContributionActionOutcome {
  return { ok: false, reason: contributionRejectionOf(error) ?? 'failed' };
}

/** Φ4.5 — «Στείλε τη νέα έκδοση στους ίδιους»: ένα πάτημα ανά αποστολή, ο server διαλέγει την έκδοση. */
function useReissue(engagementId: string, onChanged: () => void) {
  const [reissuingIds, setReissuingIds] = useState<ReadonlySet<string>>(new Set());
  const reissue = useCallback(async (contributionId: string): Promise<ContributionActionOutcome> => {
    setReissuingIds((ids) => new Set([...ids, contributionId]));
    try {
      await reissueContributionRequest(engagementId, contributionId);
      onChanged();
      return { ok: true };
    } catch (error) {
      return failureOf(error);
    } finally {
      setReissuingIds((ids) => new Set([...ids].filter((id) => id !== contributionId)));
    }
  }, [engagementId, onChanged]);
  return { reissuingIds, reissue };
}

export function useCaseContributions(engagementId: string, onChanged: () => void): CaseContributionsApi {
  const [sendingItemId, setSendingItemId] = useState<string | null>(null);
  const [withdrawingIds, setWithdrawingIds] = useState<ReadonlySet<string>>(new Set());
  const busy = useRef(false);

  const transmit = useCallback(async (request: ContributionRequest): Promise<ContributionActionOutcome> => {
    if (busy.current) return { ok: false, reason: 'failed' };
    busy.current = true;
    setSendingItemId(request.checklistItemId);
    try {
      await issueContributionRequest(engagementId, request);
      onChanged();
      return { ok: true };
    } catch (error) {
      return failureOf(error);
    } finally {
      busy.current = false;
      setSendingItemId(null);
    }
  }, [engagementId, onChanged]);

  const withdraw = useCallback(async (contributionId: string): Promise<ContributionActionOutcome> => {
    setWithdrawingIds((ids) => new Set([...ids, contributionId]));
    try {
      await withdrawContributionRequest(engagementId, contributionId);
      onChanged();
      return { ok: true };
    } catch (error) {
      // Επαναφορά της αισιόδοξης απόκρυψης — το αρχείο ξαναφαίνεται εκεί που ήταν.
      setWithdrawingIds((ids) => new Set([...ids].filter((id) => id !== contributionId)));
      return failureOf(error);
    }
  }, [engagementId, onChanged]);

  const { reissuingIds, reissue } = useReissue(engagementId, onChanged);

  return { sendingItemId, withdrawingIds, transmit, withdraw, reissuingIds, reissue };
}
