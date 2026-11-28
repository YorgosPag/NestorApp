'use client';

/**
 * @fileoverview **Νέο τοπογραφικό σχέδιο → ποιο είναι το οικόπεδο → επιβεβαίωση** (ADR-920 §14.11 Ζ4 · Π4 · Π5 · Π9 · Π10).
 * @related hooks/listings/usePlotDrawingImport (ΟΛΗ η κατάσταση — εδώ μηδέν λογική) · ./PlotDxfDrawingView · ./PlotPdfDrawingView ·
 *   ./PlotCandidateList · components/terrain/survey-import/SurveyUnitSelect (η ΜΙΑ λίστα μονάδων) ·
 *   components/shared/files/FileUploadZone (η ΜΙΑ ζώνη μεταφοράς αρχείων)
 * @module components/terrain/plot-outline/PlotDrawingImport
 *
 * 🔑 **Κάθε αδιέξοδο λέει την ΠΡΑΞΗ**: DWG ⇒ «αποθήκευσε ως DXF» · DXF χωρίς μονάδες ⇒ διάλεξε μονάδα · PDF χωρίς πίνακα
 *    ⇒ «ζήτα DXF ή πίνακα» · σαρωμένο PDF ⇒ το ίδιο. Ποτέ σιωπηλό γκρίζο κουμπί.
 * 🔑 **Π9 ρητό**: το κουτάκι «να φαίνεται στη δημόσια αγγελία» ξεκινά ΑΤΣΕΚΑΡΙΣΤΟ — το σχήμα εντοπίζει το οικόπεδο.
 */

import React from 'react';

import { FileUploadZone } from '@/components/shared/files/FileUploadZone';
import { SurveyUnitSelect } from '@/components/terrain/survey-import/SurveyUnitSelect';
import { Button } from '@/components/ui/button';
import type { PlotDrawingImportApi } from '@/hooks/listings/usePlotDrawingImport';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatNumber } from '@/lib/intl-formatting';
import { PLOT_DRAWING_ACCEPT } from '@/lib/terrain/plot-outline/plot-drawing-read';
import { TERRAIN_REFUSAL_MESSAGE_LIMITS } from '@/lib/terrain/publication/terrain-publication-contract';

import { PlotCandidateList } from './PlotCandidateList';
import { PlotCandidateStatusLine } from './PlotCandidateStatusLine';
import { PlotDxfDrawingView } from './PlotDxfDrawingView';
import { PlotOutlineVisibilityCheckbox } from './PlotOutlineVisibilityCheckbox';
import { PlotPdfDrawingView } from './PlotPdfDrawingView';

const NS = 'terrain-survey:plotOutline';

function DrawingPicker({ api }: { readonly api: PlotDrawingImportApi }) {
  const { t } = useTranslation(['terrain-survey']);
  const sending = api.submission.kind === 'sending';
  const onUpload = async (files: File[]) => {
    const [first] = files;
    if (first !== undefined) await api.loadFile(first);
  };
  return (
    <section className="flex flex-col gap-2" aria-busy={api.reading}>
      {api.file === null ? (
        <FileUploadZone onUpload={onUpload} accept={PLOT_DRAWING_ACCEPT} multiple={false} minSize={0}
          enableCompression={false} disabled={sending} uploading={api.reading} typesHint={t(`${NS}.file.typesHint`)} />
      ) : (
        <header className="flex flex-wrap items-center justify-between gap-2">
          <p className="m-0 truncate text-sm text-foreground">{t(`${NS}.file.chosen`, { name: api.file.name })}</p>
          <Button type="button" variant="outline" size="sm" onClick={api.reset} disabled={sending || api.reading}>
            {t(`${NS}.file.reset`)}
          </Button>
        </header>
      )}
      <p role="status" className="m-0 text-sm text-muted-foreground">{api.reading ? t(`${NS}.file.reading`) : ''}</p>
      {api.read?.kind === 'refused' && (
        <p role="alert" className="m-0 rounded border border-destructive p-2 text-sm text-foreground">
          {t(`${NS}.refusals.${api.read.refusal}`, TERRAIN_REFUSAL_MESSAGE_LIMITS)}
        </p>
      )}
    </section>
  );
}

/** Ό,τι εμποδίζει τα υποψήφια, με όνομα: μονάδα DXF · PDF χωρίς κείμενο · PDF χωρίς πίνακα. */
function Blocker({ api }: { readonly api: PlotDrawingImportApi }) {
  const { t } = useTranslation(['terrain-survey']);
  if (api.asksUnit) {
    return (
      <section className="flex flex-col gap-2">
        {api.needsUnit && <p role="alert" className="m-0 text-sm text-foreground">{t(`${NS}.unit.needed`)}</p>}
        <SurveyUnitSelect unit={api.unit} onUnit={api.setUnit} disabled={api.submission.kind === 'sending'} />
      </section>
    );
  }
  if (api.read?.kind !== 'pdf' || api.read.reading.status === 'tables') return null;
  const key = api.read.reading.status === 'unreadable' ? 'unreadable' : 'noTable';
  return <p role="alert" className="m-0 text-sm text-foreground">{t(`${NS}.pdf.${key}`)}</p>;
}

