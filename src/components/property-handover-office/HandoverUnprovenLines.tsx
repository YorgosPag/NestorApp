'use client';

/**
 * @fileoverview **Οι γραμμές χωρίς απόδειξη μιας παράδοσης** — και το «Κλείσιμο χωρίς πλήρες αποτύπωμα» για όσες τα bytes
 *   χάθηκαν οριστικά (ADR-916 §5.23 Φ-Δ.7γ · Ο13β (i)).
 * @related hooks/property-handover/useHandoverOfficeActions (`closeLine`) · HandoverIrreversibleAction.tsx (το ΕΝΑ σχήμα
 *          μη αναστρέψιμης πράξης) · lib/property-handover/handover-line-closure (`handoverLineClosureOfferOf` — η ΙΔΙΑ κρίση
 *          με την πόρτα)
 * @module components/property-handover-office/HandoverUnprovenLines
 *
 * 🔑 **Το κουμπί ΔΕΝ κρίνει**: εμφανίζεται όταν το λέει το `line.offer` · αλλιώς ο άνθρωπος βλέπει **γιατί όχι** (ανάκτηση σε
 *    εξέλιξη · αποδείξιμη · …) — Purview «policy tip», ποτέ σιωπηλά κρυμμένο κουμπί.
 * ⚠️ **Μη αναστρέψιμο** (DocuSign void): ο διάλογος λέει τι **σημαίνει** (τι τυπώνει το Πρωτόκολλο, τι δεν βεβαιώνει) και
 *    ζητά αιτιολογία **και** ρητή επιβεβαίωση. Η αιτία δεν επιλέγεται — τη μέτρησε η μηχανή και απλώς φαίνεται.
 */

import React from 'react';
import { FileX2 } from 'lucide-react';

import type { HandoverOfficeActions } from '@/hooks/property-handover/useHandoverOfficeActions';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDate } from '@/lib/intl-formatting';
import type { HandoverUnprovenLine } from '@/types/property-handover-line-closure';
import { formatFileSize } from '@/utils/file-validation';

import { HandoverIrreversibleAction } from './HandoverIrreversibleAction';

const K = 'properties-detail:handover.lineClosure';

/** Τι σημαίνει το κλείσιμο — τι γράφει το Πρωτόκολλο, τι δεν βεβαιώνει, ότι δεν αναιρείται. */
const MEANS = ['listed', 'notCertified', 'final'] as const;

interface LineProps {
  readonly handoverId: string;
  readonly line: HandoverUnprovenLine;
  readonly actions: HandoverOfficeActions;
}

/** Η κίνηση μιας γραμμής: το κουμπί κλεισίματος (η αιτία στην περιγραφή) ή **γιατί όχι**. */
function LineMove({ handoverId, line, actions }: LineProps): React.ReactElement {
  const { t } = useTranslation(['properties-detail']);
  const { offer } = line;
  if (offer.kind !== 'close') return <span className="text-xs text-muted-foreground">{t(`${K}.blocked.${offer.reason}`)}</span>;
  return (
    <HandoverIrreversibleAction keys={K} means={MEANS} description={t(`${K}.cause.${offer.cause}`)} icon={FileX2} buttonVariant="outline"
      busyId={actions.busyId} busyKey={line.sourceFileId}
      onSubmit={(reason) => actions.closeLine({ handoverId, sourceFileId: line.sourceFileId, reason })} />
  );
}

function UnprovenLine(props: LineProps): React.ReactElement {
  const { t } = useTranslation(['properties-detail']);
  const { line } = props;
  const delivered = line.deliveredAt === null ? null : t(`${K}.deliveredOn`, { date: formatDate(line.deliveredAt) });
  return (
    <li className="flex flex-col gap-1 rounded-md border border-border p-2">
      <span className="text-sm font-medium text-foreground">{line.name ?? line.sourceFileId}</span>
      <span className="text-xs text-muted-foreground">{[formatFileSize(line.size), delivered].filter(Boolean).join(' · ')}</span>
      <LineMove {...props} />
    </li>
  );
}

export function HandoverUnprovenLines({ handoverId, lines, actions }: {
  readonly handoverId: string;
  readonly lines: readonly HandoverUnprovenLine[];
  readonly actions: HandoverOfficeActions;
}): React.ReactElement | null {
  const { t } = useTranslation(['properties-detail']);
  const headingId = React.useId();
  if (lines.length === 0) return null;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h4 id={headingId} className="m-0 text-sm font-semibold text-foreground">{t(`${K}.heading`)}</h4>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {lines.map((line) => <UnprovenLine key={line.sourceFileId} handoverId={handoverId} line={line} actions={actions} />)}
      </ul>
    </section>
  );
}
