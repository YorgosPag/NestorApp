import type { Firestore } from 'firebase-admin/firestore';

import type { AuthContext } from '@/lib/auth';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';
import { EntityAuditService } from '@/services/entity-audit.service';
import type { AuditFieldChange } from '@/types/audit-trail';
import { isFloorKind, type FloorKind } from '@/utils/floor-naming';
import { cascadeFloorRefToHosted, type FloorRefCascadeResult } from './floor-ref-cascade.service';
import { reconcileFloorStackAfterEdit, reconcileSpecialLevelPlacement } from './floor-stack-reconcile.service';

const logger = createModuleLogger('FloorUpdateEffects');

/**
 * Οι συνέπειες μιας ενημέρωσης ορόφου — έξω από τον handler (N.7.1: μία ευθύνη ανά συνάρτηση).
 *
 * Ο όροφος ενημερώνεται **πρώτα** (με έλεγχο έκδοσης)· οι συνέπειες ακολουθούν, **awaited**
 * (N.7.2 #6 — η ορθότητα δεν είναι fire-and-forget), και μια αποτυχία τους γίνεται **προειδοποίηση**
 * στην απάντηση, όχι σιωπή: ο όροφος έχει ήδη αλλάξει.
 */

/** Τα πεδία που γράφει το PATCH — όσα το σχήμα δέχεται **και** ο handler τιμά. */
export const FLOOR_UPDATE_FIELDS = ['name', 'number', 'kind', 'elevation', 'height'] as const;
type FloorUpdateField = (typeof FLOOR_UPDATE_FIELDS)[number];

/** Σώμα → ενημερώσεις. Το `kind` γράφεται πλέον (ADR-903 §6): το σχήμα το δεχόταν και το πετούσε σιωπηλά. */
export function buildFloorUpdates(body: Partial<Record<FloorUpdateField, unknown>>): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  for (const field of FLOOR_UPDATE_FIELDS) {
    if (body[field] === undefined) continue;
    updates[field] = field === 'elevation' || field === 'height' ? body[field] ?? null : body[field];
  }
  return updates;
}

/** Η διαφορά πριν → μετά, για το ίχνος και για την απόφαση ποιες συνέπειες τρέχουν. */
export function floorUpdateChanges(
  updates: Readonly<Record<string, unknown>>,
  before: Readonly<Record<string, unknown>>,
): AuditFieldChange[] {
  return FLOOR_UPDATE_FIELDS
    .filter((field) => updates[field] !== undefined && updates[field] !== before[field])
    .map((field) => ({
      field,
      oldValue: (before[field] as AuditFieldChange['oldValue']) ?? null,
      newValue: updates[field] as AuditFieldChange['newValue'],
      label: field,
    }));
}

export interface FloorUpdateEffectsInput {
  readonly db: Firestore;
  readonly ctx: AuthContext;
  readonly floorId: string;
  readonly before: Readonly<Record<string, unknown>>;
  readonly updates: Readonly<Record<string, unknown>>;
  readonly changes: readonly AuditFieldChange[];
}

export interface FloorUpdateEffectsResult {
  readonly warnings: string[];
  readonly hostedCascade?: FloorRefCascadeResult;
}

/** Ίχνος → ανασύνταξη στοίβας → θέση ειδικών σταθμών → cascade φιλοξενούμενων. */
export async function runFloorUpdateEffects(input: FloorUpdateEffectsInput): Promise<FloorUpdateEffectsResult> {
  const { ctx, changes, before, floorId } = input;
  const buildingId = typeof before.buildingId === 'string' ? before.buildingId : null;
  if (changes.length === 0 || !ctx.companyId) return { warnings: [] };

  await EntityAuditService.recordChange({
    entityType: ENTITY_TYPES.FLOOR,
    entityId: floorId,
    entityName: (before.name as string) ?? floorId,
    action: 'updated',
    changes: [...changes],
    performedBy: ctx.uid,
    performedByName: null,
    companyId: ctx.companyId,
  });

  if (!buildingId) return { warnings: [] };
  const changed = (field: FloorUpdateField) => changes.some((c) => c.field === field);
  const warnings: string[] = [];
  await reconcileStack(input, buildingId, changed('elevation'), changed('height'), warnings);
  if (changed('kind')) await placeSpecialLevels(input, buildingId, warnings);
  const hostedCascade = changed('number') || changed('kind') || changed('name')
    ? await cascadeHosted(input, buildingId, warnings)
    : undefined;
  return { warnings, ...(hostedCascade ? { hostedCascade } : {}) };
}

/**
 * ADR-451 — server-authoritative ανασύνταξη στοίβας: `elevation` = SSoT, `height` = προβολή.
 * Υψόμετρο ⇒ ξαναπαράγονται τα δύο γειτονικά ύψη· ύψος ⇒ ADR-450 §1 ώθηση των πάνω ορόφων.
 */
async function reconcileStack(
  input: FloorUpdateEffectsInput,
  buildingId: string,
  elevationChanged: boolean,
  heightChanged: boolean,
  warnings: string[],
): Promise<void> {
  if (!elevationChanged && !heightChanged) return;
  try {
    await reconcileFloorStackAfterEdit(input.db, buildingId, input.floorId, input.ctx.companyId!, input.ctx.uid, {
      elevationChanged,
      heightChanged,
      newHeightMetres: typeof input.updates.height === 'number' ? input.updates.height : null,
    });
  } catch (err) {
    logger.error('[Floors/Update] Reconcile failed — floor updated, stack not reconciled', {
      floorId: input.floorId, error: getErrorMessage(err),
    });
    warnings.push('Floor updated but vertical-stack reconcile failed. Retry or manually adjust elevations/heights.');
  }
}

/** ADR-461 — αλλαγή είδους (π.χ. σε δώμα/θεμελίωση) ⇒ οι ειδικές στάθμες ξαναμπαίνουν στη θέση τους. */
async function placeSpecialLevels(input: FloorUpdateEffectsInput, buildingId: string, warnings: string[]): Promise<void> {
  try {
    await reconcileSpecialLevelPlacement(input.db, buildingId, input.ctx.companyId!, input.ctx.uid);
  } catch (err) {
    logger.warn('[Floors/Update] Special-level placement failed (floor updated)', {
      floorId: input.floorId, error: getErrorMessage(err),
    });
    warnings.push('Floor updated but special-level placement failed. Retry the edit.');
  }
}

/** ADR-903 §6 — «Home Story»: ό,τι φιλοξενεί ο όροφος ακολουθεί τον νέο αριθμό/είδος/όνομα. */
async function cascadeHosted(
  input: FloorUpdateEffectsInput,
  buildingId: string,
  warnings: string[],
): Promise<FloorRefCascadeResult | undefined> {
  const after = { ...input.before, ...input.updates };
  if (typeof after.number !== 'number') return undefined;
  const kind: FloorKind | undefined = isFloorKind(after.kind) ? after.kind : undefined;
  try {
    const result = await cascadeFloorRefToHosted(input.db, {
      id: input.floorId,
      number: after.number,
      kind,
      buildingId,
      name: typeof after.name === 'string' ? after.name : undefined,
    }, input.ctx.companyId!, input.ctx.uid);
    if (result.failed > 0) warnings.push(HOSTED_CASCADE_WARNING);
    return result;
  } catch (err) {
    logger.error('[Floors/Update] Hosted cascade failed — floor updated', { floorId: input.floorId, error: getErrorMessage(err) });
    warnings.push(HOSTED_CASCADE_WARNING);
    return undefined;
  }
}

const HOSTED_CASCADE_WARNING = 'Floor updated but some units/parking/storage were not re-synced. Retry the edit.';
