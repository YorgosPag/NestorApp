/**
 * perimeter-build-notifications — ADR-363 / ADR-419.
 *
 * Toast registrars for the «από περίγραμμα» region/perimeter builds (walls,
 * columns, discrete columns+walls) plus the region-pick rejection warning.
 * Extracted from `useDxfViewerNotifications` (Google file-size SSoT, N.7.1).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md
 * @see docs/centralized-systems/reference/adrs/ADR-419-region-perimeter-discrete-columns.md
 */

import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import { EventBus } from '../../systems/events/EventBus';

/** «Από περίγραμμα» wall/column builds + region-pick rejection. */
export function registerPerimeterBuildNotifications(t: TFunction): Array<() => void> {
  return [
    // ADR-363 «Τοίχος από περίγραμμα» — summary feedback after a box-select build.
    EventBus.on('bim:walls-from-perimeter', ({ built, ignored }) => {
      if (built === 0) {
        toast.warning(t('perimeterWall.noneBuilt'));
      } else if (ignored > 0) {
        toast.info(t('perimeterWall.builtWithIgnored', { built, ignored }));
      } else {
        toast.success(t('perimeterWall.built', { built }));
      }
    }),

    // ADR-363 Φάση 3 «Τοιχίο από περίγραμμα» — summary feedback (ΕΝΑ τοιχίο/περίμετρο).
    EventBus.on('bim:columns-from-perimeter', ({ built, ignored }) => {
      if (built === 0) {
        toast.warning(t('perimeterColumn.noneBuilt'));
      } else if (ignored > 0) {
        toast.info(t('perimeterColumn.builtWithIgnored', { built, ignored }));
      } else {
        toast.success(t('perimeterColumn.built', { built }));
      }
    }),

    // ADR-363 Φάση 3c «Κολώνα από περίγραμμα» — breakdown feedback (κολώνες/τοιχία).
    EventBus.on('bim:columns-discrete-from-perimeter', ({ columns, walls }) => {
      if (columns === 0 && walls === 0) {
        toast.warning(t('perimeterColumnDiscrete.noneBuilt'));
      } else if (columns > 0 && walls > 0) {
        // Plural-correct σύνθετο μήνυμα (i18next _one/_other ανά αριθμό).
        const columnsText = t('perimeterColumnDiscrete.nColumns', { count: columns });
        const wallsText = t('perimeterColumnDiscrete.nWalls', { count: walls });
        toast.info(t('perimeterColumnDiscrete.builtMixed', { columns: columnsText, walls: wallsText }));
      } else if (walls > 0) {
        // ADR-419 — δημιουργήθηκαν μόνο τοιχία (intent=walls ή «μόνο τα δικά μου»).
        toast.success(t('perimeterColumnDiscrete.builtWalls', { count: walls }));
      } else {
        toast.success(t('perimeterColumnDiscrete.built', { count: columns }));
      }
    }),

    // ADR-419 — region/perimeter pick απορρίφθηκε (Layer 4/5): γιγάντιο περίγραμμα
    // (εξωτερικό του σχεδίου) ή ανοιχτές γραμμές που δεν ενώνονται. Non-blocking warn.
    EventBus.on('bim:region-perimeter-rejected', ({ reason, widthM, depthM }) => {
      if (reason === 'oversized' && widthM != null && depthM != null) {
        toast.warning(
          t('regionPerimeter.oversized', { width: widthM.toFixed(1), depth: depthM.toFixed(1) }),
        );
      } else {
        toast.warning(t('regionPerimeter.noClosedLoop'));
      }
    }),
  ];
}
