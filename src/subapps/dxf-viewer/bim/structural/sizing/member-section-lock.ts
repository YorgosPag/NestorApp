/**
 * member-section-lock — ΕΝΑ SSoT για την απόφαση «χειροκίνητη διατομή → lock»
 * (`autoSized:false`, user wins) ανά auto-sizable δομικό μέλος (κολώνα/δοκός/πλάκα).
 *
 * Dispatch-wrapper γύρω από τους per-kind resolvers (`resolveColumnSectionLock` /
 * `resolveBeamSectionLock` / `resolveSlabSectionLock`) + το resolve του ενεργού
 * κανονισμού + των per-member design context (ροπή/στήριξη/άνοιγμα/στρέψη/όρια). Ίδια
 * σημασιολογία (ADR-503): manual ≥ επαρκές → lock (`autoSized:false`)· < επαρκές →
 * bump στο ελάχιστο επαρκές + AUTO + `rejected`.
 *
 * WHY: κάθε **ρητή** αλλαγή διατομής από τον χρήστη (grip / ribbon / **Match/Transfer
 * Properties**, ADR-581 Φ6) πρέπει να «κλειδώνει» τη διατομή, αλλιώς ο δυναμικός
 * οργανισμός (`AutoSizeMembersCommand`) την ξαναϋπολογίζει από τα φορτία και την
 * επαναφέρει. Το grip/ribbon το έκαναν ήδη· εδώ ενοποιείται ώστε να το μοιράζεται
 * και η σύριγγα (ghost ≡ commit).
 *
 * @see ./column-size-patch — resolveColumnSectionLock (per-kind SSoT)
 * @see ./beam-size-patch — resolveBeamSectionLock
 * @see ./slab-size-patch — resolveSlabSectionLock
 * @see docs/centralized-systems/reference/adrs/ADR-503-manual-section-lock.md
 */

import type { Entity } from '../../../types/entities';
import type { ColumnEntity, ColumnParams } from '../../types/column-types';
import type { BeamEntity, BeamParams } from '../../types/beam-types';
import type { SlabEntity, SlabParams } from '../../types/slab-types';
import { resolveColumnSectionLock } from './column-size-patch';
import { resolveBeamSectionLock } from './beam-size-patch';
import { resolveSlabSectionLock } from './slab-size-patch';
import { resolveStructuralCode } from '../codes';
import { useStructuralSettingsStore } from '../../../state/structural-settings-store';
import {
  resolveActiveColumnDesignMoment,
  resolveActiveBeamSupportType,
  resolveActiveBeamTorsion,
  resolveActiveBeamSpanMm,
  resolveActiveBeamSizingLimits,
  resolveActiveSlabSupportCondition,
} from '../active-reinforcement';

/** Top-level params record (flat) — ο caller ξέρει τον συγκεκριμένο τύπο. */
type ParamsRecord = Record<string, unknown>;

export interface MemberSectionLockResult {
  /** Οι params που θα γραφτούν: locked (`autoSized:false`) αν επαρκής· αλλιώς bumped + AUTO. */
  readonly params: ParamsRecord;
  /** `true` ⇔ η διατομή απορρίφθηκε (υποδιαστασιολόγηση) → ο caller μπορεί να δείξει toast. */
  readonly rejected: boolean;
}

/**
 * Εφαρμόζει το safety-gated section lock για ένα auto-sizable μέλος. Επιστρέφει
 * `null` για μη-auto-sizable τύπους (raw DXF / opening / stair / …) — ο caller κρατά
 * τα `nextParams` ως έχουν.
 */
export function resolveMemberSectionLock(
  entity: Entity,
  nextParams: ParamsRecord,
): MemberSectionLockResult | null {
  const provider = resolveStructuralCode(useStructuralSettingsStore.getState().codeId);

  switch (entity.type) {
    case 'column': {
      const col = entity as unknown as ColumnEntity;
      const lock = resolveColumnSectionLock(
        provider, col.params, nextParams as unknown as ColumnParams,
        resolveActiveColumnDesignMoment(entity.id),
      );
      return { params: lock.params as unknown as ParamsRecord, rejected: lock.rejected };
    }
    case 'beam': {
      const beam = entity as unknown as BeamEntity;
      const lock = resolveBeamSectionLock(
        provider, beam, beam.params, nextParams as unknown as BeamParams,
        resolveActiveBeamSupportType(entity.id), resolveActiveBeamTorsion(entity.id),
        resolveActiveBeamSpanMm(entity.id), resolveActiveBeamSizingLimits(entity.id),
      );
      return { params: lock.params as unknown as ParamsRecord, rejected: lock.rejected };
    }
    case 'slab': {
      const slab = entity as unknown as SlabEntity;
      const lock = resolveSlabSectionLock(
        provider, slab, slab.params, nextParams as unknown as SlabParams,
        resolveActiveSlabSupportCondition(entity.id),
      );
      return { params: lock.params as unknown as ParamsRecord, rejected: lock.rejected };
    }
    default:
      return null;
  }
}

/**
 * Convenience finalize (ghost ≡ commit): επιστρέφει τα locked params, ή τα `nextParams`
 * αυτούσια για μη-auto-sizable τύπους. Το χρησιμοποιούν ΚΑΙ ο applier (commit) ΚΑΙ το
 * live hover ghost, ώστε προεπισκόπηση == τελικό αποτέλεσμα.
 */
export function applyMemberSectionLock(entity: Entity, nextParams: ParamsRecord): ParamsRecord {
  return resolveMemberSectionLock(entity, nextParams)?.params ?? nextParams;
}
