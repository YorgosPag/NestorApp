'use client';

/**
 * useDiagnosticsQuery — ADR-366 §C.7.Q2
 *
 * Subscribes to the `performance_diagnostics` collection windowed to the
 * last 30 days, ordered by `createdAt` desc. Super-admin global view
 * (tenantOverride='skip') — admins see all tenants' submissions.
 *
 * Equality guard is provided by FirestoreQueryService.subscribe (ADR-361),
 * so consumers don't need a separate hash-compare layer.
 *
 * @module admin/bim-diagnostics/hooks/useDiagnosticsQuery
 */

import { useEffect, useState } from 'react';
import { Timestamp, orderBy, where } from 'firebase/firestore';
import { firestoreQueryService } from '@/services/firestore';
import type { PerformanceDiagnostic } from '@/types/performance-diagnostic';

const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export interface DiagnosticsQueryState {
  rows: PerformanceDiagnostic[];
  loading: boolean;
  error: Error | null;
}

const INITIAL_STATE: DiagnosticsQueryState = {
  rows: [],
  loading: true,
  error: null,
};

export function useDiagnosticsQuery(enabled = true): DiagnosticsQueryState {
  const [state, setState] = useState<DiagnosticsQueryState>(INITIAL_STATE);

  useEffect(() => {
    if (!enabled) {
      setState(INITIAL_STATE);
      return;
    }

    const cutoff = Timestamp.fromMillis(Date.now() - WINDOW_MS);
    const unsub = firestoreQueryService.subscribe<PerformanceDiagnostic>(
      'PERFORMANCE_DIAGNOSTICS',
      (res) => {
        setState({
          rows: res.documents as PerformanceDiagnostic[],
          loading: false,
          error: null,
        });
      },
      (error) => {
        setState({ rows: [], loading: false, error });
      },
      {
        constraints: [where('createdAt', '>=', cutoff), orderBy('createdAt', 'desc')],
        tenantOverride: 'skip',
      },
    );

    return unsub;
  }, [enabled]);

  return state;
}
