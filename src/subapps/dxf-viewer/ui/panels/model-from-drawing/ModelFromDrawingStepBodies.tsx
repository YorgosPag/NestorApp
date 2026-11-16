'use client';

/**
 * ADR-929 §6.25 — τα **σώματα** των τριών βημάτων του βοηθού «Μοντέλο από το σχέδιο» και τα **υποσέλιδά** τους.
 *
 * Κάθε βήμα: ό,τι χρειάζεται η απόφασή του ΕΞΑΡΧΗΣ · τα διαγνωστικά σε «Λεπτομέρειες» (κλειστά) · ΜΙΑ κύρια ενέργεια
 * στο καρφωμένο υποσέλιδο, μαζί με το «τι μένει έξω» (GitLab/CubiCasa: ένα κύριο κουμπί ανά βήμα, με περιγραφικό
 * κείμενο· Revit: η πράξη δεν κυλά μακριά). Καθαρή παρουσίαση: κατάσταση ως props, αποφάσεις ως callbacks.
 *
 * @see ./ModelFromDrawingPanel.tsx (η σύνθεση)
 * @see ./model-from-drawing-steps.ts (η κατάσταση κάθε βήματος)
 */

import * as React from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { countProposalByStatus } from '../../../bim/model-from-drawing/assistant-preview';
import type { ModelFromDrawingPanelProps } from './ModelFromDrawingPanel';
import type { MfdStepId } from './model-from-drawing-steps';
import {
  ColorChip, CoverageSection, DecisionsSection, GroupsSection, LeftOutNote, MUTED, RejectedSection, StatusLegend,
  type Translate,
} from './ModelFromDrawingSections';
import { OpeningApproval, OpeningsSection, OpeningsStart } from './ModelFromDrawingOpeningSections';
import { ImageSourceStart, ImageSourceSummary } from './PlanRecognitionSections';
import { PdfVectorImportSection } from './PdfVectorImportSection';
import { PlanReadingSection } from './PlanReadingSections';
import { PlanOcrSection } from './PlanOcrSection';
import { PlanReadValuesSection } from './PlanReadValuesSection';
import { PlanDrawingKindSection } from './PlanDrawingKindSection';
import { PlanScaleCardSection } from './PlanScaleCard';
import { RecognizedDimensionsSection } from './RecognizedDimensionsSection';
import { KeepRecognizedSection } from './KeepRecognizedSection';
import { StepDetails } from './StepDetails';

export type StepProps = ModelFromDrawingPanelProps & {
  readonly t: Translate;
  readonly onSelectStep: (id: MfdStepId) => void;
};

const fromImage = (props: StepProps): boolean => props.state.lineSource.kind === 'raster';

/** Η πηγή «σχέδιο»: το χρώμα-ρόλος που έδειξε ο άνθρωπος, και «άλλο δείγμα». */
function SceneSampleLine({ colorHex, onResample, t }: {
  readonly colorHex: string | null;
  readonly onResample: () => void;
  readonly t: Translate;
}): React.ReactElement {
  return (
    <p className="m-0 flex items-center gap-1.5 text-xs text-foreground">
      {colorHex ? <ColorChip hex={colorHex} /> : null}
      <span className="flex-1">{t('modelFromDrawing.sample.label')}</span>
      <Button type="button" variant="ghost" size="xs" onClick={onResample}>
        {t('modelFromDrawing.sample.change')}
      </Button>
    </p>
  );
}

/** Επιλογή πηγής: δείξε γραμμή τοίχου · εισαγωγή διανυσματικού PDF · αναγνώριση από την εικόνα του υποβάθρου. */
function SourceChoices({ state, actions, imageSource, pdfVectorImport, t }: StepProps): React.ReactElement {
  const picking = state.phase === 'picking' && state.sampleRole === 'wall';
  return (
    <>
      {picking ? (
        <p className="m-0 text-xs text-foreground" data-testid="mfd-pick-instruction" data-role={state.sampleRole}>
          {t('modelFromDrawing.pick.instruction')}
        </p>
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={actions.onResample} data-testid="mfd-source-start">
          {t('modelFromDrawing.steps.source.start')}
        </Button>
      )}
      <PdfVectorImportSection view={pdfVectorImport.view} actions={pdfVectorImport} t={t} />
      <ImageSourceStart view={imageSource} onRecognize={actions.onRecognizeImage} t={t} />
    </>
  );
}

