import type { Firestore } from 'firebase-admin/firestore';

import type { AuthContext } from '@/lib/auth';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';
import { isFloorKind, type FloorKind } from '@/utils/floor-naming';
import { buildFloorCascadeActor, type FloorCascadeActor } from './_shared/floor-cascade-audit';
import { cascadeFloorRefToHosted, type FloorRefCascadeResult } from './floor-ref-cascade.service';
import { reconcileFloorStackAfterEdit, reconcileSpecialLevelPlacement } from './floor-stack-reconcile.service';

const logger = createModuleLogger('FloorUpdateEffects');

/**
 * Οι συνέπειες μιας ενημέρωσης ορόφου — έξω από τον handler (N.7.1: μία ευθύνη ανά συνάρτηση).
 *
 * Ο όροφος ενημερώνεται **πρώτα** (με έλεγχο έκδοσης)· οι συνέπειες ακολουθούν, **awaited**
 * (N.7.2 #6 — η ορθότητα δεν είναι fire-and-forget), και μια αποτυχία τους γίνεται **προειδοποίηση**
 * στην απάντηση, όχι σιωπή: ο όροφος έχει ήδη αλλάξει.
 *
 * 🔑 **Το ιστορικό ΔΕΝ γράφεται εδώ** (ADR-195, 2026-10-05). Η γραμμή του ανθρώπου γράφεται στον handler,
 * δίπλα στη γραφή (`recordEntityUpdate`)· εδώ φτάνει μόνο το `auditId` της, για να γίνει η **αιτία** κάθε
 * παράγωγης γραμμής. Και το «ποιες συνέπειες τρέχουν» **δεν** ρωτά το μητρώο ιστορικού: αν κάποιος πάψει να
 * παρακολουθεί το `height`, η στοίβα δεν πρέπει να πάψει να ανασυντάσσεται.
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

/** Ποια πεδία άλλαξαν **όντως** απέναντι στο αποθηκευμένο έγγραφο — η απόφαση ποιες συνέπειες τρέχουν. */
function changedFloorFields(
  updates: Readonly<Record<string, unknown>>,
  before: Readonly<Record<string, unknown>>,
): ReadonlySet<FloorUpdateField> {
  return new Set(
    FLOOR_UPDATE_FIELDS.filter((field) => updates[field] !== undefined && updates[field] !== before[field]),
  );
}

export interface FloorUpdateEffectsInput {
  readonly db: Firestore;
  readonly ctx: AuthContext;
  readonly floorId: string;
  readonly before: Readonly<Record<string, unknown>>;
  readonly updates: Readonly<Record<string, unknown>>;
  /** Η γραμμή ιστορικού της ανθρώπινης αλλαγής — η αιτία των παράγωγων. `null` ⇒ δεν γράφτηκε γραμμή. */
  readonly auditId: string | null;
}

export interface FloorUpdateEffectsResult {
  readonly warnings: string[];
  readonly hostedCascade?: FloorRefCascadeResult;
}

/** Ό,τι μοιράζονται οι τρεις συνέπειες: ο όροφος, το κτίριό του, ο μισθωτής του και ο δράστης. */
interface EffectsRun {
  readonly input: FloorUpdateEffectsInput;
  readonly buildingId: string;
  /** Ο μισθωτής **του ορόφου**, όχι του καλούντος: ο super admin δουλεύει στον ενοικιαστή του εγγράφου. */
  readonly companyId: string;
  readonly actor: FloorCascadeActor;
  readonly warnings: string[];
}

function textOf(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

/** Ανασύνταξη στοίβας → θέση ειδικών σταθμών → cascade φιλοξενούμενων. */
export async function runFloorUpdateEffects(input: FloorUpdateEffectsInput): Promise<FloorUpdateEffectsResult> {
  const { ctx, before, updates, floorId } = input;
  const changed = changedFloorFields(updates, before);
  const buildingId = textOf(before.buildingId);
  const companyId = textOf(before.companyId) ?? ctx.companyId;
  if (changed.size === 0 || !buildingId || !companyId) return { warnings: [] };

  const actor = await buildFloorCascadeActor({
    ctx,
    entityType: ENTITY_TYPES.FLOOR,
    entityId: floorId,
    entityName: textOf(updates.name) ?? textOf(before.name),
    auditId: input.auditId,
  });
  const run: EffectsRun = { input, buildingId, companyId, actor, warnings: [] };

  await reconcileStack(run, changed.has('elevation'), changed.has('height'));
  if (changed.has('kind')) await placeSpecialLevels(run);
  const hostedCascade = changed.has('number') || changed.has('kind') || changed.has('name')
    ? await cascadeHosted(run)
    : undefined;
  return { warnings: run.warnings, ...(hostedCascade ? { hostedCascade } : {}) };
}

/**
 * ADR-451 — server-authoritative ανασύνταξη στοίβας: `elevation` = SSoT, `height` = προβολή.
 * Υψόμετρο ⇒ ξαναπαράγονται τα δύο γειτονικά ύψη· ύψος ⇒ ADR-450 §1 ώθηση των πάνω ορόφων.
 */
async function reconcileStack(run: EffectsRun, elevationChanged: boolean, heightChanged: boolean): Promise<void> {
  if (!elevationChanged && !heightChanged) return;
  const { input, buildingId, companyId, actor, warnings } = run;
  try {
    await reconcileFloorStackAfterEdit(input.db, buildingId, input.floorId, companyId, actor, {
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
async function placeSpecialLevels(run: EffectsRun): Promise<void> {
  const { input, buildingId, companyId, actor, warnings } = run;
  try {
    await reconcileSpecialLevelPlacement(input.db, buildingId, companyId, actor);
  } catch (err) {
    logger.warn('[Floors/Update] Special-level placement failed (floor updated)', {
      floorId: input.floorId, error: getErrorMessage(err),
    });
    warnings.push('Floor updated but special-level placement failed. Retry the edit.');
  }
}

/** ADR-903 §6 — «Home Story»: ό,τι φιλοξενεί ο όροφος ακολουθεί τον νέο αριθμό/είδος/όνομα. */
async function cascadeHosted(run: EffectsRun): Promise<FloorRefCascadeResult | undefined> {
  const { input, buildingId, companyId, actor, warnings } = run;
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
    }, companyId, actor);
    if (result.failed > 0) warnings.push(HOSTED_CASCADE_WARNING);
    return result;
  } catch (err) {
    logger.error('[Floors/Update] Hosted cascade failed — floor updated', { floorId: input.floorId, error: getErrorMessage(err) });
    warnings.push(HOSTED_CASCADE_WARNING);
    return undefined;
  }
}

const HOSTED_CASCADE_WARNING = 'Floor updated but some units/parking/storage were not re-synced. Retry the edit.';
