'use client';

/**
 * @fileoverview ADR-915 §28 — **η είσοδος της σελίδας-συνδέσμου**: σύνδεσμος από το fragment → όψη με Bearer → κάρτα
 *   απάντησης ή λόγος.
 * @related DocumentRequestCard.tsx (η απάντηση) · document-request-api.ts · lib/tokens/useFragmentCredential.ts
 * @module app/(auth)/document-request/DocumentRequestGate
 *
 * 🔑 Ο server **δεν** βλέπει ποτέ το διαπιστευτήριο (ζει στο `#…`): η σελίδα φορτώνει εδώ, μία φορά, από το
 *    `GET /api/issuance-link` — την **ίδια** πόρτα με την απάντηση.
 * 🔑 Κάθε άρνηση **λέγεται με όνομα** — «έληξε», «αντικαταστάθηκε από νεότερο», «απαντήθηκε ήδη» είναι τρία
 *    διαφορετικά πράγματα για τον άνθρωπο, όχι ένα «άκυρος σύνδεσμος».
 */

import { useEffect, useState } from 'react';

import { AuthCardSection } from '@/components/ui/auth-card-section';
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🔴 ADR-744 §18 — ΤΟ SLICE ΤΗΣ ΔΙΑΔΡΟΜΗΣ, ΣΤΑΤΙΚΑ ΚΑΙ ΣΕ ΕΜΒΕΛΕΙΑ MODULE (ίδιο με την πύλη προμηθευτή): χωρίς αυτό το
//    πρώτο καρέ θα έγραφε ωμά κλειδιά σε άνθρωπο που μόλις ήρθε από email. ⚠️ ΠΟΤΕ `import()` · ΠΟΤΕ στο `page.tsx`.
import routeSlice from '@/i18n/generated/routes/document-request.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';
import { DOCUMENT_REQUEST_STORAGE_KEY, noDocumentRequestExtras } from '@/lib/document-validity/document-request-link';
import { useFragmentCredential } from '@/lib/tokens/useFragmentCredential';
import type { IssuanceLinkView } from '@/types/issuance-invitation';

import { DocumentRequestCard } from './DocumentRequestCard';
import { DocumentRequestFailureState } from './DocumentRequestFailureState';
import { fetchDocumentRequest, type DocumentRequestFailure } from './document-request-api';

registerRouteSlice(routeSlice);

type LoadState =
  | { readonly phase: 'loading' }
  | { readonly phase: 'failed'; readonly failure: DocumentRequestFailure }
  | { readonly phase: 'ready'; readonly view: IssuanceLinkView };

/** Η όψη **μαζί με τον σύνδεσμο που τη φόρτωσε** — άλλος σύνδεσμος ⇒ ποτέ η παλιά όψη (ADR-876 §5 Σ18). */
function useRequestView(token: string | null): LoadState {
  const [loaded, setLoaded] = useState<{ readonly token: string; readonly state: LoadState } | null>(null);
  useEffect(() => {
    if (token === null) return;
    let cancelled = false;
    void fetchDocumentRequest(token).then((outcome) => {
      if (cancelled) return;
      setLoaded({ token, state: outcome.ok ? { phase: 'ready', view: outcome.data } : { phase: 'failed', failure: outcome.failure } });
    });
    return () => { cancelled = true; };
  }, [token]);
  return loaded !== null && loaded.token === token ? loaded.state : { phase: 'loading' };
}

function Loading() {
  const { t } = useTranslation(['document-request']);
  return (
    <AuthCardSection gap={2}>
      <p className="m-0 text-sm text-card-foreground" role="status" aria-live="polite">{t('document-request:page.loading')}</p>
    </AuthCardSection>
  );
}

export function DocumentRequestGate() {
  const link = useFragmentCredential(DOCUMENT_REQUEST_STORAGE_KEY, noDocumentRequestExtras);
  const token = link.phase === 'ready' ? link.token : null;
  const load = useRequestView(token);
  if (link.phase === 'missing') return <DocumentRequestFailureState failure="missing-link" />;
  if (link.phase === 'reading' || load.phase === 'loading') return <Loading />;
  if (load.phase === 'failed') return <DocumentRequestFailureState failure={load.failure} />;
  return <DocumentRequestCard key={link.token} token={link.token} view={load.view} />;
}
