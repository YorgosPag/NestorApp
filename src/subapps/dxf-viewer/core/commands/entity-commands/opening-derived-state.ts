/**
 * @module core/commands/entity-commands/opening-derived-state
 * @description SSoT για το DERIVED state ενός `OpeningEntity` (`geometry` +
 * `validation`) όπως το ξαναϋπολογίζει κάθε opening-writing command.
 *
 * Ένα κούφωμα φιλοξενείται από ΑΚΡΙΒΩΣ ΕΝΑ από τα δύο (ADR-615):
 *   - έναν BIM τοίχο (`params.wallId`) → host = το `WallEntity` από τη σκηνή, ή
 *   - έναν συνθετικό free-standing host (`params.selfHost`) → host =
 *     `selfOpeningHost()`, όταν το κούφωμα κάθεται πάνω σε imported DXF γραμμές.
 *
 * Και οι δύο κλάδοι τροφοδοτούν την ΙΔΙΑ downstream geometry engine· εδώ ζει η
 * επιλογή κλάδου ΜΙΑ φορά, ώστε ένας νέος writer να μην μπορεί να «ξεχάσει» τον
 * self-hosted κλάδο. Αυτό ακριβώς είχε συμβεί: ο `UpdateOpeningParamsCommand`
 * ενημερώθηκε για το ADR-615 ενώ ο δίδυμός του `AssignOpeningTypeCommand` έμεινε
 * πίσω με αντιγραμμένο `resolveHostWall()` — ένα family-type assign σε
 * self-hosted κούφωμα άφηνε stale geometry.
 *
 * Soft-orphan policy (ADR-363 §5.4): wall-hosted κούφωμα του οποίου ο host
 * λείπει τη στιγμή του execute → `geometry` παραλείπεται (ο caller κρατά την
 * προηγούμενη) και τρέχει ΜΟΝΟ intrinsic validation.
 *
 * @see bim/geometry/opening-host.ts — host-abstraction SSoT (ADR-615 §Decision 1)
 * @see bim/validators/opening-validator.ts — validation SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-615-free-standing-self-hosted-opening.md
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.4
 */

import type { ISceneManager, SceneEntity } from '../interfaces';
import type { BimValidation } from '../../../bim/types/bim-base';
import type { OpeningGeometry, OpeningParams } from '../../../bim/types/opening-types';
import { isSelfHostedOpening } from '../../../bim/types/opening-types';
import type { WallEntity } from '../../../bim/types/wall-types';
import { computeOpeningGeometry } from '../../../bim/geometry/opening-geometry';
import { selfOpeningHost } from '../../../bim/geometry/opening-host';
import { validateOpeningParams } from '../../../bim/validators/opening-validator';
import { inferOpeningIfcType } from '@/services/factories/opening.factory';
import type { SceneUnits } from '../../../utils/scene-units';

/**
 * Ανακτά τον host τοίχο ενός wall-hosted κουφώματος από τη σκηνή.
 *
 * `wallId` απών ⇒ `null`: ADR-615 self-hosted κούφωμα δεν ΕΧΕΙ host τοίχο — δεν
 * πρόκειται για σφάλμα. `null` επίσης όταν ο τοίχος έχει διαγραφεί ή δεν έχει
 * ακόμη υπολογισμένο `geometry` (soft-orphan, ADR-363 §5.4).
 */
export function resolveOpeningHostWall(
  sceneManager: ISceneManager,
  wallId: string | undefined,
): WallEntity | null {
  if (!wallId) return null;
  const raw = sceneManager.getEntity(wallId);
  if (!raw) return null;
  const candidate = raw as unknown as Partial<WallEntity>;
  if (candidate.type !== 'wall' || !candidate.params || !candidate.geometry) return null;
  return candidate as WallEntity;
}

/** Το DERIVED state ενός κουφώματος. `geometry` απούσα ⇒ ο caller κρατά την προηγούμενη. */
export interface OpeningDerivedState {
  readonly geometry?: OpeningGeometry;
  readonly validation: BimValidation;
}

