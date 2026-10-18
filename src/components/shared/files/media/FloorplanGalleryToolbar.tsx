'use client';

/**
 * ADR-912 §12.17 — **Η γραμμή εργαλείων της κάτοψης: ΜΙΑ σειρά στο στενό, όλα στο φαρδύ.**
 *
 * 🔴 Μετρημένο (390×844, στιγμιότυπο Giorgio 2026-10-18): σειρά «‹ Κατόψεις property-fl… (1/2) ›» 49px + 13 κουμπιά σε
 *   2 σειρές 85px — 134px πάνω από μια κάτοψη 280px. Το όνομα αρχείου ήταν τεχνικό και το έκοβε το `truncate`.
 * 🏆 Google Maps · Apple Photos · Drive viewer: στο κινητό μένουν 3–4 ενέργειες και «⋯»· η μεγέθυνση γίνεται με
 *   **pinch** (ήδη στο `useZoomPan`), άρα τα +/−/100% δεν πιάνουν θέση — ζουν στο «⋯» για όποιον δεν έχει δύο δάχτυλα.
 *
 * 🔑 **Αποφασίζει ο χώρος της γραμμής, όχι το παράθυρο** (`useContainerClass`, ADR-912 §2.1): η κάτοψη στενεύει και σε
 *   desktop με ανοιχτό επιθεωρητή. `measuring` (SSR · jsdom) ⇒ η φαρδιά, όπως πριν.
 * 🔑 **Καμία δυνατότητα δεν χάνεται**: ό,τι φεύγει από τη σειρά μπαίνει στο ΕΝΑ «⋯» (`ActionOverflowMenu`) — μέτρηση και
 *   3D ως `menuitemcheckbox`, η διαγραφή τελευταία, κόκκινη, κάτω από διαχωριστικό. Ενεργό εργαλείο μέτρησης μένει
 *   **ορατό** στη σειρά, ώστε να κλείνει με ένα πάτημα.
 * 🔑 **‹ 1/2 ›** = το ΕΝΑ `FileSequenceNav` (§12.16)· στο στενό χωρίς όνομα αρχείου — το λέει ήδη η καρτέλα.
 */

import { useRef } from 'react';
import { Box, Compass, Download, Eraser, Maximize2, Moon, PencilRuler, Sun, Trash2, ZoomIn, ZoomOut } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ToggleButton } from '@/components/ui/toggle-button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { FileSequenceNav } from '@/components/file-manager/FileSequenceNav';
import type { FileSequence } from '@/components/file-manager/hooks/useFileSequence';
import { ActionOverflowMenu } from '@/core/entity-headers/EntityHeaderActions';
import type { EntityHeaderAction } from '@/core/entity-headers/UnifiedEntityHeaderSystem';
import { useContainerClass } from '@/hooks/media/useContainerClass';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSceneFileLevelId } from '@/hooks/useSceneFileLevelId';
import type { useZoomPan } from '@/hooks/useZoomPan';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { dxfViewerLevelHref } from '@/lib/dxf-viewer/dxf-viewer-routes';
import { useRouter } from '@/lib/workspace/navigation';
import { cn } from '@/lib/utils';
import { Bim3DToggleButton } from '@/components/shared/files/media/Bim3DToggleButton';
import { FloorplanGalleryZoomControls } from '@/components/shared/files/media/FloorplanGalleryZoomControls';
import { FloorplanInkPicker } from '@/components/shared/files/media/FloorplanInkPicker';
import { MEASURE_TOOLS, MeasureToolbar, type MeasureMode } from '@/components/shared/files/media/MeasureToolbar';
import { OpenInDxfViewerButton } from '@/components/shared/files/media/OpenInDxfViewerButton';
import { useLocalMeasurements } from '@/components/shared/files/media/useLocalMeasurements';
import type { DxfDrawingMode } from '@/components/shared/files/media/floorplan-gallery-config';
import { getFileIcon } from '@/components/shared/files/media/floorplan-gallery-config';

/** Κάτω από αυτό το πλάτος **της γραμμής** (rem) τα εργαλεία γίνονται μία σειρά + «⋯». */
export const FLOORPLAN_TOOLBAR_COMPACT_BELOW_REM = 40;

export interface FloorplanToolbarDxf {
  readonly drawingMode: DxfDrawingMode;
  readonly onToggleDrawingMode: () => void;
  readonly inkColor: string | null;
  readonly onInkChange: (ink: string | null) => void;
  /** `null` = η σκηνή δεν έχει στοιχεία BIM ⇒ καμία εναλλαγή 3D. */
  readonly bim3D: { readonly active: boolean; readonly onToggle: () => void } | null;
}

