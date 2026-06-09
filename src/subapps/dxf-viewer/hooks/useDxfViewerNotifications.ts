/**
 * useDxfViewerNotifications — surfaces decoupled DXF-viewer engine events as
 * transient toasts, so commands/tools stay UI-agnostic (they emit on the
 * EventBus, this hook renders the user-facing toast). Mounted once by the
 * viewer shell.
 *
 * @see systems/events/EventBus.ts — the decoupled pub/sub contract
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md
 */

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { EventBus } from '../systems/events/EventBus';

export function useDxfViewerNotifications(): void {
  const { t } = useTranslation('dxf-viewer-shell');

  useEffect(() => {
    const unsubs: Array<() => void> = [];

    // ADR-401 Phase C — a deleted structural host left ≥1 attached wall without
    // its top support. The wall already falls back to baseline geometry; warn
    // the user (Revit "Top Constraint no longer valid"), non-blocking.
    unsubs.push(
      EventBus.on('bim:wall-attach-host-missing', () => {
        toast.warning(t('attachToStructural.hostMissing'));
      }),
    );

    // ADR-401 Phase D — walls auto-attached their top to a just-created beam/slab
    // placed over them. Non-blocking confirmation (Revit auto-attach feedback).
    unsubs.push(
      EventBus.on('bim:walls-auto-attached', () => {
        toast.info(t('attachToStructural.autoAttached'));
      }),
    );

    // ADR-363 «Τοίχος από περίγραμμα» — summary feedback after a box-select build.
    unsubs.push(
      EventBus.on('bim:walls-from-perimeter', ({ built, ignored }) => {
        if (built === 0) {
          toast.warning(t('perimeterWall.noneBuilt'));
        } else if (ignored > 0) {
          toast.info(t('perimeterWall.builtWithIgnored', { built, ignored }));
        } else {
          toast.success(t('perimeterWall.built', { built }));
        }
      }),
    );

    // ADR-363 Φάση 3 «Τοιχίο από περίγραμμα» — summary feedback (ΕΝΑ τοιχίο/περίμετρο).
    unsubs.push(
      EventBus.on('bim:columns-from-perimeter', ({ built, ignored }) => {
        if (built === 0) {
          toast.warning(t('perimeterColumn.noneBuilt'));
        } else if (ignored > 0) {
          toast.info(t('perimeterColumn.builtWithIgnored', { built, ignored }));
        } else {
          toast.success(t('perimeterColumn.built', { built }));
        }
      }),
    );

    // ADR-363 Φάση 3c «Κολώνα από περίγραμμα» — breakdown feedback (κολώνες/τοιχία).
    unsubs.push(
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
    );

    // ADR-419 — region/perimeter pick απορρίφθηκε (Layer 4/5): γιγάντιο περίγραμμα
    // (εξωτερικό του σχεδίου) ή ανοιχτές γραμμές που δεν ενώνονται. Non-blocking warn.
    unsubs.push(
      EventBus.on('bim:region-perimeter-rejected', ({ reason, widthM, depthM }) => {
        if (reason === 'oversized' && widthM != null && depthM != null) {
          toast.warning(
            t('regionPerimeter.oversized', { width: widthM.toFixed(1), depth: depthM.toFixed(1) }),
          );
        } else {
          toast.warning(t('regionPerimeter.noClosedLoop'));
        }
      }),
    );

    // ADR-401 Phase E.1 — manual attach/detach from the contextual wall ribbon.
    unsubs.push(
      EventBus.on('bim:walls-attached-manual', () => {
        toast.info(t('attachToStructural.attachedManual'));
      }),
    );
    unsubs.push(
      EventBus.on('bim:walls-detached', () => {
        toast.info(t('attachToStructural.detached'));
      }),
    );

    // ADR-401 Phase F.3 — column attach mirrors (reuse the generic messages).
    unsubs.push(
      EventBus.on('bim:columns-auto-attached', () => {
        toast.info(t('attachToStructural.autoAttached'));
      }),
    );
    unsubs.push(
      EventBus.on('bim:columns-auto-attached-base', () => {
        toast.info(t('attachToStructural.autoAttached'));
      }),
    );
    unsubs.push(
      EventBus.on('bim:columns-attached-manual', () => {
        toast.info(t('attachToStructural.attachedManual'));
      }),
    );
    unsubs.push(
      EventBus.on('bim:columns-detached', () => {
        toast.info(t('attachToStructural.detached'));
      }),
    );

    // ADR-363 Post-Creation Adjacency Merge — N γειτονικές κολόνες συγχωνεύτηκαν σε
    // ΕΝΑ composite τοιχίο (single-undo). Non-blocking success feedback.
    unsubs.push(
      EventBus.on('bim:columns-merged', () => {
        toast.success(t('columnAdjacency.merged'));
      }),
    );

    // ADR-408 Φ5 — circuit creation feedback (create-from-selection ribbon).
    unsubs.push(
      EventBus.on('bim:mep-circuit-created', ({ memberCount }) => {
        toast.success(t('mepCircuit.created', { count: memberCount }));
      }),
    );
    unsubs.push(
      EventBus.on('bim:mep-circuit-create-failed', ({ reason }) => {
        toast.warning(t(`mepCircuit.failed.${reason}`));
      }),
    );

    // ADR-408 Φ6 — circuit member-management feedback (properties panel).
    unsubs.push(
      EventBus.on('bim:mep-circuit-members-added', ({ memberCount }) => {
        toast.success(t('mepCircuit.membersAdded', { count: memberCount }));
      }),
    );
    unsubs.push(
      EventBus.on('bim:mep-circuit-members-removed', ({ memberCount }) => {
        toast.success(t('mepCircuit.membersRemoved', { count: memberCount }));
      }),
    );
    unsubs.push(
      EventBus.on('bim:mep-circuit-edit-failed', ({ reason }) => {
        toast.warning(t(`mepCircuit.${reason}`));
      }),
    );

    // ADR-408 Φ10 — pipe-network auto-derivation feedback (whole-scene).
    unsubs.push(
      EventBus.on('bim:mep-networks-derived', ({ networkCount }) => {
        toast.success(t('mepCircuit.networksDerived', { count: networkCount }));
      }),
    );

    // ADR-408 Φ13 — pipe-network from-manifold-selection feedback (create + manage).
    unsubs.push(
      EventBus.on('bim:mep-network-created', ({ memberCount }) => {
        toast.success(t('mepPipeNetwork.created', { count: memberCount }));
      }),
    );
    unsubs.push(
      EventBus.on('bim:mep-network-create-failed', ({ reason }) => {
        toast.warning(t(`mepPipeNetwork.failed.${reason}`));
      }),
    );
    unsubs.push(
      EventBus.on('bim:mep-network-members-added', ({ memberCount }) => {
        toast.success(t('mepPipeNetwork.membersAdded', { count: memberCount }));
      }),
    );
    unsubs.push(
      EventBus.on('bim:mep-network-members-removed', ({ memberCount }) => {
        toast.success(t('mepPipeNetwork.membersRemoved', { count: memberCount }));
      }),
    );
    unsubs.push(
      EventBus.on('bim:mep-network-edit-failed', ({ reason }) => {
        toast.warning(t(`mepPipeNetwork.${reason}`));
      }),
    );

    // ADR-426 Slice 2 — water-supply auto-design feedback (Generate → review → accept).
    unsubs.push(
      EventBus.on('bim:water-supply-generated', ({ networkCount, warningCount }) => {
        toast.info(
          warningCount > 0
            ? t('waterSupply.generatedWithWarnings', { count: networkCount, warnings: warningCount })
            : t('waterSupply.generated', { count: networkCount }),
        );
      }),
    );
    unsubs.push(
      EventBus.on('bim:water-supply-empty', ({ reason }) => {
        toast.warning(t(`waterSupply.empty.${reason}`));
      }),
    );
    unsubs.push(
      EventBus.on('bim:water-supply-committed', ({ networkCount, segmentCount }) => {
        toast.success(t('waterSupply.committed', { count: networkCount, segments: segmentCount }));
      }),
    );

    // ADR-427 Slice 2 — sanitary-drainage auto-design feedback (Generate → review → accept).
    unsubs.push(
      EventBus.on('bim:drainage-generated', ({ networkCount, warningCount }) => {
        toast.info(
          warningCount > 0
            ? t('drainage.generatedWithWarnings', { count: networkCount, warnings: warningCount })
            : t('drainage.generated', { count: networkCount }),
        );
      }),
    );
    unsubs.push(
      EventBus.on('bim:drainage-empty', ({ reason }) => {
        toast.warning(t(`drainage.empty.${reason}`));
      }),
    );
    unsubs.push(
      EventBus.on('bim:drainage-committed', ({ networkCount, segmentCount }) => {
        toast.success(t('drainage.committed', { count: networkCount, segments: segmentCount }));
      }),
    );

    // ADR-428 Slice 2 — heating (hydronic) auto-design feedback (Generate → review → accept).
    unsubs.push(
      EventBus.on('bim:heating-generated', ({ networkCount, warningCount }) => {
        toast.info(
          warningCount > 0
            ? t('heating.generatedWithWarnings', { count: networkCount, warnings: warningCount })
            : t('heating.generated', { count: networkCount }),
        );
      }),
    );
    unsubs.push(
      EventBus.on('bim:heating-empty', ({ reason }) => {
        toast.warning(t(`heating.empty.${reason}`));
      }),
    );
    unsubs.push(
      EventBus.on('bim:heating-committed', ({ networkCount, segmentCount }) => {
        toast.success(t('heating.committed', { count: networkCount, segments: segmentCount }));
      }),
    );

    // ADR-430 Slice 2 — electrical-strong auto-design feedback (Generate → review → accept).
    unsubs.push(
      EventBus.on('bim:electrical-generated', ({ circuitCount, warningCount }) => {
        toast.info(
          warningCount > 0
            ? t('electrical.generatedWithWarnings', { count: circuitCount, warnings: warningCount })
            : t('electrical.generated', { count: circuitCount }),
        );
      }),
    );
    unsubs.push(
      EventBus.on('bim:electrical-empty', ({ reason }) => {
        toast.warning(t(`electrical.empty.${reason}`));
      }),
    );
    unsubs.push(
      EventBus.on('bim:electrical-committed', ({ circuitCount }) => {
        toast.success(t('electrical.committed', { count: circuitCount }));
      }),
    );

    // ADR-431 Slice 2 — electrical-weak (ασθενή) auto-design feedback.
    unsubs.push(
      EventBus.on('bim:electrical-weak-generated', ({ channelCount, warningCount }) => {
        toast.info(
          warningCount > 0
            ? t('electricalWeak.generatedWithWarnings', { count: channelCount, warnings: warningCount })
            : t('electricalWeak.generated', { count: channelCount }),
        );
      }),
    );
    unsubs.push(
      EventBus.on('bim:electrical-weak-empty', ({ reason }) => {
        toast.warning(t(`electricalWeak.empty.${reason}`));
      }),
    );
    unsubs.push(
      EventBus.on('bim:electrical-weak-committed', ({ channelCount }) => {
        toast.success(t('electricalWeak.committed', { count: channelCount }));
      }),
    );

    // ADR-432 Slice 2 — HVAC (αερισμός) auto-design feedback (Generate → review → accept).
    unsubs.push(
      EventBus.on('bim:hvac-generated', ({ networkCount, warningCount }) => {
        toast.info(
          warningCount > 0
            ? t('hvac.generatedWithWarnings', { count: networkCount, warnings: warningCount })
            : t('hvac.generated', { count: networkCount }),
        );
      }),
    );
    unsubs.push(
      EventBus.on('bim:hvac-empty', ({ reason }) => {
        toast.warning(t(`hvac.empty.${reason}`));
      }),
    );
    unsubs.push(
      EventBus.on('bim:hvac-committed', ({ networkCount, segmentCount }) => {
        toast.success(t('hvac.committed', { count: networkCount, segments: segmentCount }));
      }),
    );

    // ADR-401 Phase G.3 — stair attach mirrors (reuse the generic messages).
    unsubs.push(
      EventBus.on('bim:stairs-auto-attached', () => {
        toast.info(t('attachToStructural.autoAttached'));
      }),
    );
    unsubs.push(
      EventBus.on('bim:stairs-auto-attached-base', () => {
        toast.info(t('attachToStructural.autoAttached'));
      }),
    );
    unsubs.push(
      EventBus.on('bim:stairs-attached-manual', () => {
        toast.info(t('attachToStructural.attachedManual'));
      }),
    );
    unsubs.push(
      EventBus.on('bim:stairs-detached', () => {
        toast.info(t('attachToStructural.detached'));
      }),
    );

    return () => unsubs.forEach((u) => u());
  }, [t]);
}