/**
 * Ξαναϋπολογίζει `geometry` + `validation` για τα `params`, επιλέγοντας μόνη της
 * τον σωστό host (self-hosted vs wall-hosted vs soft-orphan).
 *
 * @param sceneUnits ο mm↔scene συντελεστής της σκηνής· χρειάζεται ΜΟΝΟ στον
 *   self-hosted κλάδο (δεν υπάρχει τοίχος να τον διαβάσουμε από πάνω του). Στον
 *   wall-hosted κλάδο υπερισχύει το `host.params.sceneUnits`.
 */
export function computeOpeningDerivedState(
  params: OpeningParams,
  sceneManager: ISceneManager,
  sceneUnits: SceneUnits = 'mm',
): OpeningDerivedState {
  if (isSelfHostedOpening(params)) {
    // ADR-615 §Decision 1 — recompute από τον συνθετικό host με την ΙΔΙΑ engine
    // που χρησιμοποιεί η δημιουργία/hydration· αλλιώς τα params αλλάζουν αλλά η
    // geometry μένει stale → το σύμβολο δεν μετακινείται ποτέ ορατά.
    const host = selfOpeningHost(params, sceneUnits);
    return {
      geometry: computeOpeningGeometry(params, host, sceneUnits),
      validation: validateOpeningParams(params, null).bimValidation,
    };
  }

  const host = resolveOpeningHostWall(sceneManager, params.wallId);
  if (!host) {
    // Soft-orphan (ADR-363 §5.4) — intrinsic validation μόνο, καμία geometry.
    return { validation: validateOpeningParams(params, null).bimValidation };
  }
  return {
    geometry: computeOpeningGeometry(params, host, host.params.sceneUnits ?? 'mm'),
    validation: validateOpeningParams(params, host).bimValidation,
  };
}

/**
 * Γράφει το κοινό «tail» κάθε opening writer πάνω στη σκηνή: χτίζει το patch με
 * τους DERIVED discriminators (`kind`/`ifcType`), ξαναϋπολογίζει geometry +
 * validation μέσω `computeOpeningDerivedState`, και καλεί `updateEntity` — ΜΙΑ
 * φορά, ώστε ο `UpdateOpeningParamsCommand` και ο δίδυμός του
 * `AssignOpeningTypeCommand` να μη διατηρούν αντιγραμμένα twins (ADR-583/N.18).
 *
 * Ό,τι είναι ειδικό ανά command (π.χ. ο Assign προσθέτει `typeId`/`typeOverrides`)
 * περνά μέσω `extraPatch`· τα `params`/`kind`/`ifcType`/`geometry`/`validation`
 * είναι πάντα SSoT εδώ.
 */
export function applyOpeningDerivedPatch(
  sceneManager: ISceneManager,
  entityId: string,
  params: OpeningParams,
  sceneUnits: SceneUnits,
  extraPatch: Record<string, unknown> = {},
): void {
  const patch: Record<string, unknown> = {
    ...extraPatch,
    params,
    // `kind`/`ifcType` κρατιούνται σε lock-step με το `params.kind` (renderer/IFC routing).
    kind: params.kind,
    ifcType: inferOpeningIfcType(params.kind),
  };
  const derived = computeOpeningDerivedState(params, sceneManager, sceneUnits);
  if (derived.geometry) patch.geometry = derived.geometry;
  patch.validation = derived.validation;
  sceneManager.updateEntity(entityId, patch as Partial<SceneEntity>);
}

/**
 * Ο host-guard που κάθε opening command οφείλει να τρέχει στο `validate()`.
 *
 * ADR-615: ένα κούφωμα χρειάζεται ΕΝΑΝ host — `wallId` Ή `selfHost`. Το
 * ανεπιφύλακτο «`wallId` is required» απέρριπτε σιωπηλά κάθε self-hosted commit.
 *
 * @returns μήνυμα σφάλματος, ή `null` όταν ο host είναι αποδεκτός.
 */
export function validateOpeningHostRef(params: OpeningParams): string | null {
  if (!params.wallId && !params.selfHost) {
    return 'Opening requires a host (params.wallId or params.selfHost)';
  }
  return null;
}