export interface FloorplanGalleryToolbarProps {
  readonly sequence: FileSequence | null;
  readonly fileName: string | null;
  readonly fileExt: string;
  readonly zp: ReturnType<typeof useZoomPan>;
  readonly onOpenFullscreen: () => void;
  /** `null` = η τρέχουσα κάτοψη δεν είναι DXF. */
  readonly dxf: FloorplanToolbarDxf | null;
  readonly measureMode: MeasureMode | null;
  readonly onMeasureModeChange: (mode: MeasureMode | null) => void;
  readonly measureScopeKey: string | null;
  /** Το αρχείο σκηνής που προβάλλεται — για το «Άνοιγμα στο DXF»· `null` εκτός DXF. */
  readonly dxfFileId: string | null;
  /** `null` = η βαθμονόμηση δεν προσφέρεται (μόνο raster με υπόβαθρο). */
  readonly onCalibrate: (() => void) | null;
  readonly onDownload: () => void;
  readonly downloadDisabled: boolean;
  readonly onDelete?: () => void;
}

const DIVIDER = 'w-px h-6 bg-border mx-1';

export function FloorplanGalleryToolbar(props: FloorplanGalleryToolbarProps) {
  const { t } = useTranslation(['files-media']);
  const ref = useRef<HTMLElement>(null);
  const compact = useContainerClass(ref, FLOORPLAN_TOOLBAR_COMPACT_BELOW_REM, { zeroWidth: 'measuring' }) === 'narrow';

  return (
    <header
      ref={ref}
      data-floorplan-toolbar={compact ? 'compact' : 'wide'}
      className={cn(
        'flex items-center justify-between gap-1 border-b bg-background/95 p-1 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        compact ? 'flex-nowrap' : 'flex-wrap gap-y-1 sm:p-2',
      )}
      aria-label={t('files-media:floorplan.actions')}
    >
      {compact ? <CompactToolbar {...props} /> : <WideToolbar {...props} />}
    </header>
  );
}

// ── ΣΤΕΝΗ: ‹ 1/2 › · [ενεργή μέτρηση] · χρώμα · πλήρης οθόνη · λήψη · ⋯ ─────────────────────────────────────────

function CompactToolbar(props: FloorplanGalleryToolbarProps) {
  const { t } = useTranslation(['files-media']);
  const iconSizes = useIconSizes();
  const { actions, destructive } = useOverflowActions(props);

  return (
    <>
      {props.sequence ? <FileSequenceNav sequence={props.sequence} /> : <span aria-hidden="true" />}
      <nav className="flex min-w-0 items-center gap-0.5" aria-label={t('files-media:floorplan.actions')}>
        <ActiveMeasureToggle mode={props.measureMode} onModeChange={props.onMeasureModeChange} />
        {props.dxf && <FloorplanInkPicker inkColor={props.dxf.inkColor} onChange={props.dxf.onInkChange} />}
        <IconAction label={t('files-media:floorplan.fullscreen')} onClick={props.onOpenFullscreen}>
          <Maximize2 className={iconSizes.sm} aria-hidden="true" />
        </IconAction>
        <IconAction label={t('files-media:floorplan.download')} onClick={props.onDownload} disabled={props.downloadDisabled}>
          <Download className={iconSizes.sm} aria-hidden="true" />
        </IconAction>
        <ActionOverflowMenu actions={actions} destructive={destructive} />
      </nav>
    </>
  );
}

/** Το ενεργό εργαλείο μέτρησης μένει στη σειρά: ό,τι είναι «αναμμένο» δεν κρύβεται σε μενού. */
function ActiveMeasureToggle({ mode, onModeChange }: { mode: MeasureMode | null; onModeChange: (m: MeasureMode | null) => void }) {
  const { t } = useTranslation(['files-media']);
  const iconSizes = useIconSizes();
  const tool = MEASURE_TOOLS.find((candidate) => candidate.mode === mode);
  if (!tool) return null;
  const label = t(tool.labelKey);
  return (
    <ToggleButton pressed variant="ghost" size="sm" aria-label={label} onClick={() => onModeChange(null)} className="h-9 w-9 p-0">
      <tool.Icon className={iconSizes.sm} aria-hidden={true} />
    </ToggleButton>
  );
}

