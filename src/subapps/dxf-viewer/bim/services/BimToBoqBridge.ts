'use client';

/**
 * BIM → BOQ Auto-Feed Bridge (ADR-363 Phase 6 + 6.1 multi-layer)
 *
 * Fire-and-forget Firestore service: όταν ένα BIM entity αποθηκεύεται /
 * διαγράφεται, δημιουργείται / ενημερώνεται / αφαιρείται το αντίστοιχο
 * BOQ row με σωστή ΑΤΟΕ category + auto-derived quantity (m²/m³/pcs).
 *
 * **Phase 6 single-entry** (default): ένα BoqItem ανά entity με deterministic
 * id `boq_bim_${entity.id}`.
 *
 * **Phase 6.1 multi-layer DNA** (walls μόνο, όταν `params.dna.layers.length > 1`):
 *   - 1 parent summary row `boq_bim_${entity.id}` (isGroupParent=true)
 *   - N child rows `boq_bim_${entity.id}_layer_${layerId}` (per WallDna layer)
 *   Per-layer detach guard ανεξάρτητο ανά row. Industry pattern: Revit Material
 *   Takeoff / ArchiCAD Interactive Schedule (6/6 σύγκλιση, SPEC-3D-004D §12 Q4).
 *
 * Contract:
 *   - Deterministic IDs (idempotent upsert).
 *   - `source: 'bim-auto'`, `sourceType: 'bim-auto'` σε κάθε BIM-generated row.
 *   - `detached: true` rows ΔΕΝ overwriteάρονται από update (user override).
 *   - Callers MUST `void` το returned promise — fire-and-forget audit pattern.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6
 * @see .ssot-registry.json (module: bim-to-boq-bridge, Tier 3)
 */

