'use client';

/**
 * @fileoverview **Ο ΧΩΡΟΣ ΕΡΓΑΣΙΑΣ ΤΩΝ ΣΗΜΕΙΩΝ ΛΗΨΗΣ** — κατόψεις, φωτογραφίες, βορράς, επιθεωρητής, μία αποθήκευση (ADR-897 Φ3 · Φ5.2).
 * @related CaptureSpotControl.tsx (ο φιλοξενούμενος) · use-capture-spot-draft.ts (το πρόχειρο) · CaptureSpotEditSurface.tsx ·
 *   FloorplanNorthPanel.tsx (ο βορράς)
 * @module components/listings/capture-spots/CaptureSpotWorkspaceDialog
 *
 * 🔑 **Αγνωστικός ως προς την αποθήκευση**: δέχεται `declared` και επιστρέφει **ολόκληρη** τη νέα αποτύπωση
 *   (`CaptureSurvey` — σημεία **και** βορράς) στο `onSave`. Το γραφείο γράφει **ένα** PATCH (αισιόδοξα), ο ιδιοκτήτης
 *   στη φόρμα — η οθόνη δεν ξέρει και δεν χρειάζεται να ξέρει.
 * ⚠️ Το περιεχόμενο **γεννιέται σε κάθε άνοιγμα** (Radix): το πρόχειρο δεν επιβιώνει μιας ακύρωσης.
 */

import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { normalizeAngleDeg, radToDeg } from '@/lib/geometry/angle';
import type { CaptureSurvey } from '@/lib/listings/capture-survey';
import { headingFromCompass } from '@/lib/listings/floorplan-north';
import type { PhotoCaptureSpot } from '@/lib/listings/photo-capture-spot';
import type { CustodyKind } from '@/lib/workspace/custody-scope';
import { groupCaptureSpots, type ImageSize } from '@/lib/listings/photo-capture-spot-edit';
import type { CaptureFactsSuggestion } from '@/services/filesystem/capture-facts.client';

import { usePhotoSource } from '../focal-point/use-photo-source';
import type { CaptureSpotFloorplan, CaptureSpotPhoto } from './capture-spot-types';
import { CaptureSpotEditSurface } from './CaptureSpotEditSurface';
import { CaptureSpotInspector, type CompassHint } from './CaptureSpotInspector';
import { CaptureSpotPhotoList } from './CaptureSpotPhotoList';
import type { CaptureSpotMarker } from './CaptureSpotLayer';
import { FloorplanNorthPanel } from './FloorplanNorthPanel';
import { useCaptureFacts } from './use-capture-facts';
import { useCaptureSpotDraft, type CaptureSpotDraft } from './use-capture-spot-draft';
import { useNorthEstimate } from './use-north-estimate';

const K = 'property-market:photoCaptureSpots';

export interface CaptureSpotWorkspaceDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly photos: readonly CaptureSpotPhoto[];
  readonly floorplans: readonly CaptureSpotFloorplan[];
  readonly declared: CaptureSurvey;
  readonly onSave: (next: CaptureSurvey) => void;
  /** Σε ποιο διαμέρισμα ζουν οι φωτογραφίες — για τα στοιχεία λήψης (EXIF) από τον φρουρούμενο δρόμο. */
  readonly custody: CustodyKind;
}

type WorkspaceProps = Omit<CaptureSpotWorkspaceDialogProps, 'open'>;

interface FloorplanStageProps {
  readonly floorplan: CaptureSpotFloorplan;
  readonly draft: CaptureSpotDraft;
  readonly markers: readonly CaptureSpotMarker[];
  /** 📷 Το πεδίο του φακού της επιλεγμένης (EXIF) — μόνο για **νέα** τοποθέτηση. */
  readonly initialFovRad?: number;
}

/** Η ενεργή κάτοψη — φορτώνει τα δικά της bytes· νέα κάτοψη ⇒ νέο στιγμιότυπο (κλειδί), καθαρό μέγεθος. */
function FloorplanStage({ floorplan, draft, markers, initialFovRad }: FloorplanStageProps) {
  const { t } = useTranslation(['property-market']);
  const source = usePhotoSource(true, floorplan.source);
  const [size, setSize] = useState<ImageSize | null>(null);
  const [failed, setFailed] = useState(false);
  if (source.kind !== 'ready' || failed) {
    const loading = source.kind === 'loading' && !failed;
    return (
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {loading ? t(`${K}.imageLoading`) : t(`${K}.imageLoadFailed`)}
      </p>
    );
  }
  const selectedName = markers.find((marker) => marker.key === draft.selectedPhotoId)?.label ?? '';
  const northDegrees = Math.round(normalizeAngleDeg(radToDeg(draft.activeNorthRad ?? 0))) % 360;
  return (
    <CaptureSpotEditSurface
      src={source.src} alt={floorplan.name} size={size} onSize={setSize} onError={() => setFailed(true)}
      floorplanId={floorplan.id} markers={markers} selectedPhotoId={draft.selectedPhotoId} selected={draft.selectedSpot}
      onSelect={draft.select} onChange={draft.setSelected} initialFovRad={initialFovRad}
      northRad={draft.activeNorthRad} onNorth={draft.setActiveNorth}
      labels={{
        surface: t(`${K}.surfaceAria`),
        target: t(`${K}.targetHandleAria`, { name: selectedName }),
        fovEdge: t(`${K}.fovHandleAria`, { name: selectedName }),
        northGlyph: t(`${K}.north.glyph`),
        northArrow: t(`${K}.north.arrowAria`, { degrees: northDegrees }),
      }}
    />
  );
}

