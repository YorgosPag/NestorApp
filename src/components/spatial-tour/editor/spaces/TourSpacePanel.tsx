'use client';

/**
 * @fileoverview **ΤΟ ΠΑΝΕΛ ΤΟΥ ΕΠΙΛΕΓΜΕΝΟΥ** — πρόταση (έγκριση/απόρριψη/διαχωρισμός), εγκεκριμένος χώρος (στοιχεία/διαγραφή),
 * νοητή γραμμή (αφαίρεση) (ADR-884 Φ2στ-γ Γ3γ-2β · §12 Δ8.1–Δ8.6 · Δ9.2–Δ9.6).
 * @related `TourSpaceDetails.tsx` (όνομα · εμβαδά · φύλακας) · `useShapeEdit.ts` (`pendingReplace`) ·
 *   `lib/spatial-tour/tour-editor-optimistic.ts` (`judgeShapeCommand` — ο ΙΔΙΟΣ κριτής) · `../useTourEditorActions.ts`
 * @module components/spatial-tour/editor/spaces/TourSpacePanel
 *
 * 🔑 **Η οθόνη δεν προσφέρει πράξη που ο γραφέας θα αρνηθεί** (Δ9.6): η «Έγκριση» τρέχει πρώτα τον κριτή πάνω στην **ίδια**
 *   εντολή (ίδιο οριστικό id) — αν απαντά «επικαλύπτει», το κουμπί είναι ανενεργό και ο λόγος γραμμένος από πάνω του.
 * 🔑 **Διαχωρισμός = εγγραφή της γραμμής, μετά νέα ανίχνευση** (Δ8.2): η πρόταση του ενιαίου χώρου φεύγει και ξαναρωτιούνται τα
 *   σημεία — τώρα η γραμμή είναι τοίχος και βγαίνουν δύο χώροι.
 */

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatNumber } from '@/lib/intl-formatting';
import { pointInPolygon, type PlanarPoint } from '@/lib/geometry/planar-polygon';
import { spaceDraftOf, type SpaceProposal } from '@/lib/spatial-tour/space-edit/tour-space-proposals';
import { judgeShapeCommand } from '@/lib/spatial-tour/tour-editor-optimistic';
import type { TourGraphCommand } from '@/lib/spatial-tour/tour-graph-edit';
import { normalizeTourRoom, sameTourRoom } from '@/lib/spatial-tour/tour-room';
import { draftOf } from '@/lib/spatial-tour/tour-space-edit';
import type { TourViewerSeparation, TourViewerSpace } from '@/lib/spatial-tour/viewer/tour-viewer-shapes';
import type { PlacedStop } from '@/lib/spatial-tour/viewer/tour-viewer-plan';
import type { SpatialTour, TourLevelKey } from '@/types/spatial-tour';

import { SPATIAL_TOUR_NS } from '../../spatial-tour-namespace';
import { tourGraphRefusalKey } from '../tour-shape-labels';
import type { TourEditorActions } from '../useTourEditorActions';
import {
  dropProposal,
  putProposal,
  selectTarget,
  updateSpaceEditor,
  useSpaceEditor,
  type SpaceEditorState,
  type SpaceEditorStore,
} from './space-editor-store';
import { TOUR_SPACE_EDITOR_KEYS } from './tour-space-editor-labels';
import { TourSpaceDetails, detailsOf, useSpaceDetails, type SavedSpaceDetails, type SpaceDetailsState } from './TourSpaceDetails';
import { pendingReplace } from './useShapeEdit';
import type { SpaceProposalsHandle } from './useSpaceProposals';

export interface SpacePanelContext {
  readonly store: SpaceEditorStore;
  readonly levelKey: TourLevelKey;
  readonly spaces: readonly TourViewerSpace[];
  readonly separations: readonly TourViewerSeparation[];
  readonly stops: readonly PlacedStop[];
  readonly nameOf: (nodeId: string) => string;
  /** Ο γράφος της οθόνης — ο κριτής του προελέγχου. */
  readonly graph: Pick<SpatialTour, 'levels' | 'nodes'>;
  readonly actions: TourEditorActions;
  readonly proposals: SpaceProposalsHandle;
}

/** Το όνομα από σημείο **με δηλωμένο χώρο** μέσα στο σχήμα (Δ8.5) — `null` ⇒ ο χώρος ονομάζεται μόνος του. */
function pointNameInside(ctx: SpacePanelContext, points: readonly PlanarPoint[]): string | null {
  const stop = ctx.stops.find((s) => s.entry.node.room != null && pointInPolygon(s.point, points));
  return stop === undefined ? null : ctx.nameOf(stop.entry.node.id);
}

