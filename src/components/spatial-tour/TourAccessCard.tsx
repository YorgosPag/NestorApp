'use client';

/**
 * @fileoverview **Η ΠΕΡΙΗΓΗΣΗ ΣΤΗ ΔΗΜΟΣΙΑ ΑΓΓΕΛΙΑ** — άνοιγμα, ή «ζητήστε πρόσβαση» (ADR-884 Κ3β · Φ0.13).
 * @related `components/listing-detail/ListingTour.tsx` (το όριο `next/dynamic`) · `useTourAccessCard.ts` (η κατάσταση)
 * @module components/spatial-tour/TourAccessCard
 *
 * 🔑 **Εμφανίζεται μόνο όταν υπάρχει κάτι να δει ο επισκέπτης** (`presence`: δημοσιευμένη, όχι `link-only`, με έτοιμο
 * tileset) — αλλιώς **τίποτα**, ούτε κενός χώρος. Η περιήγηση `link-only` είναι **αόρατη** εδώ ex definitione (Δ3).
 * 🔑 **Πρότυπο Google Drive «Request access»**: λογαριασμός υποχρεωτικός· μήνυμα προαιρετικό· η απάντηση φτάνει ως
 * ειδοποίηση. Κάθε κατάσταση (εκκρεμεί · εγκρίθηκε έως · απορρίφθηκε · έληξε · ανακλήθηκε) λέει **τι να κάνει** ο άνθρωπος.
 */

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDate } from '@/lib/intl-formatting';
import { loginHref } from '@/lib/routes/return-path';
import { tourViewHref } from '@/lib/spatial-tour/tour-routes';
import { Link } from '@/lib/workspace/navigation';

import { SPATIAL_TOUR_NS } from './spatial-tour-namespace';
import { ACCESS_KEYS } from './tour-access-labels';
import { useTourAccessCard, type TourAccessCardState } from './useTourAccessCard';

const MESSAGE_MAX = 1000;

export default function TourAccessCard({ listingId, returnPath }: { readonly listingId: string; readonly returnPath: string }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const card = useTourAccessCard(listingId);
  if (card.state.kind === 'hidden') return null;
  return (
    <section aria-labelledby="listing-tour-heading" className="space-y-2 rounded-lg border p-4">
      <h2 id="listing-tour-heading" className="text-lg font-semibold">{t(ACCESS_KEYS.cardTitle)}</h2>
      <CardBody state={card.state} listingId={listingId} returnPath={returnPath}
        busy={card.busy} onRequest={card.request} onWithdraw={card.withdraw} />
      {card.failed && <p className="text-sm text-destructive" role="alert">{t(ACCESS_KEYS.failed)}</p>}
    </section>
  );
}

function OpenLink({ listingId }: { readonly listingId: string }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  return (
    <Button asChild><Link href={tourViewHref(listingId)}>{t(ACCESS_KEYS.open)}</Link></Button>
  );
}

function CardBody({ state, listingId, returnPath, busy, onRequest, onWithdraw }: {
  readonly state: Exclude<TourAccessCardState, { kind: 'hidden' }>;
  readonly listingId: string;
  readonly returnPath: string;
  readonly busy: boolean;
  readonly onRequest: (message: string | null) => Promise<void>;
  readonly onWithdraw: () => Promise<void>;
}) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  switch (state.kind) {
    case 'open':
      return <><p className="text-sm">{t(ACCESS_KEYS.cardPublic)}</p><OpenLink listingId={listingId} /></>;
    case 'approved':
      return <><p className="text-sm" role="status">{t(ACCESS_KEYS.approved, { date: formatDate(state.expiresAt) })}</p><OpenLink listingId={listingId} /></>;
    case 'sign-in':
      return (
        <>
          <p className="text-sm">{t(ACCESS_KEYS.cardOnRequest)}</p>
          <Button asChild variant="outline"><Link href={loginHref(returnPath)}>{t(ACCESS_KEYS.signIn)}</Link></Button>
          <p className="text-xs text-muted-foreground">{t(ACCESS_KEYS.signInHint)}</p>
        </>
      );
    case 'pending':
      return (
        <>
          <p className="text-sm" role="status">{t(ACCESS_KEYS.pending)}</p>
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void onWithdraw()}>{t(ACCESS_KEYS.withdraw)}</Button>
        </>
      );
    case 'requestable':
      return <RequestForm previous={state.previous} busy={busy} onRequest={onRequest} />;
  }
}

/** Το αίτημα — με τον λόγο που ο προηγούμενος τελείωσε (απορρίφθηκε · έληξε · ανακλήθηκε), αν υπάρχει. */
function RequestForm({ previous, busy, onRequest }: {
  readonly previous: 'declined' | 'expired' | 'revoked' | null;
  readonly busy: boolean;
  readonly onRequest: (message: string | null) => Promise<void>;
}) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const [message, setMessage] = useState('');
  const previousKey = previous === null ? null : ACCESS_KEYS[previous];
  return (
    <form className="space-y-2" onSubmit={(event) => {
      event.preventDefault();
      void onRequest(message.trim() === '' ? null : message);
    }}>
      <p className="text-sm">{previousKey === null ? t(ACCESS_KEYS.cardOnRequest) : t(previousKey)}</p>
      <Label htmlFor="tour-access-message">{t(ACCESS_KEYS.messageLabel)}</Label>
      <Textarea id="tour-access-message" value={message} maxLength={MESSAGE_MAX}
        placeholder={t(ACCESS_KEYS.messagePlaceholder)} onChange={(event) => setMessage(event.target.value)} />
      <Button type="submit" disabled={busy}>{t(previous === null ? ACCESS_KEYS.request : ACCESS_KEYS.requestAgain)}</Button>
    </form>
  );
}
