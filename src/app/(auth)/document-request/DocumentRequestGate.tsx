'use client';

/**
 * @fileoverview ADR-915 §28 — **η είσοδος της σελίδας-συνδέσμου**: σύνδεσμος από το fragment → όψη με Bearer → κάρτα
 *   απάντησης ή λόγος.
 * @related DocumentRequestCard.tsx (η απάντηση) · document-request-api.ts · lib/tokens/useFragmentCredential.ts
 * @module app/(auth)/document-request/DocumentRequestGate
 *
 * 🔑 Ο server **δεν** βλέπει ποτέ το διαπιστευτήριο (ζει στο `#…`): η σελίδα φορτώνει εδώ, μία φορά, από το
 *    `GET /api/issuance-link` — την **ίδια** πόρτα με την απάντηση.
 * 🔑 §29 — σύνδεσμος με κωδικό ⇒ πρώτα το βήμα του κωδικού (μόνο «Για» · γραφείο), μετά η κάρτα· ο κωδικός μένει στη
 *    μνήμη της σελίδας και συνοδεύει την απάντηση.
 * 🔑 Κάθε άρνηση **λέγεται με όνομα** — «έληξε», «αντικαταστάθηκε από νεότερο», «απαντήθηκε ήδη» είναι τρία
 *    διαφορετικά πράγματα για τον άνθρωπο, όχι ένα «άκυρος σύνδεσμος».
 */

import { useCallback, useEffect, useState } from 'react';

import { AuthCardSection } from '@/components/ui/auth-card-section';
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🔴 ADR-744 §18 — ΤΟ SLICE ΤΗΣ ΔΙΑΔΡΟΜΗΣ, ΣΤΑΤΙΚΑ ΚΑΙ ΣΕ ΕΜΒΕΛΕΙΑ MODULE (ίδιο με την πύλη προμηθευτή): χωρίς αυτό το
//    πρώτο καρέ θα έγραφε ωμά κλειδιά σε άνθρωπο που μόλις ήρθε από email. ⚠️ ΠΟΤΕ `import()` · ΠΟΤΕ στο `page.tsx`.
import routeSlice from '@/i18n/generated/routes/document-request.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';
import { DOCUMENT_REQUEST_STORAGE_KEY, noDocumentRequestExtras } from '@/lib/document-validity/document-request-link';
import { useFragmentCredential } from '@/lib/tokens/useFragmentCredential';
import type { IssuanceLinkLanding, IssuanceLinkView } from '@/types/issuance-invitation';

import { DocumentRequestCard } from './DocumentRequestCard';
import { DocumentRequestCodeStep } from './DocumentRequestCodeStep';
import { DocumentRequestFailureState } from './DocumentRequestFailureState';
import { fetchDocumentRequest, type DocumentRequestFailure } from './document-request-api';

registerRouteSlice(routeSlice);

type LoadState =
  | { readonly phase: 'loading' }
  | { readonly phase: 'failed'; readonly failure: DocumentRequestFailure }
  | { readonly phase: 'ready'; readonly landing: IssuanceLinkLanding };

/** Η όψη **μαζί με τον σύνδεσμο που τη φόρτωσε** — άλλος σύνδεσμος ⇒ ποτέ η παλιά όψη (ADR-876 §5 Σ18). */
function useRequestView(token: string | null): LoadState {
  const [loaded, setLoaded] = useState<{ readonly token: string; readonly state: LoadState } | null>(null);
  useEffect(() => {
    if (token === null) return;
    let cancelled = false;
    void fetchDocumentRequest(token).then((outcome) => {
      if (cancelled) return;
      setLoaded({ token, state: outcome.ok ? { phase: 'ready', landing: outcome.data } : { phase: 'failed', failure: outcome.failure } });
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

/** Η όψη που ξεκλείδωσε ο κωδικός (§29) — **με** τον σύνδεσμο που την ξεκλείδωσε: άλλος σύνδεσμος ⇒ ποτέ η παλιά. */
interface Unlocked {
  readonly token: string;
  readonly view: IssuanceLinkView;
  readonly accessCode: string;
}

export function DocumentRequestGate() {
  const link = useFragmentCredential(DOCUMENT_REQUEST_STORAGE_KEY, noDocumentRequestExtras);
  const token = link.phase === 'ready' ? link.token : null;
  const load = useRequestView(token);
  const [unlocked, setUnlocked] = useState<Unlocked | null>(null);
  const onUnlocked = useCallback((view: IssuanceLinkView, accessCode: string) => {
    if (token !== null) setUnlocked({ token, view, accessCode });
  }, [token]);
  if (link.phase === 'missing') return <DocumentRequestFailureState failure="missing-link" />;
  if (link.phase === 'reading' || load.phase === 'loading') return <Loading />;
  if (load.phase === 'failed') return <DocumentRequestFailureState failure={load.failure} />;
  const { landing } = load;
  if (landing.access === 'open') return <DocumentRequestCard key={link.token} token={link.token} view={landing.view} accessCode={null} />;
  if (unlocked !== null && unlocked.token === link.token) {
    return <DocumentRequestCard key={link.token} token={link.token} view={unlocked.view} accessCode={unlocked.accessCode} />;
  }
  return <DocumentRequestCodeStep key={link.token} token={link.token} gate={landing.gate} onUnlocked={onUnlocked} />;
}
