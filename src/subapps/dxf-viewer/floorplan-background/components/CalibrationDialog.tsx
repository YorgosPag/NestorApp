'use client';

/**
 * ADR-340 / ADR-929 Φ5.2 — ο διάλογος βαθμονόμησης κλίμακας του υποβάθρου.
 *
 * Ροή (Revit «Resize graphically» / ArchiCAD «Define graphically», και πέρα από αυτούς):
 * 1. «Βαθμονόμηση» στο πάνελ ⇒ ο καμβάς ζητά τα άκρα A, B μιας γνωστής διάστασης (με OSNAP).
 * 2. Ο διάλογος ανοίγει μόνος του: πληκτρολογείς το μήκος («10,30 m») και βλέπεις ζωντανά τη λύση.
 * 3. Προαιρετικά «Προσθήκη δεύτερου μήκους» ⇒ ο καμβάς ζητά C, D. Κάθετο στο πρώτο ⇒ χωριστή κλίμακα
 *    X/Y (τέντωμα σαρωτή)· παράλληλο ⇒ έλεγχος με απόκλιση %.
 * 4. «Εφαρμογή» γράφει **αυτό που δείχνει η προεπισκόπηση** — ίδια συνάρτηση, καμία δεύτερη πράξη.
 *
 * Self-contained: διαβάζει τη συνεδρία από το store· ανοίγει όταν συμπληρωθούν τα σημεία του βήματος.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatNumber } from '@/lib/intl-formatting';
import { resolveSceneUnits, type SceneUnits } from '../../utils/scene-units';
import type { LevelSceneReader } from '../../systems/levels/level-scene-accessor';
import { isCalibrationPickComplete, useFloorplanBackgroundStore } from '../stores/floorplanBackgroundStore';
import { useCalibrationPreview, type CalibrationPreview } from '../hooks/useCalibration';
import { buildCalibrationData, type CalibrationLengthDraft } from '../geometry/calibration-draft';
import { commitCalibration } from '../services/commit-calibration';
import { useAnnounceCalibration } from '../hooks/useAnnounceCalibration';
import { CalibrationAlignToggle, CalibrationReferenceField, CalibrationSecondReference, CalibrationSummary } from './CalibrationDialogParts';

const KEY = 'panels.floorplanBackground.calibration';
const EMPTY_LENGTH: CalibrationLengthDraft = { text: '', unit: 'm' };

export interface CalibrationDialogProps {
  /** Για τις μονάδες της σκηνής του ενεργού επιπέδου (ADR-929 §6.1 #1). */
  readonly levelManager: LevelSceneReader;
}

function useSceneUnits(levelManager: LevelSceneReader): SceneUnits {
  const levelId = levelManager.currentLevelId;
  return levelId ? resolveSceneUnits(levelManager.getLevelScene(levelId)) : 'mm';
}

/** Μήκη ⇄ συνεδρία: το δεύτερο μήκος μετρά μόνο όταν έχουν δοθεί και τα C, D. */
function activeLengths(first: CalibrationLengthDraft, second: CalibrationLengthDraft, pointCount: number) {
  return pointCount >= 4 ? [first, second] : [first];
}

/** Το μήκος της πρώτης αναφοράς στην εικόνα, σε pixel (πληροφορία για τον άνθρωπο). */
function firstReferencePixels(preview: CalibrationPreview): number | null {
  if (preview.status !== 'solved') return null;
  const { pointA, pointB } = preview.references[0].record;
  return Math.hypot(pointB.x - pointA.x, pointB.y - pointA.y);
}

/** Η φόρμα του διαλόγου· νέα συνεδρία = καθαρή φόρμα (το state ζει όσο ζει ο always-mounted host). */
function useCalibrationForm(idle: boolean) {
  const [first, setFirst] = useState<CalibrationLengthDraft>(EMPTY_LENGTH);
  const [second, setSecond] = useState<CalibrationLengthDraft>(EMPTY_LENGTH);
  const [alignToAxis, setAlignToAxis] = useState(false);
  useEffect(() => {
    if (!idle) return;
    setFirst(EMPTY_LENGTH);
    setSecond(EMPTY_LENGTH);
    setAlignToAxis(false);
  }, [idle]);
  return { first, setFirst, second, setSecond, alignToAxis, setAlignToAxis };
}

/** Ο «εγκέφαλος» του διαλόγου: συνεδρία + φόρμα + ζωντανή λύση + η πράξη εφαρμογής. */
function useCalibrationDialogModel(levelManager: LevelSceneReader) {
  const session = useFloorplanBackgroundStore((s) => s.calibrationSession);
  const form = useCalibrationForm(session === null);
  const sceneUnits = useSceneUnits(levelManager);
  const pointCount = session?.points.length ?? 0;
  const { first, second, alignToAxis } = form;
  const lengths = useMemo(() => activeLengths(first, second, pointCount), [first, second, pointCount]);
  const preview = useCalibrationPreview(lengths, alignToAxis, sceneUnits);
  const announce = useAnnounceCalibration();
  const apply = () => {
    if (!session || preview.status !== 'solved') return;
    const data = buildCalibrationData(preview.references, preview.solution, sceneUnits, alignToAxis, Date.now(), 'manual');
    // Αισιόδοξα: εφαρμόζεται και κλείνει αμέσως· το μήνυμα λέει αν έμεινε (ADR-929 Φ5.2γ).
    void commitCalibration(session.floorId, preview.solution.transform, data).then(announce);
  };
  return { session, form, preview, apply };
}

export function CalibrationDialog({ levelManager }: CalibrationDialogProps) {
  const { t } = useTranslation(['dxf-viewer-panels']);
  const { session, form, preview, apply } = useCalibrationDialogModel(levelManager);
  const store = useFloorplanBackgroundStore.getState;
  const pixels = firstReferencePixels(preview);
  return (
    <AlertDialog open={isCalibrationPickComplete(session)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t(`${KEY}.title`)}</AlertDialogTitle>
          <AlertDialogDescription>
            {pixels !== null && t(`${KEY}.pixelDist`, { dist: formatNumber(pixels, { maximumFractionDigits: 1 }) })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <section className="space-y-4 py-2">
          <CalibrationReferenceField id="cal-length-1" label={t(`${KEY}.referenceFirst`)} draft={form.first} onChange={form.setFirst} t={t} />
          <CalibrationSecondReference
            active={session?.target === 4}
            draft={form.second}
            onChange={form.setSecond}
            onAdd={() => store().requestSecondCalibrationReference()}
            onRemove={() => store().stepBackCalibration()}
            t={t}
          />
          <CalibrationAlignToggle checked={form.alignToAxis} onChange={form.setAlignToAxis} t={t} />
          <CalibrationSummary preview={preview} t={t} />
        </section>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => store().cancelCalibration()}>{t(`${KEY}.cancel`)}</AlertDialogCancel>
          <AlertDialogAction onClick={apply} disabled={preview.status !== 'solved'}>{t(`${KEY}.apply`)}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
