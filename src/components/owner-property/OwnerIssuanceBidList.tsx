'use client';

/**
 * @fileoverview ADR-945 §7.6 — **οι προσφορές ενός αιτήματος**, όπως τις βλέπει ο ιδιώτης: ποιος · σε ποιο στάδιο · σε
 *   ποιον η μπάλα · τι τιμή · τι έγινε πότε — και «Επιλογή» όταν υπάρχει τιμή προς απόφαση.
 * @related OwnerIssuanceRequestSection.tsx (ο καταναλωτής) · lib/document-validity/issuance-request-view-model.ts ·
 *   components/document-registry/registry-issuance-quote-lines.tsx (`quoteLines` — οι ΙΔΙΕΣ γραμμές με το γραφείο) ·
 *   components/document-registry/IssuanceAdvanceTimelineList.tsx (το ΙΔΙΟ χρονολόγιο)
 * @module components/owner-property/OwnerIssuanceBidList
 *
 * 🏆 Thumbtack «Projects» · Checkatrade: κάθε επαγγελματίας μία κάρτα, με την τιμή του δίπλα στο «ποιος». Πέρα από
 *    αυτούς: **στάδιο και μπάλα** σε κάθε κάρτα (Procore «Ball in Court»), και χρονολόγιο από τα **γεγονότα** — ο
 *    ιδιώτης ξέρει πάντα αν περιμένει τον επαγγελματία ή αν περιμένει εκείνος τον ίδιο.
 * 🔑 Το στάδιο έρχεται **κριμένο** από τον διακομιστή· εδώ μόνο λέξεις — στη **φωνή του ιδιώτη** (`OWNER_STAGE_KEYS`):
 *    ίδια μηχανή καταστάσεων με το μητρώο του γραφείου, άλλος ομιλητής (το γραφείο λέει «αναμένει έγκριση του ιδιοκτήτη»).
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import { agencyProfileRoute } from '@/components/mandate/agency-directory-route';
import { IssuanceAdvanceTimelineList } from '@/components/document-registry/IssuanceAdvanceTimelineList';
import { quoteLines } from '@/components/document-registry/registry-issuance-quote-lines';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { IssuanceBiddingView, IssuanceBidView } from '@/lib/document-validity/issuance-bidding-request';
import type { IssuanceProfessional } from '@/lib/document-validity/issuance-professional';
import { bidTimelineOf, canAwardBid, ownerBallOf } from '@/lib/document-validity/issuance-request-view-model';
import { Link } from '@/lib/workspace/navigation';
import { usePublicAgency } from '@/services/realtime/hooks/usePublicAgencies';
import {
  BID_TIMELINE_KEYS,
  OWNER_BALL_KEYS,
  OWNER_ISSUANCE_KEYS,
  OWNER_ISSUANCE_NAMESPACES,
  OWNER_STAGE_KEYS,
} from './owner-issuance-labels';

/** Ο επαγγελματίας της προσφοράς — από το γεγονός της ανάθεσης, αλλιώς από την πρόσκληση του αιτήματος. */
function professionalOf(view: IssuanceBiddingView, bid: IssuanceBidView): IssuanceProfessional | null {
  return bid.record?.professional ?? view.request?.bids.find((invited) => invited.bidId === bid.bidId)?.professional ?? null;
}

/**
 * Η επωνυμία από τη **δημόσια βιτρίνα** — ανάγνωση **ενός** εγγράφου κατά ταυτότητα (`usePublicAgency`), ποτέ ολόκληρος
 * ο κατάλογος. Βιτρίνα που αποσύρθηκε ⇒ το λέει, δεν κρύβει την προσφορά.
 */
