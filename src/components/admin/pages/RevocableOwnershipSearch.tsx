'use client';

/**
 * @fileoverview **Ανάκληση επαληθευμένης κατοχής** (ADR-900 §8 #2, Β3) — η δεύτερη καρτέλα της ουράς
 * `/admin/ownership-verifications`.
 * @module components/admin/pages/RevocableOwnershipSearch
 *
 * Ο διαχειριστής βρίσκει την απόδειξη με **ακριβή** ΚΑΕΚ ή id αγγελίας (ποτέ ελεύθερο κείμενο — η ουρά δείχνει
 * ιδιοκτήτες όλων), διαλέγει **λόγο από κλειστό σύνολο** (Radix Select, ADR-001) και επιβεβαιώνει. Η επιβεβαίωση
 * λέει **πριν** την πράξη τι θα γίνει στη δημόσια μονάδα: μόνο λόγος που ρίχνει την απόδειξη μπορεί να την
 * αποσύρει (UPRN · Zillow).
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EnumSelect } from '@/components/ui/enum-select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { ApiClientError } from '@/lib/api/api-client-types';
import { formatDate } from '@/lib/intl-formatting';
import {
  OWNERSHIP_NS,
  REVOCATION_ADMIN_KEYS,
  REVOCATION_REASON_KEYS,
  REVOKE_ERROR_KEYS,
  revokeErrorCodeOf,
  type RevokeErrorCode,
} from '@/components/owner-property/ownership-verification-labels';
import type { RevocableOwnershipItem } from '@/services/ownership/ownership-verification-review.service';
import { ClaimantHeader, KaekTerm } from './OwnershipClaimParts';
import {
  ADMIN_REVOCATION_REASONS,
  REVOCATION_REASONS_VOIDING_EVIDENCE,
  type AdminRevocationReason,
} from '@/types/ownership-verification';

const LIST_URL = '/api/admin/ownership-verifications';

type SearchState =
  | { readonly state: 'idle' }
  | { readonly state: 'loading' }
  | { readonly state: 'malformed' }
  | { readonly state: 'failed' }
  | { readonly state: 'ready'; readonly items: ReadonlyArray<RevocableOwnershipItem> };

/** `ownp_*` ⇒ αγγελία· οτιδήποτε άλλο ⇒ ΚΑΕΚ (ο διακομιστής τον κανονικοποιεί ή τον αρνείται). */
function searchUrlOf(query: string): string {
  const key = query.startsWith('ownp_') ? 'ownerPropertyId' : 'kaek';
  return `${LIST_URL}?${key}=${encodeURIComponent(query)}`;
}

function useRevocableSearch(): { readonly result: SearchState; readonly run: (query: string) => void } {
  const [result, setResult] = React.useState<SearchState>({ state: 'idle' });
  const run = React.useCallback((query: string) => {
    const trimmed = query.trim();
    if (trimmed === '') return;
    setResult({ state: 'loading' });
    apiClient
      .get<{ revocable: RevocableOwnershipItem[] }>(searchUrlOf(trimmed))
      .then((body) => setResult({ state: 'ready', items: body.revocable }))
      .catch((error: unknown) =>
        setResult({ state: error instanceof ApiClientError && error.statusCode === 400 ? 'malformed' : 'failed' }),
      );
  }, []);
  return { result, run };
}

