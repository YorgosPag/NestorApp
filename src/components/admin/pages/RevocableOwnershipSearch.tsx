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

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EnumSelect } from '@/components/ui/enum-select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
    <Card asChild className="flex flex-col gap-3 p-4">
      <article>
        <ClaimantHeader
          item={item}
          // `h2`: η κάρτα κρέμεται κατευθείαν από το `h1` της σελίδας — η καρτέλα δεν έχει δική της κεφαλίδα (WCAG 1.3.1).
          level="h2"
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
        <Label htmlFor={reasonId}>{t(REVOCATION_ADMIN_KEYS.reasonFieldLabel)}</Label>
        <EnumSelect
          id={reasonId}
          value={reason}
          onValueChange={setReason}
          values={ADMIN_REVOCATION_REASONS}
          getLabel={(value) => t(REVOCATION_REASON_KEYS[value])}
          disabled={busy}
        />
        <Label htmlFor={noteId}>{t('admin:ownershipVerifications.note')}</Label>
        <Textarea id={noteId} value={note} onChange={(event) => setNote(event.target.value)} size="sm" rows={2} disabled={busy} />
        <footer className="flex flex-wrap gap-2">
          <Button type="button" variant="destructive" disabled={busy} onClick={() => setOpen(true)}>
            {t(REVOCATION_ADMIN_KEYS.revoke)}
          </Button>
        </footer>
        {failure !== null && (
          <Alert variant="destructive" withIcon><AlertDescription>{t(REVOKE_ERROR_KEYS[failure])}</AlertDescription></Alert>
        )}
        <ConfirmDialog
          open={open}
          // Όσο τρέχει η ανάκληση ο διάλογος ΜΕΝΕΙ (ένδειξη προόδου στο κουμπί)· Esc/έξω-κλικ δεν τον κλείνουν.
          onOpenChange={(next) => { if (!busy) setOpen(next); }}
          keepOpenWhilePending
          variant="destructive"
          title={t(REVOCATION_ADMIN_KEYS.confirmTitle)}
          description={t(REVOCATION_ADMIN_KEYS.confirmBody, {
            reason: t(REVOCATION_REASON_KEYS[reason]),
            unit: t(REVOCATION_REASONS_VOIDING_EVIDENCE.has(reason) ? REVOCATION_ADMIN_KEYS.unitWillRetire : REVOCATION_ADMIN_KEYS.unitStays),
          })}
          confirmText={t(REVOCATION_ADMIN_KEYS.revoke)}
          loading={busy}
          onConfirm={revoke}
        >
          {/* ΠΟΙΑΝ αφορά — δεδομένα, όχι λέξεις: με δύο κάρτες στον ίδιο ΚΑΕΚ ο τίτλος μόνος δεν το λέει. */}
          <section className="flex flex-col gap-1 text-sm">
            <p className="m-0 font-semibold text-foreground">{item.claimantName} · …{item.claimantTaxIdLast3}</p>
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <KaekTerm kaek={item.kaek} />
            </dl>
          </section>
        </ConfirmDialog>
      </article>
    </Card>
  );
}

export function RevocableOwnershipSearch(): React.ReactElement {
  const { t } = useTranslation([OWNERSHIP_NS]);
  const { result, run } = useRevocableSearch();
  const [query, setQuery] = React.useState('');
  const [lastQuery, setLastQuery] = React.useState('');
  const queryId = React.useId();
  const hintId = React.useId();
  const errorId = React.useId();
  const malformed = result.state === 'malformed';
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
        <p id={hintId} className="m-0 text-sm text-muted-foreground">{t(REVOCATION_ADMIN_KEYS.searchHint)}</p>
        <fieldset className="m-0 flex gap-2 border-0 p-0">
          <Input
            id={queryId}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
            aria-invalid={malformed}
            aria-describedby={malformed ? `${hintId} ${errorId}` : hintId}
          />
          <Button type="submit" disabled={query.trim() === '' || result.state === 'loading'}>
            {t(REVOCATION_ADMIN_KEYS.search)}
          </Button>
        </fieldset>
      </form>
      {malformed && (
        <Alert id={errorId} variant="destructive" withIcon><AlertDescription>{t(REVOCATION_ADMIN_KEYS.searchMalformed)}</AlertDescription></Alert>
      )}
      {result.state === 'failed' && (
        <Alert variant="destructive" withIcon><AlertDescription>{t(REVOKE_ERROR_KEYS.UNAVAILABLE)}</AlertDescription></Alert>
      )}
      {result.state === 'ready' && result.items.length === 0 && (
        <p className="m-0 text-sm text-muted-foreground">{t(REVOCATION_ADMIN_KEYS.noResults)}</p>
      )}
      {result.state === 'ready' &&
        result.items.map((item) => <RevocableCard key={item.id} item={item} onRevoked={() => search(lastQuery)} />)}
    </section>
  );
}
