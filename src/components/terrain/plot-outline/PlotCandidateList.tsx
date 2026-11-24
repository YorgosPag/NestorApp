'use client';

/**
 * @fileoverview **Τα υποψήφια περιγράμματα, με τα τεκμήριά τους** — η επιλογή ως κανονική ομάδα κουμπιών επιλογής (ADR-920 §14.11 Ζ4 · Π4).
 * @related lib/terrain/plot-outline/plot-outline-ranking (η κατάταξη και τα ονομασμένα τεκμήρια) · ./PlotDxfDrawingView (η ίδια
 *   επιλογή, με κλικ πάνω στο σχέδιο) · hooks/listings/usePlotDrawingImport
 * @module components/terrain/plot-outline/PlotCandidateList
 *
 * 🔑 **Γιατί προτείνεται — με λέξεις, όχι με βαθμό**: κάθε τεκμήριο λέει τι είδε (στρώση · εμβαδόν και με ποιο συγκρίθηκε ·
 *    ετικέτες κορυφών) και αν μετρά υπέρ ή κατά. Ο αριθμός κατάταξης δεν φαίνεται πουθενά (είναι μόνο σειρά).
 * 🔑 **Ποτέ σιωπηλή επιλογή**: όταν η κατάταξη δεν προτείνει (ισοβαθμία · χωρίς τεκμήριο), λέγεται ΓΙΑΤΙ και τίποτα δεν
 *    είναι επιλεγμένο. Η επικάλυψη με το ανάγλυφο κρίνεται από τον server στην επιβεβαίωση — και αυτό λέγεται.
 * 🔑 Πληκτρολόγιο: εγγενή `radio` (βέλη, Space) — το σχέδιο είναι η ποντικο-οδός, η λίστα η προσβάσιμη.
 * 🔗 **Αμφίδρομη επισήμανση** (§14.11 «Ζ4 — αμφίδρομη επισήμανση» · λεξιλόγιο ADR-777 `listing-focus`): δείκτης ή εστίαση σε
 *    κάρτα ⇒ ανάβει η γραμμή στο σχέδιο· δείκτης ή εστίαση σε γραμμή ⇒ ανάβει η κάρτα — με δαχτυλίδι ΚΑΙ σήμα «Στο σχέδιο»,
 *    όχι μόνο χρώμα (CHECK 3.41). Το πέρασμα δεν κυλά ΠΟΤΕ τη σελίδα· μόνο το κλικ στο σχέδιο φέρνει την κάρτα (`revealRequest`).
 * 🔑 **Ίδιο σχήμα, άλλη στρώση** (Π4): η κάρτα το λέει — αλλιώς δύο κάρτες ανάβουν την ίδια γραμμή χωρίς εξήγηση.
 */

import React, { useEffect, useId, useMemo, useRef, type PointerEvent, type RefObject } from 'react';

import type { PlotCandidateRevealRequest } from '@/hooks/listings/usePlotDrawingImport';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { revealInScroll } from '@/lib/a11y/reveal-in-scroll';
import { formatList, formatNumber } from '@/lib/intl-formatting';
import { listingFocusStrength, type ListingFocusStrength } from '@/lib/listings/listing-focus';
import { coincidentPlotCandidates } from '@/lib/terrain/plot-outline/plot-candidate-coincidence';
import type {
  PlotOutlineCandidate,
  PlotOutlineEvidence,
  PlotOutlineRanking,
  RankedPlotOutline,
} from '@/lib/terrain/plot-outline/plot-outline-types';
import { cn } from '@/lib/utils';

import {
  plotCandidateArea as area,
  plotCandidateHeadline,
  plotCandidateOrigin as originText,
  type PlotCandidateTranslate as Translate,
} from './plot-candidate-text';

const NS = 'terrain-survey:plotOutline';
const percent = (fraction: number) => formatNumber(fraction * 100, { maximumFractionDigits: 1 });

