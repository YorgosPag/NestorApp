'use client';

/**
 * @fileoverview **Η ουρά ελέγχου επαληθεύσεων κατοχής** (ADR-900 §3.8) — `/admin/ownership-verifications`.
 * @module components/admin/pages/OwnershipVerificationsPageContent
 *
 * Ο άνθρωπος βλέπει ό,τι η μηχανή **δεν** απέδειξε: τους κλειστούς λόγους, τον υπογράφοντα της σφραγίδας, το
 * ονοματεπώνυμο του λογαριασμού και τα 3 τελευταία ψηφία του ΑΦΜ. Ανοίγει το ΠΚΑ (σύνδεσμος 15′ με ίχνος),
 * συγκρίνει, και εγκρίνει ή απορρίπτει με σημείωση. FIFO: όποιος περιμένει περισσότερο, κρίνεται πρώτος.
 *
 * Δεύτερη καρτέλα (ADR-900 §8 #2 Β3): **ανάκληση** επαληθευμένης κατοχής — {@link RevocableOwnershipSearch}.
 */

import React from 'react';
import { ShieldCheck } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { formatDate } from '@/lib/intl-formatting';
import {
  OWNERSHIP_NS,
  REASON_KEYS,
  REVOCATION_ADMIN_KEYS,
} from '@/components/owner-property/ownership-verification-labels';
import { ClaimantHeader, KaekTerm } from './OwnershipClaimParts';
import { RevocableOwnershipSearch } from './RevocableOwnershipSearch';
import type { OwnershipReviewItem } from '@/services/ownership/ownership-verification-review.service';

const NS = 'admin';
const LIST_URL = '/api/admin/ownership-verifications';

type QueueState =
  | { readonly state: 'loading' }
  | { readonly state: 'failed' }
  | { readonly state: 'ready'; readonly items: ReadonlyArray<OwnershipReviewItem> };

function useReviewQueue(): { readonly queue: QueueState; readonly reload: () => void } {
  const [queue, setQueue] = React.useState<QueueState>({ state: 'loading' });
  const reload = React.useCallback(() => {
    apiClient
      .get<{ items: OwnershipReviewItem[] }>(LIST_URL)
      .then((body) => setQueue({ state: 'ready', items: body.items }))
      .catch(() => setQueue({ state: 'failed' }));
  }, []);
  React.useEffect(reload, [reload]);
  return { queue, reload };
}

async function openEvidence(verificationId: string): Promise<void> {
  const body = await apiClient.get<{ url: string }>(`${LIST_URL}/${encodeURIComponent(verificationId)}/evidence`);
  window.open(body.url, '_blank', 'noopener,noreferrer');
}

function ReviewCard({ item, onDecided }: { readonly item: OwnershipReviewItem; readonly onDecided: () => void }): React.ReactElement {
  const { t } = useTranslation([NS, 'property-market']);
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const noteId = React.useId();

  const decide = async (decision: 'approve' | 'reject') => {
    setBusy(true);
    try {
      await apiClient.post(LIST_URL, { verificationId: item.id, decision, note: note.trim() || null });
      onDecided();
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
      <ClaimantHeader
        item={item}
        level="h2"
        aside={<time dateTime={item.createdAt} className="text-sm text-muted-foreground">{formatDate(item.createdAt)}</time>}
      />
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <KaekTerm kaek={item.kaek} />
        <dt className="text-muted-foreground">{t('admin:ownershipVerifications.signer')}</dt>
        <dd className="m-0 text-foreground">{item.sealValid ? (item.sealSigner ?? t('admin:ownershipVerifications.unread')) : t('admin:ownershipVerifications.sealInvalid')}</dd>
      </dl>
      <ul className="m-0 list-disc pl-5 text-sm text-foreground">
        {item.reasons.map((reason) => <li key={reason}>{t(REASON_KEYS[reason])}</li>)}
      </ul>
      <label htmlFor={noteId} className="text-sm text-muted-foreground">{t('admin:ownershipVerifications.note')}</label>
      <Textarea id={noteId} value={note} onChange={(event) => setNote(event.target.value)} size="sm" rows={2} />
      <footer className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => void openEvidence(item.id)}>{t('admin:ownershipVerifications.openCertificate')}</Button>
        <Button type="button" disabled={busy} onClick={() => void decide('approve')}>{t('admin:ownershipVerifications.approve')}</Button>
        <Button type="button" variant="destructive" disabled={busy} onClick={() => void decide('reject')}>{t('admin:ownershipVerifications.reject')}</Button>
      </footer>
    </article>
  );
}

function PendingQueue(): React.ReactElement {
  const { t } = useTranslation([NS]);
  const { queue, reload } = useReviewQueue();
  return (
    <section className="flex flex-col gap-4">
      {queue.state === 'loading' && <p className="m-0 text-sm text-muted-foreground">{t('admin:ownershipVerifications.loading')}</p>}
      {queue.state === 'failed' && (
        <Alert variant="destructive" withIcon><AlertDescription>{t('admin:ownershipVerifications.failed')}</AlertDescription></Alert>
      )}
      {queue.state === 'ready' && queue.items.length === 0 && (
        <p className="m-0 text-sm text-muted-foreground">{t('admin:ownershipVerifications.empty')}</p>
      )}
      {queue.state === 'ready' && queue.items.map((item) => <ReviewCard key={item.id} item={item} onDecided={reload} />)}
    </section>
  );
}

export function OwnershipVerificationsPageContent(): React.ReactElement {
  const { t } = useTranslation([NS, OWNERSHIP_NS]);
  return (
    <main className="container mx-auto flex max-w-4xl flex-col gap-4 px-4 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="m-0 flex items-center gap-3 text-2xl font-bold">
          <ShieldCheck aria-hidden="true" className="h-6 w-6" />
          {t('admin:ownershipVerifications.title')}
        </h1>
        <p className="m-0 text-sm text-muted-foreground">{t('admin:ownershipVerifications.description')}</p>
      </header>
      {/* Το `TabsContent` έχει ΜΗΔΕΝ προεπιλεγμένο κενό (δόγμα `ui/tabs`) — το κενό το δηλώνει ο καλών. */}
      <Tabs defaultValue="pending" className="flex flex-col gap-4">
        <TabsList>
          <TabsTrigger value="pending">{t(REVOCATION_ADMIN_KEYS.tabPending)}</TabsTrigger>
          <TabsTrigger value="verified">{t(REVOCATION_ADMIN_KEYS.tabVerified)}</TabsTrigger>
        </TabsList>
        <TabsContent value="pending"><PendingQueue /></TabsContent>
        <TabsContent value="verified"><RevocableOwnershipSearch /></TabsContent>
      </Tabs>
    </main>
  );
}