function RevocableCard({ item, onRevoked }: {
  readonly item: RevocableOwnershipItem;
  readonly onRevoked: () => void;
}): React.ReactElement {
  const { t } = useTranslation([OWNERSHIP_NS, 'admin']);
  const [reason, setReason] = React.useState<AdminRevocationReason>('evidence-invalid');
  const [note, setNote] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [failure, setFailure] = React.useState<RevokeErrorCode | null>(null);
  const reasonId = React.useId();
  const noteId = React.useId();

  const revoke = async () => {
    setBusy(true);
    setFailure(null);
    try {
      await apiClient.post(LIST_URL, { verificationId: item.id, decision: 'revoke', reason, note: note.trim() || null });
      setOpen(false);
      onRevoked();
    } catch (error) {
      const body = error instanceof ApiClientError ? error.errorBody : null;
      const wire = typeof body === 'object' && body !== null ? (body as { reason?: unknown }).reason : undefined;
      setFailure(revokeErrorCodeOf(wire));
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
      <ClaimantHeader
        item={item}
        level="h3"
        aside={
          <p className="m-0 text-sm text-muted-foreground">
            {t(item.status === 'verified' ? REVOCATION_ADMIN_KEYS.statusVerified : REVOCATION_ADMIN_KEYS.statusSuperseded)}
            {item.decidedAt !== null && <> · <time dateTime={item.decidedAt}>{formatDate(item.decidedAt)}</time></>}
          </p>
        }
      />
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <KaekTerm kaek={item.kaek} />
      </dl>
      <Label htmlFor={reasonId}>{t(REVOCATION_ADMIN_KEYS.revoke)}</Label>
      <EnumSelect
        id={reasonId}
        value={reason}
        onValueChange={setReason}
        values={ADMIN_REVOCATION_REASONS}
        getLabel={(value) => t(REVOCATION_REASON_KEYS[value])}
        disabled={busy}
      />
      <Label htmlFor={noteId}>{t('admin:ownershipVerifications.note')}</Label>
      <textarea id={noteId} value={note} onChange={(event) => setNote(event.target.value)} rows={2}
        className="rounded-md border border-border bg-background p-2 text-sm text-foreground" />
      <footer className="flex flex-wrap gap-2">
        <Button type="button" variant="destructive" disabled={busy} onClick={() => setOpen(true)}>
          {t(REVOCATION_ADMIN_KEYS.revoke)}
        </Button>
      </footer>
      {failure !== null && <p role="alert" className="m-0 text-sm text-foreground">{t(REVOKE_ERROR_KEYS[failure])}</p>}
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        variant="destructive"
        title={t(REVOCATION_ADMIN_KEYS.confirmTitle)}
        description={t(REVOCATION_ADMIN_KEYS.confirmBody, {
          reason: t(REVOCATION_REASON_KEYS[reason]),
          unit: t(REVOCATION_REASONS_VOIDING_EVIDENCE.has(reason) ? REVOCATION_ADMIN_KEYS.unitWillRetire : REVOCATION_ADMIN_KEYS.unitStays),
        })}
        confirmText={t(REVOCATION_ADMIN_KEYS.revoke)}
        loading={busy}
        onConfirm={revoke}
      />
    </article>
  );
}

export function RevocableOwnershipSearch(): React.ReactElement {
  const { t } = useTranslation([OWNERSHIP_NS]);
  const { result, run } = useRevocableSearch();
  const [query, setQuery] = React.useState('');
  const [lastQuery, setLastQuery] = React.useState('');
  const queryId = React.useId();
  const search = (value: string) => {
    setLastQuery(value);
    run(value);
  };

  return (
    <section className="flex flex-col gap-4">
      <form
        role="search"
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          search(query);
        }}
      >
        <Label htmlFor={queryId}>{t(REVOCATION_ADMIN_KEYS.searchLabel)}</Label>
        <p className="m-0 text-sm text-muted-foreground">{t(REVOCATION_ADMIN_KEYS.searchHint)}</p>
        <fieldset className="m-0 flex gap-2 border-0 p-0">
          <Input id={queryId} value={query} onChange={(event) => setQuery(event.target.value)} autoComplete="off" />
          <Button type="submit" disabled={query.trim() === '' || result.state === 'loading'}>
            {t(REVOCATION_ADMIN_KEYS.search)}
          </Button>
        </fieldset>
      </form>
      {result.state === 'malformed' && <p role="alert" className="m-0 text-sm text-foreground">{t(REVOCATION_ADMIN_KEYS.searchMalformed)}</p>}
      {result.state === 'failed' && <p role="alert" className="m-0 text-sm text-foreground">{t(REVOKE_ERROR_KEYS.UNAVAILABLE)}</p>}
      {result.state === 'ready' && result.items.length === 0 && (
        <p className="m-0 text-sm text-muted-foreground">{t(REVOCATION_ADMIN_KEYS.noResults)}</p>
      )}
      {result.state === 'ready' &&
        result.items.map((item) => <RevocableCard key={item.id} item={item} onRevoked={() => search(lastQuery)} />)}
    </section>
  );
}
