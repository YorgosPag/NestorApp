'use client';

/**
 * ADR-505 — Export host (lifecycle owner for the «Εξαγωγή» dialog).
 *
 * Mirror of `PrintHost` (ADR-453): subscribes to the ribbon EventBus signal,
 * owns the dialog open state, gathers live deps (every level's loaded scene,
 * active level, drawing name, date) and routes a submitted `ExportRequest`.
 *
 * Format routing (full SSoT — no duplicated engines):
 *   - DXF / TEK / OBJ / glTF → the unified `runExport` pipeline (scope filter +
 *           multi-floor here). The 3Δ mesh formats (ADR-668) additionally need the
 *           building's storey elevations — gathered here, like every other live dep.
 *   - IFC → delegates to the canonical IFC4 flow (`bim:ifc-export-requested`,
 *           served by `IfcExportHost`, ADR-369) — whole project, BIM-only.
 *   - PDF → delegates to the canonical Print engine (`dxf:print-dialog-requested`,
 *           served by `PrintHost`, ADR-453).
 *
 * Mounted as a React.Suspense leaf in `DxfViewerDialogs`. ADR-040: zero HIGH-FREQUENCY
 * canvas subscriptions (transform/hover/cursor). The low-frequency Firestore feeds it reads
 * (`useFloorsByBuilding`, `useFirestoreBuildings`) are rarely-changing lists, not 60fps stores.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-505-unified-export-system.md
 */

import * as React from 'react';

import { EventBus } from '../systems/events/EventBus';
import { useEventGatedDialog } from './dialog-hosts/useEventGatedDialog';
import { useLevels } from '../systems/levels';
// ADR-668 — storey elevations for the 3Δ export, from the SAME canonical Firestore source the
// floor tabs and the live «Όλοι οι όροφοι» 3Δ view use (`useFloors3DAggregator` reads exactly
// this hook). NOT `Bim3DEntitiesStore.floors`, whose `elevation` arrives undefined → every
// storey would stack at Y=0.
import { useFloorsByBuilding } from '@/components/properties/shared/useFloorsByBuilding';
// ADR-668 — building records (baseElevation + membership) from the SAME canonical Firestore SSoT
// the live 3Δ store feeds on: `useFirestoreBuildings` (ONE shared BUILDINGS listener, ADR-227/300)
// → `useBuildingFloors3DSync` → `Bim3DEntitiesStore.buildings`. Low-frequency list, not a canvas
// store — the ADR-040 concern is high-freq subscriptions, not a rarely-changing buildings feed.
import { useFirestoreBuildings } from '@/hooks/useFirestoreBuildings';
import { nowISO } from '@/lib/date-local';
import { runExport } from '../export/export-service';
import type { ExportDeps, ExportLevelScene, ExportRequest } from '../export/types';
import type { BuildingRef } from '../bim/utils/bim-floor-utils';
import { ExportDialog } from '../ui/components/export/ExportDialog';
// 🔴 ADR-767 Δ4 — ο φραγμός των **μπαγιάτικων δεμένων πινάκων** (`DXEVAL`). Η κρίση είναι
// καθαρή και ελεγμένη· εδώ αποκτά το σημείο όπου σταματά τον χρήστη.
import { assessExportBoundTables } from '../export/core/bound-table-export-preflight';
import { readTableSourceContext } from '../bim/table/binding/table-source-context';
import { setTableBindingFreshness } from '../state/table-binding-freshness-store';
import { BoundTableExportBarrier } from '../ui/components/export/BoundTableExportBarrier';
import type { BoundTableExportVerdict } from '../bim/table/binding/table-binding-export-guard';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('DXF_EXPORT_BOUND_TABLES');

export interface ExportHostProps {
  /** Active project id — forwarded to the canonical IFC export flow. */
  readonly projectId?: string;
  /** Active building id — scopes the IFC export to one building. */
  readonly buildingId?: string;
}

/**
 * Thin gate (ADR-532 Stage 3): listens for «Εξαγωγή» and mounts the dialog body
 * ONLY while open. Closed → `null`, so the always-listed host costs nothing in
 * the per-selection commit (was re-rendering ExportDialog while closed).
 */
export function ExportHost({ projectId, buildingId }: ExportHostProps): React.ReactElement | null {
  const { open, close } = useEventGatedDialog('dxf:export-dialog-requested');
  if (!open) return null;
  return <ExportBody projectId={projectId} buildingId={buildingId} onClose={close} />;
}

