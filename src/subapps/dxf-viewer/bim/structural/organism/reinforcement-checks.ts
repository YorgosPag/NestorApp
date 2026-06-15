/**
 * Structural Organism — reinforcement diagnostics (ADR-459, Phase 4d).
 *
 * Revit-grade analytical warnings πάνω στον DERIVED graph + τα persisted
 * reinforcement intents + την οργανική συνέχεια (Φ4c):
 *   · `memberMissingReinforcement` (info)    — μέλος χωρίς διαστασιολογημένο οπλισμό.
 *   · `ratioOutOfRange`            (warning) — ρ < ρ_min ή ρ > ρ_max (per code limits).
 *   · `barMismatchAtJoint`         (warning) — αναντιστοιχία ράβδων/ανεπαρκές μήκος σε κόμβο.
 *
 * **ΞΕΧΩΡΙΣΤΗ signature** από το geometry-only `runOrganismChecks(graph)`: τα
 * reinforcement checks χρειάζονται entities + code provider (limits/compute) +
 * την οργανική συνέχεια. Pure — διαβάζει `params.reinforcement`, μηδέν mutation/
 * persist· i18n keys + DERIVED params μόνο (N.11).
 *
 * @see ./organism-checks.ts — οι geometry connectivity checks (Phase 0-1)
 * @see ./reinforcement-continuity.ts — input για το `barMismatchAtJoint`
 * @see ../section-context.ts — SSoT entity→SectionContext builders
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §6f
 */

import type { Entity } from '../../../types/entities';
import { isColumnEntity, isBeamEntity, isFoundationEntity } from '../../../types/entities';
import type { ColumnReinforcement } from '../reinforcement/column-reinforcement-types';
import { computeColumnReinforcementQuantities } from '../reinforcement/column-reinforcement-compute';
import { computeBeamReinforcementQuantities } from '../reinforcement/beam-reinforcement-compute';
import { computeFootingReinforcementQuantities } from '../reinforcement/footing-reinforcement-compute';
import { computeSlabFoundationReinforcementQuantities } from '../reinforcement/slab-foundation-reinforcement-compute';
import type { StructuralCodeProvider } from '../codes/structural-code-types';
import {
  buildColumnSectionContext,
  buildBeamSectionContext,
  buildFootingSectionContext,
  buildSlabFoundationSectionContext,
  isFoundationSlabEntity,
} from '../section-context';
import {
  computeOrganismReinforcementContinuity,
  type ReinforcementContinuityItem,
} from './reinforcement-continuity';
import type { StructuralDiagnostic, StructuralGraph } from './structural-organism-types';

/** i18n key prefix (ns `dxf-viewer-shell`). */
const MSG = 'structuralOrganism.diagnostics';

/** Όρια ποσοστού οπλισμού ενός μέλους (max απών για θεμελίωση — slab-like). */
interface RatioBounds {
  readonly ratio: number;
  readonly minRatio: number;
  readonly maxRatio?: number;
}

/** Είναι το entity δομικό μέλος που δέχεται οπλισμό; (κολόνα/δοκάρι/πέδιλο/raft). */
function isReinforceable(e: Entity): boolean {
  return isColumnEntity(e) || isBeamEntity(e) || isFoundationEntity(e) || isFoundationSlabEntity(e);
}

/** Έχει το μέλος persisted reinforcement intent; */
function hasReinforcement(e: Entity): boolean {
  if (isColumnEntity(e)) return e.params.reinforcement !== undefined;
  if (isBeamEntity(e)) return e.params.reinforcement !== undefined;
  if (isFoundationEntity(e)) return e.params.reinforcement !== undefined;
  if (isFoundationSlabEntity(e)) return e.params.structuralReinforcement !== undefined;
  return false;
}

/** ColumnReinforcement ενός entity (ή undefined). */
function columnReinforcementOf(e: Entity | undefined): ColumnReinforcement | undefined {
  return e && isColumnEntity(e) ? e.params.reinforcement : undefined;
}

// ─── Check 1: μέλος χωρίς οπλισμό (info) ──────────────────────────────────────

