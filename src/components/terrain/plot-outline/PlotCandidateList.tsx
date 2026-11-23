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
 */

import React, { useId } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatNumber } from '@/lib/intl-formatting';
import type {
  PlotOutlineEvidence,
  PlotOutlineRanking,
  RankedPlotOutline,
} from '@/lib/terrain/plot-outline/plot-outline-types';

const NS = 'terrain-survey:plotOutline';

type Translate = ReturnType<typeof useTranslation>['t'];

const area = (m2: number) => formatNumber(m2, { maximumFractionDigits: 0 });
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

function originText(entry: RankedPlotOutline, t: Translate): string {
  const { origin } = entry.candidate;
  return origin.source === 'dxf' ? t(`${NS}.candidates.dxfOrigin`, { layer: origin.layer }) : t(`${NS}.candidates.pdfOrigin`, { page: origin.page });
}

function CandidateOption({ entry, name, proposed, checked, onSelect }: {
  readonly entry: RankedPlotOutline;
  readonly name: string;
  readonly proposed: boolean;
  readonly checked: boolean;
  readonly onSelect: (id: string) => void;
}) {
  const { t } = useTranslation(['terrain-survey']);
  const { candidate } = entry;
  return (
    <li className="rounded border border-border p-2">
      <label className="flex cursor-pointer items-start gap-2">
        <input type="radio" name={name} value={candidate.id} checked={checked}
          onChange={() => onSelect(candidate.id)} className="mt-1" />
        <span className="flex min-w-0 flex-col gap-1">
          <span className="text-sm font-medium text-foreground">
            {t(`${NS}.candidates.area`, { area: area(candidate.areaM2) })}
            {' · '}{t(`${NS}.candidates.corners`, { count: candidate.corners.length })}
            {' · '}{originText(entry, t)}
            {proposed && <strong className="ml-2 rounded border border-border px-1 text-xs">{t(`${NS}.candidates.proposed`)}</strong>}
          </span>
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

export interface PlotCandidateListProps {
  readonly ranking: PlotOutlineRanking;
  readonly selectedId: string | null;
  readonly rejectedCount: number;
  readonly disabled?: boolean;
  readonly onSelect: (candidateId: string) => void;
}

export function PlotCandidateList({ ranking, selectedId, rejectedCount, disabled = false, onSelect }: PlotCandidateListProps) {
  const { t } = useTranslation(['terrain-survey']);
  const name = useId();
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
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {ranking.ranked.map((entry) => (
            <CandidateOption key={entry.candidate.id} entry={entry} name={name}
              proposed={entry.candidate.id === ranking.proposedId} checked={entry.candidate.id === selectedId} onSelect={onSelect} />
          ))}
        </ul>
      )}
      {rejectedCount > 0 && <p className="m-0 text-xs text-muted-foreground">{t(`${NS}.candidates.rejected`, { count: rejectedCount })}</p>}
    </fieldset>
  );
}