/** Η πηγή «εικόνα υποβάθρου»: περίληψη, τοπικό OCR, είδος σχεδίου, «Τι διάβασα», ανάγνωση AI, κλίμακα. */
function ImageSourceSections({ actions, imageSource, t }: StepProps): React.ReactElement {
  return (
    <>
      <ImageSourceSummary view={imageSource} onResample={actions.onResample} t={t} />
      <PlanOcrSection view={imageSource.ocr} actions={actions.ocr} t={t} />
      <PlanDrawingKindSection view={imageSource.drawingKind} actions={actions.drawingKind} t={t} />
      <PlanScaleCardSection view={imageSource.scale} actions={actions.scale} t={t} />
      <PlanReadValuesSection rows={imageSource.readValues} absorbedMarks={imageSource.absorbedMarks} thumbnails={imageSource.readValueThumbnails} actions={actions.readValues} t={t} />
      <PlanReadingSection available={imageSource.readingAvailable} readingAdopted={imageSource.readingAdopted} review={imageSource.review} actions={actions.reading} t={t} />
    </>
  );
}

function SourceBody(props: StepProps): React.ReactElement {
  const { state, actions, t } = props;
  if (!state.proposal) return <SourceChoices {...props} />;
  return fromImage(props)
    ? <ImageSourceSections {...props} />
    : <SceneSampleLine colorHex={state.wallColorHex} onResample={actions.onResample} t={t} />;
}

/** «Δεν υπάρχει ακόμη τίποτα εδώ» — με το βήμα που λείπει, ως κουμπί (ποτέ αδιέξοδο). */
function EmptyStep({ text, onGo, t }: { readonly text: string; readonly onGo: () => void; readonly t: Translate }): React.ReactElement {
  return (
    <>
      <p className={MUTED}>{text}</p>
      <Button type="button" size="sm" variant="outline" onClick={onGo}>
        {t('modelFromDrawing.steps.goSource')}
      </Button>
    </>
  );
}

function WallsBody(props: StepProps): React.ReactElement {
  const { state, actions, imageSource, t } = props;
  const { proposal } = state;
  if (!proposal) {
    return <EmptyStep text={t('modelFromDrawing.steps.walls.empty')} onGo={() => props.onSelectStep('source')} t={t} />;
  }
  const unexplained = proposal.coverage.unexplainedIds.length;
  return (
    <>
      <StatusLegend proposal={proposal} t={t} />
      <GroupsSection groups={proposal.groups} onConfirm={actions.onConfirmGroup} t={t} />
      <DecisionsSection
        proposal={proposal} focusedKey={state.focusedKey}
        onSetUndecided={actions.onSetUndecided} onDiscardOrphaned={actions.onDiscardOrphanedDecisions}
        onFocus={actions.onFocus} t={t}
      />
      {/* ΟΡΑΤΟ: λέει τι θα γράψει η έγκριση ΜΑΖΙ με τους τοίχους — απόφαση, όχι διαγνωστικό («τίποτα σιωπηλό»). */}
      <RecognizedDimensionsSection summary={state.dimensionSummary} t={t} />
      {fromImage(props) ? (
        <KeepRecognizedSection
          dimensions={state.dimensionSummary} lines={state.lineSummary} tier={state.keepMinTier}
          calibrated={imageSource.calibrated} actions={actions} t={t}
        />
      ) : null}
      <StepDetails
        label={t('modelFromDrawing.details.walls')} testId="mfd-walls-details"
        hint={unexplained > 0 ? t('modelFromDrawing.details.unexplained', { count: unexplained }) : undefined}
      >
        <RejectedSection proposal={proposal} focusedKey={state.focusedKey} onFocus={actions.onFocus} t={t} />
        <CoverageSection proposal={proposal} t={t} />
      </StepDetails>
    </>
  );
}