interface ExportBodyProps {
  readonly projectId?: string;
  readonly buildingId?: string;
  readonly onClose: () => void;
}

function ExportBody({ projectId, buildingId, onClose }: ExportBodyProps): React.JSX.Element {
  const { levels, currentLevelId, getLevelScene } = useLevels();

  const projectName = React.useMemo(() => {
    const level = levels.find((l) => l.id === currentLevelId);
    return level?.name ?? level?.sceneFileName ?? 'drawing';
  }, [levels, currentLevelId]);

  // ADR-668 — derived from the ACTIVE LEVEL (not the `buildingId` prop, which scopes the IFC
  // flow): this mirrors `useFloors3DAggregator` exactly, so the exported stack matches what the
  // live 3Δ view shows. Falls back to the prop when the level carries no building.
  const activeBuildingId = React.useMemo(
    () => levels.find((l) => l.id === currentLevelId)?.buildingId ?? buildingId ?? null,
    [levels, currentLevelId, buildingId],
  );
  // Fetched while the dialog is open (it only mounts on open), so the storey elevations are
  // ready before submit. DXF/TEK ignore them; the 3Δ exporter fails closed without them.
  const { floors: buildingFloors } = useFloorsByBuilding(activeBuildingId, true);

  // ADR-668 — building refs for the 3Δ exporter. Mirrors `useBuildingFloors3DSync`'s map exactly
  // (id + baseElevation + name), from the same `useFirestoreBuildings` SSoT. Without them
  // `resolveEntityBuilding` fails → every body resolves to buildingId='' → the mesh3d building gate
  // marks it `HIDDEN_` AND its `baseElevation` Y-offset collapses to 0. Left UNFILTERED by project:
  // the exporter only ever does `.find(b => b.id === …)`, so extra buildings are harmless while a
  // stale/missing projectId prop could starve it (fail-open beats fail-closed here).
  const { buildings: firestoreBuildings } = useFirestoreBuildings();
  const buildings = React.useMemo<BuildingRef[]>(
    () => firestoreBuildings.map((b) => ({ id: b.id, baseElevation: b.baseElevation, name: b.name })),
    [firestoreBuildings],
  );

  /**
   * 🔴 ADR-767 Δ4 — ο φραγμός **εν αναμονή**: η ετυμηγορία + το «τι κάνω μόλις απαντήσεις».
   *
   * Η απόφαση του χρήστη ταξιδεύει ως `resolve` μιας υπόσχεσης, ώστε ο **ένας** δρόμος
   * `handleSubmit` να μη διχαστεί σε δύο (σύγχρονο για καθαρό έργο, callback για μπλοκαρισμένο)
   * — δύο δρόμοι σημαίνουν δύο σημεία που πρέπει να θυμούνται να τρέξουν την ίδια εξαγωγή.
   */
  const [barrier, setBarrier] = React.useState<
    { readonly verdict: BoundTableExportVerdict; readonly decide: (proceed: boolean) => void } | null
  >(null);

  /**
   * 🔴 **Ο ΦΡΑΓΜΟΣ, ΠΡΙΝ ΑΠΟ ΚΑΘΕ ΜΟΡΦΗ.**
   *
   * Τρέχει **πριν** τη διακλάδωση IFC/PDF/DXF επίτηδες: το PDF είναι το **πιο** ευαίσθητο
   * παραδοτέο (υπογράφεται), και το ότι δρομολογείται σε άλλη μηχανή δεν το κάνει λιγότερο
   * παραδοτέο. Η εναλλακτική — φραγμός μόνο στο `runExport` — θα άφηνε τη μία μορφή που
   * τυπώνεται ακριβώς **έξω**.
   *
   * ⚠️ **Γνωστό κενό, δηλωμένο**: ο **αυτόνομος** διάλογος Εκτύπωσης (ADR-453, `PrintHost`)
   * έχει δικό του σημείο εισόδου και **δεν** περνά από εδώ. Λέγεται αντί να υπονοείται.
   *
   * Ο έλεγχος **καταγράφει** ό,τι βρήκε στο store φρεσκάδας: μετά από ακύρωση, οι μπαγιάτικοι
   * πίνακες μένουν **σημαδεμένοι στην οθόνη**, δηλαδή ο χρήστης βλέπει *ποιους* να ανανεώσει
   * αντί να τους ψάχνει. Είναι ακριβώς η συμπεριφορά του AutoCAD `DATALINKNOTIFY`.
   */
  const passesBoundTableGate = React.useCallback(
    async (request: ExportRequest, levelScenes: readonly ExportLevelScene[]): Promise<boolean> => {
      const verdict = assessExportBoundTables({
        levelScenes,
        activeLevelId: currentLevelId,
        floorScope: request.floorScope,
        context: readTableSourceContext(),
      });
      for (const table of verdict.stale) {
        setTableBindingFreshness(table.entityId, {
          status: 'stale',
          freshRevision: table.freshRevision,
        });
      }
      for (const table of verdict.unchecked) {
        setTableBindingFreshness(table.entityId, { status: 'unknown', reason: table.reason });
      }
      if (!verdict.blocked) return true;

      const proceed = await new Promise<boolean>((resolve) => {
        setBarrier({ verdict, decide: resolve });
      });
      setBarrier(null);
      // §8 #6 — «η επιλογή “εξάγω έτσι” **καταγράφεται**». Χωρίς αυτό, ο φραγμός θα ήταν
      // εμπόδιο χωρίς ίχνος: κανείς δεν θα μπορούσε να απαντήσει «ποιος εξήγαγε μπαγιάτικα».
      if (proceed) {
        logger.warn('Export proceeded over stale bound tables', {
          format: request.format,
          stale: verdict.stale.length,
          unchecked: verdict.unchecked.length,
          examined: verdict.examined,
        });
      }
      return proceed;
    },
    [currentLevelId],
  );

  const handleSubmit = React.useCallback(
    async (request: ExportRequest) => {
      // 🔴 ADR-767 Δ4 — οι σκηνές συναρμολογούνται **πριν** τη διακλάδωση, γιατί ο φραγμός
      // τις χρειάζεται για **κάθε** μορφή (δες `passesBoundTableGate`). Η λίστα ξαναχρησιμο-
      // ποιείται αυτούσια από το `deps` παρακάτω — καμία δεύτερη συλλογή.
      const levelScenes: ExportLevelScene[] = [];
      for (const level of levels) {
        const scene = getLevelScene(level.id);
        if (scene) levelScenes.push({ level, scene });
      }
      if (!(await passesBoundTableGate(request, levelScenes))) return;

      // IFC / PDF → delegate to the canonical engines (SSoT, no duplication).
      if (request.format === 'ifc') {
        EventBus.emit('bim:ifc-export-requested', {
          projectId,
          buildingIds: buildingId ? [buildingId] : undefined,
          includePsets: true,
        });
        return;
      }
      if (request.format === 'pdf') {
        EventBus.emit('dxf:print-dialog-requested', {});
        return;
      }

      // DXF / TEK / OBJ / glTF → unified pipeline (content scope + multi-floor live here).
      const deps: ExportDeps = {
        levelScenes,
        activeLevelId: currentLevelId,
        projectName,
        dateStr: nowISO().slice(0, 10),
        // ADR-668 — 3Δ-only: real storey elevations, so «όλοι οι όροφοι» stacks a building
        // instead of flattening every floor onto Z=0.
        floors: buildingFloors,
        // ADR-668 — 3Δ-only: building records so `resolveEntityBuilding` binds every body to its
        // building (correct baseElevation + never spuriously HIDDEN_).
        buildings,
        activeBuildingId,
      };
      await runExport(request, deps);
    },
    [levels, getLevelScene, currentLevelId, projectName, projectId, buildingId,
     buildingFloors, buildings, activeBuildingId, passesBoundTableGate],
  );

  const handleOpenChange = React.useCallback(
    (next: boolean) => { if (!next) onClose(); },
    [onClose],
  );

  return (
    <React.Fragment>
      <ExportDialog open onOpenChange={handleOpenChange} onSubmit={handleSubmit} />
      {/* 🔴 ADR-767 §8 #6 — ΠΑΝΩ από τον διάλογο εξαγωγής, ποτέ αντί αυτού: ο χρήστης πρέπει
          να βλέπει ότι ο φραγμός αφορά **αυτή** την εξαγωγή που μόλις ζήτησε. Οι δύο έξοδοι
          είναι ρητές — καμία δεν είναι προεπιλεγμένη (δες τον διάλογο). */}
      {barrier && (
        <BoundTableExportBarrier
          verdict={barrier.verdict}
          onProceed={() => barrier.decide(true)}
          onCancel={() => barrier.decide(false)}
        />
      )}
    </React.Fragment>
  );
}