function Refusal({ command, graph }: { readonly command: TourGraphCommand | null; readonly graph: SpacePanelContext['graph'] }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const reason = command === null ? null : judgeShapeCommand(command, graph);
  return reason === null ? null : <p role="alert" className="m-0 text-sm text-destructive">{t(tourGraphRefusalKey(reason))}</p>;
}

function SeparationSuggestion({ ctx, proposal }: { readonly ctx: SpacePanelContext; readonly proposal: SpaceProposal }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const suggestion = proposal.separation;
  if (suggestion === null) return null;
  const other = ctx.stops.filter((s) => s.entry.node.id !== proposal.seedNodeId)[suggestion.otherStopIndex];
  const apply = async () => {
    const { a, b } = suggestion.segment;
    if (!(await ctx.actions.separate(ctx.levelKey, null, a, b))) return;
    updateSpaceEditor(ctx.store, (s) => dropProposal(s, proposal.key));
    await ctx.proposals.fill();
  };
  const keep = () => updateSpaceEditor(ctx.store, (s) => ({
    ...s, proposals: s.proposals.map((p) => (p.key === proposal.key ? { ...p, separation: null } : p)),
  }));
  return (
    <section className="space-y-2 rounded-md border border-border bg-muted p-2" aria-labelledby={`${proposal.key}-split`}>
      <h4 id={`${proposal.key}-split`} className="m-0 text-sm font-medium">
        {t(TOUR_SPACE_EDITOR_KEYS.separationTitle, { name: other === undefined ? '' : ctx.nameOf(other.entry.node.id) })}
      </h4>
      <p className="m-0 text-sm">{t(TOUR_SPACE_EDITOR_KEYS.separationBody, { width: formatNumber(suggestion.widthM, { maximumFractionDigits: 1 }) })}</p>
      <footer className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => void apply()}>{t(TOUR_SPACE_EDITOR_KEYS.separationApply)}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={keep}>{t(TOUR_SPACE_EDITOR_KEYS.separationKeep)}</Button>
      </footer>
    </section>
  );
}

const NO_DETAILS: SavedSpaceDetails = { room: null, declaredArea: null };

function ProposalPanel({ ctx, proposal }: { readonly ctx: SpacePanelContext; readonly proposal: SpaceProposal }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const state = useSpaceDetails(NO_DETAILS);
  const pointName = pointNameInside(ctx, proposal.outline);
  const details = detailsOf(state, NO_DETAILS, pointName !== null);
  const command: TourGraphCommand | null = details === null ? null : {
    op: 'space', levelKey: ctx.levelKey, spaceId: proposal.spaceId, mode: 'create', space: spaceDraftOf(proposal.outline, proposal.source, details),
  };
  const refused = command === null || judgeShapeCommand(command, ctx.graph) !== null;
  // Αισιόδοξα (Gmail): η πρόταση γίνεται αμέσως ο επιλεγμένος χώρος· άρνηση ⇒ η πρόταση ξαναγυρίζει ίδια (ίδιο id).
  const approve = async () => {
    if (command === null || command.op !== 'space') return;
    updateSpaceEditor(ctx.store, (s) => selectTarget(dropProposal(s, proposal.key), { kind: 'space', id: command.spaceId }));
    if (!(await ctx.actions.space(ctx.levelKey, { mode: 'create', spaceId: command.spaceId }, command.space))) {
      updateSpaceEditor(ctx.store, (s) => putProposal(s, proposal, true));
    }
  };
  return (
    <>
      <h3 className="m-0 text-base font-semibold">{t(TOUR_SPACE_EDITOR_KEYS.proposal)}</h3>
      {!proposal.orthogonal && <p role="status" className="m-0 text-sm text-muted-foreground">{t(TOUR_SPACE_EDITOR_KEYS.notOrthogonal)}</p>}
      <SeparationSuggestion ctx={ctx} proposal={proposal} />
      <TourSpaceDetails idBase={`space-${proposal.spaceId}`} state={state} points={proposal.outline} pointName={pointName} />
      <Refusal command={command} graph={ctx.graph} />
      <footer className="flex flex-wrap gap-2">
        <Button type="button" disabled={refused} onClick={() => void approve()}>{t(TOUR_SPACE_EDITOR_KEYS.approve)}</Button>
        <Button type="button" variant="ghost" onClick={() => updateSpaceEditor(ctx.store, (s) => dropProposal(s, proposal.key))}>
          {t(TOUR_SPACE_EDITOR_KEYS.discard)}
        </Button>
      </footer>
    </>
  );
}

function savedOf(space: TourViewerSpace): SavedSpaceDetails {
  return { room: space.room ?? null, declaredArea: space.declaredArea ?? null };
}

