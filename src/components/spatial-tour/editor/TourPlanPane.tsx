'use client';

/**
 * @fileoverview **Η ΚΑΤΟΨΗ ΣΤΗΝ ΟΘΟΝΗ ΤΟΠΟΘΕΤΗΣΗΣ** — για το επιλεγμένο σημείο: ποια κάτοψη έχει ο όροφός του, ποια κλίμακα,
 * πού στέκεται, προς τα πού κοιτάζει (ADR-884 Φ2στ-β · §4.13 · §12 Δ7).
 * @related `TourPlanPicker.tsx` (επιλογή) · `CalibrateScaleDialog` (κλίμακα — κοινός, ADR-340) · `TourPlanEditMap.tsx`
 *   (θέση) · `TourPlanDirection.tsx` (κατεύθυνση) · `useTourEditorActions.ts` (οι εντολές)
 * @module components/spatial-tour/editor/TourPlanPane
 *
 * 🔑 **Τέσσερα βήματα, με τη σειρά που τα απαιτεί ο γραφέας**: κάτοψη → κλίμακα → θέση/κατεύθυνση → χώροι (Γ3γ-2β,
 *   `spaces/TourSpacesLauncher.tsx`). Κάθε βήμα εμφανίζεται μόνο
 *   όταν το προηγούμενο υπάρχει — η οθόνη δεν προσφέρει ποτέ πράξη που ο γραφέας θα αρνηθεί (`plan-absent` ·
 *   `plan-uncalibrated`).
 */

import { useState } from 'react';

import { CalibrateScaleDialog } from '@/components/shared/files/media/CalibrateScaleDialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { PixelPoint } from '@/lib/geometry/scale-calibration';
import { levelKeyId } from '@/lib/spatial-tour/spatial-tour-graph';
import { imagePixelToPlan } from '@/lib/spatial-tour/tour-plan-frame';
import type { TourViewerGraph, TourViewerLevel, TourViewerPlan } from '@/lib/spatial-tour/viewer/tour-viewer-graph';
import type { TourLevelKey, TourNode, TourSubject } from '@/types/spatial-tour';

import { SPATIAL_TOUR_NS } from '../spatial-tour-namespace';
import type { TourPanoramaSource } from '../viewer/tour-panorama-source';
import { TOUR_EDITOR_KEYS } from './tour-editor-labels';
import { TourPlanDirection } from './TourPlanDirection';
import { TourPlanEditMap } from './TourPlanEditMap';
import { TourPlanPicker } from './TourPlanPicker';
import { TourSpacesLauncher } from './spaces/TourSpacesLauncher';
import type { TourEditorActions } from './useTourEditorActions';

/** Πλάτος (css px) του χάρτη τοποθέτησης — η πηγή διαλέγει το παράγωγο που φτάνει. */
const EDIT_MAP_CSS_WIDTH = 720;

export interface TourPlanPaneProps {
  readonly subject: TourSubject;
  readonly source: TourPanoramaSource;
  readonly actions: TourEditorActions;
  readonly nodes: readonly TourNode[];
  readonly levels: readonly TourViewerLevel[];
  readonly nodeId: string;
  /** Η λήψη που βλέπει ο επισκέπτης σε αυτό το σημείο — αυτή ευθυγραμμίζεται. `null` ⇒ καμία έτοιμη λήψη. */
  readonly capture: { readonly id: string; readonly headingRad: number } | null;
  readonly nameOf: (nodeId: string) => string;
  /** Ο γράφος του επεξεργαστή (στάσεις + όροφοι με σχήματα) — το βήμα «Χώροι» (Γ3γ-2β). */
  readonly graph: TourViewerGraph;
}

function ScaleStep({ plan, imageUrl, levelKey, actions }: {
  readonly plan: TourViewerPlan; readonly imageUrl: string | null; readonly levelKey: TourLevelKey; readonly actions: TourEditorActions;
}) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const [open, setOpen] = useState(false);
  const pixels = plan.metresPerPixel === null ? null : Math.round(1 / plan.metresPerPixel);
  return (
    <section className="flex flex-wrap items-center gap-2">
      <p className="m-0 flex-1 text-sm text-muted-foreground">
        {pixels === null ? t(TOUR_EDITOR_KEYS.planScaleMissing) : t(TOUR_EDITOR_KEYS.planScaleValue, { pixels })}
      </p>
      <Button type="button" size="sm" variant={pixels === null ? 'default' : 'outline'} disabled={actions.busy} onClick={() => setOpen(true)}>
        {t(pixels === null ? TOUR_EDITOR_KEYS.planScaleSet : TOUR_EDITOR_KEYS.planScaleChange)}
      </Button>
      {/* Η κλίμακα στα pixel του ΠΡΩΤΟΤΥΠΟΥ (`plan.image`) — ο διάλογος δείχνει παράγωγο άλλου πλάτους. */}
      <CalibrateScaleDialog open={open} onOpenChange={setOpen} imageSrc={imageUrl} pixelSpace={plan.image}
        onSave={async (pixelsPerMetre) => { await actions.calibrate(levelKey, 1 / pixelsPerMetre); }} />
    </section>
  );
}