function OpeningsBody({ state, actions, t }: StepProps): React.ReactElement {
  if (state.phase === 'picking' && state.sampleRole === 'opening') {
    return (
      <p className="m-0 text-xs text-foreground" data-testid="mfd-pick-instruction" data-role={state.sampleRole}>
        {t('modelFromDrawing.openings.pickInstruction')}
      </p>
    );
  }
  if (!state.openingProposal) return <OpeningsStart onStart={actions.onStartOpenings} t={t} />;
  return (
    <OpeningsSection
      proposal={state.openingProposal} preview={state.openingPreview} choices={state.openingReview.choices}
      orphanedCount={state.openingReview.orphaned.length}
      colorHex={state.openingColorHex} focusedKey={state.focusedKey} actions={actions} t={t}
    />
  );
}

/** Το σώμα του τρέχοντος βήματος — ΜΟΝΟ αυτό αποδίδεται (staged disclosure). */
export function StepBody({ step, ...props }: StepProps & { readonly step: MfdStepId }): React.ReactElement {
  if (step === 'source') return <SourceBody {...props} />;
  if (step === 'walls') return <WallsBody {...props} />;
  return <OpeningsBody {...props} />;
}

/** ① — «Συνέχεια στους τοίχους», ενεργό μόλις η πηγή είναι έτοιμη (σε εικόνα: βαθμονομημένη). */
function SourceAction(props: StepProps): React.ReactElement | null {
  const { state, imageSource, t } = props;
  if (!state.proposal) return null;
  const ready = !fromImage(props) || imageSource.calibrated;
  return (
    <Button type="button" size="sm" disabled={!ready} onClick={() => props.onSelectStep('walls')} data-testid="mfd-step-next">
      {t('modelFromDrawing.steps.source.next')}
      <ArrowRight className="size-3.5" aria-hidden="true" />
    </Button>
  );
}

/** ② — η ΜΙΑ έγκριση τοίχων, με το «τι μένει έξω» και τον λόγο αν κλειδώνει. */
function WallsAction(props: StepProps): React.ReactElement | null {
  const { state, actions, imageSource, t } = props;
  const { proposal } = state;
  if (!proposal) return null;
  const uncalibrated = fromImage(props) && !imageSource.calibrated;
  const locked = proposal.walls.length === 0 || uncalibrated;
  return (
    <>
      <LeftOutNote
        count={countProposalByStatus(proposal).unconfirmed}
        text={(count) => t('modelFromDrawing.leftOut', { count })} testId="mfd-left-out"
      />
      {uncalibrated ? <p className={MUTED} data-testid="mfd-walls-needs-calibration">{t('modelFromDrawing.steps.walls.needsCalibration')}</p> : null}
      <Button type="button" size="sm" disabled={locked} onClick={actions.onApprove} data-testid="mfd-approve">
        {t('modelFromDrawing.approve', { count: proposal.walls.length })}
      </Button>
    </>
  );
}

/** ③ — η ΜΙΑ έγκριση κουφωμάτων. */
function OpeningsAction({ state, actions, t }: StepProps): React.ReactElement | null {
  if (!state.openingProposal) return null;
  return (
    <OpeningApproval
      proposal={state.openingProposal} preview={state.openingPreview} choices={state.openingReview.choices}
      actions={actions} t={t}
    />
  );
}

/** Η κύρια ενέργεια του τρέχοντος βήματος — στο καρφωμένο υποσέλιδο. */
export function StepAction({ step, ...props }: StepProps & { readonly step: MfdStepId }): React.ReactElement | null {
  if (step === 'source') return <SourceAction {...props} />;
  if (step === 'walls') return <WallsAction {...props} />;
  return <OpeningsAction {...props} />;
}
