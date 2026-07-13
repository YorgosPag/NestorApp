/**
 * ADR-650 M7 — «ένα κουμπί → φάκελος»: ο μόνος αδιάφανος (impure) κρίκος.
 *
 * Ό,τι είναι λογική ζει σε καθαρές συναρτήσεις (`buildSurveyDeliverables`, `survey-sheet`,
 * `survey-folder`). Εδώ γίνεται μόνο η **ενορχήστρωση**: διάβασε τα stores → χτίσε τα παραδοτέα →
 * (1) βάλε τους πίνακες ΜΕΣΑ στο σχέδιο ως ένα block → (2) εξήγαγε τον φάκελο ως ZIP.
 *
 * Η σειρά είναι σκόπιμη και είναι ΚΑΙ η απάντηση στο race condition: το DXF του φακέλου χτίζεται
 * από μια σκηνή που **ρητά** περιλαμβάνει το block των πινάκων (`[...scene.entities, block]`), αντί
 * να ξαναδιαβαστεί η σκηνή μετά το commit και να ελπίζουμε ότι το React state πρόλαβε. Έτσι το
 * παραδοτέο DXF και το σχέδιο στην οθόνη λένε πάντα το ίδιο πράγμα (N.7.2 #2/#3 — idempotent, μη
 * εξαρτώμενο από χρονισμό).
 */

import { useCallback } from 'react';
import { useTranslation } from '@/i18n';
import { useLevels } from '../../levels';
import { appendEntityToScene } from '../../../bim/scene/append-entity-to-scene';
import { buildBlockEntityFromDef } from '../../../bim/block-library/place-block-from-library';
import { buildSheetBlockDef } from '../../../bim/block-library/sheet-block-def';
import { buildDxfExportRequest, renderDxfBlob } from '../../../export/formats/dxf-export-adapter';
import type { Point2D } from '../../../rendering/types/Types';
import { createTinSampler } from '../tin-sampler';
import { getCutFillState } from '../cut-fill-store';
import { getTopoBoundary, getTopoPoints } from '../TopoPointStore';
import { getTopoSurface } from '../topo-surface';
import type { DeclaredPlot } from './greek-survey-rules';
import {
  buildSurveyDeliverables,
  type SurveyDeliverables,
} from './build-survey-deliverables';
import { buildSurveySheet, selectInSceneSections, SHEET_WIDTH_MM } from './survey-sheet';
import { downloadSurveyFolder } from './survey-folder';

/** Όνομα του DXF block ορισμού των πινάκων (ASCII — γίνεται `BLOCK` record στο export). */
export const SURVEY_TABLES_BLOCK_NAME = 'SURVEY_TABLES';

/** Απόσταση του φύλλου πινάκων από τη δεξιά άκρη της αποτύπωσης, ως ποσοστό του πλάτους της. */
const SIDE_GAP_RATIO = 0.08;

export interface SurveyExportOptions {
  readonly declared: DeclaredPlot;
  /** Παρονομαστής κλίμακας σχεδίου (1:N) — μέγεθος των πινάκων μέσα στο σχέδιο. */
  readonly scaleDenominator: number;
  /** Βάση ονόματος για τα αρχεία του φακέλου. */
  readonly projectName: string;
}

export interface SurveyExportOutcome {
  readonly ok: boolean;
  readonly deliverables: SurveyDeliverables | null;
  /** Πόσοι πίνακες μπήκαν μέσα στο σχέδιο. */
  readonly placedTables: number;
  /** Ο πίνακας συντεταγμένων ήταν πολύ μεγάλος → έμεινε μόνο στα αρχεία. */
  readonly droppedCoordinates: boolean;
  readonly zipName: string | null;
  readonly reason?: 'no-level' | 'no-points';
}

const FAILED: SurveyExportOutcome = {
  ok: false,
  deliverables: null,
  placedTables: 0,
  droppedCoordinates: false,
  zipName: null,
};