/** Ένα τεκμήριο → «τι είδε» σε λέξεις. */
function evidenceText(evidence: PlotOutlineEvidence, t: Translate): string {
  switch (evidence.kind) {
    case 'layer-name':
      return `${t(`${NS}.evidence.layer-name`, { layer: evidence.layer })} ${t(`${NS}.evidence.${evidence.stem === null ? 'layerUnmatched' : 'layerMatched'}`)}`;
    case 'declared-area':
      return `${t(`${NS}.evidence.declared-area`)}: ${evidence.declaredBy === null || evidence.declaredM2 === null || evidence.relativeDifference === null
        ? t(`${NS}.evidence.areaVs.none`)
        : t(`${NS}.evidence.areaVs.${evidence.declaredBy}`, { declared: area(evidence.declaredM2), difference: percent(evidence.relativeDifference) })}`;
    case 'relief-overlap':
      return `${t(`${NS}.evidence.relief-overlap`)}: ${t(`${NS}.evidence.reliefPending`)}`;
    case 'corner-labels':
      return `${t(`${NS}.evidence.corner-labels`)}: ${t(`${NS}.evidence.cornersLabelled`, { labelled: evidence.labelledCorners, corners: evidence.corners })}`;
  }
}

/** Το γνώρισμα με το οποίο κάθε κάρτα λέει ποιο υποψήφιο είναι — το βρίσκει η αποκάλυψη μετά από κλικ στο σχέδιο. */
const CANDIDATE_ID_ATTRIBUTE = 'data-plot-candidate-id';

/**
 * Η κάρτα ανά ένταση εστίασης. Προ-τονισμένη = δαχτυλίδι στο χρώμα του περιγράμματος (χωρίς μετατόπιση διάταξης). Το `scroll-mt`
 * κρατά την κάρτα που φέρνει η αποκάλυψη ΚΑΤΩ από την κολλημένη όψη του σχεδίου (≤ 45vh + γραμμή εργαλείων).
 */
const CARD_BASE_CLASS = 'rounded border border-border p-2 scroll-mt-[calc(45vh_+_4rem)]';
const CARD_CLASS: Readonly<Record<ListingFocusStrength, string>> = {
  none: CARD_BASE_CLASS,
  peeked: cn(CARD_BASE_CLASS, 'ring-2 ring-[hsl(var(--terrain-plot-outline))]'),
  selected: CARD_BASE_CLASS,
};

/** Αφή: δεν υπάρχει «φεύγω» — το πάτημα επιλέγει, δεν προ-τονίζει (αλλιώς ο τονισμός κολλά, μάθημα ADR-777). */
const peekable = (event: PointerEvent) => event.pointerType !== 'touch';

interface CandidateOptionProps {
  readonly entry: RankedPlotOutline;
  readonly name: string;
  readonly proposed: boolean;
  readonly strength: ListingFocusStrength;
  readonly sameShape: readonly PlotOutlineCandidate[];
  readonly onSelect: (id: string) => void;
  readonly onPeek: (id: string | null) => void;
}

function CandidateOption({ entry, name, proposed, strength, sameShape, onSelect, onPeek }: CandidateOptionProps) {
  const { t } = useTranslation(['terrain-survey']);
  const { candidate } = entry;
  return (
    <li className={CARD_CLASS[strength]} {...{ [CANDIDATE_ID_ATTRIBUTE]: candidate.id }}
      onPointerEnter={(event) => { if (peekable(event)) onPeek(candidate.id); }}
      onPointerLeave={(event) => { if (peekable(event)) onPeek(null); }}>
      <label className="flex cursor-pointer items-start gap-2">
        <input type="radio" name={name} value={candidate.id} checked={strength === 'selected'}
          onChange={() => onSelect(candidate.id)} onFocus={() => onPeek(candidate.id)} onBlur={() => onPeek(null)} className="mt-1" />
        <span className="flex min-w-0 flex-col gap-1">
          <span className="text-sm font-medium text-foreground">
            {plotCandidateHeadline(candidate, t)}
            {proposed && <strong className="ml-2 rounded border border-border px-1 text-xs">{t(`${NS}.candidates.proposed`)}</strong>}
            {/* Πάντα στη θέση του (`invisible`) ⇒ καμία μετατόπιση όταν ανάβει· αόρατο = και σιωπηλό για τους αναγνώστες οθόνης. */}
            <strong className={cn('ml-2 rounded border border-[hsl(var(--terrain-plot-outline))] px-1 text-xs', strength !== 'peeked' && 'invisible')}>
              {t(`${NS}.candidates.onDrawing`)}
            </strong>
          </span>
          {sameShape.length > 0 && (
            <span className="text-xs text-foreground">
              {t(`${NS}.candidates.sameShape`, { others: formatList(sameShape.map((other) => originText(other, t))) })}
            </span>
          )}
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0 text-xs text-muted-foreground">
            {entry.evidence.map((evidence) => (
              <li key={evidence.kind}>
                <span className="font-medium">{t(`${NS}.evidence.verdict.${evidence.verdict}`)}</span>{' — '}{evidenceText(evidence, t)}
              </li>
            ))}
          </ul>
        </span>
      </label>
    </li>
  );
}