function useMarkersOf(draft: CaptureSpotDraft, photos: readonly CaptureSpotPhoto[]): readonly CaptureSpotMarker[] {
  return useMemo(() => photos.flatMap((photo) => {
    const spot = draft.spots.get(photo.id);
    return spot !== undefined && spot.floorplanFileId === draft.activeFloorplanId
      ? [{ key: photo.id, label: photo.name, spot }]
      : [];
  }), [draft.spots, draft.activeFloorplanId, photos]);
}

/**
 * 🧭 **Τι λέει η πυξίδα για την επιλεγμένη φωτογραφία** (Φ5.2) — πρόταση **μόνο** όταν ξέρουμε και την πυξίδα **και** τον
 * βορρά της κάτοψης όπου στέκεται η φωτογραφία (όχι της ενεργής καρτέλας: ο βορράς είναι ανά κάτοψη).
 */
function compassHintOf(facts: CaptureFactsSuggestion | null, spot: PhotoCaptureSpot | null, survey: CaptureSurvey): CompassHint {
  const compassRad = facts?.compassRad ?? null;
  if (compassRad === null || spot === null) return { kind: 'none' };
  const north = survey.north.get(spot.floorplanFileId);
  return north === undefined ? { kind: 'needsNorth' } : { kind: 'suggest', headingRad: headingFromCompass(north, compassRad) };
}

interface SidebarProps {
  readonly photos: readonly CaptureSpotPhoto[];
  readonly floorplanIds: readonly string[];
  readonly draft: CaptureSpotDraft;
  readonly facts: CaptureFactsSuggestion | null;
  readonly custody: CustodyKind;
}

function WorkspaceSidebar({ photos, floorplanIds, draft, facts, custody }: SidebarProps) {
  const { t } = useTranslation(['property-market']);
  const estimate = useNorthEstimate(draft.activeFloorplanId, draft.spots, custody);
  const groups = groupCaptureSpots(photos.map((photo) => photo.id), draft.spots, floorplanIds, draft.activeFloorplanId);
  const placed = photos.length - groups.unplaced.length - groups.orphaned.length;
  const selected = photos.find((photo) => photo.id === draft.selectedPhotoId) ?? null;
  return (
    <aside className="flex min-h-0 flex-col gap-4 overflow-auto">
      {draft.activeFloorplanId !== null && (
        <FloorplanNorthPanel northRad={draft.activeNorthRad} onNorth={draft.setActiveNorth}
          estimate={estimate.state} onEstimate={estimate.run} />
      )}
      <p className="m-0 text-sm font-medium" aria-live="polite">{t(`${K}.coverage`, { placed, total: photos.length })}</p>
      {selected === null
        ? <p className="m-0 text-sm text-muted-foreground">{t(`${K}.selectHint`)}</p>
        : <CaptureSpotInspector name={selected.name} spot={draft.selectedSpot} onChange={draft.setSelected}
            compass={compassHintOf(facts, draft.selectedSpot, draft.survey)} />}
      <CaptureSpotPhotoList photos={photos} groups={groups} selectedPhotoId={draft.selectedPhotoId} onSelect={draft.select} />
    </aside>
  );
}

function Workspace({ photos, floorplans, declared, onSave, onOpenChange, custody }: WorkspaceProps) {
  const { t } = useTranslation(['property-market', 'common']);
  const floorplanIds = useMemo(() => floorplans.map((floorplan) => floorplan.id), [floorplans]);
  const draft = useCaptureSpotDraft(declared, floorplanIds);
  const markers = useMarkersOf(draft, photos);
  // 📷 ADR-897 Φ5 — πεδίο φακού (νέα τοποθέτηση) + πυξίδα (πρόταση κατεύθυνσης, Φ5.2) της επιλεγμένης· μία κλήση ανά αρχείο.
  const facts = useCaptureFacts(draft.selectedPhotoId, custody, draft.selectedPhotoId !== null);
  const active = floorplans.find((floorplan) => floorplan.id === draft.activeFloorplanId) ?? null;

  return (
    <>
      <section className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="flex min-h-0 flex-col gap-3 overflow-auto">
          {floorplans.length > 1 && (
            <Tabs value={draft.activeFloorplanId ?? undefined} onValueChange={draft.activate}>
              <TabsList aria-label={t(`${K}.floorplansAria`)}>
                {floorplans.map((floorplan, index) => (
                  <TabsTrigger key={floorplan.id} value={floorplan.id}>
                    {floorplan.name || t(`${K}.floorplanTab`, { index: index + 1 })}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}
          {active !== null && (
            <FloorplanStage key={active.id} floorplan={active} draft={draft} markers={markers}
              initialFovRad={draft.selectedSpot === null ? facts?.fovRad ?? undefined : undefined} />
          )}
        </section>
        <WorkspaceSidebar photos={photos} floorplanIds={floorplanIds} draft={draft} facts={facts} custody={custody} />
      </section>
      <DialogFooter className="gap-2">
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t('common:buttons.cancel')}</Button>
        <Button type="button" disabled={!draft.dirty} onClick={() => { onSave(draft.survey); onOpenChange(false); }}>
          {t(`${K}.save`)}
        </Button>
      </DialogFooter>
    </>
  );
}

export function CaptureSpotWorkspaceDialog({ open, ...workspace }: CaptureSpotWorkspaceDialogProps) {
  const { t } = useTranslation(['property-market']);
  return (
    <Dialog open={open} onOpenChange={workspace.onOpenChange}>
      <DialogContent size="fullscreen" className="flex flex-col">
        <DialogHeader>
          <DialogTitle>{t(`${K}.title`)}</DialogTitle>
          <DialogDescription>{t(`${K}.description`)}</DialogDescription>
        </DialogHeader>
        <Workspace {...workspace} />
      </DialogContent>
    </Dialog>
  );
}