function ProfessionalHeading({ professional }: { readonly professional: IssuanceProfessional | null }): React.ReactElement {
  const { t } = useTranslation([...OWNER_ISSUANCE_NAMESPACES]);
  const companyId = professional?.kind === 'workspace' ? professional.companyId : null;
  const lookup = usePublicAgency(companyId);
  if (companyId === null || lookup.state !== 'found') {
    return <h4 className="m-0 text-sm font-semibold text-card-foreground">{t(OWNER_ISSUANCE_KEYS.professionalUnavailable)}</h4>;
  }
  return (
    <header className="flex flex-wrap items-baseline gap-x-3">
      <h4 className="m-0 text-sm font-semibold text-card-foreground">{lookup.showcase.displayName}</h4>
      <Link href={agencyProfileRoute(companyId)} className="text-xs text-muted-foreground underline underline-offset-4">
        {t(OWNER_ISSUANCE_KEYS.viewProfile)}
      </Link>
    </header>
  );
}

function StageLine({ bid, awarded }: { readonly bid: IssuanceBidView; readonly awarded: boolean }): React.ReactElement {
  const { t } = useTranslation([...OWNER_ISSUANCE_NAMESPACES]);
  const ball = ownerBallOf(bid.stage);
  return (
    <p className="m-0 flex flex-wrap gap-x-2 text-sm text-card-foreground">
      {/* ⚠️ Τριαδικός ΜΕΣΑ στο `t(…)`: ο γεννήτορας του route slice λύνει στατικά μόνο αυτή τη μορφή. */}
      <strong>{t(bid.stage === null ? OWNER_ISSUANCE_KEYS.bidClosed : OWNER_STAGE_KEYS[bid.stage])}</strong>
      {awarded ? <span>{t(OWNER_ISSUANCE_KEYS.awardedBadge)}</span> : null}
      {ball === null ? null : <span className="text-muted-foreground">{t(OWNER_BALL_KEYS[ball])}</span>}
    </p>
  );
}

interface BidCardProps {
  readonly view: IssuanceBiddingView;
  readonly bid: IssuanceBidView;
  readonly canAct: boolean;
  readonly busy: boolean;
  readonly onAward: (bid: IssuanceBidView) => void;
}

function BidCard({ view, bid, canAct, busy, onAward }: BidCardProps): React.ReactElement {
  const { t } = useTranslation([...OWNER_ISSUANCE_NAMESPACES]);
  const record = bid.record;
  const lines = record === null ? [] : quoteLines(t, record);
  const awarded = view.request?.award?.bidId === bid.bidId;
  return (
    <li className="flex flex-col gap-2 rounded-md border border-border bg-card p-3">
      <ProfessionalHeading professional={professionalOf(view, bid)} />
      <StageLine bid={bid} awarded={awarded} />
      {lines.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm text-card-foreground">{lines}</ul>
      ) : (
        bid.stage !== null && <p className="m-0 text-sm text-muted-foreground">{t(OWNER_ISSUANCE_KEYS.awaitingQuote)}</p>
      )}
      {record === null ? null : (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">{t(OWNER_ISSUANCE_KEYS.timeline)}</summary>
          <IssuanceAdvanceTimelineList timeline={bidTimelineOf(record)} textOf={(entry) => t(BID_TIMELINE_KEYS[entry.kind])} />
        </details>
      )}
      {canAct && canAwardBid(view, bid) ? (
        <Button type="button" size="sm" className="w-fit" disabled={busy} onClick={() => onAward(bid)}>
          {t(busy ? OWNER_ISSUANCE_KEYS.saving : OWNER_ISSUANCE_KEYS.award)}
        </Button>
      ) : null}
    </li>
  );
}

export interface OwnerIssuanceBidListProps {
  readonly view: IssuanceBiddingView;
  readonly canAct: boolean;
  /** Η προσφορά της οποίας η επιλογή είναι σε πτήση — `null` όταν τίποτα. */
  readonly busyBidId: string | null;
  readonly onAward: (bid: IssuanceBidView) => void;
}

export function OwnerIssuanceBidList({ view, canAct, busyBidId, onAward }: OwnerIssuanceBidListProps): React.ReactElement | null {
  if (view.bids.length === 0) return null;
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {view.bids.map((bid) => (
        <BidCard key={bid.bidId} view={view} bid={bid} canAct={canAct} busy={busyBidId === bid.bidId} onAward={onAward} />
      ))}
    </ul>
  );
}
