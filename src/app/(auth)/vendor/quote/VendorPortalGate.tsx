'use client';

/**
 * **Η είσοδος της πύλης προμηθευτή** — σύνδεσμος από το fragment → δεδομένα με Bearer → φόρμα ή λόγος.
 *
 * 🔑 Η σελίδα **δεν** αποδίδεται πια στον server με τα δεδομένα της πρόσκλησης: ο server δεν βλέπει
 * ποτέ το διαπιστευτήριο (ζει στο `#…`, ADR-876 §5). Γι' αυτό φορτώνει εδώ, μία φορά, από το
 * `GET /api/vendor/quote` — που περνά από την **ίδια** πόρτα και τον **ίδιο** αναλυτή με κάθε άλλη
 * πράξη (ανάκληση ελεγμένη παντού, Ε5).
 *
 * @module app/(auth)/vendor/quote/VendorPortalGate
 * @enterprise ADR-876 §5
 */

import { useCallback, useEffect, useState } from 'react';

import { AuthCardSection } from '@/components/ui/auth-card-section';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import type { VendorPortalView } from './types';
import { useVendorPortalLink } from './useVendorPortalLink';
import { VendorPortalClient } from './VendorPortalClient';
import { VendorPortalErrorState } from './VendorPortalErrorState';
import { vendorPortalFailureOf, vendorPortalFetch, type VendorPortalFailure } from './vendor-portal-api';

type LoadState =
  | { readonly phase: 'loading' }
  | { readonly phase: 'failed'; readonly reason: VendorPortalFailure }
  | { readonly phase: 'ready'; readonly view: VendorPortalView };

interface PortalView {
  readonly state: LoadState;
  /**
   * Ξαναδιάβασε την όψη **μετά από πράξη** (ADR-876 §5 Σ16): η υποβολή αλλάζει προσφορά και ρήματα,
   * και ο client ΔΕΝ τα μαντεύει. Σιωπηλά — η τρέχουσα όψη μένει ώσπου να έρθει η νέα.
   */
  readonly revalidate: () => void;
}

const LOADING: LoadState = { phase: 'loading' };

/** Η όψη **μαζί με τον σύνδεσμο που τη φόρτωσε** — άλλος σύνδεσμος ⇒ ποτέ η παλιά όψη (ADR-876 §5 Σ18). */
interface LoadedView {
  readonly token: string;
  readonly state: LoadState;
}

function usePortalView(token: string | null): PortalView {
  const [loaded, setLoaded] = useState<LoadedView | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await vendorPortalFetch(token, { method: 'GET' });
        const next: LoadState = res.ok
          ? { phase: 'ready', view: ((await res.json()) as { data: VendorPortalView }).data }
          : { phase: 'failed', reason: await vendorPortalFailureOf(res) };
        if (!cancelled) setLoaded({ token, state: next });
      } catch {
        if (!cancelled) setLoaded({ token, state: { phase: 'failed', reason: 'server_error' } });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, revision]);
  const revalidate = useCallback(() => setRevision((current) => current + 1), []);
  const state = loaded && loaded.token === token ? loaded.state : LOADING;
  return { state, revalidate };
}

function Loading() {
  const { t } = useTranslation(['vendor-portal']);
  return (
    <AuthCardSection gap={4}>
      <p className="m-0 text-sm text-card-foreground" role="status" aria-live="polite">
        {t('vendor-portal:page.loading')}
      </p>
    </AuthCardSection>
  );
}

export function VendorPortalGate() {
  const link = useVendorPortalLink();
  const token = link.phase === 'ready' ? link.token : null;
  const { state: load, revalidate } = usePortalView(token);

  if (link.phase === 'missing') return <VendorPortalErrorState reason="missing_link" token={null} />;
  if (link.phase === 'reading' || load.phase === 'loading') return <Loading />;
  if (load.phase === 'failed') return <VendorPortalErrorState reason={load.reason} token={token} />;
  return (
    <VendorPortalClient
      key={link.token}
      token={link.token}
      initialData={{ invite: load.view.invite, rfq: load.view.rfq }}
      initialQuote={load.view.quote}
      initialIntent={link.intent}
      onSubmitted={revalidate}
    />
  );
}
