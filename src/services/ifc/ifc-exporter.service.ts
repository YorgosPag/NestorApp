/**
 * IFC4 Exporter Service (ADR-369 §Q8.3)
 *
 * Orchestrator that turns Nestor domain objects (Project + Buildings +
 * Floors) into a downloadable IFC4 STEP21 byte buffer. Entity geometry
 * serializers (walls / slabs / columns / beams / openings) plug in via
 * the optional `entitySerializer` hook and are written *after* the
 * spatial hierarchy is established (Q8.4).
 *
 * Q8.3 scope: spatial chain + units + geometric context. Q8.4+Q8.5 will
 * append building elements + property sets via the same `IfcGraph`.
 *
 * ADR-798 Φάση 4: πριν από τη χωρική αλυσίδα γράφεται η **αλυσίδα ιδιοκτησίας**
 * (`ifc-authorship.ts`), ώστε το `IfcProject` να μπορεί να τη δείξει — αυτό που
 * το σχόλιο *«OwnerHistory — patched in by exporter»* υποσχόταν και **κανείς δεν
 * έκανε** μέχρι σήμερα.
 */

import type { Project } from '@/types/project';
import type { Building } from '@/types/building/contracts';
import type { FloorDocument } from '@/app/api/floors/floors.types';
import type { SceneModel } from '@/subapps/dxf-viewer/types/scene';
import type { ThermalEnvelopeSpec } from '@/subapps/dxf-viewer/bim/types/thermal-envelope-types';
import type { DeclaredOccupation } from '@/types/professional-identity';
import type { IfcActorRoleVerdict } from '@/config/isco-ifc-role';
import { nowISO } from '@/lib/date-local';

import { IfcGraph } from './ifc-entity-graph';
import {
  buildIfcSpatialHierarchy,
  type SpatialHierarchyOutput,
} from './ifc-spatial-hierarchy';
import {
  writeStepIfc,
  type IfcStepHeader,
} from './ifc-step-writer';
import { appendIfcAuthorship, type IfcAuthoringApplication } from './ifc-authorship';

// ─── Application identity ───────────────────────────────────────────────────

/**
 * **Ποιος** παράγει το αρχείο — μία δήλωση, δύο καταναλωτές.
 *
 * 🔑 Ζει **εδώ**, στον ενορχηστρωτή, επειδή είναι το **μόνο** σημείο που συνθέτει
 * και τα δύο μέρη όπου η ταυτότητα της εφαρμογής εμφανίζεται: την **κεφαλίδα**
 * STEP21 (`FILE_NAME`) και το **`IfcApplication`** μέσα στα δεδομένα. Δηλωμένη
 * χωριστά στα δύο, θα ήταν το σχήμα των δύο λιστών namespace του CHECK 3.34 —
 * σωστή σήμερα, αποκλίνουσα αύριο.
 *
 * ⚠️ Οι προεπιλογές του `DEFAULT_HEADER` στο `ifc-step-writer.ts` παραμένουν, και
 * **δεν** είναι δεύτερη αυθεντία: τις βλέπει μόνο όποιος καλεί το `writeStepIfc`
 * **απευθείας** (σήμερα: άγκυρες). Η πραγματική εξαγωγή τις παρακάμπτει πάντα.
 */
export const NESTOR_IFC_APPLICATION: IfcAuthoringApplication = {
  developer: 'Nestor',
  version: '1.0',
  fullName: 'Nestor BIM IFC4 STEP21 Writer',
  identifier: 'NestorBIM',
};

// ─── Public types ───────────────────────────────────────────────────────────