function DrawingView({ api }: { readonly api: PlotDrawingImportApi }) {
  const { read, file, candidates, selectedId } = api;
  if (read === null || file === null || read.kind === 'refused') return null;
  if (read.kind === 'pdf') {
    const selected = candidates?.ranking.ranked.find((entry) => entry.candidate.id === selectedId)?.candidate ?? null;
    return <PlotPdfDrawingView file={file} pages={read.pages} selected={selected} />;
  }
  if (candidates === null || candidates.scaleToMm === null) return null;
  // Κολλημένη πάνω από τη λίστα (Zillow: ο χάρτης μένει, οι κάρτες κυλούν) ⇒ η αμφίδρομη επισήμανση φαίνεται πάντα, όσο
  // βαθιά κι αν είναι η κάρτα. Το `sticky` ζει μέσα στο ΚΟΙΝΟ τμήμα σχεδίου + λίστας ⇒ ξεκολλά όταν τελειώσει η λίστα.
  // Μόνο για DXF: η σελίδα PDF είναι ψηλή και η λίστα του πίνακα κοντή.
  return (
    <div className="sticky top-0">
      <PlotDxfDrawingView fileKey={`${file.name}:${file.size}:${file.lastModified}`} drawing={read.drawing}
        scaleToMm={candidates.scaleToMm} ranking={candidates.ranking} selectedId={selectedId} peek={api.peek}
        onSelect={api.selectOnDrawing} />
      <PlotCandidateStatusLine ranking={candidates.ranking} peek={api.peek} />
    </div>
  );
}

function SubmissionMessage({ api }: { readonly api: PlotDrawingImportApi }) {
  const { t } = useTranslation(['terrain-survey']);
  const { submission } = api;
  if (submission.kind === 'refused') {
    return <p role="alert" className="m-0 text-sm text-foreground">{t(`terrain-survey:publish.refusals.${submission.refusal}`, TERRAIN_REFUSAL_MESSAGE_LIMITS)}</p>;
  }
  if (submission.kind !== 'confirmed') return <p role="status" className="m-0" />;
  const { outcome } = submission;
  const area = formatNumber(outcome.areaM2, { maximumFractionDigits: 0 });
  return (
    <section role="status" className="flex flex-col gap-1 text-sm text-foreground">
      <p className="m-0">{t(`${NS}.confirmed.${outcome.coverage === null ? 'waiting' : 'withRelief'}`, { area })}</p>
      {outcome.coverage?.coverage === 'partial' && (
        <p className="m-0">{t(`${NS}.confirmed.partial`, { percent: formatNumber(outcome.coverage.coveredFraction * 100, { maximumFractionDigits: 0 }) })}</p>
      )}
      {outcome.listing !== null && <p className="m-0 text-muted-foreground">{t(`terrain-survey:publish.listing.${outcome.listing}`)}</p>}
    </section>
  );
}

function ConfirmControls({ api }: { readonly api: PlotDrawingImportApi }) {
  const { t } = useTranslation(['terrain-survey']);
  const sending = api.submission.kind === 'sending';
  return (
    <section className="flex flex-col gap-2">
      <PlotOutlineVisibilityCheckbox checked={api.showInListing} disabled={sending} onChange={api.setShowInListing} />
      {api.selectedId === null && <p className="m-0 text-sm text-muted-foreground">{t(`${NS}.confirm.needSelection`)}</p>}
      <Button type="button" className="self-start" disabled={!api.canConfirm} onClick={() => void api.confirm()}>
        {t(`${NS}.confirm.${sending ? 'sending' : 'action'}`)}
      </Button>
      <SubmissionMessage api={api} />
    </section>
  );
}

export function PlotDrawingImport({ api }: { readonly api: PlotDrawingImportApi }) {
  const { candidates } = api;
  const sending = api.submission.kind === 'sending';
  return (
    <section className="flex flex-col gap-3">
      <DrawingPicker api={api} />
      <Blocker api={api} />
      <section className="flex flex-col gap-3">
        <DrawingView api={api} />
        {candidates !== null && (
          <PlotCandidateList ranking={candidates.ranking} selectedId={api.selectedId} peek={api.peek}
            revealRequest={api.revealRequest} rejectedCount={candidates.rejectedCount} disabled={sending}
            onSelect={api.select} />
        )}
      </section>
      {candidates !== null && candidates.ranking.ranked.length > 0 && <ConfirmControls api={api} />}
    </section>
  );
}