function IconAction({ label, onClick, disabled, children }: {
  label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="sm" onClick={onClick} disabled={disabled} aria-label={label} className="h-9 w-9 p-0">
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** Ό,τι δεν χωρά στη σειρά, με τη σειρά του φαρδιού: θέαση → μέτρηση → εργασία → (κόκκινο) διαγραφή. */
function useOverflowActions(props: FloorplanGalleryToolbarProps) {
  const { t } = useTranslation(['files-media', 'bim3d']);
  const router = useRouter();
  const { count, clearAll } = useLocalMeasurements(props.measureScopeKey);
  const levelId = useSceneFileLevelId(props.dxfFileId);
  const { zp, dxf } = props;

  const actions: EntityHeaderAction[] = [
    { label: t('files-media:floorplan.zoomIn'), icon: ZoomIn, onClick: zp.zoomIn },
    { label: t('files-media:floorplan.zoomOut'), icon: ZoomOut, onClick: zp.zoomOut },
    { label: t('files-media:floorplan.resetZoom'), icon: Maximize2, onClick: zp.resetAll },
    ...(dxf ? [{
      label: dxf.drawingMode === 'dark' ? t('files-media:floorplan.lightMode') : t('files-media:floorplan.darkMode'),
      icon: dxf.drawingMode === 'dark' ? Sun : Moon,
      onClick: dxf.onToggleDrawingMode,
    }] : []),
    ...(dxf?.bim3D ? [{ label: t('bim3d:modeToggle.label'), icon: Box, onClick: dxf.bim3D.onToggle, pressed: dxf.bim3D.active }] : []),
    ...MEASURE_TOOLS.map(({ mode, Icon, labelKey }) => ({
      label: t(labelKey),
      icon: Icon,
      pressed: props.measureMode === mode,
      onClick: () => props.onMeasureModeChange(props.measureMode === mode ? null : mode),
    })),
    ...(count > 0 ? [{ label: t('files-media:floorplan.measure.clearAll'), icon: Eraser, onClick: clearAll }] : []),
    ...(props.onCalibrate ? [{ label: t('files-media:floorplan.calibrate.openButton'), icon: Compass, onClick: props.onCalibrate }] : []),
    ...(levelId ? [{ label: t('files-media:floorplan.openInDxf'), icon: PencilRuler, onClick: () => router.push(dxfViewerLevelHref(levelId)) }] : []),
  ];
  const destructive: EntityHeaderAction[] = props.onDelete
    ? [{ label: t('files-media:floorplan.delete'), icon: Trash2, onClick: props.onDelete }]
    : [];
  return { actions, destructive };
}

// ── ΦΑΡΔΙΑ: η διάταξη ως τώρα (όνομα + ‹ 1/2 › · όλα τα εργαλεία, με αναδίπλωση) ─────────────────────────────────

function WideToolbar(props: FloorplanGalleryToolbarProps) {
  const { t } = useTranslation(['files-media']);
  const { dxf } = props;

  return (
    <>
      <nav className="flex min-w-0 items-center gap-2" aria-label={t('files-media:floorplan.navigation')}>
        {getFileIcon(props.fileExt)}
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="font-medium truncate max-w-[16rem]">{props.fileName || t('files-media:floorplan.untitled')}</span>
          </TooltipTrigger>
          <TooltipContent>{props.fileName}</TooltipContent>
        </Tooltip>
        {props.sequence && <FileSequenceNav sequence={props.sequence} />}
      </nav>
      {/* ADR-907 §11.14 — αναδιπλώνει: στα 320 / 390 μετρήθηκαν 9 ενέργειες κομμένες εκτός κάδρου, άφταστες. */}
      <nav className="flex flex-wrap items-center gap-1" aria-label={t('files-media:floorplan.actions')}>
        {dxf && <WideDxfControls dxf={dxf} />}
        <MeasureToolbar mode={props.measureMode} onModeChange={props.onMeasureModeChange} scopeKey={props.measureScopeKey} />
        {props.onCalibrate && <CalibrateButton onClick={props.onCalibrate} />}
        <span className={DIVIDER} aria-hidden="true" />
        <FloorplanGalleryZoomControls zp={props.zp} showFullscreen onOpenFullscreen={props.onOpenFullscreen} />
        <span className={DIVIDER} aria-hidden="true" />
        <OpenInDxfViewerButton fileId={props.dxfFileId} />
        <WideFileActions {...props} />
      </nav>
    </>
  );
}

function WideDxfControls({ dxf }: { dxf: FloorplanToolbarDxf }) {
  const { t } = useTranslation(['files-media']);
  const iconSizes = useIconSizes();
  const toLight = dxf.drawingMode === 'dark';
  const label = toLight ? t('files-media:floorplan.lightMode') : t('files-media:floorplan.darkMode');
  return (
    <>
      {dxf.bim3D && <Bim3DToggleButton active={dxf.bim3D.active} onToggle={dxf.bim3D.onToggle} />}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" onClick={dxf.onToggleDrawingMode} aria-label={label} aria-pressed={!toLight}>
            {toLight ? <Sun className={iconSizes.sm} aria-hidden="true" /> : <Moon className={iconSizes.sm} aria-hidden="true" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <FloorplanInkPicker inkColor={dxf.inkColor} onChange={dxf.onInkChange} />
      <span className={DIVIDER} aria-hidden="true" />
    </>
  );
}

function CalibrateButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation(['files-media']);
  const iconSizes = useIconSizes();
  const label = t('files-media:floorplan.calibrate.openButton');
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="sm" onClick={onClick} aria-label={label}>
          <Compass className={iconSizes.sm} aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function WideFileActions({ onDownload, downloadDisabled, onDelete }: FloorplanGalleryToolbarProps) {
  const { t } = useTranslation(['files-media']);
  const iconSizes = useIconSizes();
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" onClick={onDownload} disabled={downloadDisabled} aria-label={t('files-media:floorplan.download')}>
            <Download className={iconSizes.sm} aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('files-media:floorplan.download')}</TooltipContent>
      </Tooltip>
      {onDelete && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive hover:text-destructive" aria-label={t('files-media:floorplan.delete')}>
              <Trash2 className={iconSizes.sm} aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('files-media:floorplan.delete')}</TooltipContent>
        </Tooltip>
      )}
    </>
  );
}