export interface IfcExportParams {
  readonly project: Project;
  readonly buildings: readonly Building[];
  readonly floors: readonly FloorDocument[];
  /** Optional per-floor scene used by entity serializers (Q8.4). */
  readonly scenes?: ReadonlyMap<string, SceneModel>;
  /**
   * Optional per-floor ETICS thermal-envelope spec (floorId → spec), consumed
   * by the covering serializer (ADR-396 P9) to emit `IfcCovering` for the
   * facade walls (whose Z1 insulation lives on the per-floor spec, not on the
   * wall entity). Columns/beams/slabs/openings read their own per-element layer.
   */
  readonly envelopeSpecs?: ReadonlyMap<string, ThermalEnvelopeSpec>;
  /** When true (default), include per-entity Property Sets (Q8.5). */
  readonly includePsets?: boolean;
  /** Optional STEP21 file header overrides. */
  readonly header?: Partial<IfcStepHeader>;
  /** Optional plugin that appends building elements after the spatial chain. */
  readonly entitySerializer?: IfcEntitySerializer;
  /**
   * Το **δηλωμένο επάγγελμα** του κατόχου του λογαριασμού — ADR-798 Φάση 4.
   *
   * ⚠️ **Ταξιδεύει ως ΡΟΛΟΣ, ποτέ ως όνομα.** Το `ifc-authorship.ts` γράφει
   * `IfcActorRole` + ταξινόμηση ESCO πάνω σε `IfcPerson` **χωρίς κανένα όνομα**.
   * Παράλειψη ή `null` ⇒ **σιωπή**: η αλυσίδα ιδιοκτησίας γράφεται κανονικά,
   * απλώς χωρίς ρόλο. Δεν υπάρχει κατάσταση όπου η παράλειψη σπάει την εξαγωγή.
   */
  readonly declaredOccupation?: DeclaredOccupation | null;
}

export interface IfcExportResult {
  readonly bytes: Uint8Array;
  readonly fileName: string;
  /** Highest expressID assigned in the graph — useful for telemetry. */
  readonly entityCount: number;
  /**
   * Η ετυμηγορία της επαγγελματικής προβολής — **πέντε ρητές καταστάσεις**,
   * ποτέ boolean. Επιτρέπει στον καλούντα να ξεχωρίσει *«δεν έπρεπε να μπει
   * ρόλος»* από *«κάτι έσπασε»* (ADR-798 §6.2).
   */
  readonly authorship: IfcActorRoleVerdict;
}

/**
 * Plugin contract for Q8.4 element serializers. Receives the live graph
 * after the spatial chain is built, plus the storey lookup so each element
 * can attach to the correct `IfcBuildingStorey` via
 * `IfcRelContainedInSpatialStructure`.
 */
export interface IfcEntitySerializer {
  serializeEntities(
    graph: IfcGraph,
    spatial: SpatialHierarchyOutput,
    params: IfcExportParams,
  ): void;
}

// ─── Service ────────────────────────────────────────────────────────────────

export class IfcExporter {
  /**
   * Builds the complete IFC4 graph and returns it as a STEP21 byte buffer.
   * Synchronous on purpose — text emission is CPU-bound and avoids the
   * web-ifc WASM round-trip until tessellated geometry is required (Q8.6).
   *
   * ⚠️ **Η ΣΕΙΡΑ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ**: η ιδιοκτησία γράφεται **πρώτη**, γιατί το
   * `IfcProject` οφείλει να δείξει το `#id` της. Ένας γράφος append-only δεν
   * μπορεί να «γυρίσει πίσω» να το συμπληρώσει.
   */
  exportProject(params: IfcExportParams): IfcExportResult {
    const graph = new IfcGraph();
    const timeStampISO = params.header?.timeStampISO ?? nowISO();
    const authorship = appendIfcAuthorship(graph, {
      application: NESTOR_IFC_APPLICATION,
      occupation: params.declaredOccupation,
      creationTimestamp: Math.floor(Date.parse(timeStampISO) / 1000),
    });

    const spatial = buildIfcSpatialHierarchy(graph, {
      project: params.project,
      buildings: params.buildings,
      floors: params.floors,
      ownerHistoryID: authorship.ownerHistoryId,
    });
    params.entitySerializer?.serializeEntities(graph, spatial, params);

    const fileName = sanitizeFileName(params.project.name) + '.ifc';
    const bytes = writeStepIfc(graph, {
      fileName,
      timeStampISO,
      organizations: [NESTOR_IFC_APPLICATION.developer],
      authoringTool: `${NESTOR_IFC_APPLICATION.fullName} ${NESTOR_IFC_APPLICATION.version}`,
      ...params.header,
    });
    return {
      bytes,
      fileName,
      entityCount: graph.lastId(),
      authorship: authorship.verdict,
    };
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function sanitizeFileName(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return 'project';
  return trimmed.replace(/[\\/:*?"<>|]/g, '_');
}
