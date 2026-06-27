'use client';

/**
 * ADR-396 Phase P6 + P7 Part B — Thermal Envelope (ETICS) dialog host.
 *
 * Lifecycle owner του authoring command «Εφαρμογή Θερμοπρόσοψης»:
 *   1. Listen σε `bim:thermal-envelope-requested` (ribbon → action intercept →
 *      EventBus) → init draft από το spec του τρέχοντος ορόφου (ή default) +
 *      open dialog.
 *   2. «Εφαρμογή» → `setEnvelopeSpec(currentLevelId, draft)` (D3 ανά όροφο).
 *   3. «σε όλους» → `setEnvelopeSpec` σε ΟΛΟΥΣ τους ορόφους (D3).
 *   4. `markAllCanvasDirty()` → 2D overlay repaint· το 3D resync wiring
 *      (`use-bim3d-vg-resync`) ακούει το spec store για parity.
 *
 * **P7 Part A** — μετά το apply, persist το per-floor spec στο level doc
 * (`saveThermalEnvelopeSpec`) ώστε το κέλυφος να επιβιώνει reload.
 *
 * **P7 Part B** — επιπλέον, παράγει per-element στρώσεις μόνωσης:
 *   `computeEnvelopeAssignments` → `applyAssignmentsToEntities` → `setLevelScene`
 *   με ενημερωμένα params → `EventBus.emit('bim:envelope-applied')` ώστε τα
 *   υπάρχοντα persistence hooks να γράψουν + audit-άρουν (column/beam/slab μέσω
 *   του shared moved effect· opening μέσω δικού του listener) → `syncEnvelopeBoq`
 *   για χωριστές BOQ γραμμές ανά ζώνη+όροφο (D5). Idempotent.
 *
 * Mounted as React.Suspense leaf σε `DxfViewerContent.tsx` — mirror του
 * `OpeningTagStyleHost` (ADR-376 C.2). ADR-040: leaf-only, καμία orchestrator
 * subscription. Τα storeys διαβάζονται imperatively (apply = action, όχι render).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-396-bim-external-thermal-envelope-etics.md §7 (P6, P7)
 */

import * as React from 'react';