function missingReinforcementFinding(e: Entity): StructuralDiagnostic | null {
  if (!isReinforceable(e) || hasReinforcement(e)) return null;
  return {
    id: `memberMissingReinforcement:${e.id}`,
    code: 'memberMissingReinforcement',
    severity: 'info',
    messageKey: `${MSG}.memberMissingReinforcement`,
    primaryEntityId: e.id,
    entityIds: [e.id],
  };
}

// ─── Check 2: ρ εκτός ορίων (warning) ─────────────────────────────────────────

/** ρ + όρια του μέλους (από compute + provider limits), ή null αν δεν οπλισμένο. */
function ratioBoundsOf(e: Entity, provider: StructuralCodeProvider): RatioBounds | null {
  if (isColumnEntity(e) && e.params.reinforcement) {
    const r = e.params.reinforcement;
    const ctx = buildColumnSectionContext(e);
    const lim = provider.columnReinforcementLimits(ctx, r.longitudinal.diameterMm);
    return { ratio: computeColumnReinforcementQuantities(ctx, r).ratio, minRatio: lim.minRatio, maxRatio: lim.maxRatio };
  }
  if (isBeamEntity(e) && e.params.reinforcement) {
    const r = e.params.reinforcement;
    const ctx = buildBeamSectionContext(e);
    const lim = provider.beamReinforcementLimits(ctx, r.bottom.diameterMm);
    return { ratio: computeBeamReinforcementQuantities(ctx, r).ratio, minRatio: lim.minRatio, maxRatio: lim.maxRatio };
  }
  if (isFoundationEntity(e) && e.params.reinforcement) {
    const r = e.params.reinforcement;
    const ctx = buildFootingSectionContext(e);
    const lim = provider.footingReinforcementLimits(ctx);
    return { ratio: computeFootingReinforcementQuantities(ctx, r).ratio, minRatio: lim.minRatio };
  }
  if (isFoundationSlabEntity(e) && e.params.structuralReinforcement) {
    const r = e.params.structuralReinforcement;
    const ctx = buildSlabFoundationSectionContext(e);
    const lim = provider.slabFoundationReinforcementLimits(ctx);
    return { ratio: computeSlabFoundationReinforcementQuantities(ctx, r).ratio, minRatio: lim.minRatio };
  }
  return null;
}

const pct = (x: number): string => (x * 100).toFixed(2);

function ratioFinding(e: Entity, provider: StructuralCodeProvider): StructuralDiagnostic | null {
  const b = ratioBoundsOf(e, provider);
  if (!b) return null;
  const base = { code: 'ratioOutOfRange' as const, severity: 'warning' as const, primaryEntityId: e.id, entityIds: [e.id] };
  if (b.ratio < b.minRatio) {
    return { id: `ratioOutOfRange:${e.id}`, ...base, messageKey: `${MSG}.ratioBelowMin`, messageParams: { ratio: pct(b.ratio), min: pct(b.minRatio) } };
  }
  if (b.maxRatio !== undefined && b.ratio > b.maxRatio) {
    return { id: `ratioOutOfRange:${e.id}`, ...base, messageKey: `${MSG}.ratioAboveMax`, messageParams: { ratio: pct(b.ratio), max: pct(b.maxRatio) } };
  }
  return null;
}

// ─── Check 3: αναντιστοιχία ράβδων σε κόμβο (warning) ─────────────────────────

/**
 * Κόμβος προβληματικός όταν: (α) το μήκος ανάπτυξης δεν προκύπτει (lengthMm ≤ 0),
 * ή (β) μάτισμα κολόνας↔κολόνας με διαφορετικό πλήθος/διάμετρο διαμήκων ράβδων
 * (EC2 §8.7 — οι ματιζόμενες ράβδοι πρέπει να είναι συμβατές).
 */
