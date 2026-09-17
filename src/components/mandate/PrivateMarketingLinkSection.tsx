'use client';

/**
 * @fileoverview **Η ΚΛΕΙΣΤΗ ΔΙΑΘΕΣΗ ΣΤΟΝ ΣΥΝΔΕΣΜΟ ΤΟΥ ΙΔΙΟΚΤΗΤΗ** — συναίνεση σε αίτημα, ή ανάκληση (ADR-864 Ε-11 · Ε-13).
 * @related app/(auth)/mandate/[token]/page.tsx · app/api/mandate/[token]/route.ts
 * @module components/mandate/PrivateMarketingLinkSection
 *
 * 🔑 **Ό,τι αποφασίζει, το αποφάσισε ο διακομιστής**: αν υπάρχει αίτημα (και ποιο — Α19), ποιο κείμενο
 * ισχύει, με ποιες τιμές. Η ενότητα απλώς ρωτά τον άνθρωπο και στέλνει πίσω **τι του έδειξε**.
 *
 * ⚠️ Η ανάκληση προσφέρει **δύο** ρητές εκβάσεις — δημόσια (πρώτη) **ή** απόσυρση — ποτέ «σκέτη
 * ανάκληση» που θα άφηνε τη διάθεση κλειστή χωρίς συναίνεση (Ε-13).
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { refusalOf } from '@/lib/http/response-refusal';
import type { LegalDocumentVersion } from '@/lib/legal/legal-document-versions';
import type { ConsentSubmission } from '@/lib/mandate/private-marketing-consent-text';
import {
  PRIVATE_MARKETING_REFUSALS,
  type ConsentPlaceholderValues,
  type PrivateMarketingRevocationOutcome,
} from '@/types/private-marketing-consent';

import { PrivateMarketingConsentForm, type PartySubmission } from './PrivateMarketingConsentForm';

const NS = 'property-market';
const K = `${NS}:mandate.privateMarketing`;

/** Κωδικοί με **δικό τους** κείμενο εδώ· ό,τι άλλο είναι λόγος συνδέσμου (`mandate.consent.reason`). */
const OWN_REASONS = [...PRIVATE_MARKETING_REFUSALS, 'private-marketing-consent-missing'] as const;
const LINK_REASONS = ['link-invalid', 'link-expired', 'listing-absent', 'not-brokered', 'client-mismatch', 'superseded', 'service-unavailable'] as const;

export interface PrivateMarketingLinkView {
  readonly token: string;
  /** Το εκκρεμές αίτημα — `null` όταν δεν υπάρχει τίποτα να εκτελεστεί. */
  readonly requestId: string | null;
  /** Η διάθεση είναι ήδη κλειστή ⇒ προσφέρεται ανάκληση. */
  readonly closed: boolean;
  readonly version: LegalDocumentVersion | null;
  readonly values: ConsentPlaceholderValues;
}

type Phase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'sending' }
  | { readonly kind: 'done'; readonly what: 'granted' | 'revoked' | 'declined' }
  | { readonly kind: 'failed'; readonly key: string };

function failureKey(body: unknown): string {
  const own = refusalOf(body, OWN_REASONS);
  if (own !== null) return `${K}.reason.${own}`;
  const link = refusalOf(body, LINK_REASONS);
  return `${NS}:mandate.consent.reason.${link ?? 'write-failed'}`;
}

async function post(token: string, privateMarketing: object): Promise<Phase> {
  try {
    const response = await fetch(`/api/mandate/${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ privateMarketing }),
    });
    if (response.ok) return { kind: 'idle' };
    return { kind: 'failed', key: failureKey(await response.json().catch(() => null)) };
  } catch {
    return { kind: 'failed', key: `${NS}:mandate.consent.reason.write-failed` };
  }
}

export function PrivateMarketingLinkSection({ view }: { readonly view: PrivateMarketingLinkView }): React.ReactElement | null {
  const { t } = useTranslation([NS]);
  const [phase, setPhase] = React.useState<Phase>({ kind: 'idle' });
  const headingId = React.useId();

  const run = async (what: 'granted' | 'revoked' | 'declined', privateMarketing: object): Promise<void> => {
    setPhase({ kind: 'sending' });
    const result = await post(view.token, privateMarketing);
    setPhase(result.kind === 'idle' ? { kind: 'done', what } : result);
  };

  const grant = (submissions: readonly PartySubmission[]): void => {
    const submission: ConsentSubmission | undefined = submissions[0]?.submission;
    if (submission !== undefined) void run('granted', { action: 'grant', requestId: view.requestId, submission });
  };
  const revoke = (outcome: PrivateMarketingRevocationOutcome): void => void run('revoked', { action: 'revoke', outcome });
  const decline = (requestId: string): void => void run('declined', { action: 'decline', requestId });

  if (phase.kind === 'done') {
    // ⚠️ Ρητά `t()`, όχι `${K}.${phase.what}`: το δυναμικό πρόθεμα έσερνε ΟΛΟ το `mandate.privateMarketing.*` στο slice (CHECK 3.34).
    const doneText = phase.what === 'granted' ? t(`${K}.granted`) : phase.what === 'revoked' ? t(`${K}.revoked`) : t(`${K}.declinedDone`);
    return <p role="status" className="text-sm font-medium text-card-foreground">{doneText}</p>;
  }
  if (view.requestId === null && !view.closed) return null;

  const busy = phase.kind === 'sending';
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4 border-t border-border pt-4">
      <h2 id={headingId} className="text-base font-semibold text-card-foreground">{t(`${K}.title`)}</h2>
      {phase.kind === 'failed' && <p role="alert" className="text-sm font-medium text-destructive">{t(phase.key)}</p>}

      {view.requestId !== null && view.version !== null && (
        <PrivateMarketingConsentForm version={view.version} parties={[{ key: 'link', values: view.values }]} busy={busy} onSubmit={grant} />
      )}

      {view.requestId !== null && (
        <footer className="flex flex-col gap-1">
          <Button type="button" variant="outline" className="self-start" disabled={busy} onClick={() => view.requestId !== null && decline(view.requestId)}>
            {t(`${K}.decline`)}
          </Button>
          <p className="text-sm text-muted-foreground">{t(`${K}.declineExplain`)}</p>
        </footer>
      )}

      {view.closed && (
        <footer className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">{t(`${K}.revokeExplain`)}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={busy} onClick={() => revoke('public')}>{t(`${K}.revokePublic`)}</Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => revoke('withdrawn')}>
              {t(`${K}.revokeWithdraw`)}
            </Button>
          </div>
        </footer>
      )}
    </section>
  );
}