/** Κλικ στο σχέδιο ⇒ η κάρτα του φαίνεται. Σκόπιμη πράξη ⇒ `requested`· `nearest` ⇒ ήδη ορατή κάρτα δεν κουνιέται. */
function useRevealCard(listRef: RefObject<HTMLUListElement | null>, request: PlotCandidateRevealRequest | null): void {
  useEffect(() => {
    if (request === null || listRef.current === null) return;
    const cards = Array.from(listRef.current.querySelectorAll<HTMLElement>(`[${CANDIDATE_ID_ATTRIBUTE}]`));
    revealInScroll(cards.find((card) => card.getAttribute(CANDIDATE_ID_ATTRIBUTE) === request.candidateId), { urgency: 'requested' });
  }, [listRef, request]);
}

export interface PlotCandidateListProps {
  readonly ranking: PlotOutlineRanking;
  readonly selectedId: string | null;
  /** Εφήμερο: το υποψήφιο κάτω από τον δείκτη/την εστίαση — εδώ ή στο σχέδιο. */
  readonly peekedId: string | null;
  /** Το τελευταίο κλικ στο σχέδιο: η κάρτα του έρχεται στο οπτικό πεδίο (όσο λιγότερο γίνεται). */
  readonly revealRequest: PlotCandidateRevealRequest | null;
  readonly rejectedCount: number;
  readonly disabled?: boolean;
  readonly onSelect: (candidateId: string) => void;
  readonly onPeek: (candidateId: string | null) => void;
}

export function PlotCandidateList({
  ranking, selectedId, peekedId, revealRequest, rejectedCount, disabled = false, onSelect, onPeek,
}: PlotCandidateListProps) {
  const { t } = useTranslation(['terrain-survey']);
  const name = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const sameShape = useMemo(() => coincidentPlotCandidates(ranking.ranked.map(({ candidate }) => candidate)), [ranking]);
  useRevealCard(listRef, revealRequest);
  const focus = { peeked: peekedId, selected: selectedId };
  const count = ranking.ranked.length;
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0" disabled={disabled}>
      <legend className="mb-1 p-0 text-sm font-semibold text-foreground">{t(`${NS}.candidates.heading`)}</legend>
      <p className="m-0 text-sm text-muted-foreground">
        {count === 0 ? t(`${NS}.candidates.none`) : t(`${NS}.candidates.count`, { count })}
      </p>
      {ranking.noProposalReason !== null && count > 0 && (
        <p role="status" className="m-0 text-sm text-foreground">{t(`${NS}.candidates.noProposal.${ranking.noProposalReason}`)}</p>
      )}
      {count > 0 && (
        <ul ref={listRef} className="m-0 flex list-none flex-col gap-2 p-0">
          {ranking.ranked.map((entry) => (
            <CandidateOption key={entry.candidate.id} entry={entry} name={name} proposed={entry.candidate.id === ranking.proposedId}
              strength={listingFocusStrength(focus, entry.candidate.id)} sameShape={sameShape.get(entry.candidate.id) ?? []}
              onSelect={onSelect} onPeek={onPeek} />
          ))}
        </ul>
      )}
      {rejectedCount > 0 && <p className="m-0 text-xs text-muted-foreground">{t(`${NS}.candidates.rejected`, { count: rejectedCount })}</p>}
    </fieldset>
  );
}