function jointHasMismatch(item: ReinforcementContinuityItem, entityById: ReadonlyMap<string, Entity>): boolean {
  if (item.lengthMm <= 0) return true;
  if (item.kind !== 'lap') return false;
  const lower = columnReinforcementOf(entityById.get(item.fromMemberId));
  const upper = columnReinforcementOf(entityById.get(item.toMemberId));
  if (!lower || !upper) return false;
  return (
    lower.longitudinal.count !== upper.longitudinal.count ||
    lower.longitudinal.diameterMm !== upper.longitudinal.diameterMm
  );
}

function barMismatchFindings(
  graph: StructuralGraph,
  entities: readonly Entity[],
  provider: StructuralCodeProvider,
): StructuralDiagnostic[] {
  const entityById = new Map<string, Entity>(entities.map((e) => [e.id, e]));
  const continuity = computeOrganismReinforcementContinuity(graph, entities, provider);
  const out: StructuralDiagnostic[] = [];
  const seen = new Set<string>();
  for (const item of continuity.items) {
    if (!jointHasMismatch(item, entityById)) continue;
    const id = `barMismatchAtJoint:${item.edgeId}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      code: 'barMismatchAtJoint',
      severity: 'warning',
      messageKey: `${MSG}.barMismatchAtJoint`,
      primaryEntityId: item.fromMemberId,
      entityIds: [item.fromMemberId, item.toMemberId],
    });
  }
  return out;
}

// ─── Check 4: αγκύρωση κορυφής κολόνας σε μη-κολόνα host (warning, Φ4e/E1) ─────

/**
 * Όταν η κορυφή μιας οπλισμένης κολόνας είναι attached σε host που ΔΕΝ είναι
 * κολόνα (δοκάρι/πλάκα), οι διαμήκεις αγκυρώνονται μέσα στον host (lbd). Αν ο host
 * δεν έχει δικό του διαστασιολογημένο οπλισμό, η αγκύρωση δεν επαληθεύεται →
 * warning (EC8 §5.6 — ο κόμβος πρέπει να αναπτύσσει τις ράβδους).
 */
function topAnchorageFindings(
  graph: StructuralGraph,
  entities: readonly Entity[],
): StructuralDiagnostic[] {
  const entityById = new Map<string, Entity>(entities.map((e) => [e.id, e]));
  const out: StructuralDiagnostic[] = [];
  for (const edge of graph.edges) {
    if (edge.kind !== 'top-attachment') continue;
    const column = entityById.get(edge.supportedId);
    const host = entityById.get(edge.supportId);
    if (!column || !host || !isColumnEntity(column) || !column.params.reinforcement) continue;
    if (isColumnEntity(host) || hasReinforcement(host)) continue; // lap ή επαληθεύσιμη αγκύρωση
    out.push({
      id: `columnTopAnchorageUnverified:${edge.id}`,
      code: 'columnTopAnchorageUnverified',
      severity: 'warning',
      messageKey: `${MSG}.columnTopAnchorageUnverified`,
      primaryEntityId: edge.supportedId,
      entityIds: [edge.supportedId, edge.supportId],
    });
  }
  return out;
}

// ─── Runner ────────────────────────────────────────────────────────────────────

/**
 * Τρέξε όλους τους reinforcement ελέγχους πάνω στον οργανισμό. Pure — απαιτεί
 * entities (για το `params.reinforcement`) + code provider (limits/compute) +
 * την DERIVED οργανική συνέχεια (κόμβοι). Δεν αγγίζει το `runOrganismChecks`.
 */
export function runReinforcementChecks(
  graph: StructuralGraph,
  entities: readonly Entity[],
  provider: StructuralCodeProvider,
): StructuralDiagnostic[] {
  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  const out: StructuralDiagnostic[] = [];
  for (const e of entities) {
    if (!nodeIds.has(e.id)) continue; // μόνο μέλη του οργανισμού
    const missing = missingReinforcementFinding(e);
    if (missing) {
      out.push(missing);
      continue; // χωρίς οπλισμό → δεν έχει νόημα έλεγχος ρ
    }
    const ratio = ratioFinding(e, provider);
    if (ratio) out.push(ratio);
  }
  out.push(...barMismatchFindings(graph, entities, provider));
  out.push(...topAnchorageFindings(graph, entities));
  return out;
}