import { doc, getDoc, getDocs, query, setDoc, where, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import type { BOQItem } from '@/types/boq';
import {
  resolveAtoeMapping,
  resolveImportedMeshMapping,
  resolveGenericSolidMapping,
  deriveAtoeQuantity,
  type AtoeMappingEntry,
  type BimEntityType,
} from '../config/bim-to-atoe-mapping';
import type { WallDna } from '../types/wall-dna-types';
import {
  buildMultiLayerBoqPayloads,
  layerChildBoqId,
  parentBoqId,
  type BuiltBoqRow,
} from './boq-multi-layer-builder';
import {
  buildFinishBoqPayloads,
  finishChildBoqIds,
  hasFinishContribution,
  type FinishBoqContribution,
} from './structural-finish-boq';
import { isFrozenBaselineStatus } from '@/types/boq/units';
import { buildSingleEntityBoqRow, buildGroupParentBoqRow } from './boq-base-row';
import { deleteManagedBoqRow, recordBaselineDrift } from './boq-firestore-sync';
import {
  buildExistingCreatedAtMap,
  fetchRowStates,
  upsertRowGroup,
} from './boq-row-batch-sync';
// ADR-712 — «κοντόστυλο» θεμελίωσης: δεύτερη πηγή children της ίδιας κολώνας (δίπλα στον σοβά).
import {
  buildFoundationStubChild,
  foundationStubChildBoqId,
  foundationStubChildBoqIds,
} from './column-foundation-stub-boq';
import {
  hasFoundationStub,
  type ColumnFoundationStubQuantities,
} from '../geometry/column-foundation-stub';

const logger = createModuleLogger('BimToBoqBridge');

// ============================================================================
// PUBLIC TYPES
// ============================================================================

/** Minimal BIM entity snapshot passed στο bridge. */
export interface BimEntityForBoq {
  readonly id: string;
  readonly kind: string;
  /**
   * Για walls: `params.category` + optional `params.dna` (Phase 6.1 multi-layer).
   * `dna` is `unknown` here on purpose — bridge narrows at runtime με
   * `isMultiLayerWall()`. Keeps consumer callsites free από strict imports
   * του `WallDna` type (avoid cyclic imports + back-compat με existing
   * `params as unknown as {...}` casts στα persistence hooks).
   */
  readonly params?: Readonly<{
    category?: string;
    [key: string]: unknown;
  }>;
  // ADR-407 — `lengthM` carries the running length for path-length entities
  // (railings → ΑΤΟΕ unit 'm'); area/volume cover surface/solid entities.
  readonly geometry?: Readonly<{ area?: number; volume?: number; lengthM?: number }>;
  /**
   * ADR-449 — Καθαρό derived contribution σοβά (κολόνα/δοκάρι). Όταν υπάρχει ΚΑΙ
   * έχει θετικό εμβαδό, το bridge παράγει parent (στατικός πυρήνας) + finish
   * children (interior/exterior σοβάς) αντί single-entry. Υπολογίζεται upstream
   * στο `column-boq-feed` (έχει πρόσβαση στη σκηνή για ανάλυση γειτνίασης).
   */
  readonly finishContribution?: FinishBoqContribution;
  /**
   * ADR-712 — Το «κοντόστυλο» θεμελίωσης μιας κολώνας που εδράζεται σε πέδιλο: ο όγκος από
   * την άνω παρειά του πεδίλου ως τη nominal βάση της. Όταν υπάρχει, το bridge κρεμάει ένα
   * επιπλέον child με άρθρο **θεμελίων** (OIK-2.07) — το ΝΕΤ ΟΙΚ τιμολογεί χωριστά θεμέλια
   * από ανωδομή, άρα λάθος απόδοση = σφάλμα τιμής. Υπολογίζεται upstream στο
   * `column-boq-feed` (μόνο εκεί είναι γνωστός ο cross-level χάρτης έδρασης).
   */
  readonly foundationStub?: ColumnFoundationStubQuantities;
}

export interface BimBoqContext {
  readonly companyId: string;
  readonly projectId: string;
  readonly buildingId: string;
  /**
   * ADR-395 Phase 1 (G7) — floor link. Stamped on the BOQ row as
   * `linkedFloorId` + `scope: 'floor'` so the building Επιμετρήσεις tab can
   * group BIM quantities per floor. Resolved upstream από `floorId` (import
   * destination) ή `Level.buildingId` chain. Όταν λείπει → `scope: 'building'`,
   * `linkedFloorId: null` (back-compat).
   */
  readonly floorId?: string;
  /**
   * ADR-376 Phase B.2 — opening signature group scope. Required όταν το
   * entityType είναι `'opening'` (per-floorplan aggregation). Ignored από
   * το wall/slab/column/beam single-entry + multi-layer path.
   */
  readonly floorplanId?: string;
}

// ============================================================================
// HELPERS — single-entry path
// ============================================================================

function buildSingleEntryPayload(
  deterministicId: string,
  entityType: BimEntityType,
  entity: BimEntityForBoq,
  context: BimBoqContext,
  mapping: AtoeMappingEntry,
  existingCreatedAt: string | null,
): Record<string, unknown> {
  const quantity = deriveAtoeQuantity(mapping.unit, entity.geometry);
  return buildSingleEntityBoqRow(deterministicId, context, entity.id, entityType, mapping, quantity, existingCreatedAt);
}

// ============================================================================
// HELPERS — multi-layer path
// ============================================================================

function isMultiLayerWall(entityType: BimEntityType, entity: BimEntityForBoq): entity is BimEntityForBoq & {
  params: { dna: WallDna; category?: string };
} {
  if (entityType !== 'wall') return false;
  const dna = entity.params?.dna as WallDna | undefined;
  return !!dna && Array.isArray(dna.layers) && dna.layers.length > 1;
}

/**
 * Resolve the ATOE mapping for an entity, narrowing the index-typed
 * `sectionKind` (ADR-363 Φ2 beam-steel discriminator) + `classification`
 * (ADR-408 MEP pipe plumbing) params to `string`. Shared prologue of the
 * single-entry + finish upsert paths.
 */
function resolveEntityAtoeMapping(
  entityType: BimEntityType,
  entity: BimEntityForBoq,
): AtoeMappingEntry | undefined {
  // ADR-683 Φ3.1 — το εισαγόμενο πλέγμα δεν έχει διαχωριστή στο μοντέλο· τον δηλώνει ο χρήστης.
  // Ανανάθετο → `null` → **καμία γραμμή** (§10.2: ορατή απουσία αντί για μηδενικό κόστος).
  if (entityType === 'imported-mesh') {
    return resolveImportedMeshMapping(entity.params?.['importedMeshIdentity']) ?? undefined;
  }

  // ADR-684 Φ4-C — παραμετρικό στερεό: ο διαχωριστής είναι ο `structuralRole` (§4.3), όχι το kind.
  // Δομικό → RC m³· διακοσμητικό/απόν → καμία γραμμή (mirror ανανάθετου imported-mesh).
  if (entityType === 'generic-solid') {
    return resolveGenericSolidMapping(entity.params?.['structuralRole']) ?? undefined;
  }

  const category = entity.params?.category;
  const rawSectionKind = entity.params?.['sectionKind'];
  const sectionKind = typeof rawSectionKind === 'string' ? rawSectionKind : undefined;
  const rawClassification = entity.params?.['classification'];
  const classification = typeof rawClassification === 'string' ? rawClassification : undefined;
  return resolveAtoeMapping(entityType, entity.kind, category, sectionKind, classification) ?? undefined;
}

// ============================================================================
// BRIDGE CLASS
// ============================================================================

class BimToBoqBridgeImpl {

  /**
   * Upsert BOQ item(s) από BIM entity save. Multi-layer walls δημιουργούν
   * 1 parent + N children· τα υπόλοιπα entities (ή walls χωρίς DNA) πάνε
   * single-entry path.
   *
   * **Openings ΔΕΝ περνούν από εδώ μετά το ADR-376 Phase B.2.** Καλέστε
   * `upsertOpeningGroupForOpening()` από `opening-boq-sync.ts` direct —
   * single-entry per-opening rows αντικαταστάθηκαν από signature-group
   * aggregation (Revit Schedule pattern, 6/6 industry). Αν entityType ===
   * 'opening' εδώ → warn + skip για να μην δημιουργούνται ξανά legacy
   * `boq_bim_<openingId>` rows.
   *
   * Detach guard ανά row (parent + κάθε child ξεχωριστά).
   */
  async upsertBoqItemForBim(
    entityType: BimEntityType,
    entity: BimEntityForBoq,
    context: BimBoqContext,
    action: 'created' | 'updated',
  ): Promise<void> {
    if (!context.companyId || !context.projectId || !context.buildingId) return;

    if (entityType === 'opening') {
      logger.warn(
        'BimToBoqBridge.upsertBoqItemForBim called with opening — use upsertOpeningGroupForOpening από opening-boq-sync.ts instead (ADR-376 Phase B.2)',
        { entityId: entity.id },
      );
      return;
    }

    if (isMultiLayerWall(entityType, entity)) {
      await this.upsertMultiLayerWall(entity, context, action);
      return;
    }

    if (hasFinishContribution(entity.finishContribution) || hasFoundationStub(entity.foundationStub)) {
      await this.upsertWithChildren(entityType, entity, context, action);
      return;
    }

    await this.upsertSingleEntry(entityType, entity, context, action);
  }

  /**
   * Group upsert: parent (στατικός πυρήνας, π.χ. column OIK-2.03 m³) + **όλα** τα children
   * του entity από κάθε πηγή:
   *   · ADR-449 σοβάς — ένα child ανά υλικό (interior Knauf OIK-7.05 / exterior OIK-4.03 m²).
   *   · ADR-712 κοντόστυλο θεμελίωσης — ένα child OIK-2.07 m³.
   *
   * ADR-712 — **ΓΙΑΤΙ ΕΝΑ pipeline και όχι δύο branches:** μια κολώνα μπορεί κάλλιστα να
   * έχει ΚΑΙ σοβά ΚΑΙ κοντόστυλο. Με if/else το δεύτερο έχανε σιωπηλά τη γραμμή του. Οι
   * πηγές children συνθέτουν· ο parent είναι πάντα ένας (ο πυρήνας) και δεν αλλάζει από
   * καμία τους — και τα δύο children είναι additive.
   *
   * Mirror του `upsertMultiLayerWall`: ένα combined fetch των states (detach guard +
   * createdAt preservation), per-row upsert.
   */
  private async upsertWithChildren(
    entityType: BimEntityType,
    entity: BimEntityForBoq,
    context: BimBoqContext,
    action: 'created' | 'updated',
  ): Promise<void> {
    const coreMapping = resolveEntityAtoeMapping(entityType, entity);
    if (!coreMapping) return;
    const finish = entity.finishContribution;
    const stub = entity.foundationStub;

    const coreQuantity = deriveAtoeQuantity(coreMapping.unit, entity.geometry);
    const parentId = parentBoqId(entity.id);
    // Υποψήφια ids = parent + ένα child ανά υλικό σοβά + (το πολύ) ένα κοντόστυλο.
    const candidateIds = [
      parentId,
      ...(hasFinishContribution(finish) ? finishChildBoqIds(entity.id, finish) : []),
      ...foundationStubChildBoqIds(entity.id, stub),
    ];
    const states = await fetchRowStates(candidateIds);
    const existingCreatedAt = buildExistingCreatedAtMap(states);

    const children: BuiltBoqRow[] = [];
    // Ο σοβάς φέρνει τον δικό του parent builder· χωρίς σοβά χτίζουμε τον ίδιο group parent
    // απευθείας, ώστε το payload να είναι ταυτόσημο και στις δύο διαδρομές.
    let parent: BuiltBoqRow;
    if (hasFinishContribution(finish)) {
      const built = buildFinishBoqPayloads(
        { entityId: entity.id, entityType, coreMapping, coreQuantity, finish, context },
        existingCreatedAt,
      );
      parent = built.parent;
      children.push(...built.children);
    } else {
      parent = buildGroupParentBoqRow(
        parentId, context, entity.id, entityType, coreMapping, coreQuantity,
        existingCreatedAt.get(parentId) ?? null,
      );
    }

    const stubChild = buildFoundationStubChild(
      entity.id, entityType, parentId, stub, context,
      existingCreatedAt.get(foundationStubChildBoqId(entity.id)) ?? null,
    );
    if (stubChild) children.push(stubChild);

    await upsertRowGroup(parent, children, states, action);
  }

  private async upsertSingleEntry(
    entityType: BimEntityType,
    entity: BimEntityForBoq,
    context: BimBoqContext,
    action: 'created' | 'updated',
  ): Promise<void> {
    const mapping = resolveEntityAtoeMapping(entityType, entity);
    if (!mapping) return;

    const deterministicId = parentBoqId(entity.id);
    const ref = doc(db, COLLECTIONS.BOQ_ITEMS, deterministicId);

    const snap = await getDoc(ref).catch(() => null);
    if (snap === null) return;

    if (snap.exists()) {
      const existing = snap.data() as Record<string, unknown>;
      if (action === 'updated' && existing.detached === true) return;
      // ADR-674 — frozen-baseline guard: υπογεγραμμένο row (status ∉ draft/submitted)
      // ΠΟΤΕ δεν overwriteάρεται· καταγράφουμε μόνο την απόκλιση του live μοντέλου.
      if (isFrozenBaselineStatus(existing.status)) {
        const live = deriveAtoeQuantity(mapping.unit, entity.geometry);
        await recordBaselineDrift(ref, existing, live, 'BimToBoqBridge');
        return;
      }
    }

    const existingCreatedAt = snap.exists()
      ? (snap.data() as Record<string, unknown>).createdAt as string ?? null
      : null;
    const payload = buildSingleEntryPayload(deterministicId, entityType, entity, context, mapping, existingCreatedAt);

    try {
      await setDoc(ref, payload);
    } catch (err) {
      logger.error('BimToBoqBridge: upsert failed', { entityId: entity.id, entityType, err });
    }
  }

  private async upsertMultiLayerWall(
    entity: BimEntityForBoq & { params: { dna: WallDna; category?: string } },
    context: BimBoqContext,
    action: 'created' | 'updated',
  ): Promise<void> {
    const category = entity.params.category;
    const parentMapping = resolveAtoeMapping('wall', entity.kind, category);
    if (!parentMapping) return;

    const wallNetArea = entity.geometry?.area ?? 0;
    const dna = entity.params.dna;

    // Pre-collect all candidate IDs (parent + every layer child) and fetch
    // existing states ONCE — combined detach check + createdAt preservation.
    const candidateIds: string[] = [parentBoqId(entity.id)];
    for (const layer of dna.layers) {
      candidateIds.push(layerChildBoqId(entity.id, layer.id));
    }
    const states = await fetchRowStates(candidateIds);
    const existingCreatedAt = buildExistingCreatedAtMap(states);

    const { parent, children } = buildMultiLayerBoqPayloads(
      {
        entityId: entity.id,
        entityType: 'wall',
        dna,
        wallNetArea,
        parentMapping,
        context,
      },
      existingCreatedAt,
    );

    await upsertRowGroup(parent, children, states, action);
  }

  /**
   * Διαγραφή BOQ row(s) όταν διαγράφεται BIM entity.
   * Cascades σε όλα τα child layer rows. Skip detached items (user override).
   */
  async deleteBoqItemForBim(entityId: string, companyId: string): Promise<void> {
    const parentId = parentBoqId(entityId);

    // Find every child row anchored σε αυτό το entity (multi-layer cascade).
    // Query by parentBoqItemId === parentId — Phase 6.1 children καρφώνουν αυτό
    // το pointer, single-entry rows δεν έχουν children.
    let childIds: string[] = [];
    try {
      const q = query(
        collection(db, COLLECTIONS.BOQ_ITEMS),
        where('companyId', '==', companyId),
        where('parentBoqItemId', '==', parentId),
      );
      const snap = await getDocs(q);
      childIds = snap.docs.map((d) => d.id);
    } catch (err) {
      // Non-fatal: cascade query failure means children stay orphaned (manual
      // cleanup possible via "Re-sync BOQ" Phase 6.2+ recovery action).
      logger.error('BimToBoqBridge: cascade query failed', { entityId, err });
    }

    const allIds = [parentId, ...childIds];
    await Promise.all(allIds.map((id) => deleteManagedBoqRow(id, 'BimToBoqBridge')));
  }

  /** Look up the BOQ summary item που δημιουργήθηκε για ένα BIM entity (read-only). */
  async getBoqItemBySourceEntity(entityId: string): Promise<BOQItem | null> {
    const deterministicId = parentBoqId(entityId);
    const ref = doc(db, COLLECTIONS.BOQ_ITEMS, deterministicId);
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) return null;
      const data = snap.data() as Record<string, unknown>;
      return { id: deterministicId, ...data } as BOQItem;
    } catch {
      return null;
    }
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const bimToBoqBridge = new BimToBoqBridgeImpl();
