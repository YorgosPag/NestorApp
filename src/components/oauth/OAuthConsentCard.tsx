'use client';

/**
 * Οθόνη συγκατάθεσης OAuth (ADR-738)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΑΥΤΗ Η ΟΘΟΝΗ ΕΙΝΑΙ ΑΜΥΝΑ, ΟΧΙ ΤΥΠΙΚΟΤΗΤΑ
 * ─────────────────────────────────────────────────────────────────────────────
 * Το ίδιο το πρότυπο παραδέχεται ότι το CIMD **δεν** εμποδίζει πλαστοπροσωπία
 * μέσω `localhost`: κακόβουλο πρόγραμμα δηλώνει το νόμιμο `client_id`, δεσμεύει
 * τοπικό port και εισπράττει τον code, ενώ ο χρήστης βλέπει το **νόμιμο**
 * όνομα. Η τεχνική άμυνα σταματά εκεί· η επόμενη είναι ο άνθρωπος. Γι' αυτό
 * εμφανίζονται ρητά:
 *
 * - το **hostname του redirect** («SHOULD display additional warnings for
 *   localhost-only redirect URIs», «MUST clearly display the redirect URI
 *   hostname»),
 * - η **ταυτότητα του client** ως ολόκληρο URL, ώστε ένα `claude.ai.evil.example`
 *   να φαίνεται,
 * - προειδοποίηση όταν το domain **δεν** είναι γνωστό.
 *
 * ⚠️ Καμία απόφαση δεν λαμβάνεται εδώ. Το κουμπί στέλνει **μόνο** το handle και
 * τη λέξη «approve»/«deny»· όλες οι παράμετροι είναι παγωμένες στον server. Το
 * UI δεν *μπορεί* να αλλάξει αυτό που εγκρίνεται.
 *
 * @module components/oauth/OAuthConsentCard
 * @see ADR-738 §4
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

// ============================================================================
// ΤΥΠΟΙ
// ============================================================================

interface ConsentRequestData {
  readonly clientName: string;
  readonly clientId: string;
  readonly clientUri: string | null;
  readonly redirectUri: string;
  readonly scopes: readonly string[];
  readonly isLoopbackRedirect: boolean;
  readonly isFamiliarClient: boolean;
}

type LoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly data: ConsentRequestData }
  | { readonly status: 'error'; readonly reason: string };

interface OAuthConsentCardProps {
  readonly requestHandle: string | null;
  /** Σφάλμα που ήρθε ως query param από το authorize endpoint. */
  readonly initialError: string | null;
}

// ============================================================================
// ΒΟΗΘΗΤΙΚΑ
// ============================================================================

/** `https://host/path` → `host` — για εμφάνιση, με ασφαλές fallback. */
function hostnameOf(raw: string): string {
  try {
    return new URL(raw).host;
  } catch {
    return raw;
  }
}

const REASON_KEYS: Readonly<Record<string, string>> = {
  expired: 'oauthConsent.errorExpired',
  consumed: 'oauthConsent.errorConsumed',
  not_found: 'oauthConsent.errorNotFound',
  wrong_user: 'oauthConsent.errorWrongUser',
};

// ============================================================================
// COMPONENT
// ============================================================================

export function OAuthConsentCard({
  requestHandle,
  initialError,
}: OAuthConsentCardProps): React.ReactElement {
  const { t } = useTranslation(['auth']);
  const [state, setState] = useState<LoadState>(
    initialError !== null
      ? { status: 'error', reason: initialError }
      : { status: 'loading' },
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialError !== null || requestHandle === null) {
      if (initialError === null) setState({ status: 'error', reason: 'not_found' });
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(
          `/api/oauth/consent-request?request=${encodeURIComponent(requestHandle)}`,
          { credentials: 'include' },
        );
        const payload = (await response.json()) as {
          success: boolean;
          data?: ConsentRequestData;
          reason?: string;
        };

        if (cancelled) return;
        setState(
          payload.success && payload.data
            ? { status: 'ready', data: payload.data }
            : { status: 'error', reason: payload.reason ?? 'generic' },
        );
      } catch {
        if (!cancelled) setState({ status: 'error', reason: 'generic' });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [requestHandle, initialError]);

  const decide = useCallback(
    async (decision: 'approve' | 'deny') => {
      if (requestHandle === null) return;
      setSubmitting(true);

      try {
        const response = await fetch('/api/oauth/authorize', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ request: requestHandle, decision }),
        });
        const payload = (await response.json()) as { redirectTo?: string; reason?: string };

        if (typeof payload.redirectTo === 'string') {
          window.location.assign(payload.redirectTo);
          return;
        }
        setState({ status: 'error', reason: payload.reason ?? 'generic' });
      } catch {
        setState({ status: 'error', reason: 'generic' });
      } finally {
        setSubmitting(false);
      }
    },
    [requestHandle],
  );

  if (state.status === 'loading') {
    return (
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>{t('auth:oauthConsent.title')}</CardTitle>
          <CardDescription>{t('auth:oauthConsent.working')}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (state.status === 'error') {
    const key = REASON_KEYS[state.reason] ?? 'oauthConsent.errorGeneric';
    return (
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>{t('auth:oauthConsent.errorTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>{t(`auth:${key}`)}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const { data } = state;

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>{t('auth:oauthConsent.title')}</CardTitle>
        <CardDescription>
          {t('auth:oauthConsent.intro', { clientName: data.clientName })}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <section aria-labelledby="oauth-consent-scopes">
          <h3 id="oauth-consent-scopes" className="text-sm font-semibold">
            {t('auth:oauthConsent.scopesHeading')}
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {data.scopes.map((scope) => (
              <li key={scope}>
                {scope === 'boq:read'
                  ? t('auth:oauthConsent.scopeBoqRead')
                  : t('auth:oauthConsent.scopeUnknown', { scope })}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('auth:oauthConsent.readOnlyNotice')}
          </p>
        </section>

        <section aria-labelledby="oauth-consent-details">
          <h3 id="oauth-consent-details" className="text-sm font-semibold">
            {t('auth:oauthConsent.detailsHeading')}
          </h3>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex flex-wrap gap-2">
              <dt className="text-muted-foreground">{t('auth:oauthConsent.clientIdLabel')}</dt>
              <dd className="break-all font-mono">{data.clientId}</dd>
            </div>
            <div className="flex flex-wrap gap-2">
              <dt className="text-muted-foreground">{t('auth:oauthConsent.redirectLabel')}</dt>
              <dd className="break-all font-mono">{hostnameOf(data.redirectUri)}</dd>
            </div>
          </dl>
        </section>

        {!data.isFamiliarClient && (
          <Alert variant="destructive">
            <AlertDescription>{t('auth:oauthConsent.unknownClientWarning')}</AlertDescription>
          </Alert>
        )}

        {data.isLoopbackRedirect && (
          <Alert>
            <AlertDescription>{t('auth:oauthConsent.loopbackWarning')}</AlertDescription>
          </Alert>
        )}
      </CardContent>

      <CardFooter className="flex justify-end gap-2">
        <Button variant="outline" disabled={submitting} onClick={() => void decide('deny')}>
          {t('auth:oauthConsent.deny')}
        </Button>
        <Button disabled={submitting} onClick={() => void decide('approve')}>
          {submitting ? t('auth:oauthConsent.working') : t('auth:oauthConsent.approve')}
        </Button>
      </CardFooter>
    </Card>
  );
}