import { useAuth } from '@/auth/hooks/useAuth';
import { useFirestoreBuildings } from '@/hooks/useFirestoreBuildings';
import { updateBuildingWithPolicy } from '@/services/building/building-mutation-gateway';
import { markAllCanvasDirty } from '../../../rendering/core/frame-scheduler-api';
import type { ClimateZone } from '../../../bim/thermal/kenak-thermal-config';
import { EventBus } from '../../../systems/events/EventBus';
import {
  buildDefaultSpec,
  getEnvelopeSpec,
  setEnvelopeSpec,
} from '../../../bim/stores/envelope-spec-store';
import {
  parseEnvelopeFunctionValue,
  type ThermalEnvelopeSpec,
} from '../../../bim/types/thermal-envelope-types';
import { saveThermalEnvelopeSpec } from '../../../services/thermal-envelope.service';
import {
  computeEnvelopeAssignments,
  applyAssignmentsToEntities,
} from '../../../bim/services/envelope-element-applicator';
import { syncEnvelopeBoq } from '../../../bim/services/envelope-boq-sync';
import { getEnvelopeFloorSlabs } from '../../../bim/stores/envelope-floor-slabs-store';
import {
  classifyFootprintRegions,
  resolveSlabsAboveForLevel,
} from '../../../bim/geometry/footprint-region-classifier';
import { computeBuildingFootprint } from '../../../bim/geometry/building-footprint';
import { collectEnvelopeOverrides } from '../../../bim/geometry/envelope-shell';
import {
  buildRegionOverrideTargets,
  buildRegionOverrideCommand,
  type RegionOverrideTarget,
} from '../../../bim/services/envelope-region-override.service';
import { isWallEntity, isColumnEntity, isBeamEntity } from '../../../types/entities';
import type { WallDna } from '../../../bim/types/wall-dna-types';
import { useCommandHistory } from '../../../core/commands';
import { createLevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import { useUniversalSelectionStable } from '../../../systems/selection';
import { useEnvelopeFloorSlabs } from '../../../hooks/data/useEnvelopeFloorSlabs';
import { useBim3DEntitiesStore } from '../../../bim-3d/stores/Bim3DEntitiesStore';
import type { SceneModel } from '../../../types/scene';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { ThermalEnvelopeDialog } from './ThermalEnvelopeDialog';

const logger = createModuleLogger('ThermalEnvelopeHost');

/** Ελάχιστη μορφή ορόφου που χρειάζεται ο host (per-level BOQ scope). */
export interface ThermalEnvelopeLevel {
  readonly id: string;
  readonly floorId?: string;
  readonly buildingId?: string;
  readonly projectId?: string;
}

export interface ThermalEnvelopeHostProps {
  /** Τρέχων BIM όροφος — κλειδί του per-level spec (D3). */
  readonly currentLevelId: string | null | undefined;
  /** Όλοι οι όροφοι — για «Εφαρμογή σε όλους» (D3) + per-level BOQ scope. */
  readonly levels: ReadonlyArray<ThermalEnvelopeLevel>;
  /** Scene readers/writers (από levelManager) — per-element apply (P7 Part B). */
  readonly getLevelScene: (levelId: string) => SceneModel | null;
  readonly setLevelScene: (levelId: string, scene: SceneModel) => void;
  /** Project scope fallback (level.projectId ?? αυτό). */
  readonly projectId: string | null | undefined;
}

export function ThermalEnvelopeHost(
  props: ThermalEnvelopeHostProps,
): React.ReactElement | null {
  const { currentLevelId, levels, getLevelScene, setLevelScene, projectId } = props;
  // ADR-396 v2 Φ5C — always-on producer των cross-floor slabs (αίθριο vs δωμάτιο)
  // για το envelope store. Mounted εδώ (always-on host, εντός LevelsSystem) αντί
  // στο DxfViewerContent (N.7.1 — εκείνο στο όριο 500 γρ.). No-op εκτός LevelsSystem.
  useEnvelopeFloorSlabs();
  const { user } = useAuth();
  const companyId = user?.companyId ?? null;
  const { execute: executeCommand } = useCommandHistory();
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<ThermalEnvelopeSpec>(buildDefaultSpec);
  // ADR-396 v2 Φ6b — ανιχνευμένα όρια τρέχοντος ορόφου (per-region override panel).
  const [regions, setRegions] = React.useState<readonly RegionOverrideTarget[]>([]);
  // ADR-396 P10 — DNA επιλεγμένου τοίχου κατά το άνοιγμα του dialog. Snapshot
  // μόνο κατά το event-fire (imperative read) — ΔΕΝ παρακολουθεί αλλαγές επιλογής
  // ενώ ο dialog είναι ανοιχτός. null → fallback στο REFERENCE_BARE_WALL_LAYERS.
  const [wallDna, setWallDna] = React.useState<WallDna | null>(null);
  // Getter για imperative read επιλογής (ADR-040: leaf — επιτρέπεται, ΟΧΙ high-freq).
  // 🚀 PERF (2026-06-28): NON-reactive variant — `getPrimaryId()` is read imperatively inside the
  // EventBus listener only (never in render), so the always-mounted host must NOT re-render on every
  // selection commit. `useUniversalSelectionStable` keeps a stable identity (memo on [context]).
  const universalSelection = useUniversalSelectionStable();

  // ADR-396 P8 — κλιματική ζώνη = ρύθμιση κτιρίου (OQ-7a). Resolve από το
  // building doc του τρέχοντος ορόφου· optimistic override μέχρι να γυρίσει
  // το persisted snapshot.
  const { buildings } = useFirestoreBuildings();
  const buildingId = React.useMemo(
    () => levels.find((l) => l.id === currentLevelId)?.buildingId ?? null,
    [levels, currentLevelId],
  );
  const persistedZone = React.useMemo<ClimateZone | null>(() => {
    const z = buildings.find((b) => b.id === buildingId)?.climateZone;
    return z === 'A' || z === 'B' || z === 'C' || z === 'D' ? z : null;
  }, [buildings, buildingId]);
  const [zoneOverride, setZoneOverride] = React.useState<ClimateZone | null>(null);
  // Καθάρισε το optimistic override όταν αλλάζει κτίριο (νέο context).
  React.useEffect(() => setZoneOverride(null), [buildingId]);
  const climateZone = zoneOverride ?? persistedZone;

  const handleClimateZoneChange = React.useCallback(
    (zone: ClimateZone) => {
      setZoneOverride(zone); // optimistic — instant UI
      if (!buildingId) {
        logger.warn('climate zone change χωρίς buildingId — skip persist', { currentLevelId });
        return;
      }
      void updateBuildingWithPolicy({ buildingId, updates: { climateZone: zone } })
        .then((r) => {
          if (!r.success) logger.error('climate zone persist failed', { buildingId, error: r.error });
        })
        .catch((err: unknown) => logger.error('climate zone persist threw', { buildingId, err }));
    },
    [buildingId, currentLevelId],
  );

  // ADR-396 v2 Φ6b — υπολογίζει τα όρια του τρέχοντος ορόφου (footprint union +
  // αυτόματη ταξινόμηση αίθριο/δωμάτιο) → στόχοι per-region override. Ίδιο SSoT
  // με 2D/3D (`computeBuildingFootprint` + `classifyFootprintRegions` + ίδιο
  // `slabsAbove` με τον applicator). Imperative read — apply = action, όχι render.
  const recomputeRegions = React.useCallback((): void => {
    if (!currentLevelId) {
      setRegions([]);
      return;
    }
    const scene = getLevelScene(currentLevelId);
    if (!scene) {
      setRegions([]);
      return;
    }
    const walls = scene.entities.filter(isWallEntity);
    const columns = scene.entities.filter(isColumnEntity);
    const beams = scene.entities.filter(isBeamEntity);
    if (walls.length === 0 && columns.length === 0 && beams.length === 0) {
      setRegions([]);
      return;
    }
    const level = levels.find((l) => l.id === currentLevelId);
    const slabsSnap = getEnvelopeFloorSlabs();
    const slabsAbove = resolveSlabsAboveForLevel(slabsSnap.slabs, slabsSnap.floors, level?.floorId ?? null);
    const footprint = computeBuildingFootprint(walls, columns, beams);
    const classification = classifyFootprintRegions(footprint, slabsAbove);
    const overrides = collectEnvelopeOverrides([...walls, ...columns, ...beams]);
    setRegions(buildRegionOverrideTargets(classification, overrides));
  }, [currentLevelId, getLevelScene, levels]);

  // EventBus listener — ribbon button → init draft από το spec του ορόφου +
  // υπολογισμός ορίων (Φ6b) + snapshot επιλεγμένου τοίχου (P10) + open.
  React.useEffect(() => {
    return EventBus.on('bim:thermal-envelope-requested', () => {
      setDraft(getEnvelopeSpec(currentLevelId) ?? buildDefaultSpec());
      recomputeRegions();
      // ADR-396 P10 — imperative snapshot: αν είναι επιλεγμένος τοίχος, πάρε το DNA
      // του για ακριβέστερο per-type U-value στον dialog. Μηδέν reactive subscription.
      const primaryId = universalSelection.getPrimaryId();
      if (primaryId && currentLevelId) {
        const scene = getLevelScene(currentLevelId);
        const entity = scene?.entities.find((e) => e.id === primaryId);
        setWallDna(entity !== undefined && isWallEntity(entity) ? (entity.params.dna ?? null) : null);
      } else {
        setWallDna(null);
      }
      setOpen(true);
    });
  }, [currentLevelId, recomputeRegions, universalSelection, getLevelScene]);

  // P7 Part B — per-element apply + BOQ για έναν όροφο (idempotent).
  const applyPerElement = React.useCallback(
    (levelId: string, spec: ThermalEnvelopeSpec) => {
      const scene = getLevelScene(levelId);
      if (!scene) return;
      const storeys = useBim3DEntitiesStore.getState().floors;
      const level = levels.find((l) => l.id === levelId);
      // ADR-396 v2 Φ5C — πλάκες ψηλότερων ορόφων του target floor → ο classifier
      // ξεχωρίζει αίθριο (ανοιχτό, μονώνεται γύρω) από δωμάτιο. Ίδιο SSoT με 2D/3D.
      const slabsSnap = getEnvelopeFloorSlabs();
      const slabsAbove = resolveSlabsAboveForLevel(slabsSnap.slabs, slabsSnap.floors, level?.floorId ?? null);
      const assignments = computeEnvelopeAssignments(spec, scene.entities, storeys, slabsAbove);
      const { entities, changed } = applyAssignmentsToEntities(scene.entities, assignments);
      if (changed.length > 0) {
        setLevelScene(levelId, { ...scene, entities });
        EventBus.emit('bim:envelope-applied', { entities: changed });
      }
      void syncEnvelopeBoq(entities, storeys, spec, {
        companyId: companyId ?? '',
        projectId: level?.projectId ?? projectId ?? '',
        buildingId: level?.buildingId ?? '',
        floorId: level?.floorId ?? '',
      }, slabsAbove).catch((err: unknown) => logger.error('envelope BOQ sync failed', { levelId, err }));
    },
    [getLevelScene, setLevelScene, levels, companyId, projectId],
  );

  const applyToLevels = React.useCallback(
    (levelIds: readonly string[]) => {
      for (const id of levelIds) {
        // Optimistic in-memory update (instant 2D/3D repaint)…
        setEnvelopeSpec(id, draft);
        // …+ persist το per-floor spec στο level doc (P7 Part A) — επιβιώνει reload.
        void saveThermalEnvelopeSpec(id, draft).catch((err: unknown) => {
          logger.error('persist failed', { levelId: id, err });
        });
        // …+ per-element layers + audit + BOQ (P7 Part B).
        applyPerElement(id, draft);
      }
      markAllCanvasDirty();
      setOpen(false);
    },
    [draft, applyPerElement],
  );

  const handleApply = React.useCallback(() => {
    if (currentLevelId) applyToLevels([currentLevelId]);
  }, [currentLevelId, applyToLevels]);

  const handleApplyAll = React.useCallback(() => {
    applyToLevels(levels.map((l) => l.id));
  }, [levels, applyToLevels]);

  // ADR-396 v2 Φ6b — per-region override: γράφει το `envelopeFunction` σε ΟΛΑ τα
  // στοιχεία ενός ορίου ως ΕΝΑ undo entry (CompoundCommand → undoable, atomic,
  // last-write-wins αν στοιχείο ανήκει σε 2 όρια). Re-derive layers/BOQ ΜΟΝΟ αν
  // υπάρχει ήδη εφαρμοσμένο spec· αλλιώς το override είναι απλώς input για το
  // επόμενο «Εφαρμογή». markAllCanvasDirty → 2D overlay ξαναϋπολογίζει το κέλυφος.
  const handleRegionFunctionChange = React.useCallback(
    (region: RegionOverrideTarget, value: string): void => {
      if (!currentLevelId) return;
      const parsed = parseEnvelopeFunctionValue(value);
      if (!parsed) return;
      const sm = createLevelSceneManagerAdapter(getLevelScene, setLevelScene, currentLevelId);
      const command = buildRegionOverrideCommand(region.elementIds, parsed.fn, sm);
      if (command.size() === 0) return;
      executeCommand(command);
      const appliedSpec = getEnvelopeSpec(currentLevelId);
      if (appliedSpec) applyPerElement(currentLevelId, appliedSpec);
      markAllCanvasDirty();
      recomputeRegions();
    },
    [currentLevelId, getLevelScene, setLevelScene, executeCommand, applyPerElement, recomputeRegions],
  );

  return (
    <ThermalEnvelopeDialog
      open={open}
      onOpenChange={setOpen}
      value={draft}
      onChange={setDraft}
      onApply={handleApply}
      onApplyAll={handleApplyAll}
      climateZone={climateZone}
      onClimateZoneChange={handleClimateZoneChange}
      wallDna={wallDna}
      regions={regions}
      onRegionFunctionChange={handleRegionFunctionChange}
    />
  );
}