/** Πάνω-δεξιά από την αποτύπωση — εκεί που θα το έβαζε ο μηχανικός, ποτέ πάνω στο οικόπεδο. */
function sheetOrigin(points: readonly { x: number; y: number }[], sheetHeightScaled: number): Point2D {
  let maxX = -Infinity;
  let minX = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x > maxX) maxX = p.x;
    if (p.x < minX) minX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const gap = Math.max((maxX - minX) * SIDE_GAP_RATIO, sheetHeightScaled * 0.05);
  return { x: maxX + gap, y: maxY - sheetHeightScaled };
}

export interface UseSurveyExport {
  readonly exportFolder: (options: SurveyExportOptions) => Promise<SurveyExportOutcome>;
}

export function useSurveyExport(): UseSurveyExport {
  const { t } = useTranslation('dxf-viewer-panels');
  const { currentLevelId, getLevelScene, setLevelScene } = useLevels();

  const exportFolder = useCallback(
    async (options: SurveyExportOptions): Promise<SurveyExportOutcome> => {
      const levelId = currentLevelId;
      const scene = levelId ? getLevelScene(levelId) : null;
      if (!levelId || !scene) return { ...FAILED, reason: 'no-level' };

      const points = getTopoPoints();
      if (points.length === 0) return { ...FAILED, reason: 'no-points' };

      const boundary = getTopoBoundary();
      const deliverables = buildSurveyDeliverables({
        points,
        boundary: boundary ? boundary.vertices : null,
        sampler: createTinSampler(getTopoSurface('existing')),
        cutFill: getCutFillState().result,
        declared: options.declared,
        titles: {
          coordinates: t('topography.deliverables.section.coordinates'),
          plot: t('topography.deliverables.section.plot'),
          volumes: t('topography.deliverables.section.volumes'),
          tolerance: t('topography.deliverables.section.tolerance'),
        },
        volumeLabels: {
          cut: t('topography.deliverables.volume.cut'),
          fill: t('topography.deliverables.volume.fill'),
          net: t('topography.deliverables.volume.net'),
        },
        toleranceLabels: {
          area: t('topography.deliverables.check.area'),
          perimeter: t('topography.deliverables.check.perimeter'),
          pass: t('topography.deliverables.status.pass'),
          fail: t('topography.deliverables.status.fail'),
          notDeclared: t('topography.deliverables.status.not-declared'),
        },
      });

      const translateHeader = (key: string): string => t(key);
      const inScene = selectInSceneSections(deliverables);

      // (1) Οι πίνακες μέσα στο σχέδιο — ένα block: επιλέγεται/μετακινείται/αναιρείται ως ΕΝΑ.
      const sheet = buildSurveySheet(inScene.sections, translateHeader);
      const scaleFactor = Math.max(options.scaleDenominator, 1);
      const block = buildBlockEntityFromDef(
        buildSheetBlockDef(sheet.primitives, {
          name: SURVEY_TABLES_BLOCK_NAME,
          widthMm: SHEET_WIDTH_MM,
          heightMm: sheet.heightMm,
          scaleFactor,
        }),
        { position: sheetOrigin(points, sheet.heightMm * scaleFactor) },
      );
      appendEntityToScene({ currentLevelId: levelId, getLevelScene, setLevelScene }, block, 'topo-deliverables');

      // (2) Ο φάκελος. Το DXF χτίζεται από τη σκηνή ΜΑΖΙ με το block — όχι από ξαναδιαβασμένο state.
      const { request } = buildDxfExportRequest(
        { ...scene, entities: [...scene.entities, block] },
        { entityScope: 'both', drawingScale: scaleFactor },
      );
      const zipName = await downloadSurveyFolder({
        sections: deliverables.sections,
        translateHeader,
        projectName: options.projectName,
        documentLabel: t('topography.deliverables.documentLabel'),
        drawing: renderDxfBlob(request),
      });

      return {
        ok: true,
        deliverables,
        placedTables: inScene.sections.length,
        droppedCoordinates: inScene.droppedCoordinates,
        zipName,
      };
    },
    [currentLevelId, getLevelScene, setLevelScene, t],
  );

  return { exportFolder };
}