/** Άλλαξε κάτι στα στοιχεία (και στέκει); — όνομα με την ΙΔΙΑ σύγκριση του γραφέα, δήλωση τιμή + πηγή. */
function detailsChanged(state: SpaceDetailsState, saved: SavedSpaceDetails, usePointName: boolean): boolean {
  const next = detailsOf(state, saved, usePointName);
  if (next === null) return false;
  const room = next.room === null ? null : normalizeTourRoom(next.room);
  const a = next.declaredArea;
  const b = saved.declaredArea;
  const sameDeclared = a === null || b === null ? a === b : a.areaM2 === b.areaM2 && a.source === b.source;
  return !sameTourRoom(room, saved.room) || !sameDeclared;
}

function SpacePanel({ ctx, space }: { readonly ctx: SpacePanelContext; readonly space: TourViewerSpace }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const edit = useSpaceEditor(ctx.store, readEdit);
  const saved = savedOf(space);
  const state = useSpaceDetails(saved);
  const points = edit?.spaceId === space.id ? edit.points : space.points;
  const pointName = pointNameInside(ctx, points);
  const pending = pendingReplace({ ...ctx.store.get(), edit }, ctx.spaces, ctx.levelKey);
  // Η πηγή του σχήματος μένει ό,τι ήταν (και `dxf`) — αλλάζουν μόνο όνομα/δήλωση (και οι γωνίες, αν έχουν πρόχειρο).
  const save = () => {
    const details = detailsOf(state, saved, pointName !== null);
    if (details === null) return;
    void ctx.actions.space(ctx.levelKey, { mode: 'replace', spaceId: space.id }, { ...draftOf(space), ...details, points });
  };
  const remove = () => {
    updateSpaceEditor(ctx.store, (s) => selectTarget(s, null));
    void ctx.actions.unspace(ctx.levelKey, space.id);
  };
  return (
    <>
      <h3 className="m-0 text-base font-semibold">{t(TOUR_SPACE_EDITOR_KEYS.approvedSpace)}</h3>
      <TourSpaceDetails idBase={`space-${space.id}`} state={state} points={points} pointName={pointName} />
      <Refusal command={pending} graph={ctx.graph} />
      <footer className="flex flex-wrap gap-2">
        <Button type="button" disabled={!detailsChanged(state, saved, pointName !== null)} onClick={save}>{t(TOUR_SPACE_EDITOR_KEYS.saveDetails)}</Button>
        <Button type="button" variant="ghost" onClick={remove}>{t(TOUR_SPACE_EDITOR_KEYS.remove)}</Button>
      </footer>
    </>
  );
}

function SeparationPanel({ ctx, line }: { readonly ctx: SpacePanelContext; readonly line: TourViewerSeparation }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const remove = async () => {
    updateSpaceEditor(ctx.store, (s) => selectTarget(s, null));
    if (await ctx.actions.unseparate(ctx.levelKey, line.id)) await ctx.proposals.fill();
  };
  return (
    <>
      <h3 className="m-0 text-base font-semibold">{t(TOUR_SPACE_EDITOR_KEYS.separationSelected)}</h3>
      <Button type="button" variant="ghost" className="self-start" onClick={() => void remove()}>{t(TOUR_SPACE_EDITOR_KEYS.separationRemove)}</Button>
    </>
  );
}

const readSelection = (s: SpaceEditorState) => s.selection;
const readProposals = (s: SpaceEditorState) => s.proposals;
const readEdit = (s: SpaceEditorState) => s.edit;

export function TourSpacePanel({ ctx }: { readonly ctx: SpacePanelContext }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const selection = useSpaceEditor(ctx.store, readSelection);
  const proposals = useSpaceEditor(ctx.store, readProposals);
  const proposal = selection?.kind === 'proposal' ? proposals.find((p) => p.key === selection.key) : undefined;
  const space = selection?.kind === 'space' ? ctx.spaces.find((s) => s.id === selection.id) : undefined;
  const line = selection?.kind === 'separation' ? ctx.separations.find((l) => l.id === selection.id) : undefined;
  return (
    <section className="flex flex-col gap-3" aria-live="polite">
      {proposal !== undefined && <ProposalPanel key={proposal.key} ctx={ctx} proposal={proposal} />}
      {space !== undefined && <SpacePanel key={space.id} ctx={ctx} space={space} />}
      {line !== undefined && <SeparationPanel key={line.id} ctx={ctx} line={line} />}
      {proposal === undefined && space === undefined && line === undefined && (
        <p className="m-0 text-sm text-muted-foreground">{t(TOUR_SPACE_EDITOR_KEYS.selectPrompt)}</p>
      )}
    </section>
  );
}