function PlaceStep({ props, plan, imageUrl }: { readonly props: TourPlanPaneProps; readonly plan: TourViewerPlan; readonly imageUrl: string }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const { actions, nodes, nodeId, capture, nameOf } = props;
  const [preview, setPreview] = useState<number | null>(null);
  const node = nodes.find((n) => n.id === nodeId);
  if (node === undefined || plan.metresPerPixel === null) return null;
  const metresPerPixel = plan.metresPerPixel;
  const place = (pixel: PixelPoint) => {
    const { x, y } = imagePixelToPlan(pixel, metresPerPixel);
    actions.position(nodeId, { x, y });
  };
  const onLevel = nodes.filter((n) => levelKeyId(n.levelKey) === levelKeyId(node.levelKey));
  return (
    <>
      <p id="tour-plan-place-hint" className="m-0 text-sm text-muted-foreground">{t(TOUR_EDITOR_KEYS.planPlaceHint, { name: nameOf(nodeId) })}</p>
      <TourPlanEditMap imageUrl={imageUrl} image={plan.image} metresPerPixel={metresPerPixel} nodes={onLevel} selectedNodeId={nodeId}
        headingRad={preview ?? capture?.headingRad ?? null} nameOf={nameOf} onPlace={place} />
      {node.position !== null && (
        <Button type="button" size="sm" variant="ghost" className="self-start" onClick={() => actions.position(nodeId, null)}>
          {t(TOUR_EDITOR_KEYS.planRemovePoint)}
        </Button>
      )}
      {node.position !== null && capture !== null && (
        <TourPlanDirection node={node} nodes={nodes} headingRad={capture.headingRad} onPreview={setPreview}
          onCommit={(headingRad) => actions.orient(capture.id, headingRad)} />
      )}
    </>
  );
}

export function TourPlanPane(props: TourPlanPaneProps) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const { subject, source, actions, nodes, levels, nodeId } = props;
  const [changing, setChanging] = useState(false);
  const node = nodes.find((n) => n.id === nodeId);
  const level = node === undefined ? undefined : levels.find((l) => levelKeyId(l.key) === levelKeyId(node.levelKey));
  if (node === undefined || level === undefined) return null;
  const plan = level.plan ?? null;
  const pick = async (choice: Parameters<TourEditorActions['choosePlan']>[1]) => {
    if (await actions.choosePlan(level.key, choice)) setChanging(false);
  };
  const imageUrl = plan === null ? null : source.planImageUrl(plan, EDIT_MAP_CSS_WIDTH);
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-3" aria-labelledby="tour-plan-title">
      <header className="flex items-center justify-between gap-2">
        <h3 id="tour-plan-title" className="m-0 text-sm font-semibold">{t(TOUR_EDITOR_KEYS.planTitle)}</h3>
        {plan !== null && !changing && (
          <Button type="button" size="sm" variant="ghost" onClick={() => setChanging(true)}>{t(TOUR_EDITOR_KEYS.planChange)}</Button>
        )}
      </header>
      {(plan === null || changing) && (
        <TourPlanPicker subject={subject} levelKey={level.key} busy={actions.busy} onPick={(choice) => void pick(choice)}
          onCancel={plan === null ? undefined : () => setChanging(false)} />
      )}
      {plan !== null && !changing && (
        <>
          <ScaleStep plan={plan} imageUrl={imageUrl} levelKey={level.key} actions={actions} />
          {imageUrl !== null && <PlaceStep props={props} plan={plan} imageUrl={imageUrl} />}
          {imageUrl !== null && (
            <TourSpacesLauncher graph={props.graph} levelId={levelKeyId(level.key)} levelKey={level.key} nodes={nodes} levels={levels}
              source={source} actions={actions} nameOf={props.nameOf} calibrated={plan.metresPerPixel !== null} />
          )}
        </>
      )}
    </section>
  );
}
